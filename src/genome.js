import { rng, hashString } from './rng.js';

// Local stand-in for the LLM: text → genome. The real server returns the same JSON shape.
// Keep the schema small on purpose; everything visual is derived by the compilers.
const COLORS = [
  [/빨간|붉은|적색/, '#B9573C'], [/파란|푸른|청색/, '#2F6F8F'], [/노란|황금|금빛|금색/, '#D4A94E'], [/하얀|흰|백색/, '#EDEAE2'],
  [/검은|검정|흑/, '#2A2A30'], [/초록|녹색|풀색/, '#4F7A3A'], [/보라|자주/, '#6B4A7A'], [/분홍|벚꽃/, '#E8A8B8'], [/회색|잿빛/, '#8E8A80'], [/갈색|밤색/, '#6B4A2E'],
];
const TWISTS_B = [
  ['꼭대기에 새 둥지가 있다', { nest: true }], ['벽을 덩굴이 타고 오른다', { vines: true }], ['밤이면 등불이 켜진다', { lantern: true }],
  ['지붕 위에 작은 정원', { garden: true }], ['깃발이 바람에 흔들린다', { banners: true }], ['굴뚝에서 연기가 난다', { chimney: true }], ['지붕에 수호상이 앉아 있다', { statue: true }],
];
const TWISTS_C = [
  ['등 위에 작은 등불 마을이 있다', { glow: true }], ['등줄기에 가시 능선', { ridge: true }], ['줄무늬가 있다', { pattern: 'stripes' }], ['뿔이 났다', { horns: true }], ['등지느러미가 돛처럼 크다', { dorsal: true }],
];
const TWISTS_T = [['가지에 등불이 걸렸다', { lantern: true }], ['꽃이 핀다', { blossom: '#E8A8B8' }], ['한쪽으로 기울었다', {}]];

