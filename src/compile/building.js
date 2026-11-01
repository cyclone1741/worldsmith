import * as THREE from 'three';
import { rng } from '../rng.js';
import { paint, roughen, mesh, expand, centroid, prism } from './common.js';
import { compileCreature } from './creature.js';

// ---------- footprints: never a plain box unless the genome insists ----------
function footprint(g, r) {
  const s = 1.2 + g.size * 2.6;           // half-size in world units
  const asp = r.range(1.0, 1.7);
  const w = s, d = s / asp;
  switch (g.footprint) {
    case 'circle': { const n = 14 + r.int(0, 6), p = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; p.push([Math.cos(a) * w, Math.sin(a) * w]); } return p; }
    case 'polygon': { const n = r.pick([5, 6, 8]), p = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + Math.PI / n; p.push([Math.cos(a) * w, Math.sin(a) * w]); } return p; }
    case 'L': { const k = r.range(0.4, 0.6); return [[-w, -d], [w, -d], [w, d * (1 - 2 * k)], [w * (1 - 2 * k), d * (1 - 2 * k)], [w * (1 - 2 * k), d], [-w, d]]; }
    case 'T': { const k = r.range(0.3, 0.45); return [[-w, -d], [w, -d], [w, -d + d * 2 * k], [w * k, -d + d * 2 * k], [w * k, d], [-w * k, d], [-w * k, -d + d * 2 * k], [-w, -d + d * 2 * k]]; }
    case 'cross': { const k = r.range(0.3, 0.45); return [[-w * k, -d], [w * k, -d], [w * k, -d * k], [w, -d * k], [w, d * k], [w * k, d * k], [w * k, d], [-w * k, d], [-w * k, d * k], [-w, d * k], [-w, -d * k], [-w * k, -d * k]]; }
    default: { // rect, but with a bay or chamfer so it is never a pure box
      const base = [[-w, -d], [w, -d], [w, d], [-w, d]];
      if (r.chance(0.5)) { const c = Math.min(w, d) * r.range(0.15, 0.3); return [[-w + c, -d], [w - c, -d], [w, -d + c], [w, d - c], [w - c, d], [-w + c, d], [-w, d - c], [-w, -d + c]]; }
      const bx = r.range(-w * 0.4, w * 0.4), bw = w * r.range(0.25, 0.45), bd = d * r.range(0.2, 0.4);
      return [[-w, -d], [w, -d], [w, d], [bx + bw, d], [bx + bw, d + bd], [bx - bw, d + bd], [bx - bw, d], [-w, d]];
    }
  }
}

// ---------- roofs ----------
function roofHip(poly, h, mat, r, ridge) {
  const [cx, cz] = centroid(poly);
  const pos = [];
  let apexA = [cx, h, cz], apexB = apexA;
  if (ridge) { // ridge along the longer axis
    let minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9; for (const [x, z] of poly) { minx = Math.min(minx, x); maxx = Math.max(maxx, x); minz = Math.min(minz, z); maxz = Math.max(maxz, z); }
    const L = maxx - minx, W = maxz - minz;
    if (L > W * 1.25) { const o = (L - W) / 2 * 0.8; apexA = [cx - o, h, cz]; apexB = [cx + o, h, cz]; }
    else if (W > L * 1.25) { const o = (W - L) / 2 * 0.8; apexA = [cx, h, cz - o]; apexB = [cx, h, cz + o]; }
  }
  const near = (p) => Math.hypot(p[0] - apexA[0], p[1] - apexA[2]) <= Math.hypot(p[0] - apexB[0], p[1] - apexB[2]) ? apexA : apexB;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const pa = near(a), pb = near(b);
    if (pa === pb) pos.push(a[0], 0, a[1], b[0], 0, b[1], pa[0], pa[1], pa[2]);
    else pos.push(a[0], 0, a[1], b[0], 0, b[1], pb[0], pb[1], pb[2], a[0], 0, a[1], pb[0], pb[1], pb[2], pa[0], pa[1], pa[2]);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  return mesh(roughen(g, 0.02, r), mat);
}

