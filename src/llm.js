// Real LLM path: the published page asks Claude (viewer's account) for a genome.
// Falls back to the local parser when the capability is absent or a call fails.
import { ERAS } from './eras.js';

const SCHEMA = `
building: {"kind":"building","name":string,"archetype":"house|tower|lighthouse|temple|palace|castle|market|barn|aqueduct|school|shrine","size":0~1,"floors":1~8,"footprint":"rect|L|T|cross|circle|polygon","roof":"hip|gable|dome|cone|tiered|flat|stepped","ornament":0~1,"age":0~1,"wallColor":hex?,"roofColor":hex?,"features":{"towers":bool,"banners":bool,"garden":bool,"lantern":bool,"chimney":bool,"vines":bool,"nest":bool,"statue":bool},"ornaments":[{"motif":string,"kind":"statue|carving|lantern|banner|plant|bell","where":"corners|columns|roof|entrance|walls","count":1~8,"color":hex?,"creature":{"body":"quadruped|bird|serpent|fish|dragon","legs":int,"wings":0|1,"horns":bool,"antler":bool,"ears":bool,"snout":bool,"tail":0~3,"bulk":0~1,"head":0~1,"neck":0~1}?}],"twist":string}
creature: {"kind":"creature","name":string,"body":"quadruped|serpent|bird|fish|whale|dragon","size":0~1,"legs":0~8,"wings":0|1,"fins":0~3,"tail":0~3,"horns":bool,"antler":bool,"ears":bool,"snout":bool,"head":0~1,"bulk":0~1,"legLen":0~1,"neck":0~1,"dorsal":bool,"glow":bool,"ridge":bool,"color":hex?,"accent":hex?,"twist":string}
tree: {"kind":"tree","name":string,"size":0~1,"depth":2~5,"spread":0~1,"shape":"round|pine|sparse","color":hex?,"blossom":hex?,"lantern":bool,"twist":string}`;

export function buildPrompt(text, eraKey, current) {
  const era = ERAS[eraKey];
  const pal = [...era.palette.wall, ...era.palette.roof, ...era.palette.accent].join(', ');
  return `너는 게임 Worldsmith의 "세계"다. 창조주(플레이어)의 말을 듣고, 세계가 그 말을 어떻게 받아들였는지를 게놈 JSON으로 답한다.
세계: ${era.name}. 기술 수준: ${['', '불과 돌', '청동과 바퀴', '철과 제국', '믿음과 성채', '화약과 항해', '증기와 철도', '전기와 하늘', '별'][era.tech]} (사다리 1~8 중 ${era.tech}).
땅의 팔레트(기본 색): ${pal}. 재료: ${era.materials.join(', ')}. 이 시대에 없는 재료: ${era.locked.join(', ')}.

게놈 스키마 (셋 중 하나):${SCHEMA}

규칙:
1. 반드시 JSON 객체 하나만 출력. 설명 금지.
2. "mode" 필드를 넣는다: 말이 새로운 대상을 만들라는 것이면 "new", 지금 있는 것을 고치라는 것이면 "edit".
3. "twist": 요청에 없던 작은 특징 하나를 세계가 덧붙인다(한국어 한 문장, 시대에 어울리게). 매번 다르게.
4. 시대에 없는 것(자동차, 전구, 유리창 등)을 요청하면 그 시대의 물건으로 해석해 만들고 "era_fit":"reinterpreted", "note":"무엇을 무엇으로 해석했는지 한 문장" 을 넣는다. 시대에 맞으면 "era_fit":"ok".
5. 색은 팔레트에서 고르되, 창조주가 색을 말하면 그 색의 hex.
6. 크기 단어(작은/큰/거대한)를 size에, 층수/다리 수 같은 숫자는 그대로 반영.
7. "name": 세계가 붙인 이름(한국어, 2~6글자).
8. "늑대 조각", "기둥마다 독수리", "벽에 문양", "입구에 등불" 같은 장식 요청은 ornaments 배열에 넣는다. 동물 조각은 kind:"statue"에 creature 체형을 함께 쓴다. 고칠 때 기존 ornaments는 유지하고 덧붙인다.
${current ? `
지금 선택된 것(고칠 때는 이것을 바탕으로 전체 게놈을 다시 써서 돌려준다):
${JSON.stringify(current)}` : ''}

창조주의 말: "${text.replace(/"/g, '\'')}"`;
}

