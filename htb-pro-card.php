<?php
/**
 * Plugin Name: HTB Pro Card
 * Description: Display a Hack The Box profile card (labs API or local JSON relay). Shortcode + Gutenberg blocks + settings.
 * Version: 0.0.1
 */

if (!defined('ABSPATH')) exit;

/* -----------------------------
   Options helpers  
------------------------------*/
const HTBP_OPTIONS_KEY = 'htbp_options';

function htbp_default_options() {
  return [
    'id'       => '',
    'ttl'      => 43200,
    'badge'    => 1,
    'json_url' => '',
  ];
}
function htbp_get_options() {
  $saved = get_option(HTBP_OPTIONS_KEY, []);
  return wp_parse_args($saved, htbp_default_options());
}

/** Resolve user id from attrs or global settings; accept full profile URL */
function htbp_resolve_id($maybe_id = '') {
  $id = trim((string)$maybe_id);
  if ($id === '') $id = (string) htbp_get_options()['id'];
  if ($id && preg_match('~^https?://[^/]+/profile/(\d+)~i', $id, $m)) $id = $m[1];
  return $id !== '' ? $id : '';
}

/** small error box */
function htbp_error_box($msg) {
  return '<div class="htb-card" style="padding:10px;border-radius:8px;background:#101815;color:#f66;border:1px solid #3a1212;">'
       . esc_html($msg) . '</div>';
}

/* -----------------------------
   Fetchers + cache
------------------------------*/
function htbp_transient_key($user_id){ return 'htb_v4_'.$user_id; }

function htbp_fetch_labs_api($user_id, $timeout = 15) {
  if (!$user_id) return new WP_Error('htb_no_id','No user id.');
  $token = defined('HTB_API_TOKEN') ? HTB_API_TOKEN : '';
  if (!$token) return new WP_Error('htb_no_token','Define HTB_API_TOKEN in wp-config.php to use labs API.');

  $url = "https://labs.hackthebox.com/api/v4/user/profile/basic/{$user_id}";
  $resp = wp_remote_get($url, [
    'timeout' => $timeout,
    'headers' => [
      'Authorization' => 'Bearer '.$token,
      'Accept'        => 'application/json',
      'User-Agent'    => 'WP-HTB-ProCard/1.0',
    ],
  ]);
  if (is_wp_error($resp)) return $resp;
  $code = wp_remote_retrieve_response_code($resp);
  $body = wp_remote_retrieve_body($resp);
  if ($code !== 200 || !$body) return new WP_Error('htb_http', 'HTTP '.$code);

  $json = json_decode($body, true);
  if (!is_array($json)) return new WP_Error('htb_json', 'Invalid JSON');

  $p = $json['profile'] ?? $json;
  return [
    'name'      => $p['name'] ?? $p['username'] ?? 'HTB User',
    'avatar'    => $p['avatar'] ?? '',
    'rank'      => $p['rank'] ?? '—',
    'points'    => $p['points'] ?? '—',
    'user_owns' => isset($p['user_owns'])   ? (int)$p['user_owns']   : 0,
    'root_owns' => isset($p['system_owns']) ? (int)$p['system_owns'] : 0,
    'next_rank' => $p['next_rank'] ?? '',
    'progress'  => isset($p['current_rank_progress']) ? (int)$p['current_rank_progress'] : null,
    'country'   => $p['country'] ?? $p['country_name'] ?? '',
    'team'      => $p['team'] ?? $p['team_name'] ?? '',
  ];
}

function htbp_fetch_json_url($json_url, $timeout = 10) {
  $resp = wp_remote_get($json_url, ['timeout'=>$timeout,'headers'=>['Accept'=>'application/json']]);
  if (is_wp_error($resp)) return $resp;
  $body = wp_remote_retrieve_body($resp);
  $json = json_decode($body, true);
  if (!is_array($json)) return new WP_Error('htb_json', 'Invalid JSON at '.$json_url);
  return $json;
}

function htbp_get_profile($id, $ttl, $json_url='') {
  if ($json_url) return htbp_fetch_json_url($json_url);
  $key = htbp_transient_key($id);
  $cached = get_transient($key);
  if ($cached) return $cached;
  $data = htbp_fetch_labs_api($id);
  if (!is_wp_error($data)) set_transient($key, $data, max(60,(int)$ttl));
  return $data;
}
function htbp_clear_cache($id) { if ($id) delete_transient(htbp_transient_key($id)); }

/* -----------------------------
   Renderer + shortcode
------------------------------*/
function htbp_render_card($data, $show_badge, $id) {
  if (is_wp_error($data)) return htbp_error_box($data->get_error_message());
  $profile_url = 'https://app.hackthebox.com/profile/'.rawurlencode($id);
  $badge_url   = 'https://www.hackthebox.com/badge/image/'.rawurlencode($id);

  ob_start(); ?>
  <div class="htb-card" style="display:flex;align-items:center;gap:16px;background:#0e1714;border:1px solid #123; border-radius:12px; padding:16px; color:#cde5db;">
    <div style="flex:1 1 auto; min-width:0;">
      <div style="font-weight:700; font-size:18px; line-height:1.2; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
        <?php echo esc_html($data['name'] ?? 'HTB User'); ?>
      </div>
      <div style="margin-top:6px; display:flex; flex-wrap:wrap; gap:8px; font-size:12px;">
        <span style="background:#0f2a22;padding:4px 8px;border-radius:999px;border:1px solid #1f3a32;">Rank: <?php echo esc_html($data['rank'] ?? '—'); ?></span>
        <span style="background:#0f2a22;padding:4px 8px;border-radius:999px;border:1px solid #1f3a32;">Points: <?php echo esc_html($data['points'] ?? '—'); ?></span>
        <span style="background:#0f2a22;padding:4px 8px;border-radius:999px;border:1px solid #1f3a32;">Owns: <?php echo (int)($data['user_owns'] ?? 0); ?> user • <?php echo (int)($data['root_owns'] ?? 0); ?> root</span>
        <?php if (!empty($data['next_rank'])): ?>
          <span style="background:#0f2a22;padding:4px 8px;border-radius:999px;border:1px solid #1f3a32;">Next: <?php echo esc_html($data['next_rank']); ?></span>
        <?php endif; ?>
        <?php if (isset($data['progress'])): ?>
          <span style="background:#0f2a22;padding:4px 8px;border-radius:999px;border:1px solid #1f3a32;">Progress: <?php echo (int)$data['progress']; ?>%</span>
        <?php endif; ?>
      </div>
      <div style="margin-top:10px;">
        <a href="<?php echo esc_url($profile_url); ?>" target="_blank" rel="noopener" style="display:inline-block;background:#115a46;border:1px solid #1f7a62;color:#eafff6;text-decoration:none;padding:6px 10px;border-radius:8px;">View Profile</a>
      </div>
    </div>
    <?php if ($show_badge): ?>
      <div style="flex:0 0 auto;">
        <img src="<?php echo esc_url($badge_url); ?>" alt="HTB badge" style="display:block;max-height:64px;border-radius:8px;">
      </div>
    <?php endif; ?>
  </div>
  <?php
  return ob_get_clean();
}

