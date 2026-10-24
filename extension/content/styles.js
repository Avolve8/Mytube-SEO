/* MyTube SEO — styles des panneaux injectés (ajoutés à MT.widgets.CSS dans les racines Shadow DOM). */
(function (root) {
  'use strict';
  const MT = (root.MT = root.MT || {});
  MT.contentCSS = `
:host{all:initial;display:block}
.mt-panel{background:var(--mt-bg);color:var(--mt-fg);border:1px solid var(--mt-border);border-radius:12px;box-shadow:var(--mt-shadow);margin:0 0 16px;overflow:hidden;font-size:13px}
.mt-panel-head{display:flex;align-items:center;gap:8px;padding:9px 12px;cursor:pointer;user-select:none;background:linear-gradient(90deg,color-mix(in srgb,var(--mt-accent) 10%,var(--mt-bg)),var(--mt-bg))}
.mt-logo{width:20px;height:20px;border-radius:6px;background:linear-gradient(135deg,#ff6a2b,#d71f26);display:inline-flex;align-items:center;justify-content:center;color:#fff;flex:none}
.mt-logo svg{width:12px;height:12px}
.mt-panel-title{font-weight:700;font-size:13.5px}
.mt-panel-sub{color:var(--mt-muted);font-size:12px}
.mt-panel-actions{margin-left:auto;display:flex;gap:2px;align-items:center}
.mt-panel-body{padding:10px 12px 12px}
.mt-panel.collapsed .mt-panel-body{display:none}
.mt-floating{position:fixed;z-index:2300;width:360px;max-height:calc(100vh - 90px);overflow:auto;right:16px;bottom:16px}
.mt-floating.left{right:auto;left:16px}
.mt-floating.top{bottom:auto;top:72px}
.mt-floating .mt-panel{margin:0}
.mt-section{margin-top:10px}
.mt-section-title{font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--mt-muted);margin:0 0 6px;display:flex;align-items:center;gap:6px}
.mt-gauges{display:flex;gap:12px;align-items:center;justify-content:space-around;flex-wrap:wrap}
.mt-gauge-box{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:11.5px;color:var(--mt-muted)}
.mt-toolbar{display:flex;gap:4px;align-items:center;background:var(--mt-bg);border:1px solid var(--mt-border);border-radius:10px;padding:4px;box-shadow:var(--mt-shadow)}
.mt-dropdown{position:absolute;z-index:5;background:var(--mt-bg);border:1px solid var(--mt-border);border-radius:10px;box-shadow:var(--mt-shadow);width:320px;max-height:320px;overflow:auto;padding:6px}
.mt-dropdown-item{padding:7px 9px;border-radius:7px;cursor:pointer}
.mt-dropdown-item:hover{background:var(--mt-bg2)}
.mt-dropdown-item .mt-small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mt-check-row{display:flex;gap:8px;align-items:flex-start;padding:3px 0;cursor:pointer}
.mt-check-row input{margin-top:2px}
.mt-check-row.done span{color:var(--mt-muted);text-decoration:line-through}
.mt-rankbadge{font-weight:700}
`;
})(typeof globalThis !== 'undefined' ? globalThis : this);
