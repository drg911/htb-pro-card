<?php
/**
 * Plugin Name: HTB Pro Card (Server-side + Cache)
 * Description: Renders a rich Hack The Box profile card using the API. Shortcode: [htb_pro_card id="2651542" ttl="43200" badge="1"]
 * Version: 1.0
 */

if (!defined('ABSPATH')) exit;

function htb_api_fetch($user_id, $token = '', $timeout = 15) {
  if (!$user_id) return new WP_Error('htb_no_id','No user id.');
  if (!$token && defined('HTB_API_TOKEN')) $token = HTB_API_TOKEN;
  if (!$token)   return new WP_Error('htb_no_token','No API token.');

  $api_url = "https://app.hackthebox.com/api/v4/profile/{$user_id}";

  $headers = [
    'Authorization'    => 'Bearer '.$token,
    'Accept'           => 'application/json',
    'User-Agent'       => 'WP-HTB-ProCard/1.0',
    'X-Requested-With' => 'XMLHttpRequest',
    'Referer'          => "https://app.hackthebox.com/profile/{$user_id}",
    'Origin'           => 'https://app.hackthebox.com',
  ];

  $resp = wp_remote_get($api_url, [ 'timeout' => $timeout, 'headers' => $headers ]);
  if (is_wp_error($resp)) return $resp;

  $code = wp_remote_retrieve_response_code($resp);
  $body = wp_remote_retrieve_body($resp);
  if ($code !== 200 || !$body) return new WP_Error('htb_http', 'HTTP '.$code.' from API');

  $json = json_decode($body, true);
  if (!is_array($json)) return new WP_Error('htb_json', 'Invalid JSON from API');

  $info = $json['info'] ?? $json;

  return [
    'name'       => $info['name']        ?? $info['username'] ?? 'HTB User',
    'avatar'     => $info['avatar']      ?? '',
    'rank'       => $info['rank']        ?? $info['ranking'] ?? '—',
    'points'     => $info['points']      ?? $info['score']   ?? '—',
    'user_owns'  => $info['owns']['user'] ?? ($info['user_owns'] ?? null),
    'root_owns'  => $info['owns']['root'] ?? ($info['root_owns'] ?? null),
    'country'    => $info['country_name'] ?? ($info['country'] ?? ''),
    'team'       => $info['team_name']    ?? '',
  ];
}

function htb_api_get_cached($user_id, $ttl = 43200, $token = '') {
  $key = 'htb_v4_'.$user_id;
  if ($cached = get_transient($key)) return $cached;

  $fresh = htb_api_fetch($user_id, $token);
  if (!is_wp_error($fresh)) {
    set_transient($key, $fresh, max(300, (int)$ttl));
    update_option($key.'_fallback', $fresh, false);
    return $fresh;
  }
  if ($fallback = get_option($key.'_fallback')) return $fallback;
  return $fresh;
}