export function parse(text, eraKey) {
  const t = text.trim();
  const r = rng(hashString(t + eraKey));
  const color = (COLORS.find(([re]) => re.test(t)) || [])[1];
  const big = /거대|큰|웅장|높은|장대/.test(t), small = /작은|조그만|아담|오두막/.test(t);
  const size = Math.min(1, Math.max(0, (big ? 0.75 : small ? 0.2 : 0.45) + r.range(-0.08, 0.08)));
  const ornament = /화려|장식|황금|신전|궁전|대성당/.test(t) ? 0.85 : /소박|단순|낡은|오두막/.test(t) ? 0.15 : 0.45;
  const age = /낡은|오래된|폐허|이끼/.test(t) ? 0.8 : 0.1;

  // tree
  if (/나무|숲|소나무|느티|버드|벚|참나무|야자/.test(t)) {
    const shape = /소나무|전나무|침엽/.test(t) ? 'pine' : /야자|사막/.test(t) ? 'sparse' : undefined;
    const tw = r.pick(TWISTS_T);
    return { kind: 'tree', size, depth: big ? 4 : 3, spread: /넓은|우거진/.test(t) ? 0.8 : 0.3, shape, color, blossom: /벚|꽃/.test(t) ? '#E8A8B8' : undefined, twist: tw[0], ...tw[1] };
  }
  // creature (single-syllable animals only as standalone words)
  const isCreature = /고래|드래곤|독수리|늑대|호랑이|사슴|거북|물고기|생명체|짐승|괴물|여우|토끼|코끼리|사자|까마귀|라마|염소|돌고래|공작|펠리컨|거미|나비/.test(t) || /(^|\s)(용|새|말|소|곰|뱀|학)(\s|$|가|를|이|은|는|도|한|와|과)/.test(t);
  if (isCreature) {
    let body = 'quadruped', legs = 4, wings = 0, fins = 0, tail = 1, horns = false, ears = true, snout = true, head = 0.5, bulk = 0.5, dorsal = false;
    if (/고래/.test(t)) { body = 'whale'; legs = 0; fins = 1; tail = 1.5; ears = false; snout = false; bulk = 0.9; head = 0.3; }
    if (/물고기/.test(t)) { body = 'fish'; legs = 0; fins = 2; dorsal = true; ears = false; snout = false; bulk = 0.4; }
    if (/뱀/.test(t)) { body = 'serpent'; legs = 0; ears = false; bulk = 0.2; tail = 2; }
    if (/용|드래곤/.test(t)) { body = 'dragon'; wings = 1; horns = true; tail = 2; bulk = 0.6; head = 0.6; }
    if (/새|독수리|학|까마귀/.test(t)) { body = 'bird'; wings = 1; legs = 2; ears = false; snout = true; bulk = 0.35; head = 0.6; tail = 0.6; }
    if (/거북/.test(t)) { bulk = 1; head = 0.3; tail = 0.3; ears = false; }
    if (/코끼리/.test(t)) { bulk = 1; head = 0.8; snout = true; }
    if (/사슴|소|염소/.test(t)) horns = true;
    if (/날개|하늘을 나는|날아/.test(t)) wings = 1;
    if (/뿔/.test(t)) horns = true;
    const m = t.match(/다리\s*(\d+)/); if (m) legs = +m[1];
    let legLen = 0.5, neck = 0, antler = false;
    if (/사슴|말|기린|학|라마/.test(t)) { legLen = 0.9; neck = /기린/.test(t) ? 1 : 0.6; }
    if (/사슴/.test(t)) { antler = true; horns = true; }
    if (/거북|곰|코끼리/.test(t)) legLen = 0.25;
    const pool = TWISTS_C.filter(([, f]) => !(f.horns && (legs === 0 || horns)) && !(f.dorsal && body !== 'fish' && body !== 'whale'));
    const tw = r.pick(pool);
    const g = { kind: 'creature', body, size, legs, wings, fins, tail, horns, ears, snout, head, bulk, dorsal, legLen, neck, antler, color, twist: tw[0], ...tw[1] };
    if (/빛나|등불|발광/.test(t)) g.glow = true;
    return g;
  }
  // building (default)
  let archetype = 'house', floors = 1 + (big ? 1 : 0), footprint, roof;
  const f = {};
  if (/탑|망루/.test(t)) { archetype = 'tower'; floors = 4 + (big ? 2 : 0); footprint = r.pick(['circle', 'polygon']); roof = r.pick(['cone', 'dome']); }
  if (/등대/.test(t)) { archetype = 'lighthouse'; floors = 4; footprint = 'circle'; roof = 'cone'; f.lantern = true; }
  if (/신전|사원|절|성당|모스크|사당/.test(t)) { archetype = 'temple'; floors = 1; footprint = r.pick(['rect', 'cross', 'polygon']); f.statue = r.chance(0.5); }
  if (/궁전|궁|왕궁/.test(t)) { archetype = 'palace'; floors = 2; footprint = r.pick(['T', 'cross', 'L']); f.banners = true; f.towers = r.chance(0.5); }
  if (/성|요새|성벽/.test(t) && !/성당/.test(t)) { archetype = 'castle'; floors = 2; footprint = r.pick(['rect', 'L']); f.towers = true; f.banners = true; roof = 'flat'; }
  if (/시장|장터|상점|가게|주막|빵집|국수|술집/.test(t)) { archetype = 'market'; floors = 1; footprint = 'rect'; f.banners = r.chance(0.6); }
  if (/창고|곡식|곳간/.test(t)) { archetype = 'barn'; floors = 1; footprint = 'rect'; roof = 'gable'; }
  if (/다리|물길|수로/.test(t)) { archetype = 'aqueduct'; floors = 1; footprint = 'rect'; roof = 'flat'; }
  if (/학교|서당|도서관|대학/.test(t)) { archetype = 'school'; floors = 2; footprint = r.pick(['L', 'T']); }
  if (/둥근|원형/.test(t)) footprint = 'circle';
  if (/돔/.test(t)) roof = 'dome';
  if (/뾰족/.test(t)) roof = 'cone';
  if (/층/.test(t)) { const m = t.match(/(\d+)\s*층/); if (m) floors = +m[1]; }
  if (/굴뚝/.test(t)) f.chimney = true;
  if (/정원/.test(t)) f.garden = true;
  if (/등불|빛나|밤에/.test(t)) f.lantern = true;
  if (/깃발/.test(t)) f.banners = true;
  if (/덩굴/.test(t)) f.vines = true;
  const tw = r.pick(TWISTS_B);
  return { kind: 'building', archetype, size, floors, footprint, roof, ornament, age, wallColor: color, features: { ...tw[1], ...f }, twist: tw[0] };
}

// Fill genome gaps from the era (the "civilization genome" step). Deterministic per seed.
export function resolve(g, era, seed) {
  const r = rng(seed ^ 0x9e3779b9);
  const out = structuredClone(g);
  if (out.kind === 'building') {
    out.footprint ||= r.pick(era.footprints);
    out.roof ||= r.pick(era.roofs);
    out.flare = (r.next() - 0.5) * 0.04;
  }
  return out;
}