function roofFor(g, era, poly, y, r, mats) {
  const group = new THREE.Group();
  const eave = era.eave + g.ornament * 0.1;
  const outer = expand(poly, eave + 0.1);
  const [cx, cz] = centroid(poly);
  let rx = 0; for (const [x, z] of poly) rx = Math.max(rx, Math.hypot(x - cx, z - cz));
  const pitch = 0.35 + g.ornament * 0.25;
  switch (g.roof) {
    case 'flat': {
      const slab = mesh(roughen(prism(outer, 0.18), 0.015, r), mats.roof); slab.position.y = y; group.add(slab);
      const par = mesh(prism(expand(poly, 0.06), 0.35), mats.wall); par.position.y = y; group.add(par); // parapet
      if (g.features.garden) for (let i = 0; i < 5; i++) { const b = mesh(new THREE.IcosahedronGeometry(r.range(0.25, 0.5), 0), paint(r.pick(era.tree.leaf), r)); b.position.set(cx + r.range(-rx, rx) * 0.5, y + 0.45, cz + r.range(-rx, rx) * 0.5); group.add(b); }
      break;
    }
    case 'dome': {
      const drum = mesh(new THREE.CylinderGeometry(rx * 0.95, rx, 0.4, 24), mats.wall); drum.position.set(cx, y + 0.2, cz); group.add(drum);
      const dome = mesh(roughen(new THREE.SphereGeometry(rx * 0.95, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), 0.01, r), mats.roof); dome.position.set(cx, y + 0.4, cz); group.add(dome);
      const fin = mesh(new THREE.ConeGeometry(0.12, 0.6, 8), mats.trim); fin.position.set(cx, y + 0.4 + rx * 0.95 + 0.25, cz); group.add(fin);
      break;
    }
    case 'cone': {
      const c = mesh(roughen(new THREE.ConeGeometry(rx + eave, rx * (1.1 + pitch), 12), 0.02, r), mats.roof); c.position.set(cx, y + rx * (1.1 + pitch) / 2, cz); group.add(c);
      break;
    }
    case 'tiered': {
      const tiers = 1 + era.tiers + (g.ornament > 0.5 ? 1 : 0);
      let py = y, pp = outer;
      for (let i = 0; i < tiers; i++) {
        const h = rx * pitch * 0.6;
        { const rh = roofHip(expand(pp, 0.15), h, mats.roof, r, true); rh.position.y = py; group.add(rh); }
        // upturned eave band
        const band = mesh(prism(expand(pp, 0.22), 0.08), mats.trim); band.position.y = py - 0.04; group.add(band);
        py += h + 0.45; pp = expand(pp, -rx * 0.28);
        if (i < tiers - 1) { const wall = mesh(prism(pp, 0.45), mats.wall); wall.position.y = py - 0.45; group.add(wall); }
      }
      break;
    }
    case 'stepped': {
      let pp = outer, py = y; for (let i = 0; i < 3; i++) { const s = mesh(roughen(prism(pp, 0.3), 0.015, r), i % 2 ? mats.roof : mats.wall); s.position.y = py; group.add(s); py += 0.3; pp = expand(pp, -rx * 0.22); }
      break;
    }
    case 'gable': {
      const h = rx * (0.7 + pitch);
      { const rh = roofHip(outer, h, mats.roof, r, true); rh.position.y = y; group.add(rh); }
      if (g.features.banners) { const pole = mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 6), mats.trim); pole.position.set(cx, y + h + 0.5, cz); group.add(pole); const flag = mesh(new THREE.BoxGeometry(0.6, 0.35, 0.02), paint(r.pick(era.palette.accent), r)); flag.position.set(cx + 0.3, y + h + 0.95, cz); group.add(flag); }
      break;
    }
    default: { // hip
      const h = rx * pitch * 0.9;
      { const rh = roofHip(outer, h, mats.roof, r, true); rh.position.y = y; group.add(rh); }
    }
  }
  return group;
}

// ---------- features ----------
function windows(poly, y, fh, mats, r, density) {
  const grp = new THREE.Group();
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]); if (len < 0.9) continue;
    const n = Math.max(1, Math.floor(len / (1.1 - density * 0.4)));
    const nx = -(b[1] - a[1]) / len, nz = (b[0] - a[0]) / len; // outward normal (poly is CCW in x,-z space → flipped)
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n; const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
      const w = mesh(new THREE.BoxGeometry(0.28, 0.42, 0.08), mats.dark, { shadow: false });
      w.position.set(x - nx * 0.03, y + fh * 0.55, z - nz * 0.03); w.rotation.y = Math.atan2(nx, nz); grp.add(w);
      if (r.chance(0.5)) { const sill = mesh(new THREE.BoxGeometry(0.36, 0.05, 0.12), mats.trim); sill.position.set(x - nx * 0.06, y + fh * 0.33, z - nz * 0.06); sill.rotation.y = Math.atan2(nx, nz); grp.add(sill); }
    }
  }
  return grp;
}

