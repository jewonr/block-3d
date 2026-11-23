/* ==========================================================
   블록 정의 · 코드 변환 · 도구 상자 · 예제
   ========================================================== */

const G = (window.javascript && javascript.javascriptGenerator) || Blockly.JavaScript;
const O = { ATOMIC: 0, NEW: 1.1, MEMBER: 1.2, CALL: 2, MUL: 5.1, DIV: 5.2, NONE: 99 };

const RUNTIME = ['THREE', 'scene', 'camera', 'renderer', 'controls', 'clock', 'deg',
  'animate', 'after', 'every', 'onClick', 'onKey', 'isKeyDown'];
G.addReservedWords(RUNTIME.join(',') + ',light');

/* 한글 변수 이름을 그대로 코드에 쓰기 */
['safeName', 'safeName_'].forEach(k => {
  const p = Blockly.Names.prototype;
  if (typeof p[k] !== 'function') return;
  const orig = p[k];
  p[k] = function (name) {
    return /^[\p{L}_$][\p{L}\p{N}_$]*$/u.test(name) ? name : orig.call(this, name);
  };
});

/* ---------------- 색 ---------------- */

const HUES = {
  scene: '#3B5BDB',
  shape: '#E03131',
  move: '#7048E8',
  light: '#E8590C',
  anim: '#0CA678',
  event: '#C2255C',
  loop: '#1098AD',
  logic: '#495057',
  math: '#2F9E44',
  colour: '#9C36B5',
  variable: '#B7860B',
};

function shade(hex, t) {
  const n = parseInt(hex.slice(1), 16);
  const to = t > 0 ? 255 : 0, a = Math.abs(t);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(v + (to - v) * a));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}
const style = (hex, hat) => ({
  colourPrimary: hex, colourSecondary: shade(hex, 0.3), colourTertiary: shade(hex, -0.18),
  ...(hat ? { hat: 'cap' } : {}),
});

const blockStyles = {};
const categoryStyles = {};
for (const [k, hex] of Object.entries(HUES)) {
  blockStyles[k + '_blocks'] = style(hex);
  categoryStyles[k + '_category'] = { colour: hex };
}
blockStyles.anim_hat = style(HUES.anim, true);
blockStyles.event_hat = style(HUES.event, true);
Object.assign(blockStyles, {
  logic_blocks: style(HUES.logic),
  loop_blocks: style(HUES.loop),
  math_blocks: style(HUES.math),
  colour_blocks: style(HUES.colour),
  variable_blocks: style(HUES.variable),
  variable_dynamic_blocks: style(HUES.variable),
  text_blocks: style(HUES.math),
  list_blocks: style(HUES.loop),
  procedure_blocks: style(HUES.event),
});

const THEME = Blockly.Theme.defineTheme('block3d', {
  base: Blockly.Themes.Classic,
  blockStyles,
  categoryStyles,
  fontStyle: { family: '"SUIT Variable", SUIT, sans-serif', weight: '700', size: 12 },
  componentStyles: {
    workspaceBackgroundColour: '#eef1f5',
    toolboxBackgroundColour: '#ffffff',
    toolboxForegroundColour: '#1b2030',
    flyoutBackgroundColour: '#f6f7fa',
    flyoutForegroundColour: '#1b2030',
    flyoutOpacity: 1,
    scrollbarColour: '#c9ceda',
    scrollbarOpacity: 0.7,
    insertionMarkerColour: '#1b2030',
    insertionMarkerOpacity: 0.25,
  },
  startHats: false,
});

/* ---------------- 정의 도우미 ---------------- */

const STMT = { previousStatement: null, nextStatement: null };
const IN = (name, check) => ({ type: 'input_value', name, ...(check ? { check } : {}) });
const NUM = name => IN(name, 'Number');
const COL = name => IN(name, 'Colour');
const DO = { type: 'input_statement', name: 'DO' };
const NL = { type: 'input_dummy' };
const DROP = (name, options) => ({ type: 'field_dropdown', name, options });

