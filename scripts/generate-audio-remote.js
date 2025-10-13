#!/usr/bin/env node
/* eslint-env node */
/* eslint-disable no-undef */
// scripts/generate-audio-remote.js
// Gera track-cues.json e MP3 contínuo diretamente a partir de arquivos em DO Spaces (prefixo audio/) e publica em continuous/
// Requisitos: ffmpeg, ffprobe, Node 18+, @aws-sdk/client-s3, @aws-sdk/lib-storage

import fs from 'fs';
import path from 'path';
import { Buffer } from 'buffer';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---- Carregar .env.scripts local, se existir ----
(function loadLocalEnv() {
  try {
    const envPath = path.join(__dirname, '../.env.scripts');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        let val = trimmed.slice(eq + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith('\'') && val.endsWith('\''))) {
          val = val.slice(1, -1);
        }
        if (!(key in process.env)) process.env[key] = val;
      }
    }
  } catch { /* noop */ }
})();

// ---------------------- Config e ENV ----------------------
const ENV = {
  SPACES_PUBLIC_BASE: process.env.SPACES_PUBLIC_BASE || 'https://radio-importante-audio.atl1.digitaloceanspaces.com',
  SPACES_BUCKET: process.env.SPACES_BUCKET || 'radio-importante-audio',
  SPACES_SOURCE_PREFIX: (process.env.SPACES_SOURCE_PREFIX || 'audio/').replace(/^\//, ''),
  SPACES_TARGET_PREFIX: (process.env.SPACES_TARGET_PREFIX || 'continuous/').replace(/^\//, ''),
  SPACES_ENDPOINT: process.env.SPACES_ENDPOINT || 'https://atl1.digitaloceanspaces.com',
  SPACES_REGION: process.env.SPACES_REGION || 'atl1',
  SPACES_KEY: process.env.SPACES_KEY || '',
  SPACES_SECRET: process.env.SPACES_SECRET || '',
  CATALOG_URL: process.env.CATALOG_URL || '',
  BACKEND_STAGING: process.env.BACKEND_STAGING || 'https://rd-importante-backend-staging-cudbw.ondigitalocean.app',
};

const OUTPUT = {
  tmpDir: path.join(__dirname, '../temp-remote'),
  srcDir: null,
  ffconcat: 'filelist-remote.ffconcat',
  mp3Name: 'radio-importante-continuous.mp3',
  cuesName: 'track-cues.json',
};
OUTPUT.srcDir = path.join(OUTPUT.tmpDir, 'src');

// ---------------------- Utils ----------------------
function log(msg) { console.log(msg); }
function warn(msg) { console.warn(msg); }
function err(msg) { console.error(msg); }
function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

function checkBin(bin, installHint) {
  try {
    execSync(`${bin} -version`, { stdio: 'pipe' });
    console.log(`✅ ${bin} encontrado`);
  } catch {
    throw new Error(`${bin} não encontrado. ${installHint || ''}`);
  }
}

async function fetchJson(url) {
  const res = await globalThis.fetch(url, { redirect: 'follow' });
  if (!res || !res.ok) throw new Error(`Falha ao buscar ${url}: ${res?.status}`);
  return res.json();
}

function probeDurationSeconds(mediaUrl) {
  const cmd = `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${mediaUrl}"`;
  const out = execSync(cmd, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 10 }).trim();
  const dur = parseFloat(out);
  if (!isFinite(dur) || dur <= 0) throw new Error(`Duração inválida`);
  return dur;
}

async function downloadS3ToFile(s3, key, outPath) {
  const dir = path.dirname(outPath);
  ensureDir(dir);
  const res = await s3.send(new GetObjectCommand({ Bucket: ENV.SPACES_BUCKET, Key: key }));
  await new Promise((resolve, reject) => {
    const ws = fs.createWriteStream(outPath);
    res.Body.on('error', reject);
    ws.on('error', reject);
    ws.on('finish', resolve);
    res.Body.pipe(ws);
  });
}

function getConcatFilePath() {
  return path.join(OUTPUT.tmpDir, OUTPUT.ffconcat);
}

function getTmpMp3Path() {
  return path.join(OUTPUT.tmpDir, OUTPUT.mp3Name);
}

function cueJson(tracks) {
  let t = 0;
  const cues = [];
  for (const tr of tracks) {
    const startTime = t;
    const endTime = t + tr.realDuration;
    cues.push({
      id: tr.id,
      title: tr.title,
      artist: tr.artist,
      startTime,
      endTime,
      duration: tr.realDuration,
      filename: tr.filename,
    });
    t = endTime;
  }
  return {
    mode: 'single',
    trackCount: cues.length,
    totalDuration: cues.at(-1)?.endTime || 0,
    generatedAt: new Date().toISOString(),
    tracks: cues,
  };
}

async function uploadJsonToSpaces(s3, key, obj) {
  const Body = Buffer.from(JSON.stringify(obj, null, 2));
  await s3.send(new PutObjectCommand({
    Bucket: ENV.SPACES_BUCKET,
    Key: key,
    Body,
    ContentType: 'application/json',
    CacheControl: 'public, max-age=60',
    ACL: 'public-read',
  }));
}

async function uploadFileToSpaces(s3, key, filePath, contentType, cacheControl) {
  const readStream = fs.createReadStream(filePath);
  const uploader = new Upload({
    client: s3,
    params: {
      Bucket: ENV.SPACES_BUCKET,
      Key: key,
      Body: readStream,
      ContentType: contentType,
      CacheControl: cacheControl,
      ACL: 'public-read',
    },
    queueSize: 4,
    partSize: 5 * 1024 * 1024,
    leavePartsOnError: false,
  });
  await uploader.done();
}

function buildS3Client() {
  const credentials = (ENV.SPACES_KEY && ENV.SPACES_SECRET) ? { accessKeyId: ENV.SPACES_KEY, secretAccessKey: ENV.SPACES_SECRET } : undefined;
  return new S3Client({
    region: ENV.SPACES_REGION,
    endpoint: ENV.SPACES_ENDPOINT,
    forcePathStyle: false,
    credentials,
  });
}

function normalizeTracks(raw) {
  if (Array.isArray(raw?.tracks)) return raw.tracks;
  if (Array.isArray(raw)) return raw;
  throw new Error('Formato de catálogo inválido: esperado { tracks: [...] } ou array.');
}

function humanizeTitle(name) {
  return name
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function listTracksFromSpaces(s3, prefix) {
  const Prefix = prefix.replace(/^\//, '');
  let ContinuationToken;
  const items = [];
  do {
    const resp = await s3.send(new ListObjectsV2Command({ Bucket: ENV.SPACES_BUCKET, Prefix, ContinuationToken }));
    (resp.Contents || []).forEach(obj => {
      const key = obj.Key;
      if (!key || !key.toLowerCase().endsWith('.mp3')) return;
      const filename = key.startsWith(Prefix) ? key.slice(Prefix.length) : key;
      if (!filename) return;
      const base = path.basename(filename, path.extname(filename));
      items.push({
        id: base,
        title: humanizeTitle(base),
        artist: 'Radio Importante',
        filename,
      });
    });
    ContinuationToken = resp.IsTruncated ? resp.NextContinuationToken : undefined;
  } while (ContinuationToken);
  return items;
}

// ---------------------- Main ----------------------
async function main() {
  log('🎵 Geração remota (Spaces) — MP3 contínuo + track-cues.json');

  // deps
  checkBin('ffmpeg', 'Instale com: brew install ffmpeg');
  checkBin('ffprobe', 'Instale com: brew install ffmpeg');

  ensureDir(OUTPUT.tmpDir);
  ensureDir(OUTPUT.srcDir);

  // catalog
  let catalog;
  const cliCatalogUrl = getArg('--catalog-url');
  const catalogUrl = cliCatalogUrl || ENV.CATALOG_URL || `${ENV.BACKEND_STAGING}/api/catalog`;
  log(`🔎 Lendo catálogo de: ${catalogUrl}`);
  let tracksRaw;
  try {
    catalog = await fetchJson(catalogUrl);
    tracksRaw = normalizeTracks(catalog);
  } catch {
    log('⚠️  Catálogo remoto indisponível; usando listagem do Spaces (audio/)');
    const s3 = buildS3Client();
    const listed = await listTracksFromSpaces(s3, ENV.SPACES_SOURCE_PREFIX);
    if (!listed.length) throw new Error('Falha no catálogo remoto e nenhum .mp3 encontrado no Spaces/audio/.');
    tracksRaw = listed;
  }

  if (!tracksRaw.length) throw new Error('Catálogo vazio');

  const s3 = buildS3Client();

  // Baixar faixas para tmp local e medir duração
  const tracks = [];
  log('⬇️  Baixando faixas do Spaces e medindo duração (ffprobe local)...');
  for (const tr of tracksRaw) {
    if (!tr?.filename) { warn(`  ⚠️  Faixa sem filename, ignorada: ${tr?.title || tr?.id}`); continue; }
    const key = `${ENV.SPACES_SOURCE_PREFIX}${tr.filename}`;
    const localPath = path.join(OUTPUT.srcDir, tr.filename);
    try {
      log(`  ↳ ${tr.filename} ...`);
      await downloadS3ToFile(s3, key, localPath);
      const dur = probeDurationSeconds(localPath);
      tracks.push({ ...tr, localPath, realDuration: dur });
      log(`    ✅ ${(dur).toFixed(1)}s`);
    } catch {
      warn('    ⚠️  erro ao baixar/probar — ignorando');
    }
  }

  if (!tracks.length) throw new Error('Nenhuma faixa válida com duração medida.');

  // cues JSON
  const cues = cueJson(tracks);
  const cuesKey = `${ENV.SPACES_TARGET_PREFIX}track-cues.json`;
  log(`📝 Publicando cues → s3://${ENV.SPACES_BUCKET}/${cuesKey}`);
  await uploadJsonToSpaces(s3, cuesKey, cues);

  // ffconcat (caminhos locais)
  const ffconcatPath = getConcatFilePath();
  const ffconcat = [
    'ffconcat version 1.0',
    ...tracks.map(t => `file '${t.localPath.replace(/'/g, "'\\''")}'`),
  ].join('\n');
  fs.writeFileSync(ffconcatPath, ffconcat);

  // gerar MP3 contínuo (local → arquivo)
  const outMp3 = getTmpMp3Path();
  log('🎧 Gerando MP3 contínuo com ffmpeg (CBR 96k, 44.1kHz, 2 canais)...');
  const ffmpegCmd = [
    'ffmpeg',
    '-hide_banner',
    '-f concat',
    '-safe 0',
    `-i "${ffconcatPath}"`,
    '-vn',
    '-c:a libmp3lame',
    '-b:a 96k',
    '-ar 44100',
    '-ac 2',
    '-y',
    `"${outMp3}"`,
  ].join(' ');
  try {
    execSync(ffmpegCmd, { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1024 * 1024 * 200 });
  } catch {
    throw new Error(`FFmpeg falhou`);
  } finally {
    // limpar lista
    try { fs.unlinkSync(ffconcatPath); } catch { /* noop */ }
  }

  // upload MP3
  const mp3Key = `${ENV.SPACES_TARGET_PREFIX}radio-importante-continuous.mp3`;
  log(`⬆️  Upload MP3 → s3://${ENV.SPACES_BUCKET}/${mp3Key}`);
  await uploadFileToSpaces(s3, mp3Key, outMp3, 'audio/mpeg', 'public, max-age=3600');

  // limpar tmp mp3 local
  try { fs.unlinkSync(outMp3); } catch { /* noop */ }

  log('\n🎉 Concluído! Artefatos:');
  log(`  • ${ENV.SPACES_PUBLIC_BASE}/${ENV.SPACES_TARGET_PREFIX}track-cues.json`);
  log(`  • ${ENV.SPACES_PUBLIC_BASE}/${ENV.SPACES_TARGET_PREFIX}radio-importante-continuous.mp3`);
}

function getArg(name) {
  const idx = process.argv.indexOf(name);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return '';
}

// run
main().catch(e => {
  err(`\n❌ Erro: ${e.message}`);
  process.exit(1);
});