// Sanitize whatever came back so the compilers never see garbage.
const NUM = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const HEX = (v) => (typeof v === 'string' && /^#?[0-9a-fA-F]{6}$/.test(v)) ? (v.startsWith('#') ? v : '#' + v) : undefined;
const ONE = (v, list, d) => list.includes(v) ? v : d;
const B = (v) => v === true || v === 'true';

export function sanitize(j) {
  if (!j || typeof j !== 'object') return null;
  const kind = ONE(j.kind, ['building', 'creature', 'tree'], null); if (!kind) return null;
  const base = { kind, name: typeof j.name === 'string' ? j.name.slice(0, 20) : undefined, twist: typeof j.twist === 'string' ? j.twist.slice(0, 80) : undefined, era_fit: j.era_fit, note: typeof j.note === 'string' ? j.note.slice(0, 120) : undefined, mode: j.mode === 'edit' ? 'edit' : 'new' };
  if (kind === 'building') {
    const f = j.features && typeof j.features === 'object' ? j.features : {};
    return { ...base, archetype: ONE(j.archetype, ['house', 'tower', 'lighthouse', 'temple', 'palace', 'castle', 'market', 'barn', 'aqueduct', 'school', 'shrine'], 'house'), size: NUM(j.size, 0, 1, 0.45), floors: Math.round(NUM(j.floors, 1, 8, 1)),
      footprint: ONE(j.footprint, ['rect', 'L', 'T', 'cross', 'circle', 'polygon'], undefined), roof: ONE(j.roof, ['hip', 'gable', 'dome', 'cone', 'tiered', 'flat', 'stepped'], undefined), ornament: NUM(j.ornament, 0, 1, 0.45), age: NUM(j.age, 0, 1, 0.1), wallColor: HEX(j.wallColor), roofColor: HEX(j.roofColor),
      features: Object.fromEntries(['towers', 'banners', 'garden', 'lantern', 'chimney', 'vines', 'nest', 'statue'].map(k => [k, B(f[k])])),
      ornaments: Array.isArray(j.ornaments) ? j.ornaments.slice(0, 4).map(o => o && typeof o === 'object' ? ({ motif: String(o.motif || '').slice(0, 30), kind: ONE(o.kind, ['statue', 'carving', 'lantern', 'banner', 'plant', 'bell'], 'carving'), where: ONE(o.where, ['corners', 'columns', 'roof', 'entrance', 'walls'], 'corners'), count: Math.round(NUM(o.count, 1, 8, 2)), color: HEX(o.color),
        creature: o.creature && typeof o.creature === 'object' ? { body: ONE(o.creature.body, ['quadruped', 'bird', 'serpent', 'fish', 'dragon'], 'quadruped'), legs: Math.round(NUM(o.creature.legs, 0, 8, 4)), wings: B(o.creature.wings) || Number(o.creature.wings) === 1 ? 1 : 0, horns: B(o.creature.horns), antler: B(o.creature.antler), ears: B(o.creature.ears), snout: B(o.creature.snout), tail: NUM(o.creature.tail, 0, 3, 1), bulk: NUM(o.creature.bulk, 0, 1, 0.5), head: NUM(o.creature.head, 0, 1, 0.6), neck: NUM(o.creature.neck, 0, 1, 0) } : undefined }) : null).filter(Boolean) : [] };
  }
  if (kind === 'creature') return { ...base, body: ONE(j.body, ['quadruped', 'serpent', 'bird', 'fish', 'whale', 'dragon'], 'quadruped'), size: NUM(j.size, 0, 1, 0.45), legs: Math.round(NUM(j.legs, 0, 8, 4)), wings: B(j.wings) || Number(j.wings) === 1 ? 1 : 0, fins: Math.round(NUM(j.fins, 0, 3, 0)), tail: NUM(j.tail, 0, 3, 1), horns: B(j.horns), antler: B(j.antler), ears: B(j.ears), snout: B(j.snout), head: NUM(j.head, 0, 1, 0.5), bulk: NUM(j.bulk, 0, 1, 0.5), legLen: NUM(j.legLen, 0, 1, 0.5), neck: NUM(j.neck, 0, 1, 0), dorsal: B(j.dorsal), glow: B(j.glow), ridge: B(j.ridge), color: HEX(j.color), accent: HEX(j.accent) };
  return { ...base, size: NUM(j.size, 0, 1, 0.45), depth: Math.round(NUM(j.depth, 2, 5, 3)), spread: NUM(j.spread, 0, 1, 0.3), shape: ONE(j.shape, ['round', 'pine', 'sparse'], undefined), color: HEX(j.color), blossom: HEX(j.blossom), lantern: B(j.lantern) };
}

// Returns {genome, source:'claude'|'local', note?} — never throws.
export async function askWorld(sample, text, eraKey, current, onStatus, fallback) {
  if (sample) {
    try {
      onStatus?.('세계가 읽는 중…');
      const raw = await sample.json(buildPrompt(text, eraKey, current), { modelTier: 'quick', cache: false });
      const g = sanitize(raw);
      if (g) return { genome: g, source: 'claude' };
      onStatus?.('세계가 알아듣지 못해 로컬 해석으로');
    } catch (e) {
      const why = { not_granted: 'Claude 사용이 허용되지 않아 로컬 해석으로', rate_limited: '잠시 너무 많은 말 · 로컬 해석으로', invalid_json: '세계의 답이 깨져 로컬 해석으로', refused: '세계가 거절함 · 로컬 해석으로' }[e?.code] || `연결 실패(${e?.code || '?'}) · 로컬 해석으로`;
      onStatus?.(why);
      if (e?.code === 'not_granted' || e?.code === 'sampling_disabled') return { genome: fallback(), source: 'local', dead: true };
    }
  }
  return { genome: fallback(), source: 'local' };
}