function colonnade(poly, y, fh, mats, r, era, all = false) {
  const grp = new THREE.Group();
  let best = 0, bl = 0; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l > bl) { bl = l; best = i; } }
  const off = 0.9, edges = all ? poly.map((_, i) => i) : [best];
  const outer = expand(poly, off);
  for (const i of edges) {
    const a = outer[i], b = outer[(i + 1) % outer.length]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1.2) continue;
    const n = Math.max(2, Math.round(L / 0.95));
    for (let k = 0; k < n; k++) { const t = k / (n - 1); const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
      const col = mesh(new THREE.CylinderGeometry(0.11, 0.13, fh, 10), mats.wall); col.position.set(x, y + fh / 2, z); grp.add(col);
      const cap = mesh(new THREE.BoxGeometry(0.3, 0.1, 0.3), mats.trim); cap.position.set(x, y + fh - 0.05, z); grp.add(cap); }
  }
  // entablature ring (all) or beam (front)
  if (all) { const ent = mesh(prism(expand(outer, 0.2), 0.24), mats.trim); ent.position.y = y + fh; grp.add(ent); }
  else { const a = outer[best], b = outer[(best + 1) % outer.length]; const nx = -(b[1] - a[1]) / bl, nz = (b[0] - a[0]) / bl; const ex = (a[0] + b[0]) / 2, ez = (a[1] + b[1]) / 2;
    const ent = mesh(new THREE.BoxGeometry(bl + 0.4, 0.22, 0.5), mats.trim); ent.position.set(ex, y + fh + 0.1, ez); ent.rotation.y = Math.atan2(nx, nz); grp.add(ent);
    if (era.arches > 0.3) { const ped = mesh(roughen(new THREE.ConeGeometry(bl * 0.55, 0.6, 3), 0.01, r), mats.roof); ped.scale.z = 0.5; ped.position.set(ex, y + fh + 0.5, ez); ped.rotation.y = Math.atan2(nx, nz) + Math.PI / 2; grp.add(ped); } }
  return grp;
}

function crenels(poly, y, mats) {
  const grp = new THREE.Group();
  for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); const n = Math.floor(L / 0.6);
    for (let k = 0; k < n; k += 2) { const t = (k + 0.5) / n; const m = mesh(new THREE.BoxGeometry(0.28, 0.3, 0.28), mats.wall); m.position.set(a[0] + (b[0] - a[0]) * t, y + 0.5, a[1] + (b[1] - a[1]) * t); m.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]); grp.add(m); } }
  return grp;
}

function towers(poly, h, mats, r, era, g) {
  const grp = new THREE.Group();
  const [cx, cz] = centroid(poly);
  const corners = poly.filter((p, i) => { const a = poly[(i + poly.length - 1) % poly.length], b = poly[(i + 1) % poly.length]; const v1 = [p[0] - a[0], p[1] - a[1]], v2 = [b[0] - p[0], b[1] - p[1]]; return Math.abs(v1[0] * v2[1] - v1[1] * v2[0]) > 0.3; });
  const pick = corners.filter(() => r.chance(0.6)).slice(0, 4);
  for (const [x, z] of pick) {
    const rad = 0.45 + g.size * 0.3, th = h * r.range(1.15, 1.5);
    const t = mesh(roughen(new THREE.CylinderGeometry(rad * 0.92, rad, th, 12), 0.015, r), mats.wall); t.position.set(x, th / 2, z); grp.add(t);
    const cap = mesh(new THREE.ConeGeometry(rad + 0.15, rad * 1.6, 12), mats.roof); cap.position.set(x, th + rad * 0.8, z); grp.add(cap);
    if (g.features.lantern) { const l = mesh(new THREE.SphereGeometry(0.16, 8, 6), paint('#FFD08A', null, { emissive: '#FFB547', emissiveIntensity: 2 }), { shadow: false }); l.position.set(x, th + rad * 1.7, z); grp.add(l); }
  }
  return grp;
}