function htb_pro_card_shortcode($atts){
  $global = htbp_get_options();

  $a = shortcode_atts([
    'id'       => '',
    'ttl'      => '',
    'badge'    => '',
    'token'    => '',
    'json_url' => ''
  ], $atts, 'htb_pro_card');

  // Use plugin-wide defaults when not provided
  $id       = $a['id']       !== '' ? $a['id']       : $global['id'];
  $ttl      = $a['ttl']      !== '' ? intval($a['ttl']) : intval($global['ttl']);
  $badge    = $a['badge']    !== '' ? ( $a['badge'] ? '1' : '0' ) : ( $global['badge'] ? '1' : '0' );
  $json_url = $a['json_url'] !== '' ? $a['json_url'] : $global['json_url'];

  if (!$id && !$json_url) return '<div>HTB: missing user id (or JSON URL).</div>';

  $profile_url = 'https://app.hackthebox.com/profile/'.rawurlencode($id);
  $badge_url   = 'https://www.hackthebox.com/badge/image/'.rawurlencode($id);

  // Choose source
  if ( ! empty($json_url) ) {
    $data = htb_fetch_from_json_url( esc_url_raw($json_url) );
  } else {
    $data = htb_api_get_cached( sanitize_text_field($id), (int)$ttl, $a['token'] );
  }

  // ... (renderer stays the same, but use $badge to decide if badge shows)
  // replace: if ($a['badge'] === '1') with:
  //          if ($badge === '1') { ... }


/**
 * ==============
 * Gutenberg Block
 * ==============
 */
function htbp_register_block() {
  // Editor script (no build step)
  wp_register_script(
    'htb-pro-card-block',
    plugins_url( 'block.js', __FILE__ ),
    array( 'wp-blocks', 'wp-element', 'wp-components', 'wp-block-editor', 'wp-i18n' ),
    '1.0',
    true
  );

  // Dynamic block (server-rendered)
  register_block_type( 'htb/pro-card', array(
    'api_version'     => 2,
    'editor_script'   => 'htb-pro-card-block',
    'render_callback' => function( $attrs, $content ) {
      $id       = isset($attrs['id'])       ? sanitize_text_field($attrs['id']) : '';
      $ttl      = isset($attrs['ttl'])      ? intval($attrs['ttl'])              : 43200;
      $badge    = isset($attrs['badge'])    ? ( $attrs['badge'] ? '1' : '0' )    : '1';
      $json_url = isset($attrs['json_url']) ? esc_url_raw($attrs['json_url'])    : '';

      $shortcode = '[htb_pro_card'
                 . ( $id ? ' id="'. esc_attr($id) .'"' : '' )
                 . ' ttl="'. esc_attr($ttl) .'"'
                 . ' badge="'. esc_attr($badge) .'"'
                 . ( $json_url ? ' json_url="'. esc_attr($json_url) .'"' : '' )
                 . ']';

      return do_shortcode( $shortcode );
    },
    'attributes' => array(
      'id'       => array( 'type' => 'string',  'default' => '' ),
      'ttl'      => array( 'type' => 'number',  'default' => 43200 ),
      'badge'    => array( 'type' => 'boolean', 'default' => true ),
      'json_url' => array( 'type' => 'string',  'default' => '' ),
    ),
    'title'       => __( 'HTB Pro Card', 'htb-pro-card' ),
    'description' => __( 'Displays a Hack The Box profile card.', 'htb-pro-card' ),
    'category'    => 'widgets',
    'icon'        => 'shield',
    'supports'    => array( 'html' => false ),
  ) );
}
add_action( 'init', 'htbp_register_block' );

add_shortcode('htb_pro_card','htb_pro_card_shortcode');

/**
 * =====================================
 * Global settings for HTB Pro Card
 * =====================================
 */

define( 'HTBP_OPTIONS_KEY', 'htbp_options' );

function htbp_default_options() {
  return array(
    'id'       => '',        // e.g., 2651542
    'ttl'      => 43200,     // 12h
    'badge'    => 1,         // 1 = show
    'json_url' => '',        // optional
  );
}

function htbp_get_options() {
  $saved = get_option( HTBP_OPTIONS_KEY, array() );
  return wp_parse_args( $saved, htbp_default_options() );
}

function htbp_get_opt( $key, $fallback = null ) {
  $opts = htbp_get_options();
  return isset( $opts[ $key ] ) ? $opts[ $key ] : $fallback;
}

/* Admin settings page */
add_action( 'admin_menu', function() {
  add_options_page(
    'HTB Pro Card',
    'HTB Pro Card',
    'manage_options',
    'htbp-settings',
    'htbp_render_settings_page'
  );
});

add_action( 'admin_init', function() {
  register_setting( 'htbp_settings_group', HTBP_OPTIONS_KEY, array(
    'type' => 'array',
    'sanitize_callback' => function( $input ) {
      $out = htbp_default_options();
      $out['id']       = isset($input['id'])       ? sanitize_text_field( $input['id'] ) : '';
      $out['ttl']      = isset($input['ttl'])      ? max( 60, intval($input['ttl']) )     : 43200;
      $out['badge']    = ! empty($input['badge']) ? 1 : 0;
      $out['json_url'] = isset($input['json_url']) ? esc_url_raw( $input['json_url'] ) : '';
      return $out;
    }
  ) );
});

function htbp_render_settings_page() {
  if ( ! current_user_can('manage_options') ) return;
  $o = htbp_get_options();
  ?>
  <div class="wrap">
    <h1>HTB Pro Card – Settings</h1>
    <p>These values are used by the Gutenberg block, widget, and shortcode <em>by default</em>. You can still override per-block if needed.</p>

    <form method="post" action="options.php">
      <?php settings_fields( 'htbp_settings_group' ); ?>
      <table class="form-table" role="presentation">
        <tr>
          <th scope="row"><label for="htbp_id">HTB User ID</label></th>
          <td><input name="<?php echo HTBP_OPTIONS_KEY; ?>[id]" id="htbp_id" type="text" value="<?php echo esc_attr($o['id']); ?>" class="regular-text" placeholder="e.g., 2651542"></td>
        </tr>
        <tr>
          <th scope="row"><label for="htbp_ttl">Cache TTL (seconds)</label></th>
          <td><input name="<?php echo HTBP_OPTIONS_KEY; ?>[ttl]" id="htbp_ttl" type="number" min="60" step="60" value="<?php echo esc_attr($o['ttl']); ?>" class="small-text"> <span class="description">Default cache duration.</span></td>
        </tr>
        <tr>
          <th scope="row">Show badge</th>
          <td><label><input name="<?php echo HTBP_OPTIONS_KEY; ?>[badge]" type="checkbox" value="1" <?php checked( $o['badge'], 1 ); ?>> Display official HTB badge next to the card</label></td>
        </tr>
        <tr>
          <th scope="row"><label for="htbp_json">JSON URL (optional)</label></th>
          <td><input name="<?php echo HTBP_OPTIONS_KEY; ?>[json_url]" id="htbp_json" type="url" value="<?php echo esc_attr($o['json_url']); ?>" class="regular-text" placeholder="/wp-content/uploads/htb/htb.json">
            <p class="description">If set, the card reads stats from this JSON (relay) instead of the API.</p>
          </td>
        </tr>
      </table>
      <?php submit_button(); ?>
    </form>
    <hr>
    <h2>Connection Test</h2>
    <p>Click to fetch your profile using the current settings (JSON URL if set, otherwise the labs API).</p>
    <form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
      <?php wp_nonce_field( 'htbp_test_nonce' ); ?>
      <input type="hidden" name="action" value="htbp_test">
      <?php submit_button( 'Run Test', 'secondary' ); ?>
    </form>
  </div>
  <?php
}

/**
 * ================================
 * Admin: Test connection + notices
 * ================================
 */

// Handle the "Test connection" submit (secure: nonce + capability)
add_action( 'admin_post_htbp_test', function () {
  if ( ! current_user_can( 'manage_options' ) ) {
    wp_die( 'Unauthorized' );
  }
  check_admin_referer( 'htbp_test_nonce' );

  $o = htbp_get_options();
  $id       = $o['id'];
  $json_url = $o['json_url'];

  $result = array(
    'ok'     => false,
    'source' => $json_url ? 'json_url' : 'labs_api',
    'status' => '',
    'data'   => null,
    'error'  => '',
  );

  if ( $json_url ) {
    $r = htb_fetch_from_json_url( $json_url );
    if ( is_wp_error( $r ) ) {
      $result['error']  = $r->get_error_message();
    } else {
      $result['ok']   = true;
      $result['data'] = $r;
    }
  } else {
    // Use labs API via your existing fetch (requires HTB_API_TOKEN)
    $r = htb_api_fetch( $id );
    if ( is_wp_error( $r ) ) {
      $result['error'] = $r->get_error_message();
    } else {
      $result['ok']   = true;
      $result['data'] = $r;
    }
  }

  // Make a readable status string
  if ( $result['ok'] ) {
    $result['status'] = 'OK';
  } else {
    $result['status'] = 'ERROR';
  }

  // Store for display and redirect back to settings
  set_transient( 'htbp_test_result', $result, 120 );
  wp_safe_redirect( admin_url( 'options-general.php?page=htbp-settings' ) );
  exit;
});

// Show the result as an admin notice on the settings page
add_action( 'admin_notices', function () {
  if ( ! isset( $_GET['page'] ) || $_GET['page'] !== 'htbp-settings' ) return;
  $res = get_transient( 'htbp_test_result' );
  if ( ! $res ) return;

  delete_transient( 'htbp_test_result' );

  $cls = $res['ok'] ? 'notice-success' : 'notice-error';
  echo '<div class="notice ' . esc_attr( $cls ) . ' is-dismissible"><p><strong>HTB Test: '
     . esc_html( $res['status'] ) . '</strong> (source: '
     . esc_html( $res['source'] ) . ')</p>';

  if ( $res['ok'] && is_array( $res['data'] ) ) {
    // Show a compact preview of the mapped fields
    $preview = array_intersect_key( $res['data'], array_flip( array(
      'name','rank','points','user_owns','root_owns','next_rank','progress','country','team'
    ) ) );
    echo '<pre style="max-height:240px;overflow:auto;background:#111;color:#cde5db;padding:8px;border-radius:6px;">'
       . esc_html( wp_json_encode( $preview, JSON_PRETTY_PRINT ) )
       . '</pre>';
  } elseif ( ! $res['ok'] ) {
    echo '<p>' . esc_html( $res['error'] ?: 'Unknown error' ) . '</p>';
  }

  echo '</div>';
});