function def(type, st, json, gen) {
  Blockly.common.defineBlocksWithJsonArray([{ type, style: st, inputsInline: true, ...json }]);
  G.forBlock[type] = gen;
}

const val = (b, name, fallback = '0', order = O.NONE) => G.valueToCode(b, name, order) || fallback;
const obj = (b, name = 'OBJ') => G.valueToCode(b, name, O.MEMBER);
const rad = x => (x === '0' ? '0' : `${x} * deg`);
const xyz = (b, f = v => v) => ['X', 'Y', 'Z'].map(k => f(val(b, k, '0', f === rad ? O.MUL : O.NONE))).join(', ');
const body = b => G.statementToCode(b, 'DO');
const XYZ = 'x %1 y %2 z %3';
const xyzArgs = [NUM('X'), NUM('Y'), NUM('Z')];

/* ---------------- 장면 ---------------- */

def('scene_background', 'scene_blocks', { message0: '배경색 %1', args0: [COL('COLOUR')], ...STMT },
  b => `scene.background = new THREE.Color(${val(b, 'COLOUR', "'#000000'")});\n`);

def('scene_grid', 'scene_blocks', { message0: '바닥 격자 %1 칸', args0: [NUM('SIZE')], ...STMT },
  b => { const s = val(b, 'SIZE', '20'); return `scene.add(new THREE.GridHelper(${s}, ${s}));\n`; });

def('scene_axes', 'scene_blocks', { message0: 'xyz 축 길이 %1', args0: [NUM('SIZE')], ...STMT },
  b => `scene.add(new THREE.AxesHelper(${val(b, 'SIZE', '3')}));\n`);

def('scene_fog', 'scene_blocks', {
  message0: '안개 %1 %2 부터 %3 까지', args0: [COL('COLOUR'), NUM('NEAR'), NUM('FAR')], ...STMT,
}, b => `scene.fog = new THREE.Fog(${val(b, 'COLOUR', "'#000000'")}, ${val(b, 'NEAR', '10')}, ${val(b, 'FAR', '50')});\n`);

def('camera_pos', 'scene_blocks', { message0: '카메라 위치 ' + XYZ, args0: xyzArgs, ...STMT },
  b => `camera.position.set(${xyz(b)});\n`);

def('camera_look', 'scene_blocks', { message0: '카메라가 볼 곳 ' + XYZ, args0: xyzArgs, ...STMT },
  b => `controls.target.set(${xyz(b)});\n`);

/* ---------------- 도형 ---------------- */

const MATS = [['표준', 'standard'], ['반짝', 'phong'], ['단색', 'basic'], ['무지개', 'normal'], ['뼈대', 'wire']];

def('three_mesh', 'shape_blocks', {
  message0: '%1 색 %2 %3',
  args0: [IN('GEO', 'Geometry'), COL('COLOUR'), DROP('MAT', MATS)],
  output: 'Object3D',
}, b => {
  const geo = val(b, 'GEO', 'new THREE.BoxGeometry()');
  const c = val(b, 'COLOUR', "'#ffffff'");
  const g = b.getInputTargetBlock('GEO');
  const side = g && g.type === 'geo_plane' ? ', side: THREE.DoubleSide' : '';
  const mat = {
    standard: `new THREE.MeshStandardMaterial({ color: ${c}${side} })`,
    phong: `new THREE.MeshPhongMaterial({ color: ${c}, shininess: 120${side} })`,
    basic: `new THREE.MeshBasicMaterial({ color: ${c}${side} })`,
    normal: `new THREE.MeshNormalMaterial({${side ? ' side: THREE.DoubleSide ' : ''}})`,
    wire: `new THREE.MeshBasicMaterial({ color: ${c}, wireframe: true })`,
  }[b.getFieldValue('MAT')];
  return [`new THREE.Mesh(${geo}, ${mat})`, O.NEW];
});