export function compileBuilding(g, era, seed) {
  const r = rng(seed);
  const root = new THREE.Group();
  const mats = {
    wall: paint(g.wallColor || r.pick(era.palette.wall), r),
    roof: paint(g.roofColor || r.pick(era.palette.roof), r),
    trim: paint(era.palette.trim, r),
    dark: paint('#2A2420', null),
  };
  if (g.age > 0.4) { mats.wall = paint(new THREE.Color(mats.wall.color).lerp(new THREE.Color('#6B7A5A'), g.age * 0.35).getStyle(), null, { rough: 1 }); }

  const A = g.archetype || 'house';
  const slender = A === 'tower' || A === 'lighthouse';
  let poly = footprint(g, r);
  const basePoly = poly;
  if (slender) poly = poly.map(([x, z]) => [x * 0.42, z * 0.42]);
  if (A === 'temple' || A === 'palace') poly = poly.map(([x, z]) => [x * 1.25, z * 1.25]);
  const fh = (1.0 + g.size * 0.6) * (A === 'temple' ? 1.8 : slender ? 1.15 : 1);
  const floors = Math.max(1, Math.round(g.floors));
  let y = 0;
  // plinth (temples get a stepped podium)
  const steps = A === 'temple' ? 3 : 1;
  for (let s = 0; s < steps; s++) { const plinth = mesh(roughen(prism(expand(poly, 0.18 + (steps - 1 - s) * 0.35), 0.22), 0.012, r), mats.trim); plinth.position.y = y; root.add(plinth); y += 0.22; }
  for (let f = 0; f < floors; f++) {
    const taper = slender ? 0.93 : 1;
    const wall = mesh(roughen(prism(poly, fh, taper), 0.012, r), mats.wall); wall.position.y = y; root.add(wall);
    if (A !== 'temple') root.add(windows(poly, y, fh, mats, r, g.ornament));
    if (f === 0 && (A === 'temple' || r.chance(era.columns * (0.5 + g.ornament) * (slender ? 0 : 1)))) root.add(colonnade(poly, y, fh, mats, r, era, A === 'temple'));
    if (slender) poly = poly.map(([x, z]) => [x * taper, z * taper]);
    y += fh;
    // cornice between floors; next floor slightly larger (diorama flare)
    const band = mesh(prism(expand(poly, 0.1), 0.12), mats.trim); band.position.y = y - 0.06; root.add(band);
    poly = expand(poly, (era.flare + (g.flare || 0) - 1) * 1.2);
  }
  if (r.chance(era.towers + (g.features.towers ? 0.9 : 0)) && !slender) root.add(towers(poly, y, mats, r, era, g));
  const [cx, cz] = centroid(poly); let rx = 0; for (const [x, z] of poly) rx = Math.max(rx, Math.hypot(x - cx, z - cz));
  if (A === 'lighthouse') { // lantern room + gallery
    const gal = mesh(new THREE.CylinderGeometry(rx + 0.35, rx + 0.35, 0.14, 16), mats.trim); gal.position.set(cx, y + 0.07, cz); root.add(gal);
    const room = mesh(new THREE.CylinderGeometry(rx * 0.75, rx * 0.75, 0.9, 12), paint('#FFE9B0', null, { emissive: '#FFB547', emissiveIntensity: 1.4, rough: 0.4 }), { shadow: false }); room.position.set(cx, y + 0.6, cz); root.add(room);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const bar = mesh(new THREE.BoxGeometry(0.06, 0.9, 0.06), mats.dark); bar.position.set(cx + Math.cos(a) * rx * 0.75, y + 0.6, cz + Math.sin(a) * rx * 0.75); root.add(bar); }
    const pl = new THREE.PointLight(0xffc98a, 10, 14, 1.6); pl.position.set(cx, y + 0.7, cz); root.add(pl);
    y += 1.05; g = { ...g, roof: 'cone' };
  }
  if (A === 'castle' && g.roof === 'flat') root.add(crenels(expand(poly, 0.06), y + 0.2, mats));
  if (A === 'market') for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1.5 || !r.chance(0.7)) continue; const nx = -(b[1] - a[1]) / L, nz = (b[0] - a[0]) / L; const aw = mesh(new THREE.BoxGeometry(L * 0.8, 0.05, 0.9), paint(r.pick(era.palette.accent), r)); aw.position.set((a[0] + b[0]) / 2 - nx * 0.5, y - fh * 0.35, (a[1] + b[1]) / 2 - nz * 0.5); aw.rotation.y = Math.atan2(nx, nz); aw.rotation.x = -0.35; root.add(aw); }
  root.add(roofFor(g, era, poly, y, r, mats));

  // twists / extras
  if (g.features.chimney) { const c = mesh(new THREE.BoxGeometry(0.3, 0.9, 0.3), mats.trim); c.position.set(cx + rx * 0.4, y + 0.6, cz - rx * 0.2); root.add(c); }
  if (g.features.nest) { const n = mesh(new THREE.TorusGeometry(0.22, 0.09, 6, 10), paint('#8A6B3E', r)); n.rotation.x = Math.PI / 2; n.position.set(cx, y + rx * 0.6 + 0.3, cz); root.add(n); const egg = mesh(new THREE.SphereGeometry(0.1, 8, 6), paint('#EDEAE2', null)); egg.position.set(cx, y + rx * 0.6 + 0.36, cz); root.add(egg); }
  if (g.features.vines) for (let i = 0; i < 8 + g.age * 10; i++) { const b = mesh(new THREE.IcosahedronGeometry(r.range(0.12, 0.3), 0), paint(r.pick(era.tree.leaf), r), { shadow: false }); const a = (slender ? poly : basePoly)[r.int(0, poly.length - 1)]; b.position.set(a[0] * 0.98, r.range(0.3, y * 0.8), a[1] * 0.98); root.add(b); }
  if (g.features.lantern && !g.features.towers) { const l = mesh(new THREE.SphereGeometry(0.2, 8, 6), paint('#FFD08A', null, { emissive: '#FFB547', emissiveIntensity: 2.2 }), { shadow: false }); l.position.set(cx, y + rx * 0.5 + 0.9, cz); root.add(l); const pl = new THREE.PointLight(0xffb547, 6, 8, 1.8); pl.position.copy(l.position); root.add(pl); }
  if (g.features.banners && g.roof !== 'gable') for (let i = 0; i < 2; i++) { const p = poly[r.int(0, poly.length - 1)]; const pole = mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 6), mats.trim); pole.position.set(p[0], y + 0.6, p[1]); root.add(pole); const fl = mesh(new THREE.BoxGeometry(0.02, 0.5, 0.7), paint(r.pick(era.palette.accent), r)); fl.position.set(p[0], y + 1.1, p[1] + 0.35); root.add(fl); }
  if (g.features.statue) { const s = mesh(new THREE.ConeGeometry(0.18, 0.9, 6), mats.trim); s.position.set(cx, y + rx * 0.5 + 0.45, cz); root.add(s); }

  // free-form ornaments from the genome (LLM may name any motif)
  for (const [oi, o] of (g.ornaments || []).slice(0, 4).entries()) root.add(ornament(o, { poly, basePoly: slender ? poly : basePoly, y, fh, cx, cz, rx }, mats, era, r, seed + oi * 977));

  root.userData.height = y + rx;
  return root;
}

