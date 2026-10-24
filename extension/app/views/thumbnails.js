/* MyTube SEO — vue Miniatures : éditeur (générateur), test face aux concurrents, analyse d'image, téléchargement. */
(function () {
  'use strict';
  const MT = globalThis.MT;
  const { el, fmt } = MT;
  const W = MT.widgets;
  const A = MT.app;

  const WIDTH = 1280;
  const HEIGHT = 720;
  const FONTS = [
    ['Impact, "Arial Black", sans-serif', 'Impact'],
    ['"Arial Black", Arial, sans-serif', 'Arial Black'],
    ['Arial, Helvetica, sans-serif', 'Arial'],
    ['"Trebuchet MS", sans-serif', 'Trebuchet'],
    ['Verdana, sans-serif', 'Verdana'],
    ['Georgia, serif', 'Georgia'],
    ['"Comic Sans MS", "Comic Neue", cursive', 'Comic'],
    ['"Courier New", monospace', 'Courier'],
    ['system-ui, sans-serif', 'Système'],
  ];

  /* ---------------------------------------------------------- images */

  const imageCache = new Map();
  function loadImage(src) {
    if (!src) return Promise.resolve(null);
    if (imageCache.has(src)) return imageCache.get(src);
    const p = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
    imageCache.set(src, p);
    return p;
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  function pickFile(accept = 'image/*') {
    return new Promise((resolve) => {
      const inp = el('input', { type: 'file', accept, style: 'display:none' });
      inp.addEventListener('change', async () => {
        const f = inp.files[0];
        inp.remove();
        resolve(f ? await fileToDataUrl(f) : null);
      });
      document.body.appendChild(inp);
      inp.click();
    });
  }

  async function videoThumbDataUrl(videoId) {
    for (const q of ['maxresdefault', 'sddefault', 'hqdefault']) {
      try {
        const res = await fetch(MT.thumbUrl(videoId, q), { credentials: 'omit' });
        if (!res.ok) continue;
        const blob = await res.blob();
        const bmp = await createImageBitmap(blob);
        // YouTube renvoie une image grise de 120 px quand la résolution n'existe pas
        if (bmp.width <= 120) continue;
        return fileToDataUrl(blob);
      } catch (e) {
        /* essai suivant */
      }
    }
    throw new Error('Miniature introuvable');
  }

  /** Exporte le canevas en JPEG/PNG sous 2 Mo (limite YouTube). */
  async function canvasToBlob(canvas, type = 'image/jpeg') {
    const toBlob = (q) => new Promise((resolve) => canvas.toBlob(resolve, type, q));
    if (type === 'image/png') {
      const png = await toBlob();
      if (png.size <= 2 * 1024 * 1024) return png;
      type = 'image/jpeg';
    }
    for (const q of [0.92, 0.85, 0.75, 0.65, 0.5]) {
      const b = await toBlob(q);
      if (b.size <= 2 * 1024 * 1024) return b;
    }
    return toBlob(0.4);
  }

  function blobToDataUrl(blob) {
    return fileToDataUrl(blob);
  }

  /* ------------------------------------------------------------ rendu */

  function defaultProject() {
    return {
      background: { type: 'gradient', color: '#1d1f27', color2: '#e5352b', image: null },
      layers: [
        {
          id: MT.uid(),
          type: 'text',
          text: 'VOTRE TITRE ICI',
          x: 640,
          y: 360,
          size: 120,
          font: FONTS[0][0],
          color: '#ffffff',
          stroke: '#000000',
          strokeWidth: 14,
          shadow: true,
          align: 'center',
          bg: '',
          rotation: 0,
        },
      ],
    };
  }

  async function renderProject(ctx, project, { selectedId, showSafe } = {}) {
    const bg = project.background;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    if (bg.type === 'image' && bg.image) {
      const img = await loadImage(bg.image);
      if (img) {
        const scale = Math.max(WIDTH / img.width, HEIGHT / img.height) * (bg.zoom || 1);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.filter = `brightness(${bg.brightness || 100}%) contrast(${bg.contrast || 100}%) saturate(${bg.saturate || 100}%)`;
        ctx.drawImage(img, (WIDTH - w) / 2 + (bg.offsetX || 0), (HEIGHT - h) / 2 + (bg.offsetY || 0), w, h);
        ctx.filter = 'none';
      }
    } else if (bg.type === 'gradient') {
      const g = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
      g.addColorStop(0, bg.color || '#000');
      g.addColorStop(1, bg.color2 || '#333');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    } else {
      ctx.fillStyle = bg.color || '#000';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }
    for (const layer of project.layers) {
      if (layer.hidden) continue;
      ctx.save();
      ctx.globalAlpha = layer.opacity != null ? layer.opacity : 1;
      const b = layerBounds(ctx, layer);
      if (layer.rotation) {
        const cx = b.x + b.w / 2;
        const cy = b.y + b.h / 2;
        ctx.translate(cx, cy);
        ctx.rotate((layer.rotation * Math.PI) / 180);
        ctx.translate(-cx, -cy);
      }
      if (layer.type === 'text') {
        ctx.font = `${layer.italic ? 'italic ' : ''}900 ${layer.size}px ${layer.font}`;
        ctx.textAlign = layer.align || 'center';
        ctx.textBaseline = 'middle';
        const lines = String(layer.text).split('\n');
        const lh = layer.size * 1.08;
        if (layer.bg) {
          ctx.fillStyle = layer.bg;
          roundRect(ctx, b.x - 20, b.y - 10, b.w + 40, b.h + 20, 14);
          ctx.fill();
        }
        lines.forEach((line, i) => {
          const y = layer.y + (i - (lines.length - 1) / 2) * lh;
          if (layer.shadow) {
            ctx.shadowColor = 'rgba(0,0,0,.55)';
            ctx.shadowBlur = layer.size / 6;
            ctx.shadowOffsetY = layer.size / 18;
          }
          if (layer.strokeWidth > 0) {
            ctx.lineJoin = 'round';
            ctx.lineWidth = layer.strokeWidth;
            ctx.strokeStyle = layer.stroke || '#000';
            ctx.strokeText(line, layer.x, y);
            ctx.shadowColor = 'transparent';
          }
          ctx.fillStyle = layer.color;
          ctx.fillText(line, layer.x, y);
          ctx.shadowColor = 'transparent';
        });
      } else if (layer.type === 'image') {
        const img = await loadImage(layer.src);
        if (img) ctx.drawImage(img, layer.x, layer.y, layer.w, layer.h);
      } else if (layer.type === 'rect') {
        ctx.fillStyle = layer.color;
        roundRect(ctx, layer.x, layer.y, layer.w, layer.h, layer.radius || 0);
        ctx.fill();
        if (layer.strokeWidth) {
          ctx.lineWidth = layer.strokeWidth;
          ctx.strokeStyle = layer.stroke || '#fff';
          ctx.stroke();
        }
      } else if (layer.type === 'circle') {
        ctx.beginPath();
        ctx.ellipse(layer.x + layer.w / 2, layer.y + layer.h / 2, layer.w / 2, layer.h / 2, 0, 0, Math.PI * 2);
        if (layer.fill) {
          ctx.fillStyle = layer.color;
          ctx.fill();
        }
        ctx.lineWidth = layer.strokeWidth || 12;
        ctx.strokeStyle = layer.fill ? layer.stroke || '#fff' : layer.color;
        ctx.stroke();
      } else if (layer.type === 'arrow') {
        drawArrow(ctx, layer);
      }
      ctx.restore();
      if (layer.id === selectedId) {
        ctx.save();
        ctx.strokeStyle = '#1e90ff';
        ctx.setLineDash([12, 8]);
        ctx.lineWidth = 3;
        ctx.strokeRect(b.x - 6, b.y - 6, b.w + 12, b.h + 12);
        ctx.restore();
      }
    }
    if (showSafe) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,.8)';
      roundRect(ctx, WIDTH - 140, HEIGHT - 70, 120, 50, 8);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '600 32px Roboto, Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('12:34', WIDTH - 80, HEIGHT - 45);
      ctx.restore();
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  }

  function drawArrow(ctx, l) {
    const angle = Math.atan2(l.y2 - l.y, l.x2 - l.x);
    const head = Math.max(30, l.width * 3);
    ctx.strokeStyle = l.color;
    ctx.fillStyle = l.color;
    ctx.lineWidth = l.width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(l.x, l.y);
    ctx.lineTo(l.x2 - Math.cos(angle) * head * 0.8, l.y2 - Math.sin(angle) * head * 0.8);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(l.x2, l.y2);
    ctx.lineTo(l.x2 - head * Math.cos(angle - Math.PI / 7), l.y2 - head * Math.sin(angle - Math.PI / 7));
    ctx.lineTo(l.x2 - head * Math.cos(angle + Math.PI / 7), l.y2 - head * Math.sin(angle + Math.PI / 7));
    ctx.closePath();
    ctx.fill();
  }

  function layerBounds(ctx, l) {
    if (l.type === 'text') {
      ctx.save();
      ctx.font = `${l.italic ? 'italic ' : ''}900 ${l.size}px ${l.font}`;
      const lines = String(l.text).split('\n');
      const w = Math.max(...lines.map((line) => ctx.measureText(line).width), 10);
      ctx.restore();
      const h = lines.length * l.size * 1.08;
      const x = l.align === 'left' ? l.x : l.align === 'right' ? l.x - w : l.x - w / 2;
      return { x, y: l.y - h / 2, w, h };
    }
    if (l.type === 'arrow')
      return { x: Math.min(l.x, l.x2) - l.width, y: Math.min(l.y, l.y2) - l.width, w: Math.abs(l.x2 - l.x) + l.width * 2, h: Math.abs(l.y2 - l.y) + l.width * 2 };
    return { x: l.x, y: l.y, w: l.w, h: l.h };
  }

  function moveLayer(l, dx, dy) {
    l.x += dx;
    l.y += dy;
    if (l.type === 'arrow') {
      l.x2 += dx;
      l.y2 += dy;
    }
  }

  /* ---------------------------------------------------------- éditeur */

  async function editorTab(c, params) {
    let project = (await MT.store.get('thumbDraft', null)) || defaultProject();
    const pending = params.frame ? await MT.store.get('pendingFrame', null) : null;
    if (pending && pending.dataUrl) {
      project.background = { type: 'image', image: pending.dataUrl, color: '#000', color2: '#333' };
      await MT.store.set('pendingFrame', null);
    }
    let selectedId = project.layers[0] ? project.layers[0].id : null;
    let showSafe = true;
    const canvas = el('canvas', { width: WIDTH, height: HEIGHT });
    const ctx = canvas.getContext('2d');
    const layersBox = el('div', { class: 'mt-col', style: 'gap:6px' });
    const propsBox = el('div');
    const bgBox = el('div');

    const save = MT.debounce(() => MT.store.set('thumbDraft', project), 600);
    let drawing = false;
    let again = false;
    async function redraw() {
      if (drawing) {
        again = true;
        return;
      }
      drawing = true;
      await renderProject(ctx, project, { selectedId, showSafe });
      drawing = false;
      if (again) {
        again = false;
        redraw();
      }
      save();
    }
    const selected = () => project.layers.find((l) => l.id === selectedId);

    function prop(label, control) {
      return el('div', { class: 'field', style: 'margin-bottom:6px' }, el('label', null, label), control);
    }
    function num(layer, key, min, max, step = 1) {
      const i = el('input', { type: 'range', min, max, step, value: layer[key] ?? 0, style: 'width:100%' });
      i.addEventListener('input', () => {
        layer[key] = Number(i.value);
        redraw();
      });
      return i;
    }
    function color(obj, key) {
      const i = el('input', { type: 'color', value: obj[key] || '#000000' });
      i.addEventListener('input', () => {
        obj[key] = i.value;
        redraw();
      });
      return i;
    }

    function drawProps() {
      const l = selected();
      if (!l) return MT.fill(propsBox, W.empty('Sélectionnez un calque'));
      const items = [];
      if (l.type === 'text') {
        const t = A.textarea({ rows: 2, value: l.text });
        t.addEventListener('input', () => {
          l.text = t.value;
          redraw();
          drawLayers();
        });
        const font = A.select(FONTS, l.font);
        font.addEventListener('change', () => {
          l.font = font.value;
          redraw();
        });
        const align = A.select(
          [
            ['left', 'Gauche'],
            ['center', 'Centre'],
            ['right', 'Droite'],
          ],
          l.align
        );
        align.addEventListener('change', () => {
          l.align = align.value;
          redraw();
        });
        const bgOn = A.checkbox('Fond derrière le texte', !!l.bg, (on) => {
          l.bg = on ? '#e5352b' : '';
          redraw();
          drawProps();
        });
        items.push(
          prop('Texte', t),
          prop('Police', font),
          prop('Taille', num(l, 'size', 20, 300)),
          el('div', { class: 'grid cols-2' }, prop('Couleur', color(l, 'color')), prop('Contour', color(l, 'stroke'))),
          prop('Épaisseur du contour', num(l, 'strokeWidth', 0, 40)),
          prop('Alignement', align),
          A.checkbox('Ombre portée', l.shadow, (on) => {
            l.shadow = on;
            redraw();
          }),
          bgOn,
          l.bg ? prop('Couleur du fond', color(l, 'bg')) : null
        );
      } else if (l.type === 'arrow') {
        items.push(
          prop('Couleur', color(l, 'color')),
          prop('Épaisseur', num(l, 'width', 4, 60)),
          el('p', { class: 'mt-small mt-muted' }, 'Glissez la flèche pour la déplacer. Ajustez la pointe :'),
          el('div', { class: 'grid cols-2' }, prop('Pointe X', num(l, 'x2', 0, WIDTH)), prop('Pointe Y', num(l, 'y2', 0, HEIGHT)))
        );
      } else {
        items.push(el('div', { class: 'grid cols-2' }, prop('Largeur', num(l, 'w', 20, WIDTH * 1.5)), prop('Hauteur', num(l, 'h', 20, HEIGHT * 1.5))));
        if (l.type === 'image') {
          items.push(
            W.button(
              'Conserver les proportions',
              () => {
                loadImage(l.src).then((img) => {
                  if (img) {
                    l.h = Math.round((l.w * img.height) / img.width);
                    redraw();
                    drawProps();
                  }
                });
              },
              { size: 'sm', busy: false }
            )
          );
        } else {
          items.push(prop('Couleur', color(l, 'color')));
          if (l.type === 'rect') items.push(prop('Arrondi', num(l, 'radius', 0, 200)));
          if (l.type === 'circle')
            items.push(
              prop('Épaisseur', num(l, 'strokeWidth', 2, 60)),
              A.checkbox('Rempli', !!l.fill, (on) => {
                l.fill = on;
                redraw();
              })
            );
        }
      }
      items.push(
        prop('Rotation', num(l, 'rotation', -45, 45)),
        prop(
          'Opacité',
          (() => {
            const i = el('input', { type: 'range', min: 0.1, max: 1, step: 0.05, value: l.opacity ?? 1, style: 'width:100%' });
            i.addEventListener('input', () => {
              l.opacity = Number(i.value);
              redraw();
            });
            return i;
          })()
        )
      );
      MT.fill(propsBox, items);
    }

    function drawLayers() {
      MT.fill(
        layersBox,
        [...project.layers].reverse().map((l) =>
          el(
            'div',
            {
              class: ['layer-item', l.id === selectedId ? 'active' : null],
              onclick: () => {
                selectedId = l.id;
                drawLayers();
                drawProps();
                redraw();
              },
            },
            el(
              'span',
              { class: 'mt-grow mt-ellipsis' },
              { text: '🔤 ', image: '🖼️ ', rect: '▭ ', circle: '◯ ', arrow: '➜ ' }[l.type],
              l.type === 'text' ? l.text.split('\n')[0] : { image: 'Image', rect: 'Rectangle', circle: 'Cercle', arrow: 'Flèche' }[l.type]
            ),
            W.button(
              '',
              (e) => {
                e.stopPropagation();
                const i = project.layers.indexOf(l);
                if (i < project.layers.length - 1) {
                  project.layers.splice(i, 1);
                  project.layers.splice(i + 1, 0, l);
                  drawLayers();
                  redraw();
                }
              },
              { size: 'sm', variant: 'ghost', icon: 'sort', title: 'Monter', busy: false }
            ),
            W.button(
              '',
              (e) => {
                e.stopPropagation();
                l.hidden = !l.hidden;
                drawLayers();
                redraw();
              },
              { size: 'sm', variant: 'ghost', icon: l.hidden ? 'x' : 'check', title: l.hidden ? 'Afficher' : 'Masquer', busy: false }
            ),
            W.button(
              '',
              (e) => {
                e.stopPropagation();
                project.layers = project.layers.filter((x) => x !== l);
                if (selectedId === l.id) selectedId = null;
                drawLayers();
                drawProps();
                redraw();
              },
              { size: 'sm', variant: 'ghost danger', icon: 'trash', title: 'Supprimer', busy: false }
            )
          )
        )
      );
    }

    function drawBg() {
      const bg = project.background;
      const type = A.select(
        [
          ['image', 'Image'],
          ['gradient', 'Dégradé'],
          ['color', 'Couleur unie'],
        ],
        bg.type
      );
      type.addEventListener('change', () => {
        bg.type = type.value;
        redraw();
        drawBg();
      });
      const vid = A.input({ placeholder: 'URL de vidéo YouTube' });
      MT.fill(
        bgBox,
        prop('Type', type),
        bg.type === 'image'
          ? el(
              'div',
              null,
              el(
                'div',
                { class: 'mt-row', style: 'margin-bottom:8px' },
                W.button(
                  'Importer une image',
                  async () => {
                    const d = await pickFile();
                    if (d) {
                      bg.image = d;
                      redraw();
                    }
                  },
                  { size: 'sm', icon: 'upload' }
                )
              ),
              el(
                'div',
                { class: 'field-row', style: 'margin-bottom:8px' },
                vid,
                W.button(
                  'Miniature',
                  async () => {
                    const id = MT.videoIdFromUrl(vid.value);
                    if (!id) return W.toast('Vidéo invalide', 'error');
                    bg.image = await videoThumbDataUrl(id);
                    redraw();
                  },
                  { size: 'sm' }
                )
              ),
              prop('Zoom', num(bg, 'zoom', 1, 3, 0.05)),
              el('div', { class: 'grid cols-2' }, prop('Décalage X', num(bg, 'offsetX', -640, 640)), prop('Décalage Y', num(bg, 'offsetY', -360, 360))),
              el(
                'div',
                { class: 'grid cols-3' },
                prop('Luminosité', num(bg, 'brightness', 40, 200)),
                prop('Contraste', num(bg, 'contrast', 40, 200)),
                prop('Saturation', num(bg, 'saturate', 0, 250))
              )
            )
          : el('div', { class: 'grid cols-2' }, prop('Couleur', color(bg, 'color')), bg.type === 'gradient' ? prop('Couleur 2', color(bg, 'color2')) : null)
      );
      for (const k of ['zoom', 'brightness', 'contrast', 'saturate']) if (bg[k] == null) bg[k] = k === 'zoom' ? 1 : 100;
    }

    function addLayer(layer) {
      layer.id = MT.uid();
      project.layers.push(layer);
      selectedId = layer.id;
      drawLayers();
      drawProps();
      redraw();
    }

    // déplacement à la souris
    let drag = null;
    const toCanvas = (e) => {
      const r = canvas.getBoundingClientRect();
      return { x: ((e.clientX - r.left) * WIDTH) / r.width, y: ((e.clientY - r.top) * HEIGHT) / r.height };
    };
    canvas.addEventListener('mousedown', (e) => {
      const p = toCanvas(e);
      const hit = [...project.layers].reverse().find((l) => {
        if (l.hidden) return false;
        const b = layerBounds(ctx, l);
        return p.x >= b.x - 10 && p.x <= b.x + b.w + 10 && p.y >= b.y - 10 && p.y <= b.y + b.h + 10;
      });
      if (hit) {
        selectedId = hit.id;
        drag = { last: p, layer: hit };
        drawLayers();
        drawProps();
        redraw();
      } else if (project.background.type === 'image') {
        drag = { last: p, bg: true };
      }
    });
    window.addEventListener('mousemove', (e) => {
      if (!drag) return;
      const p = toCanvas(e);
      const dx = p.x - drag.last.x;
      const dy = p.y - drag.last.y;
      drag.last = p;
      if (drag.layer) moveLayer(drag.layer, dx, dy);
      else if (drag.bg) {
        project.background.offsetX = (project.background.offsetX || 0) + dx;
        project.background.offsetY = (project.background.offsetY || 0) + dy;
      }
      redraw();
    });
    window.addEventListener('mouseup', () => (drag = null));
    canvas.tabIndex = 0;
    canvas.addEventListener('keydown', (e) => {
      const l = selected();
      if (!l) return;
      const step = e.shiftKey ? 20 : 4;
      const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (moves[e.key]) {
        e.preventDefault();
        moveLayer(l, ...moves[e.key]);
        redraw();
      } else if (e.key === 'Delete') {
        project.layers = project.layers.filter((x) => x !== l);
        selectedId = null;
        drawLayers();
        drawProps();
        redraw();
      }
    });

    const presets = [
      [
        'Texte',
        () =>
          addLayer({
            type: 'text',
            text: 'TEXTE',
            x: 640,
            y: 200,
            size: 110,
            font: FONTS[0][0],
            color: '#ffffff',
            stroke: '#000000',
            strokeWidth: 12,
            shadow: true,
            align: 'center',
            bg: '',
            rotation: 0,
          }),
      ],
      [
        'Texte jaune',
        () =>
          addLayer({
            type: 'text',
            text: 'WOW !',
            x: 900,
            y: 560,
            size: 140,
            font: FONTS[0][0],
            color: '#ffe600',
            stroke: '#000000',
            strokeWidth: 16,
            shadow: true,
            align: 'center',
            bg: '',
            rotation: -6,
          }),
      ],
      [
        'Bandeau',
        () =>
          addLayer({
            type: 'text',
            text: 'NOUVEAU',
            x: 220,
            y: 90,
            size: 64,
            font: FONTS[1][0],
            color: '#ffffff',
            stroke: '#000000',
            strokeWidth: 0,
            shadow: false,
            align: 'center',
            bg: '#e5352b',
            rotation: 0,
          }),
      ],
      ['Flèche', () => addLayer({ type: 'arrow', x: 300, y: 560, x2: 560, y2: 380, color: '#ff2a2a', width: 22 })],
      ['Cercle', () => addLayer({ type: 'circle', x: 760, y: 180, w: 300, h: 300, color: '#ff2a2a', strokeWidth: 14, fill: false })],
      ['Rectangle', () => addLayer({ type: 'rect', x: 80, y: 520, w: 520, h: 140, color: '#000000', radius: 20, opacity: 0.7 })],
      [
        'Image / logo',
        async () => {
          const d = await pickFile();
          if (!d) return;
          const img = await loadImage(d);
          const w = Math.min(500, img ? img.width : 400);
          addLayer({ type: 'image', src: d, x: 60, y: 60, w, h: img ? Math.round((w * img.height) / img.width) : 300 });
        },
      ],
      [
        'Émoji',
        () => {
          const m = W.modal(
            'Choisir un émoji',
            W.emojiPicker((e) => {
              addLayer({
                type: 'text',
                text: e,
                x: 1100,
                y: 160,
                size: 180,
                font: 'sans-serif',
                color: '#ffffff',
                stroke: '#000000',
                strokeWidth: 0,
                shadow: true,
                align: 'center',
                bg: '',
                rotation: 0,
              });
              m.close();
            })
          );
        },
      ],
    ];

    const exportBlob = async (type) => {
      const prevSel = selectedId;
      selectedId = null;
      const out = el('canvas', { width: WIDTH, height: HEIGHT });
      await renderProject(out.getContext('2d'), project, {});
      selectedId = prevSel;
      return canvasToBlob(out, type);
    };

    MT.add(
      c,
      el(
        'div',
        { class: 'grid sidebar' },
        el(
          'div',
          { class: 'stack' },
          el('div', { class: 'canvas-wrap' }, canvas),
          el(
            'div',
            { class: 'mt-row' },
            presets.map(([label, fn]) => W.button(label, fn, { size: 'sm', icon: 'plus', busy: false })),
            A.checkbox('Zone de durée', showSafe, (on) => {
              showSafe = on;
              redraw();
            })
          ),
          A.card(
            'Exporter',
            el(
              'div',
              { class: 'mt-row' },
              W.button('Télécharger JPG', async () => MT.download(`miniature-${MT.today()}.jpg`, await exportBlob('image/jpeg')), { variant: 'primary', icon: 'download' }),
              W.button('Télécharger PNG', async () => MT.download(`miniature-${MT.today()}.png`, await exportBlob('image/png')), { icon: 'download' }),
              W.button(
                'Définir comme miniature YouTube',
                async () => {
                  if (!(await MT.oauth.status()).connected) return W.toast('Connectez votre compte Google (Paramètres)', 'error');
                  const videos = await A.loadMyVideos();
                  let picked = [];
                  W.modal('Choisir la vidéo', A.videoSelector(videos, { multi: false, onChange: (v) => (picked = v) }), {
                    width: '900px',
                    actions: [
                      { label: 'Annuler', onClick: () => true },
                      {
                        label: 'Appliquer',
                        variant: 'primary',
                        onClick: async () => {
                          if (!picked[0]) return false;
                          await MT.ytapi.setThumbnail(picked[0].videoId, await exportBlob('image/jpeg'), await A.auth());
                          W.toast('Miniature mise à jour sur YouTube', 'success');
                          return true;
                        },
                      },
                    ],
                  });
                },
                { icon: 'upload' }
              ),
              W.button(
                'Tester face aux concurrents',
                async () => {
                  await MT.store.set('thumbTestImage', await blobToDataUrl(await exportBlob('image/jpeg')));
                  A.navigate('thumbnails', { tab: 'test' });
                },
                { icon: 'layers' }
              ),
              W.button(
                'Analyser',
                async () => {
                  await MT.store.set('thumbTestImage', await blobToDataUrl(await exportBlob('image/jpeg')));
                  A.navigate('thumbnails', { tab: 'analyze' });
                },
                { icon: 'chart' }
              ),
              W.button(
                'Variante de test A/B',
                async () => {
                  const image = await blobToDataUrl(await exportBlob('image/jpeg'));
                  await MT.store.update('abDraftImages', (l) => [...(l || []), image].slice(-3));
                  W.toast('Image ajoutée aux variantes du prochain test A/B', 'success');
                },
                { icon: 'flask' }
              ),
              W.button(
                'Réinitialiser',
                async () => {
                  if (await W.confirm('Repartir d’un projet vierge ?')) {
                    project = defaultProject();
                    selectedId = project.layers[0].id;
                    drawBg();
                    drawLayers();
                    drawProps();
                    redraw();
                  }
                },
                { variant: 'ghost', icon: 'trash', busy: false }
              )
            ),
            el(
              'p',
              { class: 'mt-small mt-muted' },
              'Format 1280 × 720 (16:9), JPG/PNG de moins de 2 Mo comme l’exige YouTube. Astuce : glissez les calques, flèches du clavier pour ajuster (Maj = plus vite), Suppr pour effacer.'
            )
          )
        ),
        el(
          'div',
          { class: 'stack' },
          A.card('Arrière-plan', bgBox),
          A.card('Calques', layersBox),
          A.card('Propriétés', propsBox),
          A.card(
            'Textes de miniature (IA)',
            W.button(
              'Suggérer des textes',
              async () => {
                const s = selected();
                const texts = await MT.ai.thumbnailTexts({ title: s && s.type === 'text' ? s.text : '' });
                W.modal(
                  'Textes suggérés',
                  W.chips(texts, {
                    onClick: (t) => {
                      const l = selected();
                      if (l && l.type === 'text') {
                        l.text = t;
                        drawLayers();
                        drawProps();
                        redraw();
                      }
                    },
                  })
                );
              },
              { size: 'sm', icon: 'bolt' }
            )
          )
        )
      )
    );
    drawBg();
    drawLayers();
    drawProps();
    redraw();
  }

  /* --------------------------------------------------------------- test */

  async function testTab(c, params) {
    const stored = await MT.store.get('thumbTestImage', null);
    const state = {
      image: stored,
      title: '',
      channel: (await MT.store.getSettings()).myChannelTitle || 'Ma chaîne',
      theme: 'dark',
      layout: 'home',
      device: 'desktop',
      results: [],
    };
    if (params.v) {
      try {
        const v = await MT.yt.player(params.v);
        state.title = v.title;
        state.channel = v.channelName;
        state.image = state.image || MT.thumbUrl(params.v, 'mqdefault');
      } catch (e) {
        /* ignore */
      }
    }
    const title = A.input({ value: state.title, placeholder: 'Titre de votre vidéo' });
    const kw = A.input({ value: params.q || '', placeholder: 'Mot-clé pour charger les miniatures concurrentes' });
    const view = el('div');
    const position = A.select(
      [
        ['1', 'Position 1'],
        ['2', 'Position 2'],
        ['5', 'Position 5'],
        ['8', 'Position 8'],
      ],
      '2'
    );
    const theme = A.select(
      [
        ['dark', 'Thème sombre'],
        ['light', 'Thème clair'],
      ],
      'dark'
    );
    const layout = A.select(
      [
        ['home', 'Accueil (grille)'],
        ['search', 'Résultats de recherche'],
      ],
      'home'
    );
    const device = A.select(
      [
        ['desktop', 'Ordinateur'],
        ['mobile', 'Mobile'],
      ],
      'desktop'
    );
    const draw = () => {
      const mine = { mine: true, title: title.value || 'Titre de votre vidéo', channelName: state.channel, thumb: state.image, views: '—', publishedText: 'il y a 1 jour' };
      const others = state.results.map((v) => ({
        title: v.title,
        channelName: v.channelName,
        thumb: MT.thumbUrl(v.videoId, 'mqdefault'),
        views: fmt.num(v.views) + ' vues',
        publishedText: v.publishedText,
      }));
      const list = [...others];
      list.splice(Math.min(list.length, Number(position.value) - 1), 0, mine);
      const card = (v) =>
        el(
          'div',
          { class: ['yt-card', v.mine ? 'mine' : null] },
          v.thumb
            ? el('img', { src: v.thumb, alt: '' })
            : el(
                'div',
                { style: 'aspect-ratio:16/9;background:#555;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#ccc' },
                'Importez votre miniature'
              ),
          el(
            'div',
            null,
            el('div', { class: 't' }, v.title),
            el('div', { class: 's' }, v.channelName || ''),
            el('div', { class: 's' }, `${v.views || ''} · ${v.publishedText || ''}`)
          )
        );
      MT.fill(
        view,
        el(
          'div',
          { class: ['yt-mock', theme.value, device.value === 'mobile' ? 'mobile' : null], style: 'border-radius:12px;overflow:hidden' },
          el('div', { class: layout.value === 'home' ? 'yt-grid' : 'yt-list' }, list.slice(0, layout.value === 'home' ? 9 : 8).map(card))
        )
      );
    };
    for (const s of [position, theme, layout, device]) s.addEventListener('change', draw);
    title.addEventListener('input', MT.debounce(draw, 200));
    const load = async () => {
      if (!kw.value.trim()) return W.toast('Saisissez un mot-clé', 'error');
      const r = await MT.yt.search(kw.value.trim(), { limit: 12 });
      state.results = r.videos.filter((v) => !v.inShelf && !v.isShort).slice(0, 11);
      draw();
    };
    MT.add(
      c,
      el(
        'div',
        { class: 'grid cols-2' },
        A.field(
          'Votre miniature',
          el(
            'div',
            { class: 'mt-row' },
            W.button(
              'Importer',
              async () => {
                const d = await pickFile();
                if (d) {
                  state.image = d;
                  await MT.store.set('thumbTestImage', d);
                  draw();
                }
              },
              { size: 'sm', icon: 'upload' }
            ),
            state.image ? el('span', { class: 'mt-muted mt-small' }, 'image chargée') : null
          )
        ),
        A.field('Titre', title)
      ),
      A.field('Concurrents', el('div', { class: 'field-row' }, kw, W.button('Charger', load, { icon: 'search' }))),
      el('div', { class: 'grid cols-4' }, position, theme, layout, device),
      el('div', { style: 'margin-top:14px' }, view),
      el(
        'p',
        { class: 'mt-small mt-muted' },
        'Votre miniature se démarque-t-elle ? Vérifiez la lisibilité du texte en petit, le contraste avec les miniatures voisines et la cohérence avec le titre.'
      )
    );
    draw();
    if (params.q) load();
  }

  /* ------------------------------------------------------------- analyse */

  async function imageMetrics(src) {
    let bitmap;
    if (src.startsWith('data:')) bitmap = await createImageBitmap(await (await fetch(src)).blob());
    else {
      const res = await fetch(src, { credentials: 'omit' });
      bitmap = await createImageBitmap(await res.blob());
    }
    const w = 320;
    const h = 180;
    const cv = el('canvas', { width: w, height: h });
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    const n = w * h;
    const lum = new Float32Array(n);
    let sumL = 0;
    let sumS = 0;
    const rg = [];
    const yb = [];
    const buckets = new Map();
    for (let i = 0; i < n; i++) {
      const r = data[i * 4];
      const g = data[i * 4 + 1];
      const b = data[i * 4 + 2];
      const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      lum[i] = L;
      sumL += L;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      sumS += max ? (max - min) / max : 0;
      rg.push(r - g);
      yb.push(0.5 * (r + g) - b);
      const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
      buckets.set(key, (buckets.get(key) || 0) + 1);
    }
    const meanL = sumL / n;
    let varL = 0;
    for (let i = 0; i < n; i++) varL += (lum[i] - meanL) ** 2;
    const contrast = Math.sqrt(varL / n);
    const std = (a) => {
      const m = a.reduce((s, x) => s + x, 0) / a.length;
      return { m, s: Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length) };
    };
    const RG = std(rg);
    const YB = std(yb);
    const colorfulness = Math.sqrt(RG.s ** 2 + YB.s ** 2) + 0.3 * Math.sqrt(RG.m ** 2 + YB.m ** 2);
    let edges = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const gx = lum[i + 1] - lum[i - 1];
        const gy = lum[i + w] - lum[i - w];
        if (Math.sqrt(gx * gx + gy * gy) > 60) edges++;
      }
    }
    const palette = [...buckets.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([k, count]) => ({ color: `rgb(${((k >> 6) & 7) * 32 + 16},${((k >> 3) & 7) * 32 + 16},${(k & 7) * 32 + 16})`, pct: count / n }));
    return { brightness: meanL, contrast, saturation: (sumS / n) * 100, colorfulness, complexity: (edges / n) * 100, palette };
  }

  function metricScore(m) {
    const tips = [];
    let score = 100;
    if (m.contrast < 45) {
      score -= 25;
      tips.push('Contraste faible : renforcez les écarts clair/sombre pour que l’image ressorte en petit.');
    }
    if (m.brightness < 70) {
      score -= 15;
      tips.push('Image sombre : éclaircissez le sujet principal.');
    } else if (m.brightness > 200) {
      score -= 10;
      tips.push('Image très claire : risque de se fondre dans le thème clair de YouTube.');
    }
    if (m.colorfulness < 35) {
      score -= 15;
      tips.push('Couleurs ternes : des couleurs vives (jaune, rouge, bleu saturé) attirent davantage l’œil.');
    }
    if (m.complexity > 18) {
      score -= 15;
      tips.push('Image chargée : simplifiez (un sujet, 3 mots maximum).');
    } else if (m.complexity < 2.5) {
      score -= 10;
      tips.push('Image très uniforme : ajoutez un élément focal (visage, objet, texte).');
    }
    if (!tips.length) tips.push('Bonne lisibilité générale : vérifiez aussi l’aperçu en petit format ci-dessous.');
    return { score: Math.max(0, score), tips };
  }

  async function analyzeTab(c, params) {
    let src = await MT.store.get('thumbTestImage', null);
    const out = el('div', { class: 'stack', style: 'margin-top:14px' });
    const kw = A.input({ value: params.q || '', placeholder: 'Comparer avec les miniatures d’un mot-clé (facultatif)' });
    const run = async () => {
      if (!src) return W.toast('Choisissez une image', 'error');
      await A.withLoading(out, 'Analyse de l’image…', async () => {
        const m = await imageMetrics(src);
        const sc = metricScore(m);
        let comp = null;
        if (kw.value.trim()) {
          const r = await MT.yt.search(kw.value.trim(), { limit: 10 });
          const ms = await MT.pool(r.videos.filter((v) => !v.inShelf && !v.isShort).slice(0, 10), 4, (v) => imageMetrics(MT.thumbUrl(v.videoId, 'mqdefault')));
          const ok = ms.filter((x) => x && !x.error);
          comp = ok.length
            ? {
                brightness: MT.mean(ok.map((x) => x.brightness)),
                contrast: MT.mean(ok.map((x) => x.contrast)),
                colorfulness: MT.mean(ok.map((x) => x.colorfulness)),
                complexity: MT.mean(ok.map((x) => x.complexity)),
                saturation: MT.mean(ok.map((x) => x.saturation)),
              }
            : null;
        }
        const row = (label, key, unit = '') => ({ label, value: fmt.dec(m[key], 1) + unit, hint: comp ? `concurrents : ${fmt.dec(comp[key], 1)}${unit}` : null });
        MT.fill(
          out,
          A.card(
            null,
            el(
              'div',
              { class: 'mt-row', style: 'gap:18px;align-items:flex-start' },
              el('img', { src, style: 'width:360px;max-width:100%;border-radius:10px' }),
              el(
                'div',
                { class: 'mt-grow' },
                el(
                  'div',
                  { class: 'mt-row', style: 'gap:14px;margin-bottom:10px' },
                  W.gauge(sc.score, { size: 84, label: 'Impact' }),
                  el(
                    'ul',
                    { class: 'help-list', style: 'margin:0' },
                    sc.tips.map((t) => el('li', null, t))
                  )
                ),
                W.stats([
                  row('Luminosité (0-255)', 'brightness'),
                  row('Contraste', 'contrast'),
                  row('Couleurs (vivacité)', 'colorfulness'),
                  row('Saturation', 'saturation', ' %'),
                  row('Complexité (contours)', 'complexity', ' %'),
                ])
              )
            )
          ),
          A.grid(
            2,
            A.card(
              'Palette dominante',
              el(
                'div',
                { class: 'mt-row' },
                m.palette.map((p) =>
                  el(
                    'div',
                    { class: 'mt-col', style: 'align-items:center;gap:2px' },
                    el('div', { style: { width: '54px', height: '54px', borderRadius: '10px', background: p.color, border: '1px solid var(--mt-border)' } }),
                    el('span', { class: 'mt-small' }, fmt.pct(p.pct, 0))
                  )
                )
              )
            ),
            A.card(
              'Aperçus en petit format',
              el(
                'div',
                { class: 'mt-row', style: 'align-items:flex-end;gap:14px' },
                el(
                  'div',
                  { class: 'mt-col', style: 'align-items:center' },
                  el('img', { src, style: 'width:246px;border-radius:8px' }),
                  el('span', { class: 'mt-small' }, 'Accueil')
                ),
                el(
                  'div',
                  { class: 'mt-col', style: 'align-items:center' },
                  el('img', { src, style: 'width:168px;border-radius:8px' }),
                  el('span', { class: 'mt-small' }, 'Suggestions')
                ),
                el(
                  'div',
                  { class: 'mt-col', style: 'align-items:center' },
                  el('img', { src, style: 'width:120px;border-radius:6px' }),
                  el('span', { class: 'mt-small' }, 'Mobile')
                ),
                el(
                  'div',
                  { class: 'mt-col', style: 'align-items:center' },
                  el('img', { src, style: 'width:168px;border-radius:8px;filter:grayscale(1)' }),
                  el('span', { class: 'mt-small' }, 'Niveaux de gris')
                )
              )
            )
          )
        );
      });
    };
    const vid = A.input({ placeholder: 'ou URL d’une vidéo YouTube' });
    MT.add(
      c,
      el(
        'div',
        { class: 'mt-row' },
        W.button(
          'Importer une image',
          async () => {
            const d = await pickFile();
            if (d) {
              src = d;
              run();
            }
          },
          { icon: 'upload' }
        ),
        el(
          'div',
          { class: 'field-row', style: 'flex:1;min-width:300px' },
          vid,
          W.button(
            'Charger',
            async () => {
              const id = MT.videoIdFromUrl(vid.value);
              if (!id) return W.toast('Vidéo invalide', 'error');
              src = await videoThumbDataUrl(id);
              run();
            },
            { icon: 'download' }
          )
        )
      ),
      el('div', { class: 'field-row', style: 'margin-top:8px' }, kw, W.button('Analyser', run, { variant: 'primary', icon: 'chart' })),
      out
    );
    if (src) run();
  }

  /* -------------------------------------------------------- téléchargement */

  function downloadTab(c, params) {
    const out = el('div', { style: 'margin-top:14px' });
    const show = (id) => {
      const sizes = [
        ['maxresdefault', '1280 × 720'],
        ['sddefault', '640 × 480'],
        ['hqdefault', '480 × 360'],
        ['mqdefault', '320 × 180'],
        ['default', '120 × 90'],
      ];
      MT.fill(
        out,
        el(
          'div',
          { class: 'grid cols-3' },
          sizes.map(([q, label]) =>
            A.card(
              label,
              el('img', { src: MT.thumbUrl(id, q), style: 'width:100%;border-radius:8px', alt: q }),
              el(
                'div',
                { class: 'mt-row', style: 'margin-top:8px' },
                W.button(
                  'Télécharger',
                  async () => {
                    const res = await fetch(MT.thumbUrl(id, q), { credentials: 'omit' });
                    if (!res.ok) throw new Error('Taille indisponible pour cette vidéo');
                    MT.download(`${id}-${q}.jpg`, await res.blob());
                  },
                  { size: 'sm', icon: 'download' }
                ),
                el('a', { class: 'mt-btn sm ghost', href: MT.thumbUrl(id, q), target: '_blank', rel: 'noopener' }, 'Ouvrir')
              )
            )
          )
        )
      );
    };
    MT.add(c, A.videoInput({ label: 'Afficher', onSubmit: show }), out);
    if (params.v) show(params.v);
  }

  A.register('thumbnails', {
    title: 'Miniatures',
    icon: 'image',
    group: 'create',
    order: 2,
    description: 'Éditeur, test face aux concurrents, analyse',
    render(c, params) {
      MT.add(
        c,
        A.pageHead('Miniatures', 'Créez des miniatures percutantes, comparez-les aux concurrents et analysez leur lisibilité.', 'image'),
        A.card(
          null,
          W.tabs(
            [
              { id: 'editor', label: 'Éditeur', render: (x) => editorTab(x, params) },
              { id: 'test', label: 'Test en situation', render: (x) => testTab(x, params) },
              { id: 'analyze', label: 'Analyse', render: (x) => analyzeTab(x, params) },
              { id: 'download', label: 'Téléchargement', render: (x) => downloadTab(x, params) },
            ],
            { initial: params.tab || 'editor', onChange: (id) => A.setParams({ ...params, tab: id, frame: null }) }
          )
        )
      );
    },
  });

  MT.thumbs = { renderProject, canvasToBlob, loadImage, videoThumbDataUrl, pickFile, WIDTH, HEIGHT };
})();