// Extended renderer used by the block with display toggles
function htbp_render_card_ex($data, $show_badge, $id, $opts = [], $wrapper_attrs = '') {
  if (is_wp_error($data)) return htbp_error_box($data->get_error_message());
  $profile_url = 'https://app.hackthebox.com/profile/'.rawurlencode($id);
  $badge_url   = 'https://www.hackthebox.com/badge/image/'.rawurlencode($id);

  $showRank     = array_key_exists('showRank', $opts) ? (bool)$opts['showRank'] : true;
  $showPoints   = array_key_exists('showPoints', $opts) ? (bool)$opts['showPoints'] : true;
  $showOwns     = array_key_exists('showOwns', $opts) ? (bool)$opts['showOwns'] : true;
  $showNext     = array_key_exists('showNext', $opts) ? (bool)$opts['showNext'] : true;
  $showProgress = array_key_exists('showProgress', $opts) ? (bool)$opts['showProgress'] : true;
  $showCTA      = array_key_exists('showCTA', $opts) ? (bool)$opts['showCTA'] : true;
  $ctaLabel     = isset($opts['ctaLabel']) ? (string)$opts['ctaLabel'] : 'View Profile';
  $ctaUrl       = isset($opts['ctaUrl']) && $opts['ctaUrl'] !== '' ? (string)$opts['ctaUrl'] : $profile_url;
  $showAvatar   = !empty($opts['showAvatar']);
  $avatarRound  = array_key_exists('avatarRounded', $opts) ? (bool)$opts['avatarRounded'] : true;

  $name    = $data['name'] ?? 'HTB User';
  $rank    = $data['rank'] ?? '?';
  $points  = $data['points'] ?? '?';
  $uowns   = isset($data['user_owns']) ? (int)$data['user_owns'] : 0;
  $rowns   = isset($data['root_owns']) ? (int)$data['root_owns'] : 0;
  $nextr   = $data['next_rank'] ?? '';
  $prog    = isset($data['progress']) ? (int)$data['progress'] : null;
  $avatar  = $data['avatar'] ?? '';

  ob_start(); ?>
  <?php if ($wrapper_attrs) { ?>
    <div <?php echo $wrapper_attrs; ?>>
  <?php } else { ?>
    <div class="htb-card" style="display:flex;align-items:center;gap:16px;background:#0e1714;border:1px solid #123;border-radius:12px;padding:16px;color:#cde5db;">
  <?php } ?>
    <?php if ($showAvatar && $avatar): ?>
      <div style="flex:0 0 auto;line-height:0;">
        <img src="<?php echo esc_url($avatar); ?>" alt="<?php echo esc_attr('HTB avatar for '.$name); ?>" style="display:block;height:64px;width:64px;object-fit:cover;border-radius:<?php echo $avatarRound ? '50%' : '8px'; ?>;border:1px solid #17342b;" />
      </div>
    <?php endif; ?>
    <div class="htb-main">
      <div class="htb-name"><?php echo esc_html($name); ?></div>
      <div class="htb-chips">
        <?php if ($showRank): ?>
          <span class="htb-chip">Rank: <?php echo esc_html($rank); ?></span>
        <?php endif; ?>
        <?php if ($showPoints): ?>
          <span class="htb-chip">Points: <?php echo esc_html($points); ?></span>
        <?php endif; ?>
        <?php if ($showOwns): ?>
          <span class="htb-chip">Owns: <?php echo (int)$uowns; ?> user • <?php echo (int)$rowns; ?> root</span>
        <?php endif; ?>
        <?php if ($showNext && $nextr !== ''): ?>
          <span class="htb-chip">Next: <?php echo esc_html($nextr); ?></span>
        <?php endif; ?>
        <?php if ($showProgress && $prog !== null): ?>
          <span class="htb-chip">Progress: <?php echo (int)$prog; ?>%</span>
        <?php endif; ?>
      </div>
      <?php if ($showCTA): ?>
        <div class="htb-cta">
          <a href="<?php echo esc_url($ctaUrl); ?>" target="_blank" rel="noopener" aria-label="<?php echo esc_attr('View HTB profile of '.$name); ?>"><?php echo esc_html($ctaLabel); ?></a>
        </div>
      <?php endif; ?>
    </div>
    <?php if ($show_badge): ?>
      <div style="flex:0 0 auto;">
        <img src="<?php echo esc_url($badge_url); ?>" alt="HTB badge" style="display:block;max-height:64px;border-radius:8px;">
      </div>
    <?php endif; ?>
  </div>
  <?php
  return ob_get_clean();
}