// Where an ornament sits, as world positions with a facing angle.
function spots(where, ctx, count, r) {
  const { poly, basePoly, y, fh, cx, cz, rx } = ctx; const out = [];
  const edgePts = (P, k, yy, inset = 0) => { for (let i = 0; i < P.length && out.length < k; i++) { const a = P[i], b = P[(i + 1) % P.length]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1) continue; const nx = -(b[1] - a[1]) / L, nz = (b[0] - a[0]) / L; const t = 0.5; out.push({ x: a[0] + (b[0] - a[0]) * t - nx * inset, y: yy, z: a[1] + (b[1] - a[1]) * t - nz * inset, rot: Math.atan2(-nx, -nz) }); } };
  switch (where) {
    case 'roof': { out.push({ x: cx, y: y + rx * 0.35, z: cz, rot: 0 }); for (let i = 1; i < count; i++) { const a = i / count * Math.PI * 2; out.push({ x: cx + Math.cos(a) * rx * 0.5, y: y + rx * 0.2, z: cz + Math.sin(a) * rx * 0.5, rot: -a }); } break; }
    case 'walls': edgePts(poly, count, y - fh * 0.5, 0.25); break;
    case 'entrance': { const P = expand(basePoly, 1.3); let best = 0, bl = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L > bl) { bl = L; best = i; } } const a = P[best], b = P[(best + 1) % P.length]; const nx = -(b[1] - a[1]) / bl, nz = (b[0] - a[0]) / bl; for (const t of [0.3, 0.7]) out.push({ x: a[0] + (b[0] - a[0]) * t, y: 0.22, z: a[1] + (b[1] - a[1]) * t, rot: Math.atan2(-nx, -nz) }); break; }
    case 'columns': { const P = expand(basePoly, 0.9); for (let i = 0; i < P.length && out.length < count; i++) out.push({ x: P[i][0], y: fh + 0.4, z: P[i][1], rot: Math.atan2(P[i][0] - cx, P[i][1] - cz) }); break; }
    default: { const P = expand(basePoly, 0.9); const corners = P.filter((p, i) => { const a = P[(i + P.length - 1) % P.length], b = P[(i + 1) % P.length]; return Math.abs((p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0])) > 0.3; }); for (const p of corners.slice(0, count)) out.push({ x: p[0], y: 0.22, z: p[1], rot: Math.atan2(p[0] - cx, p[1] - cz) }); }
  }
  return out.slice(0, count);
}

