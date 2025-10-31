/* global window */
(function (wp) {
  const { registerBlockType } = wp.blocks;
  const { __ } = wp.i18n || { __: (s) => s };
  const be = wp.blockEditor || wp.editor;
  const { InspectorControls, InspectorAdvancedControls } = be;
  const {
    PanelBody,
    TextControl,
    ToggleControl,
    SelectControl,
    ColorPalette,
    __experimentalNumberControl: NumberControl,
    Button,
  } = wp.components;

  const ServerSideRender = wp.serverSideRender;
  const CATEGORY = 'htbpc';

  // Simple theme presets mapped to CSS variables and progress colors
  const THEME_PRESETS = [
    {
      label: 'Custom',
      value: '',
      apply: () => ({})
    },
    {
      label: 'HTB Dark',
      value: 'htb-dark',
      apply: () => ({
        chipBg: '#0f2a22', chipFg: '#cde5db', chipBorder: '#1f3a32',
        ctaBg: '#115a46', ctaFg: '#eafff6', ctaBorder: '#1f7a62',
        border: '#123', gap: 16, padding: 16, radius: 12,
        progBar: '#1aa36b', progTrack: '#10251e', progText: '#cde5db',
      })
    },
    {
      label: 'HTB Compact',
      value: 'htb-compact',
      apply: () => ({
        chipBg: '#0f2a22', chipFg: '#cde5db', chipBorder: '#1f3a32',
        ctaBg: '#115a46', ctaFg: '#eafff6', ctaBorder: '#1f7a62',
        border: '#123', gap: 8, padding: 8, radius: 8,
        progBar: '#1aa36b', progTrack: '#10251e', progText: '#cde5db',
      })
    },
    {
      label: 'Mono',
      value: 'mono',
      apply: () => ({
        chipBg: 'transparent', chipFg: 'currentColor', chipBorder: 'currentColor',
        ctaBg: 'transparent', ctaFg: 'currentColor', ctaBorder: 'currentColor',
        border: 'currentColor',
        progBar: 'currentColor', progTrack: '#666', progText: 'currentColor',
      })
    },
    {
      label: 'Neon',
      value: 'neon',
      apply: () => ({
        chipBg: '#0b1220', chipFg: '#9cffd1', chipBorder: '#1b2a40',
        ctaBg: '#0ef0a0', ctaFg: '#05120c', ctaBorder: '#08c483',
        border: '#17323f', gap: 12, padding: 14, radius: 12,
        progBar: '#0ef0a0', progTrack: '#0b1220', progText: '#9cffd1',
      })
    },
    {
      label: 'Solar',
      value: 'solar',
      apply: () => ({
        chipBg: '#2b2a20', chipFg: '#ffe9a3', chipBorder: '#4a4833',
        ctaBg: '#d9a500', ctaFg: '#1b180f', ctaBorder: '#ad8300',
        border: '#4a4833', gap: 14, padding: 16, radius: 10,
        progBar: '#d9a500', progTrack: '#2b2a20', progText: '#ffe9a3',
      })
    },
  ];

  // Preset helpers (shared across blocks)
  const LAST_PRESET_KEY = 'htbpc:lastPreset';
  const setLastPreset = (v) => { try { window.localStorage.setItem(LAST_PRESET_KEY, v || ''); } catch(e){} };
  const getLastPreset = () => { try { return window.localStorage.getItem(LAST_PRESET_KEY) || ''; } catch(e){ return ''; } };
  const presetOptions = THEME_PRESETS.map(p => ({ label: p.label, value: p.value }));
  const findPreset = (val) => THEME_PRESETS.find(p => p.value === val) || THEME_PRESETS[0];
  const applyPresetPatch = (presetValue, kind) => {
    const p = findPreset(presetValue);
    const base = p.apply();
    if (kind === 'card') {
      const { chipBg, chipFg, chipBorder, ctaBg, ctaFg, ctaBorder, border, gap, padding, radius } = base;
      return { chipBg, chipFg, chipBorder, ctaBg, ctaFg, ctaBorder, border, gap, padding, radius };
    }
    if (kind === 'chip' || kind === 'field') {
      const { chipBg, chipFg, chipBorder } = base; return { bg: chipBg, fg: chipFg, chipBorder };
    }
    if (kind === 'progress') {
      const { progBar, progTrack, progText } = base; return {
        barColor: progBar, trackColor: progTrack,
        circleBar: progBar, circleTrack: progTrack, circleText: progText,
        numColor: progText,
      };
    }
    return {};
  };

  // --- Source controls (now under Advanced) ---
  const AdvancedSourcePanel = ({ attrs, setAttrs }) =>
    wp.element.createElement(
      InspectorAdvancedControls,
      {},
      wp.element.createElement(
        PanelBody,
        { title: __('Source', 'htb-pro-card'), initialOpen: true },
        wp.element.createElement(TextControl, {
          label: __('HTB User ID (blank = global setting)', 'htb-pro-card'),
          value: attrs.id || '',
          onChange: (v) => setAttrs({ id: v }),
          placeholder: __('e.g., 2651542 or leave blank', 'htb-pro-card'),
        }),
        wp.element.createElement(NumberControl, {
          label: __('Cache TTL (seconds)', 'htb-pro-card'),
          value: attrs.ttl ?? 43200,
          min: 60,
          step: 60,
          onChange: (v) => setAttrs({ ttl: Number(v || 0) }),
        }),
        wp.element.createElement(TextControl, {
          label: __('JSON URL (optional)', 'htb-pro-card'),
          value: attrs.json_url || '',
          onChange: (v) => setAttrs({ json_url: v }),
          placeholder: __('If set, data is read from this JSON', 'htb-pro-card'),
        })
      )
    );

  /* ─────────────────────────────────────────────
     HTB: Profile Card
  ───────────────────────────────────────────── */
  registerBlockType('htb/pro-card', {
    apiVersion: 2,
    title: 'HTB: Profile Card',
    icon: 'shield',
    category: CATEGORY,
    attributes: {
      id: { type: 'string' },
      ttl: { type: 'number', default: 43200 },
      badge: { type: 'boolean', default: true },
      json_url: { type: 'string' },
      refresh: { type: 'number', default: 0 },
      preset: { type: 'string' },
      // theme variables
      chipBg: { type: 'string' },
      chipFg: { type: 'string' },
      chipBorder: { type: 'string' },
      ctaBg: { type: 'string' },
      ctaFg: { type: 'string' },
      ctaBorder: { type: 'string' },
      border: { type: 'string' },
      gap: { type: 'number' },
      padding: { type: 'number' },
      radius: { type: 'number' },
      // display toggles
      showAvatar: { type: 'boolean', default: false },
      avatarRounded: { type: 'boolean', default: true },
      showRank: { type: 'boolean', default: true },
      showPoints: { type: 'boolean', default: true },
      showOwns: { type: 'boolean', default: true },
      showNext: { type: 'boolean', default: true },
      showProgress: { type: 'boolean', default: true },
      showCTA: { type: 'boolean', default: true },
      ctaLabel: { type: 'string', default: 'View Profile' },
      ctaUrl: { type: 'string', default: '' },
    },
    edit: ({ attributes, setAttributes }) => [
      wp.element.createElement(
        InspectorControls,
        {},
        wp.element.createElement(
          PanelBody,
          { title: __('Display', 'htb-pro-card'), initialOpen: true },
          wp.element.createElement(ToggleControl, {
            label: __('Show official badge', 'htb-pro-card'),
            checked: !!attributes.badge,
            onChange: (v) => setAttributes({ badge: !!v }),
          }),
          wp.element.createElement(Button, {
            variant: 'secondary',
            style: { marginTop: 8 },
            onClick: () => setAttributes({ refresh: Date.now() })
          }, __('Refresh data', 'htb-pro-card')),
          wp.element.createElement('div', { style: { marginTop: 8, fontWeight: 600 } }, __('Avatar', 'htb-pro-card')),
          wp.element.createElement(ToggleControl, {
            label: __('Show avatar', 'htb-pro-card'),
            checked: !!attributes.showAvatar,
            onChange: (v) => setAttributes({ showAvatar: !!v }),
          }),
          !!attributes.showAvatar &&
            wp.element.createElement(ToggleControl, {
              label: __('Rounded avatar', 'htb-pro-card'),
              checked: !!attributes.avatarRounded,
              onChange: (v) => setAttributes({ avatarRounded: !!v }),
            }),

          wp.element.createElement('div', { style: { marginTop: 12, fontWeight: 600 } }, __('Fields', 'htb-pro-card')),
          wp.element.createElement(ToggleControl, {
            label: __('Show rank', 'htb-pro-card'),
            checked: !!attributes.showRank,
            onChange: (v) => setAttributes({ showRank: !!v }),
          }),
          wp.element.createElement(ToggleControl, {
            label: __('Show points', 'htb-pro-card'),
            checked: !!attributes.showPoints,
            onChange: (v) => setAttributes({ showPoints: !!v }),
          }),
          wp.element.createElement(ToggleControl, {
            label: __('Show owns', 'htb-pro-card'),
            checked: !!attributes.showOwns,
            onChange: (v) => setAttributes({ showOwns: !!v }),
          }),
          wp.element.createElement(ToggleControl, {
            label: __('Show next rank', 'htb-pro-card'),
            checked: !!attributes.showNext,
            onChange: (v) => setAttributes({ showNext: !!v }),
          }),
          wp.element.createElement(ToggleControl, {
            label: __('Show progress', 'htb-pro-card'),
            checked: !!attributes.showProgress,
            onChange: (v) => setAttributes({ showProgress: !!v }),
          }),

          wp.element.createElement('div', { style: { marginTop: 12, fontWeight: 600 } }, __('CTA', 'htb-pro-card')),
          wp.element.createElement(ToggleControl, {
            label: __('Show CTA button', 'htb-pro-card'),
            checked: !!attributes.showCTA,
            onChange: (v) => setAttributes({ showCTA: !!v }),
          }),
          !!attributes.showCTA &&
            wp.element.createElement(TextControl, {
              label: __('CTA label', 'htb-pro-card'),
              value: attributes.ctaLabel || '',
              onChange: (v) => setAttributes({ ctaLabel: v }),
            }),
          !!attributes.showCTA &&
            wp.element.createElement(TextControl, {
              label: __('CTA URL', 'htb-pro-card'),
              value: attributes.ctaUrl || '',
              onChange: (v) => setAttributes({ ctaUrl: v }),
              placeholder: __('https://app.hackthebox.com/profile/…', 'htb-pro-card'),
            }),

          // Theme (CSS variables)
          wp.element.createElement('div', { style: { marginTop: 16, fontWeight: 600 } }, __('Theme', 'htb-pro-card')),
          wp.element.createElement(SelectControl, {
            label: __('Theme preset', 'htb-pro-card'),
            value: attributes.preset || getLastPreset() || '',
            options: presetOptions,
            onChange: (v) => {
              setLastPreset(v);
              const patch = applyPresetPatch(v, 'card');
              setAttributes({ preset: v, ...patch });
            }
          }),
          wp.element.createElement('div', {}, __('Chips', 'htb-pro-card')),
          wp.element.createElement(ColorPalette, { value: attributes.chipBg, onChange: (v) => setAttributes({ chipBg: v }) }),
          wp.element.createElement(ColorPalette, { value: attributes.chipFg, onChange: (v) => setAttributes({ chipFg: v }) }),
          wp.element.createElement(ColorPalette, { value: attributes.chipBorder, onChange: (v) => setAttributes({ chipBorder: v }) }),
          wp.element.createElement('div', { style: { marginTop: 8 } }, __('CTA Button', 'htb-pro-card')),
          wp.element.createElement(ColorPalette, { value: attributes.ctaBg, onChange: (v) => setAttributes({ ctaBg: v }) }),
          wp.element.createElement(ColorPalette, { value: attributes.ctaFg, onChange: (v) => setAttributes({ ctaFg: v }) }),
          wp.element.createElement(ColorPalette, { value: attributes.ctaBorder, onChange: (v) => setAttributes({ ctaBorder: v }) }),
          wp.element.createElement('div', { style: { marginTop: 8 } }, __('Card Border', 'htb-pro-card')),
          wp.element.createElement(ColorPalette, { value: attributes.border, onChange: (v) => setAttributes({ border: v }) }),
          wp.element.createElement(NumberControl, { label: __('Gap (px)', 'htb-pro-card'), value: attributes.gap, min: 0, step: 1, onChange: (v) => setAttributes({ gap: Number(v || 0) }) }),
          wp.element.createElement(NumberControl, { label: __('Padding (px)', 'htb-pro-card'), value: attributes.padding, min: 0, step: 1, onChange: (v) => setAttributes({ padding: Number(v || 0) }) }),
          wp.element.createElement(NumberControl, { label: __('Radius (px)', 'htb-pro-card'), value: attributes.radius, min: 0, step: 1, onChange: (v) => setAttributes({ radius: Number(v || 0) }) })
        )
      ),
      AdvancedSourcePanel({ attrs: attributes, setAttrs: setAttributes }),
      wp.element.createElement(ServerSideRender, {
        block: 'htb/pro-card',
        attributes: attributes,
      }),
    ],
    save: () => null,
  });

  /* ─────────────────────────────────────────────
     HTB: Badge
  ───────────────────────────────────────────── */
  registerBlockType('htb/badge', {
    apiVersion: 2,
    title: 'HTB: Badge',
    icon: 'format-image',
    category: CATEGORY,
    attributes: {
      id: { type: 'string' },
      size: { type: 'number', default: 64 },
      rounded: { type: 'boolean', default: true },
    },
    edit: ({ attributes, setAttributes }) => [
      wp.element.createElement(
        InspectorControls,
        {},
        wp.element.createElement(
          PanelBody,
          { title: __('Badge Settings', 'htb-pro-card'), initialOpen: true },
          wp.element.createElement(TextControl, {
            label: __('HTB User ID (blank = global setting)', 'htb-pro-card'),
            value: attributes.id || '',
            onChange: (v) => setAttributes({ id: v }),
          }),
          wp.element.createElement(NumberControl, {
            label: __('Size (px)', 'htb-pro-card'),
            value: attributes.size,
            min: 24,
            step: 4,
            onChange: (v) => setAttributes({ size: Number(v || 0) }),
          }),
          wp.element.createElement(ToggleControl, {
            label: __('Rounded corners', 'htb-pro-card'),
            checked: !!attributes.rounded,
            onChange: (v) => setAttributes({ rounded: !!v }),
          })
        )
      ),
      AdvancedSourcePanel({ attrs: attributes, setAttrs: setAttributes }),
      wp.element.createElement(ServerSideRender, {
        block: 'htb/badge',
        attributes: attributes,
      }),
    ],
    save: () => null,
  });

  /* ─────────────────────────────────────────────
     HTB: Rank Chip
  ───────────────────────────────────────────── */
  registerBlockType('htb/rank-chip', {
    apiVersion: 2,
    title: 'HTB: Rank Chip',
    icon: 'awards',
    category: CATEGORY,
    attributes: {
      id: { type: 'string' },
      ttl: { type: 'number', default: 43200 },
      json_url: { type: 'string' },
      preset: { type: 'string' },
      bg: { type: 'string', default: '' },
      fg: { type: 'string', default: '' },
      chipBorder: { type: 'string', default: '' },
    },
    edit: ({ attributes, setAttributes }) => [
      wp.element.createElement(
        InspectorControls,
        {},
        wp.element.createElement(
          PanelBody,
          { title: __('Chip Colors', 'htb-pro-card'), initialOpen: true },
          wp.element.createElement(SelectControl, {
            label: __('Theme preset', 'htb-pro-card'),
            value: attributes.preset || getLastPreset() || '',
            options: presetOptions,
            onChange: (v) => {
              const patch = applyPresetPatch(v, 'chip');
              setLastPreset(v);
              setAttributes({ preset: v, ...patch });
            }
          }),

          wp.element.createElement('div', { style: { marginBottom: 8 } }, 'Background'),
          wp.element.createElement(ColorPalette, {
            value: attributes.bg,
            onChange: (v) => setAttributes({ bg: v }),
          }),
          wp.element.createElement('div', { style: { marginTop: 12, marginBottom: 8 } }, 'Text'),
          wp.element.createElement(ColorPalette, {
            value: attributes.fg,
            onChange: (v) => setAttributes({ fg: v }),
          }),
          wp.element.createElement('div', { style: { marginTop: 12, marginBottom: 8 } }, 'Border'),
          wp.element.createElement(ColorPalette, {
            value: attributes.chipBorder,
            onChange: (v) => setAttributes({ chipBorder: v }),
          })
        )
      ),
      AdvancedSourcePanel({ attrs: attributes, setAttrs: setAttributes }),
      wp.element.createElement(ServerSideRender, {
        block: 'htb/rank-chip',
        attributes: attributes,
      }),
    ],
    save: () => null,
  });

  /* ─────────────────────────────────────────────
     HTB: Progress (number | bar | circle)
  ───────────────────────────────────────────── */
  registerBlockType('htb/progress', {
    apiVersion: 2,
    title: 'HTB: Progress',
    icon: 'performance',
    category: CATEGORY,
    attributes: {
      id: { type: 'string' },
      ttl: { type: 'number', default: 43200 },
      json_url: { type: 'string' },

      preset: { type: 'string' },
      // shared
      mode: { type: 'string', default: 'bar' }, // 'number' | 'bar' | 'circle'

      // number
      numPrefix: { type: 'string', default: '' },
      numSuffix: { type: 'string', default: '%' },
      numSize: { type: 'number', default: 32 },
      numColor: { type: 'string', default: '#cde5db' },

      // bar
      barColor: { type: 'string', default: '#1aa36b' },
      trackColor: { type: 'string', default: '#10251e' },
      barHeight: { type: 'number', default: 10 },
      barRadius: { type: 'number', default: 999 },

      // circle
      circleSize: { type: 'number', default: 120 }, // px (SVG viewBox size)
      circleStroke: { type: 'number', default: 10 },
      circleBar: { type: 'string', default: '#1aa36b' },
      circleTrack: { type: 'string', default: '#10251e' },
      circleText: { type: 'string', default: '#cde5db' },
    },
    edit: ({ attributes, setAttributes }) => [
      // GENERAL (appearance)
      wp.element.createElement(
        InspectorControls,
        {},
        wp.element.createElement(
          PanelBody,
          { title: __('Display', 'htb-pro-card'), initialOpen: true },
          wp.element.createElement(SelectControl, {
            label: __('Theme preset', 'htb-pro-card'),
            value: attributes.preset || getLastPreset() || '',
            options: presetOptions,
            onChange: (v) => {
              const patch = applyPresetPatch(v, 'progress');
              setLastPreset(v);
              setAttributes({ preset: v, ...patch });
            }
          }),
          wp.element.createElement(SelectControl, {
            label: __('Mode', 'htb-pro-card'),
            value: attributes.mode,
            options: [
              { label: 'Bar', value: 'bar' },
              { label: 'Number', value: 'number' },
              { label: 'Circle', value: 'circle' },
            ],
            onChange: (v) => setAttributes({ mode: v }),
          }),
          // NUMBER options
          attributes.mode === 'number' &&
            wp.element.createElement(TextControl, {
              label: __('Prefix', 'htb-pro-card'),
              value: attributes.numPrefix,
              onChange: (v) => setAttributes({ numPrefix: v }),
            }),
          attributes.mode === 'number' &&
            wp.element.createElement(TextControl, {
              label: __('Suffix', 'htb-pro-card'),
              value: attributes.numSuffix,
              onChange: (v) => setAttributes({ numSuffix: v }),
            }),
          attributes.mode === 'number' &&
            wp.element.createElement(NumberControl, {
              label: __('Font size (px)', 'htb-pro-card'),
              value: attributes.numSize,
              min: 12,
              step: 2,
              onChange: (v) => setAttributes({ numSize: Number(v || 0) }),
            }),
          attributes.mode === 'number' &&
            wp.element.createElement(ColorPalette, {
              value: attributes.numColor,
              onChange: (v) => setAttributes({ numColor: v }),
            }),

          // BAR options
          attributes.mode === 'bar' &&
            wp.element.createElement('div', { style: { marginTop: 12 } }, __('Bar Color', 'htb-pro-card')),
          attributes.mode === 'bar' &&
            wp.element.createElement(ColorPalette, {
              value: attributes.barColor,
              onChange: (v) => setAttributes({ barColor: v }),
            }),
          attributes.mode === 'bar' &&
            wp.element.createElement('div', { style: { marginTop: 12 } }, __('Track Color', 'htb-pro-card')),
          attributes.mode === 'bar' &&
            wp.element.createElement(ColorPalette, {
              value: attributes.trackColor,
              onChange: (v) => setAttributes({ trackColor: v }),
            }),
          attributes.mode === 'bar' &&
            wp.element.createElement(NumberControl, {
              label: __('Height (px)', 'htb-pro-card'),
              value: attributes.barHeight,
              min: 4,
              step: 1,
              onChange: (v) => setAttributes({ barHeight: Number(v || 0) }),
            }),
          attributes.mode === 'bar' &&
            wp.element.createElement(NumberControl, {
              label: __('Border radius (px)', 'htb-pro-card'),
              value: attributes.barRadius,
              min: 0,
              step: 1,
              onChange: (v) => setAttributes({ barRadius: Number(v || 0) }),
            }),

          // CIRCLE options
          attributes.mode === 'circle' &&
            wp.element.createElement(NumberControl, {
              label: __('Size (px)', 'htb-pro-card'),
              value: attributes.circleSize,
              min: 60,
              step: 4,
              onChange: (v) => setAttributes({ circleSize: Number(v || 0) }),
            }),
          attributes.mode === 'circle' &&
            wp.element.createElement(NumberControl, {
              label: __('Stroke width (px)', 'htb-pro-card'),
              value: attributes.circleStroke,
              min: 4,
              step: 1,
              onChange: (v) => setAttributes({ circleStroke: Number(v || 0) }),
            }),
          attributes.mode === 'circle' &&
            wp.element.createElement('div', { style: { marginTop: 12 } }, __('Bar Color', 'htb-pro-card')),
          attributes.mode === 'circle' &&
            wp.element.createElement(ColorPalette, {
              value: attributes.circleBar,
              onChange: (v) => setAttributes({ circleBar: v }),
            }),
          attributes.mode === 'circle' &&
            wp.element.createElement('div', { style: { marginTop: 12 } }, __('Track Color', 'htb-pro-card')),
          attributes.mode === 'circle' &&
            wp.element.createElement(ColorPalette, {
              value: attributes.circleTrack,
              onChange: (v) => setAttributes({ circleTrack: v }),
            }),
          attributes.mode === 'circle' &&
            wp.element.createElement('div', { style: { marginTop: 12 } }, __('Text Color', 'htb-pro-card')),
          attributes.mode === 'circle' &&
            wp.element.createElement(ColorPalette, {
              value: attributes.circleText,
              onChange: (v) => setAttributes({ circleText: v }),
            })
        )
      ),
      // ADVANCED ➜ Source
      AdvancedSourcePanel({ attrs: attributes, setAttrs: setAttributes }),
      // Live server render
      wp.element.createElement(ServerSideRender, {
        block: 'htb/progress',
        attributes: attributes,
      }),
    ],
    save: () => null,
  });

  /* ─────────────────────────────────────────────
     HTB: Profile Field (unchanged except Source → Advanced)
  ───────────────────────────────────────────── */
  const FIELD_OPTIONS = [
    { label: 'Name', value: 'name' },
    { label: 'Rank', value: 'rank' },
    { label: 'Points', value: 'points' },
    { label: 'User owns', value: 'user_owns' },
    { label: 'Root owns', value: 'root_owns' },
    { label: 'Progress %', value: 'progress' },
    { label: 'Next rank', value: 'next_rank' },
    { label: 'Country', value: 'country' },
    { label: 'Team', value: 'team' },
    { label: 'Avatar (image URL)', value: 'avatar' },
  ];

  registerBlockType('htb/profile-field', {
    apiVersion: 2,
    title: 'HTB: Profile Field',
    icon: 'admin-settings',
    category: CATEGORY,
    attributes: {
      id: { type: 'string' },
      ttl: { type: 'number', default: 43200 },
      json_url: { type: 'string' },

      preset: { type: 'string' },
      field: { type: 'string', default: 'rank' },
      label: { type: 'string', default: '' },
      prefix: { type: 'string', default: '' },
      suffix: { type: 'string', default: '' },
      tag: { type: 'string', default: 'span' },
      pill: { type: 'boolean', default: true },
      bg: { type: 'string', default: '' }, // chip bg
      fg: { type: 'string', default: '' }, // chip fg
      chipBorder: { type: 'string', default: '' },
      size: { type: 'number', default: 64 }, // avatar only
    },
    edit: ({ attributes, setAttributes }) => {
      const isAvatar = attributes.field === 'avatar';
      return [
        wp.element.createElement(
          InspectorControls,
          {},
          wp.element.createElement(
            PanelBody,
            { title: __('Field & Presentation', 'htb-pro-card'), initialOpen: true },
            wp.element.createElement(SelectControl, {
              label: __('Theme preset', 'htb-pro-card'),
              value: attributes.preset || getLastPreset() || '',
              options: presetOptions,
              onChange: (v) => {
                const patch = applyPresetPatch(v, 'field');
                setLastPreset(v);
                setAttributes({ preset: v, ...patch });
              }
            }),
            wp.element.createElement(SelectControl, {
              label: __('Field to display', 'htb-pro-card'),
              value: attributes.field,
              options: FIELD_OPTIONS,
              onChange: (v) => setAttributes({ field: v }),
            }),
            !isAvatar &&
              wp.element.createElement(TextControl, {
                label: __('Label (before value)', 'htb-pro-card'),
                value: attributes.label,
                onChange: (v) => setAttributes({ label: v }),
              }),
            !isAvatar &&
              wp.element.createElement(TextControl, {
                label: __('Prefix', 'htb-pro-card'),
                value: attributes.prefix,
                onChange: (v) => setAttributes({ prefix: v }),
              }),
            !isAvatar &&
              wp.element.createElement(TextControl, {
                label: __('Suffix', 'htb-pro-card'),
                value: attributes.suffix,
                onChange: (v) => setAttributes({ suffix: v }),
              }),
            !isAvatar &&
              wp.element.createElement(TextControl, {
                label: __('HTML tag (e.g., span, div, h6)', 'htb-pro-card'),
                value: attributes.tag,
                onChange: (v) => setAttributes({ tag: v || 'span' }),
              }),
            wp.element.createElement(ToggleControl, {
              label: isAvatar ? __('Circle (pill) / Square', 'htb-pro-card') : __('Pill style', 'htb-pro-card'),
              checked: !!attributes.pill,
              onChange: (v) => setAttributes({ pill: !!v }),
            }),
            !isAvatar &&
              wp.element.createElement('div', { style: { marginTop: 8, fontWeight: 600 } }, 'Pill colors'),
            !isAvatar &&
              wp.element.createElement(ColorPalette, {
                value: attributes.bg,
                onChange: (v) => setAttributes({ bg: v }),
              }),
            !isAvatar &&
              wp.element.createElement(ColorPalette, {
                value: attributes.fg,
                onChange: (v) => setAttributes({ fg: v }),
              }),
            !isAvatar &&
              wp.element.createElement(ColorPalette, {
                value: attributes.chipBorder,
                onChange: (v) => setAttributes({ chipBorder: v }),
              }),
            isAvatar &&
              wp.element.createElement(NumberControl, {
                label: __('Avatar size (px)', 'htb-pro-card'),
                value: attributes.size,
                min: 12,
                step: 2,
                onChange: (v) => setAttributes({ size: Number(v || 0) }),
              })
          )
        ),
        AdvancedSourcePanel({ attrs: attributes, setAttrs: setAttributes }),
        wp.element.createElement(ServerSideRender, {
          block: 'htb/profile-field',
          attributes: attributes,
        }),
      ];
    },
    save: () => null,
  });

  // Easy inserter entries for common single fields
  if (wp.blocks && wp.blocks.registerBlockVariation) {
    try {
      wp.blocks.registerBlockVariation('htb/profile-field', [
        {
          name: 'htb/profile-name',
          title: 'HTB: Name',
          icon: 'id',
          scope: ['inserter'],
          attributes: { field: 'name', label: 'Name', pill: false },
          keywords: ['htb', 'profile', 'name'],
        },
        {
          name: 'htb/profile-rank',
          title: 'HTB: Rank',
          icon: 'awards',
          scope: ['inserter'],
          attributes: { field: 'rank', label: 'Rank', pill: true },
          keywords: ['htb', 'profile', 'rank'],
        },
        {
          name: 'htb/profile-points',
          title: 'HTB: Points',
          icon: 'chart-bar',
          scope: ['inserter'],
          attributes: { field: 'points', label: 'Points', pill: true },
          keywords: ['htb', 'profile', 'points', 'score'],
        },
        {
          name: 'htb/profile-user-owns',
          title: 'HTB: User Owns',
          icon: 'groups',
          scope: ['inserter'],
          attributes: { field: 'user_owns', label: 'User owns', pill: true },
          keywords: ['htb', 'profile', 'owns', 'user'],
        },
        {
          name: 'htb/profile-root-owns',
          title: 'HTB: Root Owns',
          icon: 'shield',
          scope: ['inserter'],
          attributes: { field: 'root_owns', label: 'Root owns', pill: true },
          keywords: ['htb', 'profile', 'owns', 'root'],
        },
        {
          name: 'htb/profile-progress',
          title: 'HTB: Progress %',
          icon: 'performance',
          scope: ['inserter'],
          attributes: { field: 'progress', label: 'Progress', suffix: '%', pill: true },
          keywords: ['htb', 'profile', 'progress'],
        },
        {
          name: 'htb/profile-next-rank',
          title: 'HTB: Next Rank',
          icon: 'arrow-right-alt',
          scope: ['inserter'],
          attributes: { field: 'next_rank', label: 'Next', pill: true },
          keywords: ['htb', 'profile', 'rank', 'next'],
        },
        {
          name: 'htb/profile-avatar',
          title: 'HTB: Avatar',
          icon: 'format-image',
          scope: ['inserter'],
          attributes: { field: 'avatar', pill: true, size: 64 },
          keywords: ['htb', 'profile', 'avatar', 'image'],
        },
      ]);
    } catch (e) {
      // no-op if variations API unavailable
    }
  }

})(window.wp);

