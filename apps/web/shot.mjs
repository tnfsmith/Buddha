// Chụp màn hình và đo âm thanh bằng Chrome không giao diện (giao thức DevTools qua WebSocket có sẵn của Node 22).
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const file = 'file://' + resolve('dist/van-dao.html');
const port = 9333;
const chrome = spawn('google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
  '--autoplay-policy=no-user-gesture-required', `--remote-debugging-port=${port}`, '--window-size=1440,900', '--hide-scrollbars', '--user-data-dir=/tmp/vd-chrome', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const pending = new Map(); const logs = [];
async function connect() {
  for (let i = 0; i < 40; i++) {
    try { const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); const pg = list.find((x) => x.type === 'page'); if (pg) { ws = new WebSocket(pg.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; }); break; } } catch (e) { /* chờ */ }
    await sleep(250);
  }
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
    if (d.method === 'Runtime.consoleAPICalled') logs.push(d.params.type + ': ' + d.params.args.map((a) => a.value ?? a.description).join(' '));
    if (d.method === 'Runtime.exceptionThrown') logs.push('EXC: ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text)); };
}
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evalJS = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) return { error: r.result.exceptionDetails.exception?.description }; return r.result.result.value; };

await connect();
await send('Runtime.enable'); await send('Page.enable');
const { writeFileSync } = await import('node:fs');
const jobs = process.argv.slice(2);
for (const job of jobs) {
  const [name, hash, wait] = job.split('|');
  if (name === 'probe') {
    await send('Page.navigate', { url: file }); await sleep(1500);
    const res = await evalJS(`(async()=>{const o=[];for(const [a,b] of ${hash}){o.push(await window.__app.offlineProbe(a,b));}return JSON.stringify(o)})()`);
    console.log('PROBE', res);
    continue;
  }
  if (name === 'eval' || name === 'm_eval') {   // m_eval: cùng phép đo nhưng giả lập điện thoại dọc 390×800, DPR 2
    await send('Emulation.setDeviceMetricsOverride', name === 'm_eval' ? { width: 390, height: 800, deviceScaleFactor: 2, mobile: true } : { width: 1440, height: 757, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: 'about:blank' }); await sleep(100);
    await send('Page.navigate', { url: file + '#' + hash }); await sleep(9000);
    console.log('EVAL', JSON.stringify(await evalJS(wait)));
    continue;
  }
  if (name === 'dbg') {
    await send('Page.navigate', { url: file }); await sleep(2500);
    const res = await evalJS(`(async()=>{const P=window.__app.player,o=[];const w=(ms)=>new Promise(r=>setTimeout(r,ms));
      P.seek(890); await P.play(); await w(1500); o.push(['a',P.time,P.playing,P.ctx.state,P.ctx.currentTime,P.C0,P.T0]);
      P.seek(898.5); for(let i=0;i<8;i++){ await w(500); o.push([i,+P.time.toFixed(2),P.playing,P.ctx.state,+P.ctx.currentTime.toFixed(2),+P.C0.toFixed(2),P.T0,P.scheduled]); }
      o.push(window.__app.state().sessions);
      return JSON.stringify(o)})()`);
    console.log('DBG', res);
    continue;
  }
  if (name === 'live') {
    await send('Page.navigate', { url: file }); await sleep(2500);
    const res = await evalJS(`(async()=>{const P=window.__app.player,o={};const w=(ms)=>new Promise(r=>setTimeout(r,ms));
      const lvl=()=>{const a=new Float32Array(1024);P.scope(a);let m=0;for(const v of a)m=Math.max(m,Math.abs(v));return +m.toFixed(3)};
      await P.play(); await w(4500); o.t1=+P.time.toFixed(2); o.state=P.ctx.state; o.sr=P.ctx.sampleRate; o.lvl1=lvl();
      P.seek(662); await w(3500); o.t2=+P.time.toFixed(2); o.lvl2=lvl();
      P.setBio('uddhacca'); await w(7000); o.lvlBio=lvl(); P.setBio('thina'); await w(1500); o.lvlThina=lvl(); P.setBio('samadhi');
      P.pause(); await w(600); o.paused=P.ctx.state; const tp=P.time; await w(700); o.frozen=(P.time===tp);
      P.seek(880); await P.play(); await w(3000); o.t3=+P.time.toFixed(2); o.lvl3=lvl();
      P.seek(898.5); await w(3200); o.ended=!P.playing; o.sessions=window.__app.state().sessions; o.err=document.querySelector('#err').textContent;
      return JSON.stringify(o)})()`);
    console.log('LIVE', res);
    continue;
  }
  await send('Emulation.setDeviceMetricsOverride', name.startsWith('m_') ? { width: 390, height: 800, deviceScaleFactor: 2, mobile: true } : { width: 1440, height: 757, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'about:blank' }); await sleep(100);
  await send('Page.navigate', { url: file + '#' + hash }); await sleep(+(wait || 3500));
  const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 80 });
  writeFileSync(`dist/${name}.jpg`, Buffer.from(shot.result.data, 'base64'));
  console.log('shot', name);
}
console.log(logs.slice(0, 30).join('\n'));
ws.close(); chrome.kill();