const geo = (type, msg, inputs, make) => def(type, 'shape_blocks', {
  message0: msg, args0: inputs.map(NUM), output: 'Geometry',
}, b => [make(...inputs.map(k => val(b, k, '1'))), O.NEW]);

geo('geo_box', '상자 가로 %1 세로 %2 깊이 %3', ['W', 'H', 'D'], (w, h, d) => `new THREE.BoxGeometry(${w}, ${h}, ${d})`);
geo('geo_sphere', '공 반지름 %1', ['R'], r => `new THREE.SphereGeometry(${r}, 48, 24)`);
geo('geo_cylinder', '원기둥 반지름 %1 높이 %2', ['R', 'H'], (r, h) => `new THREE.CylinderGeometry(${r}, ${r}, ${h}, 48)`);
geo('geo_cone', '원뿔 반지름 %1 높이 %2', ['R', 'H'], (r, h) => `new THREE.ConeGeometry(${r}, ${h}, 48)`);
geo('geo_torus', '도넛 반지름 %1 두께 %2', ['R', 'T'], (r, t) => `new THREE.TorusGeometry(${r}, ${t}, 24, 64)`);
geo('geo_knot', '매듭 반지름 %1 두께 %2', ['R', 'T'], (r, t) => `new THREE.TorusKnotGeometry(${r}, ${t}, 128, 16)`);
geo('geo_capsule', '캡슐 반지름 %1 길이 %2', ['R', 'L'], (r, l) => `new THREE.CapsuleGeometry(${r}, ${l}, 8, 24)`);
geo('geo_plane', '판 가로 %1 세로 %2', ['W', 'H'], (w, h) => `new THREE.PlaneGeometry(${w}, ${h})`);

def('geo_poly', 'shape_blocks', {
  message0: '%1 반지름 %2',
  args0: [DROP('KIND', [['정이십면체', 'Icosahedron'], ['정십이면체', 'Dodecahedron'], ['정팔면체', 'Octahedron'], ['정사면체', 'Tetrahedron']]), NUM('R')],
  output: 'Geometry',
}, b => [`new THREE.${b.getFieldValue('KIND')}Geometry(${val(b, 'R', '1')})`, O.NEW]);

def('group_new', 'shape_blocks', { message0: '빈 묶음', output: 'Object3D' },
  () => ['new THREE.Group()', O.NEW]);

def('scene_add', 'shape_blocks', { message0: '장면에 %1 넣기', args0: [IN('OBJ')], ...STMT },
  b => { const o = val(b, 'OBJ', ''); return o ? `scene.add(${o});\n` : ''; });

def('obj_attach', 'shape_blocks', { message0: '%1 에 %2 붙이기', args0: [IN('PARENT'), IN('CHILD')], ...STMT },
  b => { const p = obj(b, 'PARENT'), c = val(b, 'CHILD', ''); return p && c ? `${p}.add(${c});\n` : ''; });

def('obj_remove', 'shape_blocks', { message0: '%1 지우기', args0: [IN('OBJ')], ...STMT },
  b => { const o = obj(b); return o ? `${o}.removeFromParent();\n` : ''; });

/* ---------------- 움직임 ---------------- */

const PROPS = [
  ['x 위치', 'position.x'], ['y 위치', 'position.y'], ['z 위치', 'position.z'],
  ['x 회전', 'rotation.x'], ['y 회전', 'rotation.y'], ['z 회전', 'rotation.z'],
  ['크기', 'scale'],
];
const isRot = p => p.startsWith('rotation');

const move = (type, msg, args, gen) => def(type, 'move_blocks', { message0: msg, args0: [IN('OBJ'), ...args], ...STMT },
  b => { const o = obj(b); return o ? gen(b, o) : ''; });