// Parse truthy shortcode values like 1|true|yes|on
function htbp_trueish($v){
  if (is_bool($v)) return $v;
  $v = strtolower(trim((string)$v));
  return in_array($v, ['1','true','yes','on'], true);
}

function htb_pro_card_shortcode($atts){
  $g = htbp_get_options();
  $a = shortcode_atts([
    'id'       => '',
    'ttl'      => '',
    'badge'    => '',
    'json_url' => '',
  ], $atts, 'htb_pro_card');

  $id       = htbp_resolve_id(($a['id'] !== '') ? $a['id'] : '');
  $ttl      = ($a['ttl'] !== '') ? (int)$a['ttl'] : (int)$g['ttl'];
  $badge    = ($a['badge'] !== '') ? (bool)$a['badge'] : (bool)$g['badge'];
  $json_url = ($a['json_url'] !== '') ? $a['json_url'] : $g['json_url'];

  if ($id === '' && $json_url === '') {
    return htbp_error_box('HTB: missing user id (or JSON URL). Set a global ID in Settings → HTB Pro Card, or fill the block/shortcode attributes.');
  }
  $data = htbp_get_profile($id, $ttl, $json_url);
  $opts = [
    'showAvatar'    => ($a['show_avatar']    !== '') ? htbp_trueish($a['show_avatar'])    : false,
    'avatarRounded' => ($a['avatar_rounded'] !== '') ? htbp_trueish($a['avatar_rounded']) : true,
    'showRank'      => ($a['show_rank']      !== '') ? htbp_trueish($a['show_rank'])      : true,
    'showPoints'    => ($a['show_points']    !== '') ? htbp_trueish($a['show_points'])    : true,
    'showOwns'      => ($a['show_owns']      !== '') ? htbp_trueish($a['show_owns'])      : true,
    'showNext'      => ($a['show_next']      !== '') ? htbp_trueish($a['show_next'])      : true,
    'showProgress'  => ($a['show_progress']  !== '') ? htbp_trueish($a['show_progress'])  : true,
    'showCTA'       => ($a['show_cta']       !== '') ? htbp_trueish($a['show_cta'])       : true,
    'ctaLabel'      => ($a['cta_label']      !== '') ? sanitize_text_field($a['cta_label']) : 'View Profile',
    'ctaUrl'        => ($a['cta_url']        !== '') ? esc_url_raw($a['cta_url']) : '',
  ];
  return htbp_render_card_ex($data, $badge, $id ?: '0', $opts);
}
add_shortcode('htb_pro_card','htb_pro_card_shortcode');

