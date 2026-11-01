import * as THREE from 'three';
import { rng } from '../rng.js';
import { paint, mesh, roughen } from './common.js';

// Recursive branching (an L-system unrolled). Era decides leaf shape and height.
export function compileTree(g, era, seed) {
  const r = rng(seed);
  const root = new THREE.Group();
  const trunk = paint(era.tree.trunk, r, { rough: 1 });
  const leafMats = era.tree.leaf.map(c => paint(g.color || c, r));
  const shape = g.shape || era.tree.shape;
  const H = (2.2 + g.size * 3.2) * era.tree.tall;
  const tips = [];

  function branch(p, dir, len, rad, depth) {
    const end = p.clone().addScaledVector(dir, len);
    const geo = new THREE.CylinderGeometry(rad * 0.7, rad, len, 7);
    const m = mesh(roughen(geo, 0.01, r), trunk);
    m.position.copy(p).lerp(end, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    root.add(m);
    if (depth >= g.depth) { tips.push(end); return; }
    const kids = depth === 0 ? r.int(2, 3) : r.int(1, 3);
    for (let i = 0; i < kids; i++) {
      const d = dir.clone();
      const spread = (shape === 'pine' ? 0.9 : 0.55) + g.spread * 0.4;
      d.applyAxisAngle(new THREE.Vector3(1, 0, 0), r.range(-spread, spread));
      d.applyAxisAngle(new THREE.Vector3(0, 0, 1), r.range(-spread, spread));
      d.applyAxisAngle(new THREE.Vector3(0, 1, 0), r.range(0, Math.PI * 2));
      if (shape === 'pine') d.y = Math.abs(d.y) * 0.4 + 0.1; else d.y = Math.abs(d.y) + 0.3; // keep growing upward
      d.normalize();
      branch(end, d, len * r.range(0.6, 0.78) * (shape === 'pine' ? 0.45 : 1), rad * 0.62, depth + 1);
    }
  }
  const lean = new THREE.Vector3(r.range(-0.08, 0.08), 1, r.range(-0.08, 0.08)).normalize();
  branch(new THREE.Vector3(0, 0, 0), lean, H * 0.42, 0.14 + g.size * 0.14, 0);

  // foliage
  if (shape === 'pine') {
    const layers = 3 + Math.round(g.size * 3);
    for (let i = 0; i < layers; i++) { const t = i / layers; const c = mesh(roughen(new THREE.ConeGeometry((1.4 - t * 1.0) * (0.9 + g.size * 0.7), 1.3, 9), 0.03, r), leafMats[i % leafMats.length]); c.position.set(0, H * 0.3 + t * H * 0.66, 0); c.rotation.y = r.next() * 3; root.add(c); }
  } else {
    const count = shape === 'sparse' ? 0.6 : 1;
    for (const t of tips) { if (!r.chance(count)) continue; const k = r.int(1, 3); for (let i = 0; i < k; i++) { const s = r.range(0.35, 0.7) * (0.8 + g.size * 0.6); const b = mesh(roughen(new THREE.IcosahedronGeometry(s, 1), 0.04, r), r.pick(leafMats)); b.position.copy(t).add(new THREE.Vector3(r.range(-0.3, 0.3), r.range(-0.1, 0.3), r.range(-0.3, 0.3))); root.add(b); } }
  }
  if (g.blossom) for (const t of tips.slice(0, 20)) { const f = mesh(new THREE.SphereGeometry(0.08, 6, 5), paint(g.blossom, null), { shadow: false }); f.position.copy(t).add(new THREE.Vector3(r.range(-0.5, 0.5), r.range(0, 0.5), r.range(-0.5, 0.5))); root.add(f); }
  if (g.lantern) for (const t of tips.slice(0, 6)) { const l = mesh(new THREE.SphereGeometry(0.12, 8, 6), paint('#FFD08A', null, { emissive: '#FFB547', emissiveIntensity: 2 }), { shadow: false }); l.position.copy(t).add(new THREE.Vector3(0, -0.3, 0)); root.add(l); }
  root.userData.height = H;
  return root;
}