move('obj_pos', '%1 위치 x %2 y %3 z %4', xyzArgs, (b, o) => `${o}.position.set(${xyz(b)});\n`);
move('obj_rot', '%1 회전 x %2 y %3 z %4', xyzArgs, (b, o) => `${o}.rotation.set(${xyz(b, rad)});\n`);
move('obj_scale', '%1 크기 x %2 y %3 z %4', xyzArgs, (b, o) => `${o}.scale.set(${xyz(b)});\n`);

move('obj_change', '%1 %2 %3 만큼 바꾸기', [DROP('PROP', PROPS), NUM('VALUE')], (b, o) => {
  const p = b.getFieldValue('PROP');
  if (p === 'scale') return `${o}.scale.addScalar(${val(b, 'VALUE')});\n`;
  return `${o}.${p} += ${isRot(p) ? rad(val(b, 'VALUE', '0', O.MUL)) : val(b, 'VALUE')};\n`;
});

move('obj_set', '%1 %2 %3 (으)로 정하기', [DROP('PROP', PROPS), NUM('VALUE')], (b, o) => {
  const p = b.getFieldValue('PROP');
  if (p === 'scale') return `${o}.scale.setScalar(${val(b, 'VALUE', '1')});\n`;
  return `${o}.${p} = ${isRot(p) ? rad(val(b, 'VALUE', '0', O.MUL)) : val(b, 'VALUE')};\n`;
});

move('obj_lookat', '%1 이(가) x %2 y %3 z %4 바라보기', xyzArgs, (b, o) => `${o}.lookAt(${xyz(b)});\n`);
move('obj_color', '%1 색 %2 (으)로 바꾸기', [COL('COLOUR')], (b, o) => `${o}.material.color.set(${val(b, 'COLOUR', "'#ffffff'")});\n`);
move('obj_visible', '%1 %2', [DROP('V', [['보이기', 'true'], ['숨기기', 'false']])], (b, o) => `${o}.visible = ${b.getFieldValue('V')};\n`);

def('obj_get', 'move_blocks', { message0: '%1 의 %2', args0: [IN('OBJ'), DROP('PROP', PROPS)], output: 'Number' }, b => {
  const o = obj(b) || 'scene';
  const p = b.getFieldValue('PROP');
  if (p === 'scale') return [`${o}.scale.x`, O.MEMBER];
  if (isRot(p)) return [`${o}.${p} / deg`, O.DIV];
  return [`${o}.${p}`, O.MEMBER];
});

def('obj_distance', 'move_blocks', { message0: '%1 와(과) %2 사이 거리', args0: [IN('A'), IN('B')], output: 'Number' },
  b => [`${obj(b, 'A') || 'scene'}.position.distanceTo(${obj(b, 'B') || 'scene'}.position)`, O.CALL]);

/* ---------------- 조명 ---------------- */

def('light_ambient', 'light_blocks', { message0: '주변광 %1 밝기 %2', args0: [COL('COLOUR'), NUM('I')], ...STMT },
  b => `scene.add(new THREE.AmbientLight(${val(b, 'COLOUR', "'#ffffff'")}, ${val(b, 'I', '1')}));\n`);

def('light_hemi', 'light_blocks', { message0: '하늘빛 %1 땅빛 %2 밝기 %3', args0: [COL('SKY'), COL('GROUND'), NUM('I')], ...STMT },
  b => `scene.add(new THREE.HemisphereLight(${val(b, 'SKY', "'#ffffff'")}, ${val(b, 'GROUND', "'#444444'")}, ${val(b, 'I', '1')}));\n`);

def('light_dir', 'light_blocks', { message0: '햇빛 %1 밝기 %2', args0: [COL('COLOUR'), NUM('I')], output: 'Object3D' },
  b => [`new THREE.DirectionalLight(${val(b, 'COLOUR', "'#ffffff'")}, ${val(b, 'I', '2')})`, O.NEW]);

