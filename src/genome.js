import { rng, hashString } from './rng.js';

// Local stand-in for the LLM: text → genome. The real server returns the same JSON shape.
// Keep the schema small on purpose; everything visual is derived by the compilers.
const COLORS = [
  [/빨간|빨갛|붉은|붉게|적색|빨개/, '#B9573C'], [/파란|파랗|푸른|푸르게|청색|파래/, '#2F6F8F'], [/노란|노랗|황금|금빛|금색|노래/, '#D4A94E'], [/하얀|하얗|흰|백색|하얘/, '#EDEAE2'],
  [/검은|검게|검정|까만|까맣|흑/, '#2A2A30'], [/초록|녹색|풀색|푸릇/, '#4F7A3A'], [/보라|자주/, '#6B4A7A'], [/분홍|벚꽃|핑크/, '#E8A8B8'], [/회색|잿빛/, '#8E8A80'], [/갈색|밤색/, '#6B4A2E'],
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

// ---------- amend: "말로 고치기" ----------
// Returns {genome, note} when the text reads as a change to the current genome, else null.
// No LLM: these are the "손길" edits (free). Unknown phrasing falls back to a fresh parse upstream.
export function amend(g, text) {
  const t = text.trim();
  const o = structuredClone(g);
  const notes = [];
  const clamp = (v) => Math.min(1, Math.max(0, v));
  const sz = (d) => { o.size = clamp((o.size ?? 0.45) + d); notes.push(d > 0 ? '더 크게' : '더 작게'); };
  if (/훨씬 (더 )?크게|거대하게|아주 크게/.test(t)) sz(0.4); else if (/더 크게|크게|키워/.test(t)) sz(0.2);
  if (/훨씬 (더 )?작게|아주 작게/.test(t)) sz(-0.4); else if (/더 작게|작게|줄여/.test(t)) sz(-0.2);
  const color = (COLORS.find(([re]) => re.test(t)) || [])[1];
  if (color) { if (/지붕/.test(t) && o.kind === 'building') o.roofColor = color; else if (o.kind === 'building') o.wallColor = color; else o.color = color; notes.push('색 바꿈'); }
  if (/화려|장식 (더|많이)|꾸며/.test(t)) { o.ornament = clamp((o.ornament ?? 0.45) + 0.3); notes.push('더 화려하게'); }
  if (/소박|단순|장식 (빼|없)/.test(t)) { o.ornament = clamp((o.ornament ?? 0.45) - 0.3); notes.push('더 소박하게'); }
  if (/낡게|오래된|이끼|세월/.test(t)) { o.age = clamp((o.age ?? 0.1) + 0.5); notes.push('세월을 입힘'); }
  if (/새것|깨끗|새로/.test(t)) { o.age = 0.05; notes.push('새것처럼'); }
  if (o.kind === 'building') {
    o.features ||= {};
    const m = t.match(/(\d+)\s*층/); if (m) { o.floors = +m[1]; notes.push(`${m[1]}층`); }
    else if (/층 (더|올려|추가)|한 층|높게|높여/.test(t)) { o.floors = (o.floors ?? 1) + 1; notes.push('한 층 더'); }
    else if (/층 (빼|낮춰)|낮게|낮춰/.test(t)) { o.floors = Math.max(1, (o.floors ?? 1) - 1); notes.push('한 층 낮게'); }
    if (/돔|둥근 지붕/.test(t)) { o.roof = 'dome'; notes.push('돔 지붕'); }
    if (/뾰족|첨탑|원뿔/.test(t)) { o.roof = 'cone'; notes.push('뾰족 지붕'); }
    if (/평평|옥상|평지붕/.test(t)) { o.roof = 'flat'; notes.push('평지붕'); }
    if (/박공|맞배/.test(t)) { o.roof = 'gable'; notes.push('박공 지붕'); }
    if (/겹처마|층층|탑처럼|기와 겹/.test(t)) { o.roof = 'tiered'; notes.push('겹처마'); }
    if (/둥글게|원형으로|둥근 (집|건물|평면)/.test(t) && !/지붕/.test(t)) { o.footprint = 'circle'; notes.push('둥근 평면'); }
    if (/ㄱ자|기역|L자/.test(t)) { o.footprint = 'L'; notes.push('ㄱ자 평면'); }
    if (/십자/.test(t)) { o.footprint = 'cross'; notes.push('십자 평면'); }
    const add = (k, re, label) => { if (re.test(t)) { o.features[k] = !/빼|없애|치워|제거/.test(t); notes.push((o.features[k] ? '' : '제거: ') + label); } };
    add('towers', /탑을|망루|탑 (달|세|추가|빼)/, '탑'); add('banners', /깃발/, '깃발'); add('garden', /정원|옥상 정원/, '정원'); add('lantern', /등불|불 밝|빛나게/, '등불');
    add('chimney', /굴뚝/, '굴뚝'); add('vines', /덩굴/, '덩굴'); add('nest', /둥지/, '둥지'); add('statue', /조각상|수호상|상을/, '조각상');
  }
  if (o.kind === 'creature') {
    const m = t.match(/다리\s*(\d+)/); if (m) { o.legs = +m[1]; notes.push(`다리 ${m[1]}개`); }
    if (/날개/.test(t)) { o.wings = /빼|없애/.test(t) ? 0 : 1; notes.push(o.wings ? '날개' : '날개 제거'); }
    if (/뿔/.test(t)) { o.horns = !/빼|없애/.test(t); notes.push(o.horns ? '뿔' : '뿔 제거'); }
    if (/빛나|등불|발광/.test(t)) { o.glow = true; notes.push('빛남'); }
    if (/줄무늬|무늬/.test(t)) { o.pattern = 'stripes'; notes.push('줄무늬'); }
    if (/뚱뚱|통통|살찌/.test(t)) { o.bulk = clamp((o.bulk ?? 0.5) + 0.3); notes.push('더 통통하게'); }
    if (/날씬|마른|홀쭉/.test(t)) { o.bulk = clamp((o.bulk ?? 0.5) - 0.3); notes.push('더 날씬하게'); }
    if (/다리 (길|늘)/.test(t)) { o.legLen = clamp((o.legLen ?? 0.5) + 0.3); notes.push('다리 길게'); }
    if (/목 (길|늘)/.test(t)) { o.neck = clamp((o.neck ?? 0) + 0.5); notes.push('목 길게'); }
    if (/꼬리 (길|늘)/.test(t)) { o.tail = (o.tail ?? 1) + 1; notes.push('꼬리 길게'); }
  }
  if (o.kind === 'tree') {
    if (/우거지|무성|가지 (더|많이)/.test(t)) { o.depth = Math.min(5, (o.depth ?? 3) + 1); o.spread = clamp((o.spread ?? 0.3) + 0.3); notes.push('더 무성하게'); }
    if (/꽃/.test(t)) { o.blossom = color || '#E8A8B8'; notes.push('꽃'); }
    if (/등불/.test(t)) { o.lantern = true; notes.push('등불'); }
    if (/소나무|침엽/.test(t)) { o.shape = 'pine'; notes.push('침엽수로'); }
  }
  if (!notes.length) return null;
  return { genome: o, note: notes.join(' · ') };
}
