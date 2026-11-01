const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = '/home/claude/worldsmith';
const srv = http.createServer((req, res) => {
  if (req.url === '/' ) { let h = fs.readFileSync(path.join(root,'index.html'),'utf8'); h = h.replace('https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js','/node_modules/three/build/three.module.js').replace('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/','/node_modules/three/examples/jsm/').replace(/<link rel="stylesheet"[^>]*>/,''); res.writeHead(200,{"content-type":"text/html; charset=utf-8"}); res.end(h); return; } const p = path.join(root, decodeURIComponent(req.url.split('?')[0]) === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': p.endsWith('.js') ? 'text/javascript' : 'text/html' }); res.end(d); }); }).listen(8765);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await b.newPage({ viewport: { width: 1400, height: 860 } });
  const errs = []; pg.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); }); pg.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  await pg.goto('http://localhost:8765/', { waitUntil: 'networkidle', timeout: 60000 });
  await pg.waitForTimeout(2500);
  const out = process.argv[2] || '/tmp/claude-0/-home-claude/db18295d-9b4f-5dd4-8e4d-1f4639f672e3/scratchpad/shot1.png';
  await pg.screenshot({ path: out });
  for (const [i, q] of (process.argv.slice(3)).entries()) { await pg.fill('#q', q); await pg.press('#q', 'Enter'); await pg.waitForTimeout(1500); await pg.screenshot({ path: out.replace('.png', `_${i + 2}.png`) }); }
  console.log(errs.slice(0, 15).join('\n') || 'no errors'); console.log(await pg.textContent('#stat'));
  await b.close(); srv.close();
})();