def('light_point', 'light_blocks', { message0: '전구 %1 밝기 %2', args0: [COL('COLOUR'), NUM('I')], output: 'Object3D' },
  b => [`new THREE.PointLight(${val(b, 'COLOUR', "'#ffffff'")}, ${val(b, 'I', '2')}, 0, 0)`, O.NEW]);

/* ---------------- 애니메이션 ---------------- */

def('anim_frame', 'anim_hat', { message0: '매 프레임마다 %1 %2', args0: [NL, DO] },
  b => `animate(() => {\n${body(b)}});\n`);

def('anim_after', 'anim_blocks', { message0: '%1 초 뒤에 %2 %3', args0: [NUM('SEC'), NL, DO], ...STMT },
  b => `after(${val(b, 'SEC', '1')}, () => {\n${body(b)}});\n`);

def('anim_every', 'anim_blocks', { message0: '%1 초마다 %2 %3', args0: [NUM('SEC'), NL, DO], ...STMT },
  b => `every(${val(b, 'SEC', '1')}, () => {\n${body(b)}});\n`);

def('anim_time', 'anim_blocks', { message0: '시간(초)', output: 'Number' },
  () => ['clock.getElapsedTime()', O.CALL]);

/* ---------------- 이벤트 ---------------- */

const KEYS = [['↑', 'ArrowUp'], ['↓', 'ArrowDown'], ['←', 'ArrowLeft'], ['→', 'ArrowRight'], ['스페이스', 'Space'],
  ['W', 'w'], ['A', 'a'], ['S', 's'], ['D', 'd'], ['엔터', 'Enter']];

def('event_click', 'event_hat', { message0: '%1 을(를) 클릭했을 때 %2 %3', args0: [IN('OBJ'), NL, DO] },
  b => { const o = val(b, 'OBJ', ''); return o ? `onClick(${o}, () => {\n${body(b)}});\n` : ''; });

def('event_key', 'event_hat', { message0: '%1 키를 눌렀을 때 %2 %3', args0: [DROP('KEY', KEYS), NL, DO] },
  b => `onKey('${b.getFieldValue('KEY')}', () => {\n${body(b)}});\n`);

def('event_keydown', 'event_blocks', { message0: '%1 키를 누르고 있나?', args0: [DROP('KEY', KEYS)], output: 'Boolean' },
  b => [`isKeyDown('${b.getFieldValue('KEY')}')`, O.CALL]);

/* ---------------- 색 ---------------- */

def('colour_hsl', 'colour_blocks', { message0: '무지개 %1', args0: [NUM('H')], output: 'Colour' },
  b => [`new THREE.Color().setHSL(${val(b, 'H', '0', O.DIV)} / 360, 0.75, 0.6)`, O.CALL]);

const HATS = new Set(['anim_frame', 'event_click', 'event_key']);

/* ==========================================================
   XML 도우미 (도구 상자 · 예제)
   ========================================================== */

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const N = (type, f = {}, v = {}, s = {}, m = '') => ({ type, f, v, s, m });

function valXml(x) {
  if (typeof x === 'number') return `<shadow type="math_number"><field name="NUM">${x}</field></shadow>`;
  if (typeof x === 'string') return `<shadow type="colour_picker"><field name="COLOUR">${x}</field></shadow>`;
  if (Array.isArray(x)) return valXml(x[1]) + valXml(x[0]);
  return toXml(x);
}
function toXml(n, rest = [], pos) {
  let s = `<block type="${n.type}"${pos ? ` x="${pos[0]}" y="${pos[1]}"` : ''}>` + n.m;
  for (const [k, x] of Object.entries(n.f)) s += `<field name="${k}">${esc(x)}</field>`;
  for (const [k, x] of Object.entries(n.v)) s += `<value name="${k}">${valXml(x)}</value>`;
  for (const [k, x] of Object.entries(n.s)) s += `<statement name="${k}">${stackXml(x)}</statement>`;
  if (rest.length) s += `<next>${stackXml(rest)}</next>`;
  return s + '</block>';
}
const stackXml = list => (list.length ? toXml(list[0], list.slice(1)) : '');

