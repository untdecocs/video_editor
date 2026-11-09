import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadReadiness } from './readiness-config.mjs';
import { assertReleaseAllowed } from './readiness.mjs';

const root = resolve(import.meta.dirname, '..');
const args = new Set(process.argv.slice(2));
const modeIndex = process.argv.indexOf('--mode');
const requestedMode = process.argv.find((arg) => arg.startsWith('--mode='))?.slice('--mode='.length)
  ?? (modeIndex >= 0 ? process.argv[modeIndex + 1] : null);

let state;
try {
  state = loadReadiness(root);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
  process.exit();
}

console.log(`Production readiness · application ${state.appVersion}`);
console.log(`Configured release mode: ${state.evaluation.mode}`);
for (const [key, result] of Object.entries(state.evaluation.checks)) {
  console.log(`[${result.status.toUpperCase()}] ${key}: ${result.detail}`);
}
console.log(`Overall public-launch readiness: ${state.evaluation.publicReady ? 'READY' : 'BLOCKED'}`);

if (args.has('--dashboard')) {
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
  const entries = Object.entries(state.evaluation.checks).map(([key, result]) => `
    <li class="${escapeHtml(result.status)}">
      <strong>${escapeHtml(key)} · ${escapeHtml(result.status.toUpperCase())}</strong>
      <p>${escapeHtml(result.detail)}</p>
    </li>`).join('');
  const destination = resolve(root, '.production-readiness/dashboard.html');
  mkdirSync(resolve(root, '.production-readiness'), { recursive: true });
  writeFileSync(destination, `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Internal production readiness</title>
<style>
body{font:16px/1.5 system-ui,sans-serif;max-width:900px;margin:3rem auto;padding:0 1rem;color:#17221e}
h1{font-size:1.6rem}.state{padding:.75rem 1rem;background:#fff0d6;border-radius:.5rem;font-weight:700}
ul{list-style:none;padding:0}li{border:1px solid #ddd;border-left:5px solid #bd8c32;border-radius:.4rem;padding:.7rem 1rem;margin:.75rem 0}
li.ready{border-left-color:#28664d}li.failed{border-left-color:#b42318}p{margin:.25rem 0}
</style>
<h1>Internal production readiness</h1>
<p>Application ${escapeHtml(state.appVersion)} · configured mode ${escapeHtml(state.evaluation.mode)}</p>
<p class="state">Public release: ${state.evaluation.publicReady ? 'READY' : 'BLOCKED'}</p>
<ul>${entries}</ul>
<p>This report is generated locally and has no approval controls. Configuration changes require authorized human review.</p>
</html>`, 'utf8');
  console.log(`Read-only dashboard written to ${destination}`);
}

if (requestedMode) {
  try {
    assertReleaseAllowed(state.evaluation, requestedMode);
    console.log(`Release gate passed for ${requestedMode}.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (args.has('--check') && !state.evaluation.eligible) process.exitCode = 1;
