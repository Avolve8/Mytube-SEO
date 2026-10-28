/*
 * MyTube SEO — composants visuels partagés (pages de l'extension et panneaux injectés dans YouTube).
 * Construits uniquement avec MT.el / MT.svg. Les styles (MT.widgets.CSS) s'appliquent sous .mt-root.
 */
(function (root) {
  'use strict';
  const MT = (root.MT = root.MT || {});
  const { el, svg } = MT;

  const CSS = `
.mt-root{--mt-bg:#ffffff;--mt-bg2:#f5f6f8;--mt-bg3:#eceef2;--mt-fg:#101318;--mt-muted:#5d6470;--mt-border:#e1e4ea;--mt-accent:#e5352b;--mt-accent2:#ff7a1a;--mt-accent-fg:#ffffff;--mt-link:#1764d8;--mt-great:#0f9d58;--mt-good:#5bb030;--mt-fair:#d99a00;--mt-poor:#e8711c;--mt-bad:#d93025;--mt-shadow:0 1px 2px rgba(16,19,24,.06),0 4px 14px rgba(16,19,24,.06);--mt-radius:10px;
  font-family:Roboto,"Segoe UI",system-ui,-apple-system,sans-serif;font-size:13px;line-height:1.45;color:var(--mt-fg);}
.mt-root[data-theme="dark"]{--mt-bg:#17191e;--mt-bg2:#1f2229;--mt-bg3:#2a2e37;--mt-fg:#eceef2;--mt-muted:#9aa1ad;--mt-border:#30343d;--mt-link:#6aa7ff;--mt-shadow:0 1px 2px rgba(0,0,0,.4),0 4px 14px rgba(0,0,0,.3);}
.mt-root *{box-sizing:border-box}
.mt-root a{color:var(--mt-link);text-decoration:none}
.mt-root a:hover{text-decoration:underline}
.mt-root a.mt-btn{color:var(--mt-fg);text-decoration:none}
.mt-root a.mt-btn.primary{color:var(--mt-accent-fg)}
.mt-muted{color:var(--mt-muted)}
.mt-small{font-size:11.5px}
.mt-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.mt-col{display:flex;flex-direction:column;gap:8px}
.mt-grow{flex:1 1 auto;min-width:0}
.mt-ellipsis{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mt-btn{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--mt-border);background:var(--mt-bg);color:var(--mt-fg);border-radius:8px;padding:6px 11px;font:inherit;font-weight:500;cursor:pointer;white-space:nowrap;transition:background .15s,border-color .15s}
.mt-btn:hover{background:var(--mt-bg2)}
.mt-btn:disabled{opacity:.55;cursor:not-allowed}
.mt-btn.primary{background:var(--mt-accent);border-color:var(--mt-accent);color:var(--mt-accent-fg)}
.mt-btn.primary:hover{filter:brightness(1.07)}
.mt-btn.ghost{border-color:transparent;background:transparent}
.mt-btn.ghost:hover{background:var(--mt-bg2)}
.mt-btn.danger{color:var(--mt-bad)}
.mt-btn.sm{padding:3px 8px;font-size:12px;border-radius:7px}
.mt-btn svg{width:15px;height:15px;flex:none}
.mt-input,.mt-select,.mt-textarea{width:100%;border:1px solid var(--mt-border);background:var(--mt-bg);color:var(--mt-fg);border-radius:8px;padding:7px 10px;font:inherit;outline:none}
.mt-input:focus,.mt-select:focus,.mt-textarea:focus{border-color:var(--mt-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--mt-accent) 18%,transparent)}
.mt-textarea{resize:vertical;min-height:80px}
.mt-card{background:var(--mt-bg);border:1px solid var(--mt-border);border-radius:var(--mt-radius);padding:14px;box-shadow:var(--mt-shadow)}
.mt-card h3{margin:0 0 10px;font-size:14px;font-weight:600;display:flex;align-items:center;gap:8px}
.mt-chips{display:flex;flex-wrap:wrap;gap:6px}
.mt-chip{display:inline-flex;align-items:center;gap:5px;background:var(--mt-bg2);border:1px solid var(--mt-border);border-radius:999px;padding:3px 10px;font-size:12px;max-width:100%;cursor:default}
.mt-chip.clickable{cursor:pointer}
.mt-chip.clickable:hover{border-color:var(--mt-accent)}
.mt-chip .mt-chip-x{cursor:pointer;opacity:.6;font-weight:700}
.mt-chip .mt-chip-x:hover{opacity:1;color:var(--mt-bad)}
.mt-chip .mt-chip-badge{background:var(--mt-bg3);border-radius:999px;padding:0 6px;font-size:10.5px;color:var(--mt-muted)}
.mt-chip.tone-great{border-color:var(--mt-great)}.mt-chip.tone-good{border-color:var(--mt-good)}.mt-chip.tone-fair{border-color:var(--mt-fair)}.mt-chip.tone-poor,.mt-chip.tone-bad{border-color:var(--mt-poor)}
.mt-pill{display:inline-flex;align-items:center;justify-content:center;min-width:34px;padding:2px 8px;border-radius:999px;font-weight:700;font-size:12px;color:#fff}
.tone-great .mt-pill-bg,.mt-pill.tone-great{background:var(--mt-great)}
.mt-pill.tone-good{background:var(--mt-good)}.mt-pill.tone-fair{background:var(--mt-fair)}.mt-pill.tone-poor{background:var(--mt-poor)}.mt-pill.tone-bad{background:var(--mt-bad)}.mt-pill.tone-none{background:var(--mt-muted)}
.mt-gauge{position:relative;display:inline-flex;align-items:center;justify-content:center}
.mt-gauge .mt-gauge-val{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:700}
.mt-gauge .mt-gauge-lbl{font-size:10px;font-weight:500;color:var(--mt-muted);text-transform:uppercase;letter-spacing:.04em}
.mt-meter{display:flex;flex-direction:column;gap:4px}
.mt-meter-head{display:flex;justify-content:space-between;font-size:12px}
.mt-meter-bar{height:7px;background:var(--mt-bg3);border-radius:999px;overflow:hidden}
.mt-meter-fill{height:100%;border-radius:999px}
.mt-stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px}
.mt-stat{background:var(--mt-bg2);border-radius:8px;padding:8px 10px;min-width:0}
.mt-stat-label{font-size:11px;color:var(--mt-muted);line-height:1.3}
.mt-stat-value{font-size:16px;font-weight:700;margin-top:1px;overflow-wrap:anywhere}
.mt-stat-hint{font-size:11px;color:var(--mt-muted)}
.mt-checks{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.mt-check{display:flex;gap:8px;align-items:flex-start}
.mt-check-icon{flex:none;width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;margin-top:1px}
.mt-check.ok .mt-check-icon{background:var(--mt-great)}.mt-check.warn .mt-check-icon{background:var(--mt-fair)}.mt-check.bad .mt-check-icon{background:var(--mt-bad)}
.mt-check-label{font-weight:500}
.mt-check-tip{font-size:11.5px;color:var(--mt-muted)}
.mt-tabs{display:flex;gap:2px;border-bottom:1px solid var(--mt-border);margin-bottom:10px;overflow-x:auto}
.mt-tab{background:none;border:none;border-bottom:2px solid transparent;padding:7px 10px;font:inherit;font-weight:500;color:var(--mt-muted);cursor:pointer;white-space:nowrap}
.mt-tab:hover{color:var(--mt-fg)}
.mt-tab.active{color:var(--mt-fg);border-bottom-color:var(--mt-accent)}
.mt-table-wrap{overflow:auto;border:1px solid var(--mt-border);border-radius:8px}
.mt-table{width:100%;border-collapse:collapse;font-size:12.5px}
.mt-table th{position:sticky;top:0;background:var(--mt-bg2);text-align:left;font-weight:600;padding:7px 9px;border-bottom:1px solid var(--mt-border);white-space:nowrap;user-select:none}
.mt-table th.sortable{cursor:pointer}
.mt-table th.sortable:hover{color:var(--mt-accent)}
.mt-table td{padding:6px 9px;border-bottom:1px solid var(--mt-border);vertical-align:middle}
.mt-table tr:last-child td{border-bottom:none}
.mt-table tr:hover td{background:color-mix(in srgb,var(--mt-bg2) 60%,transparent)}
.mt-table td.num,.mt-table th.num{text-align:right;font-variant-numeric:tabular-nums}
.mt-empty{padding:22px;text-align:center;color:var(--mt-muted)}
.mt-spinner{width:18px;height:18px;border:2px solid var(--mt-border);border-top-color:var(--mt-accent);border-radius:50%;animation:mt-spin .8s linear infinite;display:inline-block;vertical-align:middle}
@keyframes mt-spin{to{transform:rotate(360deg)}}
.mt-loading{display:flex;align-items:center;gap:10px;color:var(--mt-muted);padding:10px}
.mt-alert{border-radius:8px;padding:9px 12px;background:var(--mt-bg2);border-left:3px solid var(--mt-link);font-size:12.5px}
.mt-alert.warn{border-left-color:var(--mt-fair)}.mt-alert.error{border-left-color:var(--mt-bad)}.mt-alert.success{border-left-color:var(--mt-great)}
.mt-progress{height:6px;background:var(--mt-bg3);border-radius:999px;overflow:hidden}
.mt-progress>div{height:100%;background:var(--mt-accent);transition:width .2s}
.mt-chart text{fill:var(--mt-muted);font-size:10px}
.mt-chart .grid{stroke:var(--mt-border);stroke-width:1}
.mt-chart{cursor:crosshair;touch-action:pan-y}
.mt-chart .mt-chart-guide{stroke:var(--mt-muted);stroke-width:1;stroke-dasharray:3 3;vector-effect:non-scaling-stroke}
.mt-bar-row{border-radius:6px;padding:2px 4px;margin:0 -4px;cursor:default}
.mt-bar-row:hover{background:var(--mt-bg2)}
.mt-bar-row:hover .mt-meter-fill{filter:brightness(1.1)}
.mt-heat td{cursor:default}
.mt-heat td:hover{outline:2px solid var(--mt-fg);outline-offset:-2px}
.mt-tooltip{position:fixed;z-index:2147483647;display:none;pointer-events:none;background:#1f2229;color:#fff;border-radius:8px;padding:7px 10px;font-size:12px;line-height:1.4;box-shadow:0 6px 24px rgba(0,0,0,.28);max-width:300px}
.mt-root[data-theme="dark"] .mt-tooltip{background:#f1f2f5;color:#101318}
.mt-tooltip-title{font-weight:700;margin-bottom:3px}
.mt-tooltip-row+.mt-tooltip-row{margin-top:2px}
.mt-tooltip-line{display:flex;align-items:baseline;gap:6px}
.mt-tooltip-line strong{flex:none;margin-left:auto;padding-left:10px}
.mt-tooltip-label{flex:1;min-width:0;opacity:.85}
.mt-tooltip-dot{width:9px;height:9px;border-radius:50%;flex:none;align-self:center}
.mt-tooltip-sub{opacity:.7;font-size:11px;padding-left:15px;overflow-wrap:anywhere}
.mt-cloud{display:flex;flex-wrap:wrap;gap:4px 12px;align-items:baseline;justify-content:center;padding:10px;line-height:1.1}
.mt-cloud span{cursor:default}
.mt-heat{border-collapse:separate;border-spacing:2px;font-size:10.5px}
.mt-heat td{width:26px;height:22px;border-radius:4px;text-align:center;color:var(--mt-fg)}
.mt-heat th{font-weight:500;color:var(--mt-muted);padding:0 4px}
.mt-toast-host{position:fixed;z-index:2147483647;bottom:18px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none}
.mt-toast{pointer-events:auto;background:#1f2229;color:#fff;border-radius:9px;padding:9px 14px;box-shadow:0 6px 24px rgba(0,0,0,.25);font-size:13px;max-width:420px;animation:mt-in .2s ease}
.mt-toast.error{background:#b3261e}.mt-toast.success{background:#0b7a43}
@keyframes mt-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.mt-modal-back{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:2147483646;display:flex;align-items:center;justify-content:center;padding:16px}
.mt-modal{background:var(--mt-bg);color:var(--mt-fg);border-radius:12px;max-width:640px;width:100%;max-height:90vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.35)}
.mt-modal-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--mt-border);font-weight:600;font-size:15px}
.mt-modal-body{padding:16px}
.mt-modal-foot{display:flex;justify-content:flex-end;gap:8px;padding:12px 16px;border-top:1px solid var(--mt-border)}
.mt-thumb{width:120px;aspect-ratio:16/9;object-fit:cover;border-radius:6px;background:var(--mt-bg3);flex:none}
.mt-thumb.sm{width:80px}
.mt-kv{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;font-size:12.5px}
.mt-kv dt{color:var(--mt-muted)}.mt-kv dd{margin:0;font-weight:500;min-width:0;overflow-wrap:anywhere}
.mt-emoji-grid{display:grid;grid-template-columns:repeat(10,1fr);gap:2px;max-height:200px;overflow:auto;padding:4px}
.mt-emoji-grid button{border:none;background:none;font-size:18px;cursor:pointer;border-radius:6px;padding:3px}
.mt-emoji-grid button:hover{background:var(--mt-bg2)}
`;

  /* ----------------------------------------------------------- icônes */

  const ICONS = {
    search: 'M10 2a8 8 0 105.3 14l5.4 5.3 1.4-1.4-5.3-5.4A8 8 0 0010 2zm0 2a6 6 0 110 12 6 6 0 010-12z',
    copy: 'M8 3h10a2 2 0 012 2v12h-2V5H8V3zM5 7h10a2 2 0 012 2v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9a2 2 0 012-2zm0 2v11h10V9H5z',
    tag: 'M3 3h8l10 10-8 8L3 11V3zm4 2.5A1.5 1.5 0 107 8.5a1.5 1.5 0 000-3z',
    chart: 'M3 3h2v16h16v2H3V3zm4 10h2v4H7v-4zm4-6h2v10h-2V7zm4 3h2v7h-2v-7z',
    star: 'M12 2l3 7 7 .6-5.3 4.6 1.6 7-6.3-3.8L5.7 21l1.6-7L2 9.6 9 9z',
    check: 'M9 16.2l-3.5-3.6L4 14l5 5 11-11-1.4-1.4z',
    x: 'M6.4 5L5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19l1.4-1.4L13.4 12 19 6.4 17.6 5 12 10.6z',
    warn: 'M12 2L1 21h22L12 2zm0 4l7.5 13h-15L12 6zm-1 4v4h2v-4h-2zm0 6v2h2v-2h-2z',
    info: 'M12 2a10 10 0 100 20 10 10 0 000-20zm-1 5h2v2h-2V7zm0 4h2v6h-2v-6z',
    external: 'M14 3h7v7h-2V6.4l-9.3 9.3-1.4-1.4L17.6 5H14V3zM5 5h6v2H5v12h12v-6h2v6a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z',
    download: 'M11 3h2v9.6l3.3-3.3 1.4 1.4L12 16.4l-5.7-5.7 1.4-1.4 3.3 3.3V3zM4 19h16v2H4v-2z',
    refresh: 'M17.7 6.3A8 8 0 104 12h2a6 6 0 1110.3 4.2L14 14v6h6l-2.3-2.3A8 8 0 0017.7 6.3z',
    plus: 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z',
    trash: 'M9 3h6l1 1h4v2H4V4h4l1-1zM6 8h12l-1 13H7L6 8zm4 2v9h2v-9h-2zm-3 0l.6 9h1.8L9 10H7zm8 0l-.4 9h1.8l.6-9h-2z',
    edit: 'M3 17.2V21h3.8l11-11-3.8-3.8-11 11zM20.7 7a1 1 0 000-1.4l-2.3-2.3a1 1 0 00-1.4 0l-1.8 1.8 3.8 3.7L20.7 7z',
    play: 'M8 5v14l11-7z',
    image: 'M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zm0 2v9l4-4 4 4 3-3 5 5V6H4zm11 1.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3z',
    comment: 'M4 3h16a2 2 0 012 2v11a2 2 0 01-2 2H8l-4 4V5a2 2 0 012-2z',
    bell: 'M12 22a2 2 0 002-2h-4a2 2 0 002 2zm6-6V11a6 6 0 00-5-5.9V4h-2v1.1A6 6 0 006 11v5l-2 2v1h16v-1l-2-2z',
    calendar: 'M7 2h2v2h6V2h2v2h3a1 1 0 011 1v15a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1h3V2zM5 9v10h14V9H5z',
    settings:
      'M12 8a4 4 0 100 8 4 4 0 000-8zm8.9 5.5l2-1.5-2-3.5-2.4 1a7 7 0 00-1.8-1L16.4 6h-4l-.4 2.5a7 7 0 00-1.8 1l-2.4-1-2 3.5 2 1.5a7 7 0 000 2l-2 1.5 2 3.5 2.4-1a7 7 0 001.8 1l.4 2.5h4l.4-2.5a7 7 0 001.8-1l2.4 1 2-3.5-2-1.5a7 7 0 000-2z',
    user: 'M12 12a4.5 4.5 0 100-9 4.5 4.5 0 000 9zm0 2c-4 0-8 2-8 5v2h16v-2c0-3-4-5-8-5z',
    trophy: 'M7 3h10v2h4v3a4 4 0 01-4 4h-.3A5 5 0 0113 15v3h3v2H8v-2h3v-3a5 5 0 01-3.7-3H7a4 4 0 01-4-4V5h4V3zm-2 4v1a2 2 0 002 2V7H5zm14 0h-2v3a2 2 0 002-2V7z',
    globe:
      'M12 2a10 10 0 100 20 10 10 0 000-20zm6.9 6h-3a15 15 0 00-1.3-3.9A8 8 0 0118.9 8zM12 4.1c.8 1.1 1.5 2.4 1.9 3.9h-3.8c.4-1.5 1.1-2.8 1.9-3.9zM4.3 14a8 8 0 010-4h3.4a16 16 0 000 4H4.3zm.8 2h3a15 15 0 001.3 3.9A8 8 0 015.1 16zm3-8h-3a8 8 0 014.3-3.9A15 15 0 008.1 8zM12 19.9c-.8-1.1-1.5-2.4-1.9-3.9h3.8c-.4 1.5-1.1 2.8-1.9 3.9zM14.3 14H9.7a14 14 0 010-4h4.6a14 14 0 010 4zm.3 5.9A15 15 0 0015.9 16h3a8 8 0 01-4.3 3.9zM16.3 14a16 16 0 000-4h3.4a8 8 0 010 4h-3.4z',
    bolt: 'M13 2L4 14h6l-1 8 9-12h-6l1-8z',
    list: 'M4 5h2v2H4V5zm4 0h12v2H8V5zm-4 6h2v2H4v-2zm4 0h12v2H8v-2zm-4 6h2v2H4v-2zm4 0h12v2H8v-2z',
    sort: 'M7 3l4 4H8v10H6V7H3l4-4zm10 18l-4-4h3V7h2v10h3l-4 4z',
    flask: 'M9 2h6v2h-1v5.3l5.7 9.5A2 2 0 0118 22H6a2 2 0 01-1.7-3.2L10 9.3V4H9V2zm3 9.2L8.4 17h7.2L12 11.2z',
    clock: 'M12 2a10 10 0 100 20 10 10 0 000-20zm1 5v5.4l4 2.4-1 1.7-5-3V7h2z',
    shield: 'M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5l8-3z',
    target: 'M12 2a10 10 0 100 20 10 10 0 000-20zm0 4a6 6 0 110 12 6 6 0 010-12zm0 3a3 3 0 100 6 3 3 0 000-6z',
    users:
      'M9 11a4 4 0 100-8 4 4 0 000 8zm7 0a3 3 0 100-6 3 3 0 000 6zm-7 2c-3.3 0-7 1.7-7 4.5V20h14v-2.5C16 14.7 12.3 13 9 13zm7 0c-.5 0-1 0-1.5.1 1.5 1 2.5 2.5 2.5 4.4V20h5v-2.5c0-2.8-3-4.5-6-4.5z',
    share: 'M18 16a3 3 0 00-2.4 1.2l-6.7-3.4a3 3 0 000-1.6l6.7-3.4A3 3 0 1015 7l-6.7 3.4a3 3 0 100 3.2L15 17a3 3 0 103-1z',
    layers: 'M12 2l10 5-10 5L2 7l10-5zm-8 9.5l8 4 8-4 2 1L12 17.5 2 12.5l2-1zm0 5l8 4 8-4 2 1L12 22.5 2 17.5l2-1z',
    translate:
      'M12.9 15.1l-2.5-2.5v-.1A17 17 0 0014 6h3V4h-7V2H8v2H1v2h11.2A15.5 15.5 0 019 11.4 15.5 15.5 0 016.7 8H4.7a17 17 0 003 4.5L2.6 17.6 4 19l5-5 3.1 3.1.8-2zM18.5 10h-2L12 22h2l1.1-3h4.8l1.1 3h2l-4.5-12zm-2.6 7l1.6-4.3 1.6 4.3h-3.2z',
    money: 'M3 6h18v12H3V6zm2 2v8h14V8H5zm7 1.5a2.5 2.5 0 110 5 2.5 2.5 0 010-5z',
    upload: 'M11 16V6.4L7.7 9.7 6.3 8.3 12 2.6l5.7 5.7-1.4 1.4L13 6.4V16h-2zM4 19h16v2H4v-2z',
    home: 'M12 3l9 8h-3v9h-5v-6h-2v6H6v-9H3l9-8z',
    help: 'M12 2a10 10 0 100 20 10 10 0 000-20zm0 15a1.3 1.3 0 110 2.6 1.3 1.3 0 010-2.6zm0-11c2.2 0 4 1.5 4 3.6 0 1.5-.9 2.3-1.9 3-.7.5-1.1.9-1.1 1.9v.5h-2v-.6c0-1.7.8-2.5 1.8-3.2.7-.5 1.2-.9 1.2-1.6 0-1-.9-1.6-2-1.6s-2 .7-2.1 1.8H8C8.1 7.5 9.8 6 12 6z',
    emoji: 'M12 2a10 10 0 100 20 10 10 0 000-20zM8.5 8a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm7 0a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM7 14h10a5 5 0 01-10 0z',
    gift: 'M20 7h-2.2A3 3 0 0012 3.8 3 3 0 006.2 7H4a1 1 0 00-1 1v3h8V7h2v4h8V8a1 1 0 00-1-1zM9 7a1 1 0 110-2 1 1 0 011 1v1H9zm6 0h-1V6a1 1 0 111 1zM4 13v7a1 1 0 001 1h6v-8H4zm9 8h6a1 1 0 001-1v-7h-7v8z',
  };

  function icon(name, size = 16) {
    return svg('svg', { viewBox: '0 0 24 24', width: size, height: size, fill: 'currentColor', 'aria-hidden': 'true' }, svg('path', { d: ICONS[name] || ICONS.info }));
  }

  /* ---------------------------------------------------------- éléments */

  function toneOf(score) {
    if (score == null || Number.isNaN(score)) return 'none';
    if (score >= 80) return 'great';
    if (score >= 60) return 'good';
    if (score >= 40) return 'fair';
    if (score >= 20) return 'poor';
    return 'bad';
  }

  const TONE_VAR = { great: 'var(--mt-great)', good: 'var(--mt-good)', fair: 'var(--mt-fair)', poor: 'var(--mt-poor)', bad: 'var(--mt-bad)', none: 'var(--mt-muted)' };

  function button(label, onClick, opts = {}) {
    const b = el(
      'button',
      { class: ['mt-btn', opts.variant, opts.size], type: 'button', title: opts.title || null, disabled: !!opts.disabled },
      opts.icon ? icon(opts.icon) : null,
      label
    );
    if (onClick) {
      b.addEventListener('click', async (e) => {
        if (opts.busy === false) return onClick(e);
        if (b.disabled) return;
        const original = [...b.childNodes];
        b.disabled = true;
        try {
          const ret = onClick(e);
          if (ret && typeof ret.then === 'function') {
            MT.clear(b);
            b.append(el('span', { class: 'mt-spinner', style: 'width:13px;height:13px' }), label);
            await ret;
          }
        } catch (err) {
          toast(err.message || String(err), 'error');
        } finally {
          MT.clear(b);
          b.append(...original);
          b.disabled = !!opts.disabled;
        }
      });
    }
    return b;
  }

  function pill(score, text) {
    return el('span', { class: ['mt-pill', 'tone-' + toneOf(score)] }, text != null ? text : score == null ? '—' : String(Math.round(score)));
  }

  /** Jauge circulaire 0-100. inverse=true : une valeur haute est mauvaise (concurrence). */
  function gauge(score, { size = 74, label = '', inverse = false } = {}) {
    const r = size / 2 - 6;
    const c = 2 * Math.PI * r;
    const v = score == null ? 0 : Math.max(0, Math.min(100, score));
    const tone = toneOf(inverse ? 100 - v : v);
    return el(
      'div',
      { class: 'mt-gauge', style: { width: size + 'px', height: size + 'px' } },
      svg(
        'svg',
        { width: size, height: size, viewBox: `0 0 ${size} ${size}` },
        svg('circle', { cx: size / 2, cy: size / 2, r, fill: 'none', stroke: 'var(--mt-bg3)', 'stroke-width': 7 }),
        svg('circle', {
          cx: size / 2,
          cy: size / 2,
          r,
          fill: 'none',
          stroke: TONE_VAR[tone],
          'stroke-width': 7,
          'stroke-linecap': 'round',
          'stroke-dasharray': `${(v / 100) * c} ${c}`,
          transform: `rotate(-90 ${size / 2} ${size / 2})`,
        })
      ),
      el(
        'div',
        { class: 'mt-gauge-val', style: { fontSize: Math.round(size / 3.6) + 'px' } },
        score == null ? '—' : String(Math.round(v)),
        label ? el('span', { class: 'mt-gauge-lbl' }, label) : null
      )
    );
  }

  function meter(label, value, { inverse = false, suffix = '', text } = {}) {
    const v = value == null ? 0 : Math.max(0, Math.min(100, value));
    const tone = toneOf(inverse ? 100 - v : v);
    return el(
      'div',
      { class: 'mt-meter' },
      el('div', { class: 'mt-meter-head' }, el('span', null, label), el('strong', null, text != null ? text : value == null ? '—' : Math.round(v) + suffix)),
      el('div', { class: 'mt-meter-bar' }, el('div', { class: 'mt-meter-fill', style: { width: v + '%', background: TONE_VAR[tone] } }))
    );
  }

  function stats(items) {
    return el(
      'div',
      { class: 'mt-stats' },
      items
        .filter(Boolean)
        .map((it) =>
          el(
            'div',
            { class: 'mt-stat', title: it.title || null },
            el('div', { class: 'mt-stat-label' }, it.label),
            el('div', { class: 'mt-stat-value' }, it.value == null ? '—' : it.value),
            it.hint ? el('div', { class: 'mt-stat-hint' }, it.hint) : null
          )
        )
    );
  }

  function checklist(checks) {
    const sym = { ok: '✓', warn: '!', bad: '✕' };
    return el(
      'ul',
      { class: 'mt-checks' },
      checks.map((c) =>
        el(
          'li',
          { class: ['mt-check', c.status] },
          el('span', { class: 'mt-check-icon' }, sym[c.status] || '•'),
          el('div', null, el('div', { class: 'mt-check-label' }, c.label), c.tip ? el('div', { class: 'mt-check-tip' }, c.tip) : null)
        )
      )
    );
  }

  /** Liste de pastilles (tags). opts: {onClick, onRemove, badge(tag,i), tone(tag)} */
  function chips(items, opts = {}) {
    return el(
      'div',
      { class: 'mt-chips' },
      items.map((item, i) => {
        const label = typeof item === 'string' ? item : item.label || item.tag;
        const chip = el(
          'span',
          { class: ['mt-chip', opts.onClick ? 'clickable' : null, opts.tone ? 'tone-' + opts.tone(item, i) : null], title: opts.title ? opts.title(item, i) : label },
          el('span', { class: 'mt-ellipsis' }, label),
          opts.badge
            ? (() => {
                const b = opts.badge(item, i);
                return b != null && b !== '' ? el('span', { class: 'mt-chip-badge' }, b) : null;
              })()
            : null,
          opts.onRemove
            ? el(
                'span',
                {
                  class: 'mt-chip-x',
                  title: 'Retirer',
                  onclick: (e) => {
                    e.stopPropagation();
                    opts.onRemove(item, i);
                  },
                },
                '×'
              )
            : null
        );
        if (opts.onClick) chip.addEventListener('click', () => opts.onClick(item, i));
        return chip;
      })
    );
  }

  function spinner(text = 'Chargement…') {
    return el('div', { class: 'mt-loading' }, el('span', { class: 'mt-spinner' }), text);
  }

  function alert(text, type = 'info') {
    return el('div', { class: ['mt-alert', type] }, text);
  }

  function empty(text) {
    return el('div', { class: 'mt-empty' }, text);
  }

  function progress() {
    const fill = el('div', { style: 'width:0%' });
    const bar = el('div', { class: 'mt-progress' }, fill);
    bar.set = (done, total) => {
      fill.style.width = total ? Math.min(100, (done / total) * 100) + '%' : '0%';
    };
    return bar;
  }

  /** Onglets : defs = [{id, label, render: (container) => …}] */
  function tabs(defs, { initial, onChange } = {}) {
    const head = el('div', { class: 'mt-tabs', role: 'tablist' });
    const body = el('div');
    const rendered = new Map();
    function show(id) {
      for (const b of head.children) b.classList.toggle('active', b.dataset.id === id);
      for (const [k, node] of rendered) node.style.display = k === id ? '' : 'none';
      if (!rendered.has(id)) {
        const node = el('div');
        rendered.set(id, node);
        body.appendChild(node);
        const def = defs.find((d) => d.id === id);
        if (def) def.render(node);
      }
      if (onChange) onChange(id);
    }
    for (const d of defs) head.appendChild(el('button', { class: 'mt-tab', type: 'button', dataset: { id: d.id }, onclick: () => show(d.id) }, d.label));
    const wrap = el('div', null, head, body);
    wrap.show = show;
    show(initial || (defs[0] && defs[0].id));
    return wrap;
  }

  /**
   * Tableau triable. columns: [{key, label, num, render(row), sort(row), width}]
   */
  function table(columns, rows, { empty: emptyText = 'Aucune donnée', sortKey, sortDir = 'desc', maxHeight, rowAttrs } = {}) {
    let key = sortKey;
    let dir = sortDir;
    const tbody = el('tbody');
    const thead = el('thead');
    const wrap = el('div', { class: 'mt-table-wrap', style: maxHeight ? { maxHeight } : null }, el('table', { class: 'mt-table' }, thead, tbody));
    function valueOf(col, row) {
      return col.sort ? col.sort(row) : row[col.key];
    }
    function renderBody() {
      MT.clear(tbody);
      let data = [...rows];
      const col = columns.find((c) => c.key === key);
      if (col) {
        data.sort((a, b) => {
          const va = valueOf(col, a);
          const vb = valueOf(col, b);
          if (va == null && vb == null) return 0;
          if (va == null) return 1;
          if (vb == null) return -1;
          const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'fr', { numeric: true });
          return dir === 'asc' ? cmp : -cmp;
        });
      }
      if (!data.length) tbody.appendChild(el('tr', null, el('td', { colspan: columns.length }, empty(emptyText))));
      for (const row of data) {
        tbody.appendChild(
          el(
            'tr',
            rowAttrs ? rowAttrs(row) : null,
            columns.map((c) =>
              el('td', { class: c.num ? 'num' : null, style: c.width ? { width: c.width } : null }, c.render ? c.render(row) : row[c.key] == null ? '—' : String(row[c.key]))
            )
          )
        );
      }
    }
    function renderHead() {
      MT.clear(thead);
      thead.appendChild(
        el(
          'tr',
          null,
          columns.map((c) => {
            const sortable = c.sortable !== false && (c.key || c.sort);
            return el(
              'th',
              {
                class: [c.num ? 'num' : null, sortable ? 'sortable' : null],
                onclick: sortable
                  ? () => {
                      if (key === c.key) dir = dir === 'asc' ? 'desc' : 'asc';
                      else {
                        key = c.key;
                        dir = c.num ? 'desc' : 'asc';
                      }
                      renderHead();
                      renderBody();
                    }
                  : null,
              },
              c.label,
              key === c.key ? (dir === 'asc' ? ' ▲' : ' ▼') : ''
            );
          })
        )
      );
    }
    renderHead();
    renderBody();
    wrap.update = (newRows) => {
      rows = newRows;
      renderBody();
    };
    return wrap;
  }

  /* --------------------------------------------------------- graphiques */

  const PALETTE = ['#e5352b', '#1764d8', '#0f9d58', '#d99a00', '#8e44ad', '#16a2b8', '#ff7a1a', '#6c757d'];

  /* infobulle partagée par tous les graphiques (suit le curseur) */

  let tipEl = null;
  let tipOwner = null;

  function tooltipHide() {
    if (tipEl) tipEl.style.display = 'none';
    tipOwner = null;
  }

  function tooltipShow(owner, content, clientX, clientY) {
    const parent = overlayParent();
    if (!tipEl || !tipEl.isConnected || tipEl.parentNode !== parent) {
      tipEl = el('div', { class: 'mt-tooltip', role: 'tooltip' });
      parent.appendChild(tipEl);
    }
    tipOwner = owner;
    MT.fill(tipEl, content);
    tipEl.style.display = 'block';
    const w = tipEl.offsetWidth;
    const h = tipEl.offsetHeight;
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const vh = document.documentElement.clientHeight || window.innerHeight;
    let left = clientX + 14;
    if (left + w > vw - 8) left = Math.max(8, clientX - w - 14);
    let top = clientY + 14;
    if (top + h > vh - 8) top = Math.max(8, clientY - h - 14);
    tipEl.style.left = left + 'px';
    tipEl.style.top = top + 'px';
  }

  // l'élément survolé peut disparaître (redessin, navigation) sans déclencher pointerleave
  if (typeof document !== 'undefined') {
    document.addEventListener(
      'pointermove',
      (e) => {
        if (tipOwner && !(tipOwner.isConnected && e.composedPath().includes(tipOwner))) tooltipHide();
      },
      true
    );
    window.addEventListener('hashchange', tooltipHide);
    window.addEventListener('scroll', tooltipHide, true);
  }

  /**
   * Contenu d'infobulle : un titre puis des lignes {label, value, color, sub}.
   */
  function tipContent(title, rows = []) {
    return el(
      'div',
      null,
      title ? el('div', { class: 'mt-tooltip-title' }, title) : null,
      rows
        .filter(Boolean)
        .map((r) =>
          el(
            'div',
            { class: 'mt-tooltip-row' },
            el(
              'div',
              { class: 'mt-tooltip-line' },
              r.color ? el('span', { class: 'mt-tooltip-dot', style: { background: r.color } }) : null,
              el('span', { class: 'mt-tooltip-label' }, r.label),
              r.value != null ? el('strong', null, r.value) : null
            ),
            r.sub ? el('div', { class: 'mt-tooltip-sub' }, r.sub) : null
          )
        )
    );
  }

  /** Associe une infobulle à un élément ; contentFn(event) renvoie un contenu ou null. */
  function hoverTip(node, contentFn) {
    const move = (e) => {
      const c = contentFn(e);
      if (c) tooltipShow(node, c, e.clientX, e.clientY);
      else tooltipHide();
    };
    node.addEventListener('pointermove', move);
    node.addEventListener('pointerdown', move);
    node.addEventListener('pointerleave', tooltipHide);
    return node;
  }

  /** Point rond qui ne se déforme pas avec preserveAspectRatio="none". */
  function dot(x, y, color, size) {
    return svg('path', {
      d: `M${x.toFixed(1)},${y.toFixed(1)}l0.01,0`,
      stroke: color,
      'stroke-width': size,
      'stroke-linecap': 'round',
      'vector-effect': 'non-scaling-stroke',
      fill: 'none',
    });
  }

  function rankOf(value, values) {
    return 1 + values.filter((v) => v > value).length;
  }

  /**
   * Graphique linéaire. series: [{name, points: [{x (ms ou nombre), y, label?}], color}]
   * opts: {height, invert (rang : plus petit = mieux), yFormat, xFormat, xTipFormat (abscisse dans l'infobulle)}
   * Au survol : ligne verticale, points mis en évidence et valeurs de chaque série.
   */
  function lineChart(series, { height = 180, width = 640, invert = false, yFormat = MT.fmt.num, xFormat = (x) => MT.fmt.date(x), xTipFormat = xFormat, area = false } = {}) {
    // l'infobulle donne la valeur exacte (l'axe arrondit : « 11,8 k »)
    const yTipFormat = yFormat === MT.fmt.num ? MT.fmt.int : yFormat;
    const pts = series.flatMap((s) => s.points.filter((p) => p.y != null));
    if (!pts.length) return empty('Pas encore de données');
    const pad = { l: 46, r: 12, t: 10, b: 24 };
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    let xMin = Math.min(...xs);
    let xMax = Math.max(...xs);
    let yMin = Math.min(...ys);
    let yMax = Math.max(...ys);
    if (xMin === xMax) {
      xMin -= 1;
      xMax += 1;
    }
    if (yMin === yMax) {
      yMin = yMin - 1;
      yMax = yMax + 1;
    }
    const span = yMax - yMin;
    if (!invert) yMin = Math.max(0, yMin - span * 0.08);
    yMax += span * 0.08;
    const X = (x) => pad.l + ((x - xMin) / (xMax - xMin)) * (width - pad.l - pad.r);
    const Y = (y) => (invert ? pad.t + ((y - yMin) / (yMax - yMin)) * (height - pad.t - pad.b) : height - pad.b - ((y - yMin) / (yMax - yMin)) * (height - pad.t - pad.b));
    const g = svg('svg', { class: 'mt-chart', viewBox: `0 0 ${width} ${height}`, width: '100%', preserveAspectRatio: 'none', style: `height:${height}px` });
    for (let i = 0; i <= 4; i++) {
      const yv = yMin + ((yMax - yMin) * i) / 4;
      const y = Y(yv);
      g.appendChild(svg('line', { class: 'grid', x1: pad.l, x2: width - pad.r, y1: y, y2: y }));
      g.appendChild(svg('text', { x: pad.l - 6, y: y + 3, 'text-anchor': 'end' }, yFormat(invert ? Math.round(yv) : yv)));
    }
    for (let i = 0; i <= 3; i++) {
      const xv = xMin + ((xMax - xMin) * i) / 3;
      g.appendChild(svg('text', { x: X(xv), y: height - 6, 'text-anchor': i === 0 ? 'start' : i === 3 ? 'end' : 'middle' }, xFormat(xv)));
    }
    const drawn = [];
    series.forEach((s, si) => {
      const color = s.color || PALETTE[si % PALETTE.length];
      const p = s.points.filter((q) => q.y != null).sort((a, b) => a.x - b.x);
      if (!p.length) return;
      drawn.push({ name: s.name, color, points: p });
      const d = p.map((q, i) => `${i ? 'L' : 'M'}${X(q.x).toFixed(1)},${Y(q.y).toFixed(1)}`).join(' ');
      if (area && !invert) g.appendChild(svg('path', { d: `${d} L${X(p[p.length - 1].x)},${height - pad.b} L${X(p[0].x)},${height - pad.b} Z`, fill: color, opacity: 0.12 }));
      g.appendChild(svg('path', { d, fill: 'none', stroke: color, 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke' }));
      for (const q of p) g.appendChild(dot(X(q.x), Y(q.y), color, 5));
    });

    // couche de survol
    const guide = svg('line', { class: 'mt-chart-guide', x1: 0, x2: 0, y1: pad.t, y2: height - pad.b, visibility: 'hidden' });
    const markers = svg('g', { 'pointer-events': 'none' });
    g.append(guide, markers, svg('rect', { x: pad.l, y: 0, width: width - pad.l - pad.r, height, fill: 'transparent', 'pointer-events': 'all' }));
    const clearHover = () => {
      guide.setAttribute('visibility', 'hidden');
      MT.clear(markers);
    };
    hoverTip(g, (e) => {
      const r = g.getBoundingClientRect();
      if (!r.width) return null;
      const scale = r.width / width; // pixels écran par unité du viewBox
      const vx = ((e.clientX - r.left) / r.width) * width;
      let nearest = null;
      for (const s of drawn) {
        for (const q of s.points) {
          const dist = Math.abs(X(q.x) - vx);
          if (!nearest || dist < nearest.dist) nearest = { dist, q };
        }
      }
      if (!nearest || nearest.dist * scale > 40) {
        clearHover();
        return null;
      }
      const xHit = X(nearest.q.x);
      // points de chaque série alignés sur la position survolée (tolérance de 12 px)
      const hits = [];
      for (const s of drawn) {
        let best = null;
        for (const q of s.points) {
          const dist = Math.abs(X(q.x) - xHit);
          if (!best || dist < best.dist) best = { dist, q };
        }
        if (best && best.dist * scale <= 12) hits.push({ s, q: best.q });
      }
      guide.setAttribute('x1', xHit);
      guide.setAttribute('x2', xHit);
      guide.setAttribute('visibility', 'visible');
      MT.clear(markers);
      for (const h of hits) markers.append(dot(X(h.q.x), Y(h.q.y), '#ffffff', 12), dot(X(h.q.x), Y(h.q.y), h.s.color, 8));
      const sameX = hits.every((h) => h.q.x === nearest.q.x);
      return tipContent(
        sameX ? xTipFormat(nearest.q.x) : null,
        hits.map((h) => ({
          color: h.s.color,
          label: h.s.name || 'Valeur',
          value: yTipFormat(h.q.y),
          sub: [sameX ? null : xTipFormat(h.q.x), h.q.label].filter(Boolean).join(' · ') || null,
        }))
      );
    });
    g.addEventListener('pointerleave', clearHover);

    const legend =
      series.length > 1
        ? el(
            'div',
            { class: 'mt-row mt-small', style: 'margin-top:6px' },
            series.map((s, i) =>
              el(
                'span',
                { class: 'mt-row', style: 'gap:4px' },
                el('span', { style: { width: '10px', height: '10px', borderRadius: '3px', background: s.color || PALETTE[i % PALETTE.length], display: 'inline-block' } }),
                s.name
              )
            )
          )
        : null;
    return el('div', null, g, legend);
  }

  /**
   * Barres horizontales : items = [{label, value, color, details?: [texte]}]
   * opts.share : afficher la part de chaque barre dans le total (défaut : oui) ; opts.valueLabel : nom de la valeur.
   */
  function barChart(items, { format = MT.fmt.num, max, share = true, valueLabel = 'Valeur' } = {}) {
    const m = max || Math.max(1, ...items.map((i) => i.value || 0));
    const values = items.map((i) => i.value || 0);
    const total = values.reduce((a, b) => a + b, 0);
    const tipFormat = format === MT.fmt.num ? MT.fmt.int : format;
    return el(
      'div',
      { class: 'mt-col', style: 'gap:6px' },
      items.map((it, i) => {
        const color = it.color || PALETTE[i % PALETTE.length];
        const row = el(
          'div',
          { class: 'mt-col mt-bar-row', style: 'gap:2px' },
          el(
            'div',
            { class: 'mt-row mt-small', style: 'justify-content:space-between' },
            el('span', { class: 'mt-ellipsis', style: 'max-width:75%' }, it.label),
            el('strong', null, format(it.value))
          ),
          el('div', { class: 'mt-meter-bar' }, el('div', { class: 'mt-meter-fill', style: { width: ((it.value || 0) / m) * 100 + '%', background: color } }))
        );
        return hoverTip(row, () =>
          tipContent(it.label, [
            { color, label: valueLabel, value: tipFormat(it.value) },
            share && total ? { label: 'Part du total', value: MT.fmt.pct((it.value || 0) / total, 1) } : null,
            items.length > 1 ? { label: 'Rang', value: `${rankOf(it.value || 0, values)} sur ${items.length}` } : null,
            ...(it.details || []).map((d) => ({ label: d })),
          ])
        );
      })
    );
  }

  /** Mini-courbe. opts.labels : texte de l'infobulle pour chaque valeur (même ordre que values). */
  function sparkline(values, { width = 90, height = 24, color = 'var(--mt-accent)', labels, format = MT.fmt.num } = {}) {
    const idx = values.map((v, i) => (v != null ? i : -1)).filter((i) => i >= 0);
    if (idx.length < 2) return el('span', { class: 'mt-muted' }, '—');
    const v = idx.map((i) => values[i]);
    const min = Math.min(...v);
    const max = Math.max(...v);
    const px = (k) => (k / (v.length - 1)) * width;
    const py = (y) => height - 2 - ((y - min) / (max - min || 1)) * (height - 4);
    const d = v.map((y, k) => `${k ? 'L' : 'M'}${px(k).toFixed(1)},${py(y).toFixed(1)}`).join(' ');
    const marker = svg('circle', { r: 2.6, fill: color, visibility: 'hidden' });
    const s = svg(
      'svg',
      { width, height, viewBox: `0 0 ${width} ${height}`, style: 'cursor:crosshair' },
      svg('path', { d, fill: 'none', stroke: color, 'stroke-width': 1.6 }),
      marker,
      svg('rect', { width, height, fill: 'transparent' })
    );
    hoverTip(s, (e) => {
      const r = s.getBoundingClientRect();
      const k = Math.max(0, Math.min(v.length - 1, Math.round(((e.clientX - r.left) / r.width) * (v.length - 1))));
      marker.setAttribute('cx', px(k));
      marker.setAttribute('cy', py(v[k]));
      marker.setAttribute('visibility', 'visible');
      const label = labels ? labels[idx[k]] : null;
      return tipContent(null, [{ color, label: label || format(v[k]) }, { label: `Point ${k + 1} sur ${v.length}` }]);
    });
    s.addEventListener('pointerleave', () => marker.setAttribute('visibility', 'hidden'));
    return s;
  }

  function wordCloud(words, { max = 60, onClick } = {}) {
    const list = words.slice(0, max);
    if (!list.length) return empty('Pas assez de texte');
    const top = list[0].count;
    const low = list[list.length - 1].count;
    const total = list.reduce((a, w) => a + w.count, 0);
    const counts = list.map((w) => w.count);
    const shuffled = [...list].sort((a, b) => (a.word < b.word ? -1 : 1));
    return el(
      'div',
      { class: 'mt-cloud' },
      shuffled.map((w, i) => {
        const t = top === low ? 0.5 : (w.count - low) / (top - low);
        const color = PALETTE[i % PALETTE.length];
        const span = el(
          'span',
          {
            style: {
              fontSize: (12 + t * 26).toFixed(0) + 'px',
              fontWeight: t > 0.5 ? '700' : '500',
              color,
              opacity: (0.65 + t * 0.35).toFixed(2),
              cursor: onClick ? 'pointer' : 'default',
            },
            onclick: onClick ? () => onClick(w) : null,
          },
          w.word
        );
        return hoverTip(span, () =>
          tipContent(w.word, [
            { color, label: 'Occurrences', value: MT.fmt.int(w.count) },
            { label: 'Part des mots affichés', value: MT.fmt.pct(w.count / total, 1) },
            { label: 'Rang', value: `${rankOf(w.count, counts)} sur ${list.length}` },
            onClick ? { label: 'Cliquer pour filtrer les commentaires' } : null,
          ])
        );
      })
    );
  }

  /**
   * Carte de chaleur : matrix[r][c] = {value, count} ; valeurs normalisées automatiquement.
   * opts.title(cell) : texte complémentaire ; opts.cellLabel(r, c) : titre de l'infobulle ; valueLabel / countLabel : noms des mesures.
   */
  function heatmap(matrix, rowLabels, colLabels, { format = (v) => MT.fmt.dec(v), title, cellLabel, valueLabel = 'Valeur', countLabel = 'Nombre' } = {}) {
    const vals = matrix
      .flat()
      .filter((c) => c && c.value != null)
      .map((c) => c.value);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    return el(
      'div',
      { style: 'overflow-x:auto' },
      el(
        'table',
        { class: 'mt-heat' },
        el(
          'tr',
          null,
          el('th'),
          colLabels.map((c) => el('th', null, c))
        ),
        matrix.map((row, r) =>
          el(
            'tr',
            null,
            el('th', { style: 'text-align:right' }, rowLabels[r]),
            row.map((cell, c) => {
              const head = cellLabel ? cellLabel(r, c) : `${rowLabels[r]} · ${colLabels[c]}`;
              if (!cell || cell.value == null) return hoverTip(el('td', { style: { background: 'var(--mt-bg2)' } }), () => tipContent(head, [{ label: 'Aucune donnée' }]));
              const t = max === min ? 0.5 : (cell.value - min) / (max - min);
              const td = el(
                'td',
                { style: { background: `color-mix(in srgb, var(--mt-great) ${Math.round(15 + t * 75)}%, var(--mt-bg2))` } },
                cell.count != null ? String(cell.count) : ''
              );
              return hoverTip(td, () =>
                tipContent(head, [
                  { color: 'var(--mt-great)', label: valueLabel, value: format(cell.value) },
                  cell.count != null ? { label: countLabel, value: MT.fmt.int(cell.count) } : null,
                  { label: 'Rang', value: `${rankOf(cell.value, vals)} sur ${vals.length}` },
                  title ? { label: title(cell) } : null,
                ])
              );
            })
          )
        )
      )
    );
  }

  /* ---------------------------------------------------- toasts & modales */

  function overlayParent() {
    if (MT.widgets.getOverlay) return MT.widgets.getOverlay();
    return MT.widgets.overlayRoot || document.body;
  }

  let toastHost = null;
  function toast(message, type = 'info', ms = 3200) {
    const parent = overlayParent();
    if (!toastHost || !toastHost.isConnected || toastHost.parentNode !== parent) {
      toastHost = el('div', { class: 'mt-toast-host' });
      parent.appendChild(toastHost);
    }
    const t = el('div', { class: ['mt-toast', type] }, message);
    toastHost.appendChild(t);
    setTimeout(() => t.remove(), ms);
  }

  /** Fenêtre modale. Renvoie {close, body}. */
  function modal(title, content, { actions = [], onClose, width } = {}) {
    const parent = overlayParent();
    const body = el('div', { class: 'mt-modal-body' }, content);
    let back;
    const close = () => {
      back.remove();
      if (onClose) onClose();
    };
    const foot = actions.length
      ? el(
          'div',
          { class: 'mt-modal-foot' },
          actions.map((a) =>
            button(
              a.label,
              async () => {
                const r = await a.onClick(close);
                if (r !== false && a.close !== false) close();
              },
              { variant: a.variant }
            )
          )
        )
      : null;
    back = el(
      'div',
      {
        class: 'mt-modal-back',
        onclick: (e) => {
          if (e.target === back) close();
        },
      },
      el(
        'div',
        { class: 'mt-modal', style: width ? { maxWidth: width } : null },
        el('div', { class: 'mt-modal-head' }, title, button('', close, { variant: 'ghost', icon: 'x', title: 'Fermer', busy: false })),
        body,
        foot
      )
    );
    parent.appendChild(back);
    return { close, body };
  }

  function confirm(message, { okLabel = 'Confirmer', danger = false } = {}) {
    return new Promise((resolve) => {
      let answered = false;
      modal('Confirmation', el('p', { style: 'margin:0' }, message), {
        actions: [
          {
            label: 'Annuler',
            onClick: () => {
              answered = true;
              resolve(false);
            },
          },
          {
            label: okLabel,
            variant: danger ? 'primary danger' : 'primary',
            onClick: () => {
              answered = true;
              resolve(true);
            },
          },
        ],
        onClose: () => {
          if (!answered) resolve(false);
        },
      });
    });
  }

  function copyButton(getText, label = 'Copier', opts = {}) {
    return button(
      label,
      async () => {
        const text = typeof getText === 'function' ? getText() : getText;
        const ok = await MT.copy(text);
        toast(ok ? 'Copié dans le presse-papiers' : 'Copie impossible', ok ? 'success' : 'error');
      },
      { icon: 'copy', size: opts.size || 'sm', variant: opts.variant, busy: false, title: opts.title }
    );
  }

  const EMOJIS =
    '😀 😃 😄 😁 😆 😅 😂 🤣 😊 🙂 😉 😍 🥰 😘 😎 🤩 🥳 🤔 🤨 😐 😮 😱 😭 😡 🤯 😴 🤗 🙏 👍 👎 👏 🙌 💪 👀 🔥 ✨ ⭐ 🌟 💯 ❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💥 💡 📌 📍 ✅ ❌ ⚠️ ❗ ❓ 👉 👇 👆 ⬇️ ➡️ 🔔 🎉 🎁 🎬 🎥 📸 🎮 🎵 🎧 📚 📝 💻 📱 💰 💸 🏆 🥇 🚀 ⏱️ ⏰ 📅 🌍 🍕 ☕ 🐶 🐱'.split(
      ' '
    );

  function emojiPicker(onPick) {
    return el(
      'div',
      { class: 'mt-emoji-grid' },
      EMOJIS.map((e) =>
        el(
          'button',
          {
            type: 'button',
            title: e,
            onclick: (ev) => {
              ev.preventDefault();
              onPick(e);
            },
          },
          e
        )
      )
    );
  }

  function thumb(videoId, cls = '') {
    return el('img', { class: ['mt-thumb', cls], src: MT.thumbUrl(videoId, 'mqdefault'), loading: 'lazy', alt: '' });
  }

  function videoLink(v) {
    return el('a', { href: `https://www.youtube.com/watch?v=${v.videoId}`, target: '_blank', rel: 'noopener', title: v.title }, v.title || v.videoId);
  }

  function injectCSS(target) {
    const style = el('style');
    style.textContent = CSS;
    (target || document.head).appendChild(style);
    return style;
  }

  MT.widgets = {
    CSS,
    ICONS,
    PALETTE,
    overlayRoot: null,
    icon,
    toneOf,
    button,
    pill,
    gauge,
    meter,
    stats,
    checklist,
    chips,
    spinner,
    alert,
    empty,
    progress,
    tabs,
    table,
    lineChart,
    barChart,
    sparkline,
    wordCloud,
    heatmap,
    hoverTip,
    tipContent,
    tooltipHide,
    toast,
    modal,
    confirm,
    copyButton,
    emojiPicker,
    EMOJIS,
    thumb,
    videoLink,
    injectCSS,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
