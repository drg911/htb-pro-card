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
  } = wp.components;

  const ServerSideRender = wp.serverSideRender;
  const CATEGORY = 'htbpc';

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
          })
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
      bg: { type: 'string', default: '#0f2a22' },
      fg: { type: 'string', default: '#cde5db' },
    },
    edit: ({ attributes, setAttributes }) => [
      wp.element.createElement(
        InspectorControls,
        {},
        wp.element.createElement(
          PanelBody,
          { title: __('Chip Colors', 'htb-pro-card'), initialOpen: true },
          wp.element.createElement('div', { style: { marginBottom: 8 } }, 'Background'),
          wp.element.createElement(ColorPalette, {
            value: attributes.bg,
            onChange: (v) => setAttributes({ bg: v }),
          }),
          wp.element.createElement('div', { style: { marginTop: 12, marginBottom: 8 } }, 'Text'),
          wp.element.createElement(ColorPalette, {
            value: attributes.fg,
            onChange: (v) => setAttributes({ fg: v }),
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

      field: { type: 'string', default: 'rank' },
      label: { type: 'string', default: '' },
      prefix: { type: 'string', default: '' },
      suffix: { type: 'string', default: '' },
      tag: { type: 'string', default: 'span' },
      pill: { type: 'boolean', default: true },
      bg: { type: 'string', default: '#0f2a22' },
      fg: { type: 'string', default: '#cde5db' },
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
})(window.wp);