/* 자주 쓰는 블록 */
const T = {
  get: v => N('variables_get', { VAR: v }),
  set: (v, x) => N('variables_set', { VAR: v }, { VALUE: x }),
  mesh: (g, c = '#4c6ef5', mat = 'standard') => N('three_mesh', { MAT: mat }, { GEO: g, COLOUR: c }),
  box: (w = 1, h = 1, d = 1) => N('geo_box', {}, { W: w, H: h, D: d }),
  sphere: (r = 1) => N('geo_sphere', {}, { R: r }),
  group: () => N('group_new'),
  add: v => N('scene_add', {}, { OBJ: T.get(v) }),
  attach: (p, c) => N('obj_attach', {}, { PARENT: T.get(p), CHILD: T.get(c) }),
  pos: (v, x, y, z) => N('obj_pos', {}, { OBJ: T.get(v), X: x, Y: y, Z: z }),
  change: (v, p, n) => N('obj_change', { PROP: p }, { OBJ: T.get(v), VALUE: n }),
  setp: (v, p, n) => N('obj_set', { PROP: p }, { OBJ: T.get(v), VALUE: n }),
  bg: c => N('scene_background', {}, { COLOUR: c }),
  grid: n => N('scene_grid', {}, { SIZE: n }),
  cam: (x, y, z) => N('camera_pos', {}, { X: x, Y: y, Z: z }),
  look: (x, y, z) => N('camera_look', {}, { X: x, Y: y, Z: z }),
  ambient: (c, i) => N('light_ambient', {}, { COLOUR: c, I: i }),
  hemi: (a, b, i) => N('light_hemi', {}, { SKY: a, GROUND: b, I: i }),
  sun: (c, i) => N('light_dir', {}, { COLOUR: c, I: i }),
  bulb: (c, i) => N('light_point', {}, { COLOUR: c, I: i }),
  frame: (...s) => N('anim_frame', {}, {}, { DO: s }),
  rand: (a, b) => N('math_random_int', {}, { FROM: a, TO: b }),
  op: (op, a, b) => N('math_arithmetic', { OP: op }, { A: a, B: b }),
  if: (cond, ...s) => N('controls_if', {}, { IF0: cond }, { DO0: s }),
  key: k => N('event_keydown', { KEY: k }),
};

/* ---------------- 도구 상자 ---------------- */

const cat = (name, st, items, custom) =>
  `<category name="${name}" categorystyle="${st}_category"${custom ? ` custom="${custom}"` : ''}>` +
  (items || []).map(i => (typeof i === 'string' ? i : Array.isArray(i) ? stackXml(i) : toXml(i))).join('') +
  '</category>';
const GAP = '<sep gap="28"></sep>';