/* -----------------------------
   Gutenberg blocks (server-rendered)
------------------------------*/
add_action('init', function () {
  $deps = [
    'wp-blocks',
    'wp-element',
    'wp-components',
    'wp-block-editor',
    'wp-i18n',
    'wp-server-side-render', // <-- required for live previews in editor
  ];
  $ver  = file_exists(__DIR__.'/block.js') ? filemtime(__DIR__.'/block.js') : '1.0';
  wp_register_script('htb-pro-card-blocks', plugins_url('block.js', __FILE__), $deps, $ver, true);

  // Styles for pro-card variations
  $css_ver = file_exists(__DIR__.'/style.css') ? filemtime(__DIR__.'/style.css') : $ver;
  wp_register_style('htb-pro-card-style', plugins_url('style.css', __FILE__), [], $css_ver);


  // helper wrapper
  $wrap = function($html, $class=''){ $class = $class ? ' class="'.esc_attr($class).'"' : ''; return '<div'.$class.'>'.$html.'</div>'; };

  // 1) Full profile card
  register_block_type('htb/pro-card', [
    'api_version'     => 2,
    'editor_script'   => 'htb-pro-card-blocks',
    'style'           => 'htb-pro-card-style',
    'editor_style'    => 'htb-pro-card-style',
    'supports'        => [ 'html' => false, 'align' => [ 'wide', 'full' ], 'spacing' => [ 'margin' => true, 'padding' => true ], 'anchor' => true ],
    'render_callback' => function ($attrs) {
      $g = htbp_get_options();
      $id       = htbp_resolve_id($attrs['id'] ?? '');
      $ttl      = isset($attrs['ttl']) ? (int)$attrs['ttl'] : (int)$g['ttl'];
      $badge    = array_key_exists('badge',$attrs) ? (bool)$attrs['badge'] : (bool)$g['badge'];
      $json_url = $attrs['json_url'] ?? $g['json_url'];

      if ($id === '' && $json_url === '') return htbp_error_box('HTB: missing user id or JSON URL. Set a global ID in Settings → HTB Pro Card, or fill the block settings.');
      // Allow editor to force-refresh cache by toggling a dummy attribute
      if (!empty($attrs['refresh'])) {
        $data = $json_url ? htbp_fetch_json_url($json_url) : htbp_fetch_labs_api($id);
        if (!is_wp_error($data)) set_transient(htbp_transient_key($id), $data, max(60,(int)$ttl));
      } else {
        $data = htbp_get_profile($id, $ttl, $json_url);
      }
      $opts = [
        'showRank'      => array_key_exists('showRank', $attrs) ? (bool)$attrs['showRank'] : true,
        'showPoints'    => array_key_exists('showPoints', $attrs) ? (bool)$attrs['showPoints'] : true,
        'showOwns'      => array_key_exists('showOwns', $attrs) ? (bool)$attrs['showOwns'] : true,
        'showNext'      => array_key_exists('showNext', $attrs) ? (bool)$attrs['showNext'] : true,
        'showProgress'  => array_key_exists('showProgress', $attrs) ? (bool)$attrs['showProgress'] : true,
        'showCTA'       => array_key_exists('showCTA', $attrs) ? (bool)$attrs['showCTA'] : true,
        'ctaLabel'      => $attrs['ctaLabel'] ?? 'View Profile',
        'ctaUrl'        => $attrs['ctaUrl'] ?? '',
        'showAvatar'    => !empty($attrs['showAvatar']),
        'avatarRounded' => array_key_exists('avatarRounded', $attrs) ? (bool)$attrs['avatarRounded'] : true,
        'className'     => $attrs['className'] ?? '',
      ];
      // Build CSS variables for theming
      $vars = [];
      foreach ([
        'chipBg' => '--htb-chip-bg', 'chipFg' => '--htb-chip-fg', 'chipBorder' => '--htb-chip-border',
        'ctaBg'  => '--htb-cta-bg',  'ctaFg'  => '--htb-cta-fg',  'ctaBorder'  => '--htb-cta-border',
        'border' => '--htb-border',
      ] as $key => $prop) {
        if (!empty($attrs[$key])) $vars[$prop] = $attrs[$key];
      }
      foreach ([ 'gap' => '--htb-gap', 'padding' => '--htb-padding', 'radius' => '--htb-radius' ] as $key => $prop) {
        if (isset($attrs[$key]) && $attrs[$key] !== '') $vars[$prop] = intval($attrs[$key]).'px';
      }
      $style_string = '';
      foreach ($vars as $k=>$v) { $style_string .= $k.':'.$v.';'; }

      $wrapper_attrs = function_exists('get_block_wrapper_attributes')
        ? get_block_wrapper_attributes(['class' => 'wp-block-htb-pro-card htb-card', 'style' => $style_string])
        : 'class="htb-card" style="'.$style_string.'"';
      return htbp_render_card_ex($data, $badge, $id ?: '0', $opts, $wrapper_attrs);
    },
    'attributes' => [
      'id'       => ['type'=>'string','default'=>''],
      'ttl'      => ['type'=>'number','default'=>43200],
      'badge'    => ['type'=>'boolean','default'=>true],
      
      'preset'    => ['type'=>'string','default'=>''],
      'refresh'  => ['type'=>'number','default'=>0],
      'preset'   => ['type'=>'string','default'=>''],
      // theme variables
      'chipBg'     => ['type'=>'string','default'=>''],
      'chipFg'     => ['type'=>'string','default'=>''],
      'chipBorder' => ['type'=>'string','default'=>''],
      'ctaBg'      => ['type'=>'string','default'=>''],
      'ctaFg'      => ['type'=>'string','default'=>''],
      'ctaBorder'  => ['type'=>'string','default'=>''],
      'border'     => ['type'=>'string','default'=>''],
      'gap'        => ['type'=>'number','default'=>null],
      'padding'    => ['type'=>'number','default'=>null],
      'radius'     => ['type'=>'number','default'=>null],
      'showRank'      => ['type'=>'boolean','default'=>true],
      'showPoints'    => ['type'=>'boolean','default'=>true],
      'showOwns'      => ['type'=>'boolean','default'=>true],
      'showNext'      => ['type'=>'boolean','default'=>true],
      'showProgress'  => ['type'=>'boolean','default'=>true],
      'showCTA'       => ['type'=>'boolean','default'=>true],
      'ctaLabel'      => ['type'=>'string','default'=>'View Profile'],
      'ctaUrl'        => ['type'=>'string','default'=>''],
      'showAvatar'    => ['type'=>'boolean','default'=>false],
      'avatarRounded' => ['type'=>'boolean','default'=>true],
      'className'=> ['type'=>'string','default'=>'']
    ],
    'title'       => 'HTB: Profile Card',
    'category'    => 'htbpc',
    'icon'        => 'shield',
    'supports'    => [
      'html'      => false,
      'align'     => [ 'wide', 'full' ],
      'color'     => [ 'text' => true, 'background' => true, 'link' => true ],
      'spacing'   => [ 'margin' => true, 'padding' => true ],
      'border'    => [ 'radius' => true, 'color' => true, 'width' => true ],
    ],
  ]);

  // 2) Badge
  register_block_type('htb/badge', [
    'api_version'   => 2,
    'editor_script' => 'htb-pro-card-blocks',
    'render_callback' => function ($attrs) use ($wrap) {
      $id    = htbp_resolve_id($attrs['id'] ?? '');
      $size  = max(24, (int)($attrs['size'] ?? 64));
      $round = !empty($attrs['rounded']);
      if ($id === '') return htbp_error_box('HTB: missing user id. Set a global ID in Settings → HTB Pro Card, or fill the block settings.');
      $src   = 'https://www.hackthebox.com/badge/image/'.rawurlencode($id);
      $style = 'max-height:'.$size.'px;'.($round ? 'border-radius:8px;' : '');
      $html  = '<img src="'.esc_url($src).'" alt="HTB badge" style="'.esc_attr($style).'">';
      return $wrap($html, $attrs['className'] ?? '');
    },
    'attributes' => [
      'id'        => ['type'=>'string','default'=>''],
      'size'      => ['type'=>'number','default'=>64],
      'rounded'   => ['type'=>'boolean','default'=>true],
      'className' => ['type'=>'string','default'=>'']
    ],
    'title'    => 'HTB: Badge',
    'category' => 'htbpc',
    'icon'     => 'format-image',
    'supports' => [ 'html'=>false, 'align' => [ 'wide', 'full' ], 'spacing' => [ 'margin'=>true, 'padding'=>true ] ],
  ]);

  // 3) Rank chip
    // 3) Rank chip
  register_block_type('htb/rank-chip', [
    'api_version'   => 2,
    'editor_script' => 'htb-pro-card-blocks',
    'render_callback' => function ($attrs) {
      $g = htbp_get_options();
      $id       = htbp_resolve_id($attrs['id'] ?? '');
      $ttl      = isset($attrs['ttl']) ? (int)$attrs['ttl'] : (int)$g['ttl'];
      $json_url = $attrs['json_url'] ?? $g['json_url'];
      $bg       = $attrs['bg'] ?? '';
      $fg       = $attrs['fg'] ?? '';
      $bdr      = $attrs['chipBorder'] ?? '';

      if ($id === '' && $json_url === '') return htbp_error_box('HTB: missing user id or JSON URL.');
      $data = htbp_get_profile($id, $ttl, $json_url);
      if (is_wp_error($data)) return htbp_error_box($data->get_error_message());

      $vars = [];
      if ($bg !== '')  $vars['--htb-chip-bg'] = $bg;
      if ($fg !== '')  $vars['--htb-chip-fg'] = $fg;
      if ($bdr !== '') $vars['--htb-chip-border'] = $bdr;
      $style = '';
      foreach ($vars as $k=>$v) { $style .= $k.':'.$v.';'; }
      $wrapper = function_exists('get_block_wrapper_attributes')
        ? get_block_wrapper_attributes(['class' => 'htb-scope htb-rank-chip', 'style' => $style])
        : 'class="htb-scope htb-rank-chip" style="'.$style.'"';

      $rank = $data['rank'] ?? '?';
      $chip = '<span class="htb-chip">Rank: '.esc_html($rank).'</span>';
      return '<div '.$wrapper.'>'.$chip.'</div>';
    },
    'attributes' => [
      'id'         => ['type'=>'string','default'=>''],
      'ttl'        => ['type'=>'number','default'=>43200],
      'json_url'   => ['type'=>'string','default'=>''],
      'preset'     => ['type'=>'string','default'=>''],
      'bg'         => ['type'=>'string','default'=>''],
      'fg'         => ['type'=>'string','default'=>''],
      'chipBorder' => ['type'=>'string','default'=>''],
      'className'  => ['type'=>'string','default'=>'']
    ],
    'title'    => 'HTB: Rank Chip',
    'category' => 'htbpc',
    'icon'     => 'awards',
    'supports' => [ 'html'=>false, 'align' => [ 'wide' ], 'spacing' => [ 'margin'=>true, 'padding'=>true ] ],
  ]);

  // 4) Progress block with modes (number | bar | circle)
  register_block_type('htb/progress', [
    'api_version'   => 2,
    'editor_script' => 'htb-pro-card-blocks',
    'attributes' => [
      'id'        => ['type'=>'string','default'=>''],
      'ttl'       => ['type'=>'number','default'=>43200],
      
      'preset'    => ['type'=>'string','default'=>''],

      'mode'      => ['type'=>'string','default'=>'bar'],

      // number
      'numPrefix' => ['type'=>'string','default'=>''],
      'numSuffix' => ['type'=>'string','default'=>'%'],
      'numSize'   => ['type'=>'number','default'=>32],
      'numColor'  => ['type'=>'string','default'=>'#cde5db'],

      // bar
      'barColor'   => ['type'=>'string','default'=>'#1aa36b'],
      'trackColor' => ['type'=>'string','default'=>'#10251e'],
      'barHeight'  => ['type'=>'number','default'=>10],
      'barRadius'  => ['type'=>'number','default'=>999],

      // circle
      'circleSize'   => ['type'=>'number','default'=>120],
      'circleStroke' => ['type'=>'number','default'=>10],
      'circleBar'    => ['type'=>'string','default'=>'#1aa36b'],
      'circleTrack'  => ['type'=>'string','default'=>'#10251e'],
      'circleText'   => ['type'=>'string','default'=>'#cde5db'],
    ],
    'render_callback' => function ($attrs) {
      $g = htbp_get_options();
      $id       = htbp_resolve_id($attrs['id'] ?? '');
      $ttl      = isset($attrs['ttl']) ? (int)$attrs['ttl'] : (int)$g['ttl'];
      $json_url = $attrs['json_url'] ?? $g['json_url'];
      $mode     = $attrs['mode'] ?? 'bar';

      if ($id === '' && $json_url === '') {
        return htbp_error_box('HTB: missing user id or JSON URL.');
      }
      $data = htbp_get_profile($id, $ttl, $json_url);
      if (is_wp_error($data)) return htbp_error_box($data->get_error_message());
      $p = isset($data['progress']) ? max(0, min(100, (int)$data['progress'])) : 0;

      // NUMBER
      if ($mode === 'number') {
        $prefix = $attrs['numPrefix'] ?? '';
        $suffix = $attrs['numSuffix'] ?? '%';
        $size   = (int)($attrs['numSize'] ?? 32);
        $color  = $attrs['numColor'] ?? '#cde5db';
        $style  = 'font-weight:700;display:inline-block;color:'.esc_attr($color).';font-size:'.esc_attr($size).'px;';
        return '<div class="htb-progress htb-progress--number" style="'.$style.'">'
            . esc_html($prefix.$p.$suffix) . '</div>';
      }

      // BAR
      if ($mode === 'bar') {
        $bar   = $attrs['barColor'] ?? '#1aa36b';
        $track = $attrs['trackColor'] ?? '#10251e';
        $h     = (int)($attrs['barHeight'] ?? 10);
        $r     = (int)($attrs['barRadius'] ?? 999);
        $outer = 'background:'.esc_attr($track).';border-radius:'.$r.'px;overflow:hidden;height:'.$h.'px;width:100%;';
        $inner = 'background:'.esc_attr($bar).';height:100%;width:'.$p.'%;';
        return '<div class="htb-progress htb-progress--bar" style="'.$outer.'"><div style="'.$inner.'"></div></div>';
      }

      // CIRCLE (SVG)
      $size   = (int)($attrs['circleSize'] ?? 120);
      $stroke = (int)($attrs['circleStroke'] ?? 10);
      $bar    = $attrs['circleBar'] ?? '#1aa36b';
      $track  = $attrs['circleTrack'] ?? '#10251e';
      $textC  = $attrs['circleText'] ?? '#cde5db';

      $r = ($size - $stroke) / 2;             // radius
      $cx = $cy = $size / 2;
      $circ = 2 * M_PI * $r;
      $dash = ($p / 100) * $circ;
      $gap  = $circ - $dash;

      $svg  = '<svg width="'.esc_attr($size).'" height="'.esc_attr($size).'" viewBox="0 0 '.$size.' '.$size.'">';
      $svg .= '<circle cx="'.$cx.'" cy="'.$cy.'" r="'.$r.'" stroke="'.esc_attr($track).'" stroke-width="'.$stroke.'" fill="none" />';
      $svg .= '<circle cx="'.$cx.'" cy="'.$cy.'" r="'.$r.'" stroke="'.esc_attr($bar).'" stroke-width="'.$stroke.'" fill="none" '
            . 'stroke-dasharray="'.$dash.' '.$gap.'" transform="rotate(-90 '.$cx.' '.$cy.')" stroke-linecap="round" />';
      $svg .= '<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" '
            . 'fill="'.esc_attr($textC).'" style="font-weight:700;font-size:'.floor($size/4).'px">'.$p.'%</text>';
      $svg .= '</svg>';

      return '<div class="htb-progress htb-progress--circle" style="display:inline-block;line-height:0">'.$svg.'</div>';
    },
    'title'    => 'HTB: Progress',
    'category' => 'htbpc',
    'icon'     => 'performance',
    'supports' => [ 'html' => false, 'spacing' => [ 'margin' => true ], 'anchor' => true ],
  ]);

  // 5) Profile Field (single datum with dropdown)
  register_block_type('htb/profile-field', [
    'api_version'   => 2,
    'editor_script' => 'htb-pro-card-blocks',
    'render_callback' => function ($attrs) {
      $g = htbp_get_options();

      // Resolve basics
      $id       = htbp_resolve_id($attrs['id'] ?? '');
      $ttl      = isset($attrs['ttl']) ? (int)$attrs['ttl'] : (int)$g['ttl'];
      $json_url = $attrs['json_url'] ?? $g['json_url'];

      // Field + presentation options
      $field     = $attrs['field']     ?? 'rank';
      $label     = $attrs['label']     ?? '';
      $prefix    = $attrs['prefix']    ?? '';
      $suffix    = $attrs['suffix']    ?? '';
      $tag       = $attrs['tag']       ?? 'span';    // span|div|h6 etc
      $pill      = !empty($attrs['pill']);
      $bg        = $attrs['bg']        ?? '';
      $fg        = $attrs['fg']        ?? '';
      $bdr       = $attrs['chipBorder'] ?? '';
      $className = $attrs['className'] ?? '';
      $size      = max(12, (int)($attrs['size'] ?? 64)); // avatar size

      if ($id === '' && $json_url === '') {
        return htbp_error_box('HTB: missing user id or JSON URL. Set a global ID in Settings → HTB Pro Card, or fill the block settings.');
      }

      $data = htbp_get_profile($id, $ttl, $json_url);
      if (is_wp_error($data)) return htbp_error_box($data->get_error_message());

      // Map field -> value from our normalized profile array
      // (these keys match what we build in htbp_fetch_labs_api)
      $map = [
        'name'        => $data['name']      ?? null,
        'rank'        => $data['rank']      ?? null,
        'points'      => $data['points']    ?? null,
        'user_owns'   => $data['user_owns'] ?? null,
        'root_owns'   => $data['root_owns'] ?? null,
        'progress'    => $data['progress']  ?? null,
        'next_rank'   => $data['next_rank'] ?? null,
        'country'     => $data['country']   ?? null,
        'team'        => $data['team']      ?? null,
        'avatar'      => $data['avatar']    ?? null, // URL (may be empty/non-public)
      ];

      $value = $map[$field] ?? null;

      // Build wrapper with CSS variables
      $vars = [];
      if ($bg !== '')  $vars['--htb-chip-bg'] = $bg;
      if ($fg !== '')  $vars['--htb-chip-fg'] = $fg;
      if ($bdr !== '') $vars['--htb-chip-border'] = $bdr;
      $style_vars = '';
      foreach ($vars as $k=>$v) { $style_vars .= $k.':'.$v.';'; }
      $wrapper = function_exists('get_block_wrapper_attributes')
        ? get_block_wrapper_attributes(['class' => 'htb-scope htb-profile-field', 'style' => $style_vars])
        : 'class="htb-scope htb-profile-field" style="'.$style_vars.'"';

      // Special case: avatar image (URL)
      if ($field === 'avatar') {
        if (!$value) return htbp_error_box('HTB: avatar not available.');
        $style = 'max-height:'.$size.'px;max-width:'.$size.'px;border-radius:' . ($pill ? '50%' : '8px') . ';';
        $html  = '<img src="'.esc_url($value).'" alt="HTB avatar" style="'.esc_attr($style).'">';
        return '<div '.$wrapper.'>'.$html.'</div>';
      }

      // Treat numbers
      if ($field === 'progress' && $value !== null) $value = (int)$value;

      // Human-friendly default
      if ($value === null || $value === '') $value = '—';

      // Build chip or plain text
      if ($pill) {
        $content = ($label !== '' ? esc_html($label).': ' : '')
                . esc_html($prefix.$value.$suffix);
        $html = '<span class="htb-chip">'.$content.'</span>';
        return '<div '.$wrapper.'>'.$html.'</div>';
      } else {
        $content = ($label !== '' ? '<strong>'.esc_html($label).': </strong>' : '')
                . esc_html($prefix.$value.$suffix);
        return '<'.$tag.' '.$wrapper.'>'.$content.'</'.$tag.'>';
      }
    },
    'attributes' => [
      'id'        => ['type'=>'string','default'=>''],
      'ttl'       => ['type'=>'number','default'=>43200],
      'json_url'  => ['type'=>'string','default'=>''],
      'preset'    => ['type'=>'string','default'=>''],

      'field'     => ['type'=>'string','default'=>'rank'],     // dropdown
      'label'     => ['type'=>'string','default'=>''],         // optional label shown before value
      'prefix'    => ['type'=>'string','default'=>''],         // value prefix
      'suffix'    => ['type'=>'string','default'=>''],         // value suffix
      'tag'       => ['type'=>'string','default'=>'span'],     // span|div|h6...
      'pill'      => ['type'=>'boolean','default'=>true],      // pill style chip
      'bg'        => ['type'=>'string','default'=>''],  // chip bg
      'fg'        => ['type'=>'string','default'=>''],  // chip fg
      'chipBorder'=> ['type'=>'string','default'=>''],
      'size'      => ['type'=>'number','default'=>64],         // for avatar only
      'className' => ['type'=>'string','default'=>'']
    ],
    'title'    => 'HTB: Profile Field',
    'category' => 'htbpc',
    'icon'     => 'admin-settings',
    'supports' => [ 'html'=>false, 'align' => [ 'wide' ], 'spacing' => [ 'margin'=>true, 'padding'=>true ] ],
  ]);

  // Block styles for quick layout variants
  if (function_exists('register_block_style')) {
    register_block_style('htb/pro-card', [ 'name' => 'compact',  'label' => 'Compact' ]);
    register_block_style('htb/pro-card', [ 'name' => 'detailed', 'label' => 'Detailed' ]);
  }

  // Block patterns to showcase presets
  if (function_exists('register_block_pattern')) {
    if (function_exists('register_block_pattern_category')) {
      register_block_pattern_category('htbpc', [ 'label' => __('HTB Pro Card', 'htb-pro-card') ]);
    }
    // Neon: full profile card
    register_block_pattern('htbpc/neon-card', [
      'title'       => __('HTB Neon Card', 'htb-pro-card'),
      'description' => __('A full profile card using the Neon preset.', 'htb-pro-card'),
      'categories'  => ['htbpc'],
      'content'     => '<!-- wp:htb/pro-card {"preset":"neon"} /-->'
    ]);
    // Solar: compact fields stack
    $solar = ''
      . '<!-- wp:htb/profile-field {"preset":"solar","field":"avatar","pill":true,"size":64} /-->'
      . '\n<!-- wp:htb/profile-field {"preset":"solar","field":"name","pill":false,"tag":"h3"} /-->'
      . '\n<!-- wp:htb/profile-field {"preset":"solar","field":"rank"} /-->'
      . '\n<!-- wp:htb/profile-field {"preset":"solar","field":"points"} /-->'
      . '\n<!-- wp:htb/progress {"preset":"solar","mode":"bar"} /-->';
    register_block_pattern('htbpc/solar-fields', [
      'title'       => __('HTB Solar Profile Bits', 'htb-pro-card'),
      'description' => __('A small stack of fields with the Solar preset.', 'htb-pro-card'),
      'categories'  => ['htbpc'],
      'content'     => $solar,
    ]);

    // Compact Neon Card
    register_block_pattern('htbpc/neon-compact-card', [
      'title'       => __('HTB Neon Card (Compact)', 'htb-pro-card'),
      'description' => __('A compact full profile card using the Neon preset.', 'htb-pro-card'),
      'categories'  => ['htbpc'],
      'content'     => '<!-- wp:htb/pro-card {"preset":"neon","gap":8,"padding":8,"radius":8} /-->',
    ]);

    // Solar Header Row: avatar + name + rank chip
    $solar_header = ''
      . '<!-- wp:htb/profile-field {"preset":"solar","field":"avatar","pill":true,"size":64} /-->'
      . '\n<!-- wp:htb/profile-field {"preset":"solar","field":"name","pill":false,"tag":"h2"} /-->'
      . '\n<!-- wp:htb/rank-chip {"preset":"solar"} /-->';
    register_block_pattern('htbpc/solar-header', [
      'title'       => __('HTB Solar Header', 'htb-pro-card'),
      'description' => __('Avatar, name, and rank chip styled with Solar.', 'htb-pro-card'),
      'categories'  => ['htbpc'],
      'content'     => $solar_header,
    ]);

    // Chips Row: rank, points, owns (user/root)
    $chips_row = ''
      . '<!-- wp:htb/profile-field {"field":"rank","pill":true} /-->'
      . '\n<!-- wp:htb/profile-field {"field":"points","pill":true} /-->'
      . '\n<!-- wp:htb/profile-field {"field":"user_owns","pill":true,"label":"User owns"} /-->'
      . '\n<!-- wp:htb/profile-field {"field":"root_owns","pill":true,"label":"Root owns"} /-->';
    register_block_pattern('htbpc/chips-row', [
      'title'       => __('HTB Chips Row', 'htb-pro-card'),
      'description' => __('Rank, points, and owns as chips to compose with other blocks.', 'htb-pro-card'),
      'categories'  => ['htbpc'],
      'content'     => $chips_row,
    ]);
  }

  /* Custom block category */
  add_filter('block_categories_all', function ($categories) {
    $categories[] = ['slug'=>'htbpc','title'=>__('HTB Pro Card','htb-pro-card'),'icon'=>null];
    return $categories;
  }, 10, 1);

});

