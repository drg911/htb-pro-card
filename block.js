/* global window */
(function (wp) {
  const { registerBlockType } = wp.blocks;
  const { __ } = wp.i18n || { __: (s) => s };
  const be = wp.blockEditor || wp.editor;
  const { InspectorControls, useBlockProps } = be;
  const {
    PanelBody,
    TextControl,
    ToggleControl,
    SelectControl,
    ColorPalette,
    __experimentalNumberControl: NumberControl,
  } = wp.components;

  const CATEGORY = 'htbpc';

  const previewWrap = (title, lines) =>
    wp.element.createElement(
      'div',
      useBlockProps({
        style: {
          border: '1px dashed #335',
          background: '#0f1a14',
          color: '#cde5db',
          borderRadius: 8,
          padding: 12,
        },
      }),
      wp.element.createElement('strong', null, title),
      ...lines.map((t) =>
        wp.element.createElement(
          'div',
          { style: { marginTop: 6, opacity: 0.9 } },
          t
        )
      )
    );

  // Shared inspector section for id/ttl/json
  const SourceSettings = ({ attrs, setAttrs }) =>
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
    );

  /* ──────────────────────────────────────────────────────────
     1) HTB: Profile Card
  ────────────────────────────────────────────────────────── */
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
        SourceSettings({ attrs: attributes, setAttrs: setAttributes }),
        wp.element.createElement(
          PanelBody,
          { title: __('Display', 'htb-pro-card'), initialOpen: false },
          wp.element.createElement(ToggleControl, {
            label: __('Show official badge', 'htb-pro-card'),
            checked: !!attributes.badge,
            onChange: (v) => setAttributes({ badge: !!v }),
          })
        )
      ),
      previewWrap('HTB: Profile Card', [
        attributes.id ? `User ID: ${attributes.id}` : 'Using plugin defaults',
        attributes.badge ? 'Badge: on' : 'Badge: off',
        'Server-rendered on front end',
      ]),
    ],
    save: () => null,
  });

  /* ──────────────────────────────────────────────────────────
     2) HTB: Badge
  ────────────────────────────────────────────────────────── */
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
      previewWrap('HTB: Badge', [
        attributes.id ? `User ID: ${attributes.id}` : 'Using plugin default',
        `Size: ${attributes.size}px`,
      ]),
    ],
    save: () => null,
  });

  /* ──────────────────────────────────────────────────────────
     3) HTB: Rank Chip
  ────────────────────────────────────────────────────────── */
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
        SourceSettings({ attrs: attributes, setAttrs: setAttributes }),
        wp.element.createElement(
          PanelBody,
          { title: __('Chip Colors', 'htb-pro-card'), initialOpen: false },
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
      previewWrap('HTB: Rank Chip', [
        attributes.id ? `User ID: ${attributes.id}` : 'Using plugin default',
        'Colors configurable in inspector',
      ]),
    ],
    save: () => null,
  });

  /* ──────────────────────────────────────────────────────────
     4) HTB: Progress
  ────────────────────────────────────────────────────────── */
  registerBlockType('htb/progress', {
    apiVersion: 2,
    title: 'HTB: Progress',
    icon: 'performance',
    category: CATEGORY,
    attributes: {
      id: { type: 'string' },
      ttl: { type: 'number', default: 43200 },
      json_url: { type: 'string' },
      bar: { type: 'string', default: '#1aa36b' },
      track: { type: 'string', default: '#10251e' },
    },
    edit: ({ attributes, setAttributes }) => [
      wp.element.createElement(
        InspectorControls,
        {},
        SourceSettings({ attrs: attributes, setAttrs: setAttributes }),
        wp.element.createElement(
          PanelBody,
          { title: __('Bar Colors', 'htb-pro-card'), initialOpen: false },
          wp.element.createElement('div', { style: { marginBottom: 8 } }, 'Bar'),
          wp.element.createElement(ColorPalette, {
            value: attributes.bar,
            onChange: (v) => setAttributes({ bar: v }),
          }),
          wp.element.createElement('div', { style: { marginTop: 12, marginBottom: 8 } }, 'Track'),
          wp.element.createElement(ColorPalette, {
            value: attributes.track,
            onChange: (v) => setAttributes({ track: v }),
          })
        )
      ),
      previewWrap('HTB: Progress', [
        attributes.id ? `User ID: ${attributes.id}` : 'Using plugin default',
        'Server-rendered on front end',
      ]),
    ],
    save: () => null,
  });

  /* ──────────────────────────────────────────────────────────
     5) HTB: Profile Field (dropdown for a single datum)
  ────────────────────────────────────────────────────────── */
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
          // Data source
          SourceSettings({ attrs: attributes, setAttrs: setAttributes }),
          // Field + presentation
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
        previewWrap('HTB: Profile Field', [
          `Field: ${attributes.field}`,
          attributes.id ? `User ID: ${attributes.id}` : 'Using plugin default',
          isAvatar
            ? `Avatar size: ${attributes.size}px`
            : attributes.pill
            ? 'Style: pill'
            : 'Style: text',
          'Server-rendered on front end',
        ]),
      ];
    },
    save: () => null,
  });
})(window.wp);