const TOOLBOX = '<xml>' + [
  cat('장면', 'scene', [
    T.bg('#1b1e26'), T.grid(20), N('scene_axes', {}, { SIZE: 3 }),
    N('scene_fog', {}, { COLOUR: '#1b1e26', NEAR: 10, FAR: 40 }), GAP,
    T.cam(6, 5, 9), T.look(0, 0, 0),
  ]),
  cat('도형', 'shape', [
    [T.set('상자', T.mesh(T.box())), T.add('상자')], GAP,
    T.mesh(T.box()),
    T.box(), T.sphere(),
    N('geo_cylinder', {}, { R: 0.5, H: 1 }), N('geo_cone', {}, { R: 0.5, H: 1 }),
    N('geo_torus', {}, { R: 1, T: 0.3 }), N('geo_knot', {}, { R: 1, T: 0.3 }),
    N('geo_capsule', {}, { R: 0.5, L: 1 }), N('geo_poly', {}, { R: 1 }),
    N('geo_plane', {}, { W: 5, H: 5 }), GAP,
    T.group(), T.add('상자'), T.attach('묶음', '상자'), N('obj_remove', {}, { OBJ: T.get('상자') }),
  ]),
  cat('움직임', 'move', [
    T.pos('상자', 0, 0, 0),
    N('obj_rot', {}, { OBJ: T.get('상자'), X: 0, Y: 45, Z: 0 }),
    N('obj_scale', {}, { OBJ: T.get('상자'), X: 1, Y: 1, Z: 1 }), GAP,
    T.change('상자', 'rotation.y', 1), T.setp('상자', 'position.x', 0),
    N('obj_get', { PROP: 'position.x' }, { OBJ: T.get('상자') }), GAP,
    N('obj_color', {}, { OBJ: T.get('상자'), COLOUR: '#fa5252' }),
    N('obj_visible', {}, { OBJ: T.get('상자') }),
    N('obj_lookat', {}, { OBJ: T.get('상자'), X: 0, Y: 0, Z: 0 }),
    N('obj_distance', {}, { A: T.get('상자'), B: T.get('공') }),
  ]),
  cat('조명', 'light', [
    T.ambient('#ffffff', 0.5), T.hemi('#ffffff', '#444444', 1.5), GAP,
    [T.set('햇빛', T.sun('#ffffff', 2)), T.pos('햇빛', 5, 10, 7), T.add('햇빛')], GAP,
    [T.set('전구', T.bulb('#ffffff', 2)), T.pos('전구', 0, 3, 0), T.add('전구')], GAP,
    T.sun('#ffffff', 2), T.bulb('#ffffff', 2),
  ]),
  cat('애니메이션', 'anim', [
    T.frame(T.change('상자', 'rotation.y', 1)), GAP,
    N('anim_after', {}, { SEC: 1 }), N('anim_every', {}, { SEC: 1 }), N('anim_time'),
  ]),
  cat('이벤트', 'event', [
    N('event_click', {}, { OBJ: T.get('상자') }), N('event_key'), GAP, T.key('ArrowUp'),
  ]),
  '<sep></sep>',
  cat('반복', 'loop', [
    N('controls_repeat_ext', {}, { TIMES: 10 }),
    N('controls_for', { VAR: 'i' }, { FROM: 1, TO: 10, BY: 1 }),
  ]),
  cat('조건', 'logic', [
    N('controls_if'), N('controls_if', {}, {}, {}, '<mutation else="1"></mutation>'),
    N('logic_compare', { OP: 'GT' }, { A: 0, B: 0 }), N('logic_operation'), N('logic_negate'), N('logic_boolean'),
  ]),
  cat('수학', 'math', [
    N('math_number', { NUM: 0 }),
    T.op('ADD', 1, 1), T.op('MULTIPLY', 1, 1),
    T.rand(1, 10), N('math_random_float'),
    N('math_trig', { OP: 'SIN' }, { NUM: 45 }),
    N('math_modulo', {}, { DIVIDEND: 10, DIVISOR: 3 }),
    N('math_round', { OP: 'ROUND' }, { NUM: 3.1 }),
  ]),
  cat('색', 'colour', [
    N('colour_picker', { COLOUR: '#4c6ef5' }), N('colour_random'), N('colour_hsl', {}, { H: 0 }),
  ]),
  cat('변수', 'variable', null, 'VARIABLE'),
].join('') + '</xml>';

/* ---------------- 예제 ---------------- */