function ornament(o, ctx, mats, era, r, seed) {
  const grp = new THREE.Group();
  const count = Math.max(1, Math.min(8, o.count | 0 || 2));
  const stone = paint(era.palette.trim, r, { rough: 0.95 });
  const pts = spots(o.where || 'corners', ctx, count, r);
  pts.forEach((p, i) => {
    let m;
    if (o.kind === 'statue' && o.creature) {
      const cg = { size: 0.2, legs: 4, tail: 1, ears: true, snout: true, head: 0.6, bulk: 0.5, legLen: 0.5, neck: 0, ...o.creature, wings: o.creature.wings ? 1 : 0 };
      m = compileCreature(cg, era, seed + i * 31, { material: stone, res: 28 });
      const sc = 0.55 / Math.max(0.6, m.userData.height || 1); m.scale.setScalar(sc);
      const ped = mesh(new THREE.BoxGeometry(0.5, 0.3, 0.5), mats.trim); ped.position.set(p.x, p.y + 0.15, p.z); grp.add(ped);
      m.position.set(p.x, p.y + 0.3 - (m.userData.minY || 0) * sc, p.z); m.rotation.y = p.rot;
    } else if (o.kind === 'lantern') {
      m = mesh(new THREE.SphereGeometry(0.16, 8, 6), paint('#FFD08A', null, { emissive: '#FFB547', emissiveIntensity: 2 }), { shadow: false }); m.position.set(p.x, p.y + 0.5, p.z);
      const pl = new THREE.PointLight(0xffb547, 3, 6, 1.8); pl.position.copy(m.position); grp.add(pl);
    } else if (o.kind === 'banner') {
      const pole = mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 6), mats.trim); pole.position.set(p.x, p.y + 0.8, p.z); grp.add(pole);
      m = mesh(new THREE.BoxGeometry(0.02, 0.5, 0.7), paint(o.color || r.pick(era.palette.accent), r)); m.position.set(p.x, p.y + 1.3, p.z + 0.35);
    } else if (o.kind === 'plant') {
      m = mesh(new THREE.IcosahedronGeometry(0.3, 0), paint(r.pick(era.tree.leaf), r)); m.position.set(p.x, p.y + 0.3, p.z);
    } else if (o.kind === 'bell') {
      m = mesh(new THREE.ConeGeometry(0.22, 0.4, 10), paint('#B08D57', r, { rough: 0.5 })); m.position.set(p.x, p.y + 0.5, p.z);
    } else { // carving: a relief medallion in the accent color
      m = mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.06, 12), paint(o.color || r.pick(era.palette.accent), r)); m.rotation.x = Math.PI / 2; m.position.set(p.x, p.y + 0.3 - (m.userData.minY || 0) * sc, p.z); m.rotation.y = p.rot;
    }
    grp.add(m);
  });
  return grp;
}