/* -----------------------------
   Settings page + Test / Clear
------------------------------*/
add_action('admin_menu', function(){
  add_options_page('HTB Pro Card','HTB Pro Card','manage_options','htbp-settings','htbp_render_settings_page');
});
add_action('admin_init', function(){
  register_setting('htbp_settings_group', HTBP_OPTIONS_KEY, [
    'type'=>'array',
    'sanitize_callback'=>function($in){
      $o = htbp_default_options();
      $o['id']       = isset($in['id'])       ? sanitize_text_field($in['id']) : '';
      $o['ttl']      = isset($in['ttl'])      ? max(60,(int)$in['ttl'])         : 43200;
      $o['badge']    = !empty($in['badge']) ? 1 : 0;
      $o['json_url'] = isset($in['json_url']) ? esc_url_raw($in['json_url'])   : '';
      return $o;
    }
  ]);
});

function htbp_render_settings_page(){
  if (!current_user_can('manage_options')) return;
  $o = htbp_get_options(); ?>
  <div class="wrap">
    <h1>HTB Pro Card – Settings</h1>
    <form method="post" action="options.php">
      <?php settings_fields('htbp_settings_group'); ?>
      <table class="form-table" role="presentation">
        <tr><th><label for="htbp_id">HTB User ID</label></th>
          <td><input type="text" id="htbp_id" name="<?php echo esc_attr(HTBP_OPTIONS_KEY); ?>[id]" value="<?php echo esc_attr($o['id']); ?>" class="regular-text"></td></tr>
        <tr><th><label for="htbp_ttl">Cache TTL (seconds)</label></th>
          <td><input type="number" id="htbp_ttl" min="60" step="60" name="<?php echo esc_attr(HTBP_OPTIONS_KEY); ?>[ttl]" value="<?php echo esc_attr($o['ttl']); ?>" class="small-text"></td></tr>
        <tr><th>Show badge</th>
          <td><label><input type="checkbox" name="<?php echo esc_attr(HTBP_OPTIONS_KEY); ?>[badge]" value="1" <?php checked($o['badge'],1); ?>> Display official HTB badge</label></td></tr>
        <tr><th><label for="htbp_json">JSON URL (optional)</label></th>
          <td><input type="url" id="htbp_json" name="<?php echo esc_attr(HTBP_OPTIONS_KEY); ?>[json_url]" value="<?php echo esc_attr($o['json_url']); ?>" class="regular-text">
          <p class="description">If set, stats are read from this JSON instead of the labs API.</p></td></tr>
      </table>
      <?php submit_button(); ?>
    </form>

    <hr>
    <h2>Connection Test</h2>
    <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
      <?php wp_nonce_field('htbp_test_nonce'); ?>
      <input type="hidden" name="action" value="htbp_test">
      <?php submit_button('Run Test','secondary'); ?>
    </form>

    <h2>Cache</h2>
    <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
      <?php wp_nonce_field('htbp_clear_nonce'); ?>
      <input type="hidden" name="action" value="htbp_clear">
      <?php submit_button('Clear Cache','delete'); ?>
    </form>
  </div><?php
}

