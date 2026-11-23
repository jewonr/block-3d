/* ==========================================================
   작업 공간 · 코드 생성 · 3D 실행
   ========================================================== */

(async function () {
  const $ = s => document.querySelector(s);
  const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
  const ADDONS_URL = 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/';
  const STORE = 'block3d';
  const DEFAULT_BG = '#1b1e26';

  const THREE = await import('three');
  const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
  try {
    await Promise.race([
      Promise.all([document.fonts.load('700 12px "SUIT Variable"'), document.fonts.load('400 13px "JetBrains Mono"')]),
      new Promise(r => setTimeout(r, 2500)),
    ]);
  } catch (e) { /* 기본 글꼴로 계속 */ }

  /* ---------------- 작업 공간 ---------------- */

  const ws = Blockly.inject($('#blockly'), {
    toolbox: TOOLBOX,
    theme: THEME,
    renderer: 'zelos',
    trashcan: true,
    sounds: false,
    media: 'https://unpkg.com/blockly@10.4.3/media/',
    zoom: { controls: true, wheel: true, startScale: 0.8, maxScale: 2, minScale: 0.35, scaleSpeed: 1.1 },
    move: { scrollbars: true, drag: true, wheel: false },
    grid: { spacing: 24, length: 2, colour: '#d3d8e2', snap: false },
  });

  document.querySelectorAll('.blocklyTreeRow').forEach(row => {
    row.style.setProperty('--c', row.style.borderLeftColor || '#999');
  });
  new ResizeObserver(() => Blockly.svgResize(ws)).observe($('.workspace'));

  /* ---------------- 코드 생성 ---------------- */

  function generate() {
    G.init(ws);
    const main = [], events = [];
    for (const b of ws.getTopBlocks(true)) {
      if (b.outputConnection || !b.isEnabled()) continue;
      const code = G.blockToCode(b);
      if (typeof code !== 'string' || !code) continue;
      (HATS.has(b.type) ? events : main).push(code);
    }
    let code = main.join('\n');
    if (events.length) code += (code ? '\n' : '') + events.join('\n');
    code = G.finish(code);
    return code.replace(/^[ \t]*\/\/.*\n/gm, '').replace(/^\s*\n/, '').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
  }

  /* ---------------- 3D ---------------- */

  const stage = $('#stage');
  const canvas = $('#canvas');
  const errorBox = $('#error');
  const runBtn = $('#run');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  const clock = new THREE.Clock();
  const HOME = { pos: new THREE.Vector3(6, 5, 9), target: new THREE.Vector3(0, 0, 0) };

  let scene = new THREE.Scene();
  let frames = [], timers = [], clicks = [], keyHandlers = [];
  let running = false;
  const keysDown = new Set();

  function dispose(root) {
    root.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      const m = o.material;
      if (m) (Array.isArray(m) ? m : [m]).forEach(x => x.dispose());
    });
  }

  function halt() {
    timers.forEach(t => { clearTimeout(t); clearInterval(t); });
    timers = [];
    frames = [];
    setRunning(false);
  }

  function setRunning(on) {
    running = on;
    runBtn.classList.toggle('on', on);
    runBtn.querySelector('span').textContent = on ? '정지' : '실행';
  }

  function showError(e) {
    errorBox.textContent = e && e.message ? e.message : String(e);
    errorBox.hidden = false;
  }

  function fail(e) {
    showError(e);
    halt();
  }

  const guard = fn => function () {
    if (!running) return;
    try { fn(); } catch (e) { fail(e); }
  };

  function homeCamera() {
    camera.position.copy(HOME.pos);
    controls.target.copy(HOME.target);
    controls.update();
  }

  function run(code, fresh) {
    const keepView = !fresh && !/camera\.position|controls\.target/.test(code);
    const view = { pos: camera.position.clone(), target: controls.target.clone() };

    halt();
    dispose(scene);
    scene = new THREE.Scene();
    scene.background = new THREE.Color(DEFAULT_BG);
    clicks = [];
    keyHandlers = [];
    errorBox.hidden = true;
    homeCamera();
    clock.start();
    setRunning(true);

    const api = {
      THREE, scene, camera, renderer, controls, clock,
      deg: Math.PI / 180,
      animate: fn => frames.push(fn),
      after: (s, fn) => timers.push(setTimeout(guard(fn), s * 1000)),
      every: (s, fn) => timers.push(setInterval(guard(fn), Math.max(s, 0.02) * 1000)),
      onClick: (o, fn) => { if (o && o.isObject3D) clicks.push({ o, fn }); },
      onKey: (k, fn) => keyHandlers.push({ k, fn }),
      isKeyDown: k => keysDown.has(k),
    };
    try {
      new Function(...RUNTIME, '"use strict";\n' + code)(...RUNTIME.map(k => api[k]));
    } catch (e) {
      fail(e);
    }
    if (keepView) {
      camera.position.copy(view.pos);
      controls.target.copy(view.target);
    }
    controls.update();
  }

  function fit() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    const c = renderer.domElement;
    if (c.width !== Math.round(w * renderer.getPixelRatio()) || c.height !== Math.round(h * renderer.getPixelRatio())) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  }

  renderer.setAnimationLoop(() => {
    fit();
    if (running) {
      for (const fn of frames.slice()) {
        try { fn(); } catch (e) { fail(e); break; }
      }
    }
    controls.update();
    renderer.render(scene, camera);
  });

  /* 클릭 */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let down = null;

  function hitTest(e) {
    if (!clicks.length) return null;
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(clicks.map(c => c.o), true)[0];
    if (!hit) return null;
    return clicks.filter(c => {
      for (let o = hit.object; o; o = o.parent) if (o === c.o) return true;
      return false;
    });
  }
  canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerup', e => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
    down = null;
    (hitTest(e) || []).forEach(c => guard(c.fn)());
  });
  canvas.addEventListener('pointermove', e => {
    if (e.buttons) return;
    canvas.style.cursor = hitTest(e) ? 'pointer' : '';
  });

  /* 키보드 */
  const keyName = e => (e.code.startsWith('Key') ? e.code.slice(3).toLowerCase() : e.code);
  canvas.addEventListener('keydown', e => {
    const k = keyName(e);
    if (k.startsWith('Arrow') || k === 'Space') e.preventDefault();
    keysDown.add(k);
    keyHandlers.filter(h => h.k === k).forEach(h => guard(h.fn)());
  });
  canvas.addEventListener('keyup', e => keysDown.delete(keyName(e)));
  canvas.addEventListener('blur', () => keysDown.clear());

  /* ---------------- 코드 보기 ---------------- */

  const codeView = $('#code');
  const TOKENS = /(\/\/.*$)|('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")|\b(var|let|const|new|function|return|if|else|for|while|true|false|null|of|in)\b|\b(THREE)\b|([\p{L}_$][\p{L}\p{N}_$]*)(?=\()|(\b\d+(?:\.\d+)?\b)/gmu;
  const escHtml = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  function highlight(src) {
    let out = '', last = 0;
    for (const m of src.matchAll(TOKENS)) {
      out += escHtml(src.slice(last, m.index));
      const cls = m[1] ? 'com' : m[2] ? 'str' : m[3] ? 'kw' : m[4] ? 'three' : m[5] ? 'fn' : 'num';
      out += `<span class="t-${cls}">${escHtml(m[0])}</span>`;
      last = m.index + m[0].length;
    }
    out += escHtml(src.slice(last));
    return out.split('\n').map(l => `<span class="ln">${l || ' '}</span>`).join('');
  }

  /* ---------------- 갱신 ---------------- */

  let code = '';
  let timer = 0;
  let nextFresh = true;

  function refresh() {
    clearTimeout(timer);
    timer = 0;
    code = generate();
    codeView.innerHTML = highlight(code.trimEnd());
    run(code, nextFresh);
    nextFresh = false;
    try {
      localStorage.setItem(STORE, JSON.stringify(Blockly.serialization.workspaces.save(ws)));
    } catch (e) { /* 저장 공간 없음 */ }
    updateUndo();
  }

  const schedule = () => { clearTimeout(timer); timer = setTimeout(refresh, 350); };

  ws.addChangeListener(e => {
    if (e.isUiEvent) return;
    if (ws.isDragging()) return;
    schedule();
  });

  function updateUndo() {
    $('#undo').disabled = !ws.getUndoStack().length;
    $('#redo').disabled = !ws.getRedoStack().length;
  }

  function load(fn) {
    nextFresh = true;
    Blockly.Events.disable();
    try { ws.clear(); fn(); } finally { Blockly.Events.enable(); }
    ws.clearUndo();
    refresh();
  }

  function loadExample(i) {
    load(() => {
      Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(exampleXml(EXAMPLES[i])), ws);
      ws.cleanUp();
      ws.getTopBlocks(true).forEach(b => b.moveBy(32, 28));
    });
  }

  /* ---------------- 상단 버튼 ---------------- */

  const exSelect = $('#examples');
  EXAMPLES.forEach((ex, i) => exSelect.add(new Option(ex.name, i)));
  exSelect.addEventListener('change', () => {
    if (exSelect.value !== '') loadExample(+exSelect.value);
    exSelect.value = '';
  });

  $('#undo').addEventListener('click', () => ws.undo(false));
  $('#redo').addEventListener('click', () => ws.undo(true));
  $('#new').addEventListener('click', () => { ws.clear(); });

  runBtn.addEventListener('click', () => {
    if (running) { halt(); return; }
    clearTimeout(timer);
    code = generate();
    run(code, true);
    canvas.focus({ preventScroll: true });
  });

  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  $('#save').addEventListener('click', () => {
    const data = Blockly.serialization.workspaces.save(ws);
    download('블록3D.json', JSON.stringify(data, null, 2), 'application/json');
  });

  const fileInput = $('#file');
  $('#open').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files[0];
    fileInput.value = '';
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      load(() => Blockly.serialization.workspaces.load(data, ws));
    } catch (e) {
      showError(e);
    }
  });

  $('#export').addEventListener('click', () => {
    download('scene.html', exportHtml(generate()), 'text/html');
  });

  $('#home').addEventListener('click', homeCamera);
  $('#full').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else stage.requestFullscreen && stage.requestFullscreen();
  });

  const copyBtn = $('#copy');
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(code);
      copyBtn.classList.add('done');
      setTimeout(() => copyBtn.classList.remove('done'), 1200);
    } catch (e) { /* 복사 불가 */ }
  });

  /* ---------------- 나누기 막대 ---------------- */

  const app = $('#app'), side = $('#side');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function splitter(el, rows, onMove) {
    el.addEventListener('pointerdown', e => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      document.body.classList.add('dragging');
      document.body.classList.toggle('rows', rows);
      const move = ev => onMove(ev);
      const up = () => {
        el.removeEventListener('pointermove', move);
        document.body.classList.remove('dragging', 'rows');
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up, { once: true });
      el.addEventListener('pointercancel', up, { once: true });
    });
  }
  splitter($('#splitV'), false, e => {
    const r = app.getBoundingClientRect();
    app.style.setProperty('--side', clamp(r.right - e.clientX, 300, r.width - 380) + 'px');
  });
  splitter($('#splitH'), true, e => {
    const r = side.getBoundingClientRect();
    side.style.setProperty('--code', clamp(r.bottom - e.clientY, 40, r.height - 160) + 'px');
  });

  /* ---------------- 내보내기 ---------------- */

  function exportHtml(src) {
    const body = src.trimEnd().split('\n').map(l => (l ? '  ' + l : l)).join('\n');
    return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>3D</title>
<style>
  html, body { margin: 0; height: 100%; overflow: hidden; background: #000; }
  canvas { display: block; outline: none; }
</style>
<script type="importmap">
{ "imports": { "three": "${THREE_URL}", "three/addons/": "${ADDONS_URL}" } }
<\/script>
</head>
<body>
<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('${DEFAULT_BG}');
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 2000);
camera.position.set(${HOME.pos.toArray().join(', ')});
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
const clock = new THREE.Clock();
const deg = Math.PI / 180;

const frames = [], clicks = [], keyHandlers = [], keysDown = new Set();
const animate = fn => frames.push(fn);
const after = (s, fn) => setTimeout(fn, s * 1000);
const every = (s, fn) => setInterval(fn, s * 1000);
const onClick = (obj, fn) => clicks.push({ obj, fn });
const onKey = (key, fn) => keyHandlers.push({ key, fn });
const isKeyDown = key => keysDown.has(key);

const keyName = e => e.code.startsWith('Key') ? e.code.slice(3).toLowerCase() : e.code;
addEventListener('keydown', e => {
  const k = keyName(e);
  keysDown.add(k);
  keyHandlers.filter(h => h.key === k).forEach(h => h.fn());
});
addEventListener('keyup', e => keysDown.delete(keyName(e)));

const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
renderer.domElement.addEventListener('click', e => {
  pointer.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(clicks.map(c => c.obj), true)[0];
  if (!hit) return;
  for (const c of clicks) {
    let o = hit.object;
    while (o && o !== c.obj) o = o.parent;
    if (o) c.fn();
  }
});

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

{
${body}
}

controls.update();
renderer.setAnimationLoop(() => {
  frames.forEach(fn => fn());
  controls.update();
  renderer.render(scene, camera);
});
<\/script>
</body>
</html>
`;
  }

  /* ---------------- 시작 ---------------- */

  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(STORE)); } catch (e) { /* 없음 */ }
  if (saved && typeof saved === 'object') load(() => Blockly.serialization.workspaces.load(saved, ws));
  else loadExample(0);
})();
