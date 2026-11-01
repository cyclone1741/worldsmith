import * as THREE from 'three';

const matCache = new Map();

// Hand-painted look: flat shading, slight per-mesh hue jitter, no gloss except where asked.
export function paint(hex, r, opts = {}) {
  const c = new THREE.Color(hex);
  if (r) {
    const hsl = {}; c.getHSL(hsl);
    c.setHSL(hsl.h + (r.next() - 0.5) * 0.02, THREE.MathUtils.clamp(hsl.s + (r.next() - 0.5) * 0.08, 0, 1), THREE.MathUtils.clamp(hsl.l + (r.next() - 0.5) * 0.07, 0, 1));
  }
  const key = c.getHexString() + '|' + (opts.rough ?? 0.92) + '|' + (opts.emissive ?? '');
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial({ color: c, roughness: opts.rough ?? 0.92, metalness: 0, flatShading: true, side: THREE.DoubleSide, emissive: opts.emissive ? new THREE.Color(opts.emissive) : 0x000000, emissiveIntensity: opts.emissiveIntensity ?? 1 });
  matCache.set(key, m);
  return m;
}

// Soften geometry edges with tiny vertex noise so nothing reads as a perfect box.
export function roughen(geo, amt = 0.012, r) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    p.setXYZ(i, p.getX(i) + (r.next() - 0.5) * amt, p.getY(i) + (r.next() - 0.5) * amt, p.getZ(i) + (r.next() - 0.5) * amt);
  }
  p.needsUpdate = true; geo.computeVertexNormals();
  return geo;
}

export function mesh(geo, mat, opts = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = opts.shadow ?? true; m.receiveShadow = true;
  if (opts.pos) m.position.set(...opts.pos);
  if (opts.rot) m.rotation.set(...opts.rot);
  return m;
}

// Expand a polygon outward about its centroid (cheap eave/overhang).
export function expand(poly, amt) {
  let cx = 0, cz = 0; for (const [x, z] of poly) { cx += x; cz += z; } cx /= poly.length; cz /= poly.length;
  return poly.map(([x, z]) => { const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz) || 1; return [x + dx / d * amt, z + dz / d * amt]; });
}

export function centroid(poly) {
  let cx = 0, cz = 0; for (const [x, z] of poly) { cx += x; cz += z; } return [cx / poly.length, cz / poly.length];
}

export function shapeFrom(poly) {
  const s = new THREE.Shape();
  poly.forEach(([x, z], i) => i ? s.lineTo(x, -z) : s.moveTo(x, -z));
  s.closePath();
  return s;
}

// Extrude a footprint upward by h, with optional taper (scale at top).
export function prism(poly, h, taper = 1) {
  if (Math.abs(taper - 1) < 1e-3) {
    const g = new THREE.ExtrudeGeometry(shapeFrom(poly), { depth: h, bevelEnabled: false });
    g.rotateX(-Math.PI / 2); return g;
  }
  // lofted sides + caps
  const [cx, cz] = centroid(poly);
  const top = poly.map(([x, z]) => [cx + (x - cx) * taper, cz + (z - cz) * taper]);
  const pos = [], idx = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) { pos.push(poly[i][0], 0, poly[i][1]); pos.push(top[i][0], h, top[i][1]); }
  for (let i = 0; i < n; i++) { const a = i * 2, b = ((i + 1) % n) * 2; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  // caps via fan (works for convex-ish footprints; L shapes are fine visually since caps are hidden by floors/roof)
  const base = pos.length / 3; pos.push(cx, 0, cz); for (let i = 0; i < n; i++) idx.push(base, ((i + 1) % n) * 2, i * 2);
  const topc = pos.length / 3; pos.push(cx, h, cz); for (let i = 0; i < n; i++) idx.push(topc, i * 2 + 1, ((i + 1) % n) * 2 + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  g.computeVertexNormals(); return g.toNonIndexed();
}
