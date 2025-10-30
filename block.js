( function( wp ) {
  const { registerBlockType } = wp.blocks;
  const { __ } = wp.i18n;
  const { InspectorControls, useBlockProps } = wp.blockEditor || wp.editor;
  const { PanelBody, TextControl, ToggleControl, __experimentalNumberControl: NumberControl } = wp.components;

  registerBlockType( 'htb/pro-card', {
    apiVersion: 2,
    title: __('HTB Pro Card', 'htb-pro-card'),
    description: __('Displays a Hack The Box profile card.', 'htb-pro-card'),
    icon: 'shield',
    category: 'widgets',
    attributes: {
      id:       { type: 'string',  default: '' },
      ttl:      { type: 'number',  default: 43200 },
      badge:    { type: 'boolean', default: true },
      json_url: { type: 'string',  default: '' },
    },
    edit: ( { attributes, setAttributes } ) => {
      const { id, ttl, badge, json_url } = attributes;

      return (
        <>
          <InspectorControls>
            <PanelBody title={__('Settings', 'htb-pro-card')} initialOpen={true}>
              <TextControl
                label={__('HTB User ID', 'htb-pro-card')}
                placeholder="e.g., 2651542"
                value={id}
                onChange={(val)=>setAttributes({ id: val })}
              />
              <NumberControl
                label={__('Cache TTL (seconds)', 'htb-pro-card')}
                value={ttl}
                onChange={(val)=>setAttributes({ ttl: Number(val || 0) })}
                min={60}
                step={60}
              />
              <ToggleControl
                label={__('Show badge', 'htb-pro-card')}
                checked={!!badge}
                onChange={(val)=>setAttributes({ badge: !!val })}
              />
              <TextControl
                label={__('(Optional) JSON URL', 'htb-pro-card')}
                help={__('Use a local relay file, e.g. /wp-content/uploads/htb/htb.json', 'htb-pro-card')}
                value={json_url}
                onChange={(val)=>setAttributes({ json_url: val })}
              />
            </PanelBody>
          </InspectorControls>

          <div { ...useBlockProps( { className: 'htb-pro-card-placeholder', style:{ padding:'16px', border:'1px dashed #3a4', borderRadius:'8px', background:'#0f1a14', color:'#cde5db' } } ) }>
            <strong>HTB Pro Card</strong>
            <div style={{ marginTop: 8 }}>
              { id ? <>User ID: <code>{id}</code></> : <em>Set a User ID in the right sidebar</em> }
            </div>
            <div style={{ marginTop: 4, opacity:.85, fontSize:12 }}>
              TTL: {ttl}s • Badge: { badge ? 'on' : 'off' } { json_url ? ' • JSON: custom' : '' }
            </div>
            <div style={{ marginTop: 8, fontSize:12, opacity:.75 }}>
              The actual card renders on the front end (server-rendered).
            </div>
          </div>
        </>
      );
    },
    save: () => null, // dynamic block (server-rendered)
  } );
} )( window.wp );