const EXAMPLES = [
  {
    name: '돌아가는 상자',
    stacks: [
      [
        T.bg('#1b1e26'), T.grid(20), T.ambient('#ffffff', 0.4),
        T.set('햇빛', T.sun('#ffffff', 2.5)), T.pos('햇빛', 5, 10, 7), T.add('햇빛'),
        T.set('상자', T.mesh(T.box(2, 2, 2), '#4c6ef5')), T.pos('상자', 0, 1.5, 0), T.add('상자'),
      ],
      [T.frame(T.change('상자', 'rotation.y', 1), T.change('상자', 'rotation.x', 0.5))],
    ],
  },
  {
    name: '태양계',
    stacks: [
      [
        T.bg('#05060a'), T.ambient('#ffffff', 0.15), T.cam(0, 8, 13),
        T.set('태양', T.mesh(T.sphere(1.5), '#ffb703', 'basic')), T.add('태양'),
        T.set('전구', T.bulb('#fff4e0', 3)), T.add('전구'),
        T.set('지구궤도', T.group()), T.add('지구궤도'),
        T.set('지구', T.mesh(T.sphere(0.5), '#4dabf7')), T.setp('지구', 'position.x', 5), T.attach('지구궤도', '지구'),
        T.set('달궤도', T.group()), T.attach('지구', '달궤도'),
        T.set('달', T.mesh(T.sphere(0.15), '#dee2e6')), T.setp('달', 'position.x', 1), T.attach('달궤도', '달'),
        N('controls_repeat_ext', {}, { TIMES: 300 }, {
          DO: [
            T.set('별', T.mesh(T.sphere(0.06), '#ffffff', 'basic')),
            T.pos('별', T.rand(-60, 60), T.rand(-60, 60), T.rand(-60, 60)),
            T.add('별'),
          ],
        }),
      ],
      [T.frame(T.change('지구궤도', 'rotation.y', 0.5), T.change('지구', 'rotation.y', 2), T.change('달궤도', 'rotation.y', 1.5))],
    ],
  },
  {
    name: '무지개 탑',
    stacks: [
      [
        T.bg('#f1f3f5'), T.hemi('#ffffff', '#868e96', 2), T.grid(20),
        T.set('햇빛', T.sun('#ffffff', 1.5)), T.pos('햇빛', 5, 10, 7), T.add('햇빛'),
        T.cam(9, 8, 11), T.look(0, 4, 0),
        N('controls_for', { VAR: 'i' }, { FROM: 0, TO: 19, BY: 1 }, {
          DO: [
            T.set('층', T.mesh(T.box(3, 0.4, 1), N('colour_hsl', {}, { H: [T.op('MULTIPLY', T.get('i'), 18), 0] }))),
            T.setp('층', 'position.y', [T.op('ADD', T.op('MULTIPLY', T.get('i'), 0.45), 0.2), 0]),
            T.setp('층', 'rotation.y', [T.op('MULTIPLY', T.get('i'), 9), 0]),
            T.add('층'),
          ],
        }),
      ],
    ],
  },
  {
    name: '키보드로 움직이기',
    stacks: [
      [
        T.bg('#1b1e26'), T.hemi('#ffffff', '#444444', 2), T.grid(20), T.cam(0, 9, 10),
        T.set('공', T.mesh(T.sphere(0.5), '#fa5252')), T.pos('공', 0, 0.5, 0), T.add('공'),
      ],
      [T.frame(
        T.if(T.key('ArrowUp'), T.change('공', 'position.z', -0.1)),
        T.if(T.key('ArrowDown'), T.change('공', 'position.z', 0.1)),
        T.if(T.key('ArrowLeft'), T.change('공', 'position.x', -0.1)),
        T.if(T.key('ArrowRight'), T.change('공', 'position.x', 0.1)),
      )],
      [N('event_click', {}, { OBJ: T.get('공') }, { DO: [N('obj_color', {}, { OBJ: T.get('공'), COLOUR: N('colour_random') })] })],
      [N('event_key', { KEY: 'Space' }, {}, {
        DO: [T.setp('공', 'position.y', 2), N('anim_after', {}, { SEC: 0.4 }, { DO: [T.setp('공', 'position.y', 0.5)] })],
      })],
    ],
  },
];

function exampleXml(ex) {
  return '<xml>' + ex.stacks.map((s, i) => toXml(s[0], s.slice(1), [24, 24 + i * 400])).join('') + '</xml>';
}
