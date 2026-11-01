import * as THREE from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { rng } from '../rng.js';
import { paint, mesh } from './common.js';

// Organic forms from metaballs along a spine. No two seeds give the same silhouette.
export function compileCreature(g, era, seed) {
  const r = rng(seed);
  const root = new THREE.Group();
  const skin = paint(g.color || r.pick(era.creature.skin), r, { rough: 0.8 });
  const res = 44;
  const mc = new MarchingCubes(res, skin, false, false, 80000);
  mc.isolation = 70;
  mc.reset();

  const flying = g.body === 'bird' || g.body === 'dragon' || g.body === 'whale' && g.wings;
  const serp = g.body === 'serpent' || g.body === 'fish' || g.body === 'whale';
  const baseY = flying ? 0.55 : serp ? 0.42 : 0.5 + (g.legLen ?? 0.5) * 0.08;
  const n = 14;
  const spine = [];
  const wave = serp ? r.range(0.04, 0.09) : r.range(0, 0.02);
  const len = 0.3 + g.size * 0.25;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const x = 0.5 - len / 2 + t * len;
    const y = baseY + Math.sin(t * Math.PI * (serp ? 2 : 1) + r.next() * 0.3) * wave + (g.body === 'quadruped' ? Math.sin(t * Math.PI) * 0.03 + (1 - t) ** 3 * (g.neck ?? 0) * 0.12 : 0);
    const z = 0.5 + (serp ? Math.sin(t * Math.PI * 1.5) * wave * 0.6 : 0);
    // radius profile: thick in the middle, thin tail, head bump at front
    let s = Math.sin(t * Math.PI) * (0.9 + g.bulk * 0.6) + 0.15;
    if (t > 0.85) s *= 0.6; // tail
    spine.push([x, y, z, s * 0.22]);
    mc.addBall(x, y, z, s * 0.22, 12);
  }
  // head
  const head = spine[0]; const hs = 0.22 * (0.8 + g.head * 0.7);
  mc.addBall(head[0] - 0.05, head[1] + 0.02, head[2], hs, 12);
  if (g.snout) mc.addBall(head[0] - 0.12, head[1] - 0.01, head[2], hs * 0.55, 12);
  // tail extension
  if (g.tail > 0) { const tl = spine[n - 1]; for (let i = 1; i <= 4; i++) mc.addBall(tl[0] + i * 0.035, tl[1] + Math.sin(i) * 0.02 * g.tail, tl[2], 0.12 - i * 0.02, 12); }
  // legs
  const legs = g.legs | 0;
  const legPos = [];
  for (let i = 0; i < legs; i++) {
    const pair = Math.floor(i / 2), side = i % 2 ? 1 : -1;
    const t = legs <= 2 ? 0.5 : 0.25 + (pair / Math.max(1, Math.ceil(legs / 2) - 1)) * 0.5;
    const sp = spine[Math.round(t * (n - 1))];
    const z = sp[2] + side * 0.07;
    const LL = 0.16 + (g.legLen ?? 0.5) * 0.14, steps = 5;
    for (let k = 0; k <= steps; k++) { const y = sp[1] - (k / steps) * LL; mc.addBall(sp[0] + (k > 2 ? 0.01 : 0), y, z, 0.1 - k * 0.008, 12); }
    mc.addBall(sp[0] + 0.02, sp[1] - LL - 0.02, z, 0.085, 12); // foot
    legPos.push([sp[0], sp[1] - LL, z]);
  }
  // horns / ears via small balls
  if (g.ears) for (const side of [-1, 1]) mc.addBall(head[0], head[1] + 0.07, head[2] + side * 0.06, 0.07, 12);
  // back ridge / lantern village bumps
  if (g.ridge) for (let i = 2; i < n - 2; i += 2) { const s = spine[i]; mc.addBall(s[0], s[1] + s[3] * 0.9, s[2], 0.07, 12); }

  mc.update();
  const scale = 2.2 + g.size * 2.4;
  mc.scale.setScalar(scale);
  mc.castShadow = true; mc.receiveShadow = true;
  root.add(mc);

  // world-space helper: 0..1 box coords → scene
  const W = (x, y, z) => new THREE.Vector3((x * 2 - 1) * scale, (y * 2 - 1) * scale, (z * 2 - 1) * scale);
  const accent = paint(g.accent || era.creature.accent, r, { rough: 0.7 });
  // horns / antlers: branching cones
  if (g.horns) for (const side of [-1, 1]) {
    const base = W(head[0] - 0.02, head[1] + 0.08, head[2] + side * 0.05);
    const hornMat = paint('#D9C9A8', r, { rough: 0.8 });
    const grow = (p, dir, len, rad, depth) => { const end = p.clone().addScaledVector(dir, len); const c = mesh(new THREE.CylinderGeometry(rad * 0.55, rad, len, 6), hornMat); c.position.copy(p).lerp(end, 0.5); c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()); root.add(c); if (depth >= (g.antler ? 2 : 0)) return; for (let i = 0; i < 2; i++) { const d = dir.clone().applyAxisAngle(new THREE.Vector3(1, 0, 0), r.range(-0.7, 0.7)).applyAxisAngle(new THREE.Vector3(0, 0, 1), r.range(-0.6, 0.6)); d.y = Math.abs(d.y) + 0.2; grow(end, d.normalize(), len * 0.7, rad * 0.65, depth + 1); } };
    grow(base, new THREE.Vector3(-0.3, 1, side * 0.6).normalize(), (0.5 + g.size * 0.6) * (g.antler ? 1 : 0.6), 0.07 + g.size * 0.04, 0);
  }
  // eyes
  for (const side of [-1, 1]) { const e = mesh(new THREE.SphereGeometry(0.09 * (1 + g.head * 0.5), 10, 8), paint('#1A1410', null, { rough: 0.3 }), { shadow: false }); e.position.copy(W(head[0] - 0.06, head[1] + 0.03, head[2] + side * 0.055)); root.add(e); }
  // wings: thin fan shapes
  if (g.wings) for (const side of [-1, 1]) {
    const sp = spine[Math.round(0.4 * (n - 1))];
    const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.lineTo(0.8, 0.9); shape.lineTo(2.2, 1.1); shape.lineTo(2.6, 0.2); shape.lineTo(1.6, -0.3); shape.lineTo(0, -0.2); shape.closePath();
    const wg = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false });
    wg.rotateX(-Math.PI / 2); wg.rotateY(side > 0 ? Math.PI / 2 : -Math.PI / 2); wg.rotateX(side * 0.35);
    const w = mesh(wg, accent); w.scale.setScalar(0.5 + g.size * 0.8);
    w.position.copy(W(sp[0] - 0.04, sp[1] + sp[3] * 0.5, sp[2] + side * sp[3] * 0.6));
    root.add(w);
  }
  // fins
  const flat = (pts, depth = 0.06) => { const sh = new THREE.Shape(); pts.forEach(([x, y], i) => i ? sh.lineTo(x, y) : sh.moveTo(x, y)); sh.closePath(); return new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false }); };
  if (g.fins) for (let i = 0; i < g.fins; i++) for (const side of [-1, 1]) {
    const sp = spine[Math.round((0.3 + i * 0.25) * (n - 1))] || spine[n - 1];
    const fg = flat([[0, 0], [0.6, 0.15], [1.2, 0.05], [0.9, -0.25], [0.2, -0.2]]); fg.rotateX(-Math.PI / 2); fg.rotateY(side > 0 ? Math.PI / 2 + 0.5 : -Math.PI / 2 - 0.5); fg.rotateX(side * 0.3);
    const f = mesh(fg, accent); f.scale.setScalar(0.6 + g.size * 0.7); f.position.copy(W(sp[0], sp[1] - sp[3] * 0.3, sp[2] + side * sp[3] * 0.7)); root.add(f);
  }
  if (g.body === 'whale' || g.body === 'fish') { // horizontal fluke / vertical tail fin
    const tl = spine[n - 1]; const fl = flat([[0, 0], [0.9, 0.6], [1.3, 0.45], [0.5, 0], [1.3, -0.45], [0.9, -0.6]]);
    if (g.body === 'whale') { fl.rotateX(-Math.PI / 2); }
    const f = mesh(fl, accent); f.scale.setScalar(0.7 + g.size * 0.8); f.position.copy(W(tl[0] + (g.tail > 0 ? 0.14 : 0.02), tl[1], tl[2])); root.add(f);
  }
  if (g.dorsal) { const sp = spine[Math.round(0.45 * (n - 1))]; const d = mesh(new THREE.ConeGeometry(0.3, 1.1, 4), accent); d.scale.set(1, 1, 0.2); d.position.copy(W(sp[0], sp[1] + sp[3] * 1.3, sp[2])); d.rotation.z = -0.3; root.add(d); }
  // glow (twist: lantern village on the back)
  if (g.glow) { const sp = spine[Math.round(0.5 * (n - 1))]; for (let i = -1; i <= 1; i++) { const l = mesh(new THREE.SphereGeometry(0.12, 8, 6), paint('#FFD08A', null, { emissive: '#FFB547', emissiveIntensity: 2.5 }), { shadow: false }); l.position.copy(W(sp[0] + i * 0.05, sp[1] + sp[3] * 1.2, sp[2])); root.add(l); } const pl = new THREE.PointLight(0xffb547, 5, 10, 1.8); pl.position.copy(W(sp[0], sp[1] + sp[3] * 1.5, sp[2])); root.add(pl); }
  // pattern stripes: small accent bands as rings along the spine
  if (g.pattern === 'stripes') for (let i = 2; i < n - 2; i += 2) { const sp = spine[i]; for (const side of [-1, 0, 1]) { const spot = mesh(new THREE.SphereGeometry(0.16 + g.size * 0.08, 7, 5), accent, { shadow: false }); spot.scale.set(0.5, 1, 1.2); spot.position.copy(W(sp[0], sp[1] + sp[3] * (side ? 0.55 : 1.05), sp[2] + side * sp[3] * 0.95)); root.add(spot); } }

  // ground the creature: lowest point to y=0 (flying ones hover)
  const box = new THREE.Box3().setFromObject(root);
  root.position.y = -box.min.y + (flying ? 1.2 + g.size : 0.02);
  root.userData.height = box.max.y - box.min.y;
  return root;
}
