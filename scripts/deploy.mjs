import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env.local');

function loadEnv() {
  if (!existsSync(envPath)) throw new Error('.env.local not found');
  const out = {};
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const i = line.indexOf('=');
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    const value = line.slice(i + 1).trim();
    if (key) out[key] = value;
  }
  return out;
}

function redact(text) {
  return text.replace(/[A-Za-z0-9_-]{20,}/g, '***');
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: options.stdio ?? 'pipe',
    shell: options.shell ?? false,
    maxBuffer: 20 * 1024 * 1024,
    env: { ...process.env, ...(options.env ?? {}) },
  });
  if (result.status !== 0 && !options.allowFail) {
    const err = redact(`${result.stdout ?? ''}\n${result.stderr ?? ''}`).trim();
    throw new Error(err || `${command} failed with status ${result.status}`);
  }
  return result;
}

async function gh(pathname, options = {}) {
  const res = await fetch(`https://api.github.com${pathname}`, {
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers ?? {}),
    },
    body: options.body,
  });
  return res;
}

const env = loadEnv();
process.env.GITHUB_TOKEN = env.GITHUB_TOKEN;
process.env.VERCEL_TOKEN = env.VERCEL_TOKEN;
if (!process.env.GITHUB_TOKEN || !process.env.VERCEL_TOKEN || process.env.GITHUB_TOKEN.includes('your_') || process.env.VERCEL_TOKEN.includes('your_')) {
  throw new Error('GITHUB_TOKEN or VERCEL_TOKEN is missing in .env.local');
}

console.log('Checking GitHub token...');
const userRes = await gh('/user');
if (!userRes.ok) throw new Error(`GitHub auth failed: ${userRes.status}`);
const user = await userRes.json();
const username = user.login;
console.log(`GitHub account: ${username}`);

if (!existsSync(path.join(root, '.git'))) run('git', ['init']);
run('git', ['config', 'user.name', username]);
run('git', ['config', 'user.email', `${username}@users.noreply.github.com`]);
run('git', ['branch', '-M', 'main']);
run('git', ['add', '-A']);
try {
  run('git', ['commit', '-m', 'feat: highway heroes cartoon motorcycle racer']);
} catch (e) {
  if (!String(e).includes('nothing to commit')) throw e;
}

console.log('Creating GitHub repository...');
const repoPath = `/repos/${username}/highway-heroes`;
const existsRes = await gh(repoPath);
if (existsRes.status === 404) {
  const createRes = await gh('/user/repos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'highway-heroes',
      description: 'Cartoon rendered open highway motorcycle racing game built with Three.js, Vite and TypeScript.',
      private: false,
      has_issues: true,
    }),
  });
  if (!createRes.ok) throw new Error(`GitHub repo creation failed: ${createRes.status}`);
} else if (!existsRes.ok) {
  throw new Error(`GitHub repo check failed: ${existsRes.status}`);
}

const cleanRemote = `https://github.com/${username}/highway-heroes.git`;
const pushRemote = `https://${username}:${encodeURIComponent(process.env.GITHUB_TOKEN)}@github.com/${username}/highway-heroes.git`;
run('git', ['remote', 'remove', 'origin'], { stdio: 'ignore', allowFail: true });
run('git', ['remote', 'add', 'origin', cleanRemote]);
console.log('Pushing to GitHub...');
try {
  run('git', ['push', '-u', pushRemote, 'HEAD:main']);
} finally {
  run('git', ['remote', 'set-url', 'origin', cleanRemote]);
}
console.log(`GitHub: ${cleanRemote}`);

if (!process.env.DEPLOY_GITHUB_ONLY) {
  console.log('Deploying to Vercel...');
  const vercel = run('npx', [
    'vercel',
    '--prod',
    '--yes',
    '--name',
    'highway-heroes',
    '--token',
    process.env.VERCEL_TOKEN,
  ], { env: { ...process.env, VERCEL_TOKEN: process.env.VERCEL_TOKEN }, shell: process.platform === 'win32' });
  const vercelOutput = redact(`${vercel.stdout}\n${vercel.stderr}`);
  const urlMatch = vercelOutput.match(/https:\/\/[a-z0-9-]+\.vercel\.app/);
  console.log(vercelOutput.trim());
  if (urlMatch) console.log(`Vercel production URL: ${urlMatch[0]}`);
} else {
  console.log('Skipping Vercel deployment (DEPLOY_GITHUB_ONLY set).');
}