/* Settings link on Plugins page + meta */
add_filter('plugin_action_links_' . plugin_basename(__FILE__), function ($links) {
  $url = admin_url('options-general.php?page=htbp-settings');
  array_unshift($links, '<a href="' . esc_url($url) . '">' . esc_html__('Settings', 'htb-pro-card') . '</a>');
  return $links;
});
add_filter('plugin_row_meta', function ($links, $file) {
  if ($file === plugin_basename(__FILE__)) $links[] = '<a href="https://app.hackthebox.com/profile" target="_blank" rel="noopener">DOCS</a>';
  return $links;
}, 10, 2);

/* Test + Clear handlers + notice */
add_action('admin_post_htbp_test', function(){
  if (!current_user_can('manage_options')) wp_die('Unauthorized');
  check_admin_referer('htbp_test_nonce');
  $o = htbp_get_options();
  $src = $o['json_url'] ? 'json' : 'labs';
  $id  = htbp_resolve_id('');
  $res = $o['json_url'] ? htbp_fetch_json_url($o['json_url']) : htbp_fetch_labs_api($id);
  $payload = is_wp_error($res) ? ['ok'=>false,'err'=>$res->get_error_message(),'src'=>$src] : ['ok'=>true,'data'=>$res,'src'=>$src];
  set_transient('htbp_test_result',$payload,120);
  wp_safe_redirect(admin_url('options-general.php?page=htbp-settings')); exit;
});
add_action('admin_post_htbp_clear', function(){
  if (!current_user_can('manage_options')) wp_die('Unauthorized');
  check_admin_referer('htbp_clear_nonce');
  $id = htbp_resolve_id('');
  if ($id) htbp_clear_cache($id);
  set_transient('htbp_test_result',['ok'=>true,'data'=>['message'=>'Cache cleared'],'src'=>'cache'],60);
  wp_safe_redirect(admin_url('options-general.php?page=htbp-settings')); exit;
});
add_action('admin_notices', function(){
  if (!isset($_GET['page']) || $_GET['page']!=='htbp-settings') return;
  $res = get_transient('htbp_test_result'); if (!$res) return; delete_transient('htbp_test_result');
  $cls = !empty($res['ok']) ? 'notice-success' : 'notice-error';
  echo '<div class="notice '.esc_attr($cls).' is-dismissible"><p><strong>HTB:</strong> ';
  if (!empty($res['ok'])) {
    echo 'OK (source: '.esc_html($res['src']).')</p><pre style="max-height:220px;overflow:auto;background:#111;color:#cde5db;padding:8px;border-radius:6px;">'
        . esc_html(wp_json_encode($res['data'], JSON_PRETTY_PRINT)) . '</pre>';
  } else {
    echo 'ERROR '.esc_html($res['src']).': '.esc_html($res['err']).'</p>';
  }
  echo '</div>';
});

/* Friendly reminder if no global ID set */
add_action('admin_notices', function () {
  if (!current_user_can('manage_options')) return;
  $screen = function_exists('get_current_screen') ? get_current_screen() : null;
  if ($screen && $screen->base === 'settings_page_htbp-settings') return;
  $id = trim((string) htbp_get_options()['id']);
  if ($id === '') {
    $url = admin_url('options-general.php?page=htbp-settings');
    echo '<div class="notice notice-warning is-dismissible"><p>'
       . 'HTB Pro Card: Set your global <strong>HTB User ID</strong> in '
       . '<a href="'.esc_url($url).'">Settings → HTB Pro Card</a> to avoid “missing user id” messages.'
       . '</p></div>';
  }
});






