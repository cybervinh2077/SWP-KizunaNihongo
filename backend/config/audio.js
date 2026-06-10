'use strict';

const { spawn }  = require('child_process');
const fs         = require('fs');
const path       = require('path');
const os         = require('os');

// ── Optional dependencies ─────────────────────────────────────────────────────
let NodeVAD = null;
try { NodeVAD = require('node-vad'); } catch {}

// ── ffmpeg availability (cached) ──────────────────────────────────────────────
let _ffmpegOk = null;
function ffmpegAvailable() {
  if (_ffmpegOk !== null) return _ffmpegOk;
  try { require('child_process').execSync('ffmpeg -version', { stdio: 'ignore' }); _ffmpegOk = true; }
  catch { _ffmpegOk = false; }
  return _ffmpegOk;
}

// ── ffmpeg helper — collects both stdout (binary) and stderr (text) ───────────
function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const stdoutChunks = [];
    let stderr = '';
    proc.stdout.on('data', d => stdoutChunks.push(d));
    proc.stderr.on('data', d => { stderr += d; });
    proc.on('close', code => resolve({ code, stdout: Buffer.concat(stdoutChunks), stderr }));
    proc.on('error', err => reject(new Error('ffmpeg unavailable: ' + err.message)));
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// Strategy 1: WebRTC VAD (node-vad)
// Classifies each 30ms audio frame as VOICE / SILENCE / NOISE.
// Works correctly with background music because it detects human voice patterns,
// not just amplitude.
// ══════════════════════════════════════════════════════════════════════════════
async function detectViaVAD(audioBuffer, ext) {
  if (!NodeVAD) throw new Error('node-vad not available');
  if (!ffmpegAvailable()) throw new Error('ffmpeg not available');

  const SAMPLE_RATE  = 16000;
  const FRAME_MS     = 30;
  const FRAME_SAMPLES = (SAMPLE_RATE * FRAME_MS) / 1000; // 480 samples
  const FRAME_BYTES   = FRAME_SAMPLES * 2;               // 16-bit → 2 bytes/sample

  // Convert audio to 16 kHz mono 16-bit PCM via ffmpeg pipe
  const tmpIn = tmpPath(`vad.${ext}`);
  fs.writeFileSync(tmpIn, audioBuffer);
  let pcmBuffer;
  try {
    const { stdout } = await runFfmpeg([
      '-i', tmpIn,
      '-ar', String(SAMPLE_RATE),
      '-ac', '1',
      '-f', 's16le',
      'pipe:1',
    ]);
    pcmBuffer = stdout;
  } finally {
    tryUnlink(tmpIn);
  }

  const totalDuration = pcmBuffer.length / 2 / SAMPLE_RATE;

  // VERY_AGGRESSIVE = mode 3: fewest false positives (music rarely triggers VOICE)
  const vad = new NodeVAD(NodeVAD.Mode.VERY_AGGRESSIVE);

  const frames = [];
  for (let offset = 0; offset + FRAME_BYTES <= pcmBuffer.length; offset += FRAME_BYTES) {
    const frame  = pcmBuffer.slice(offset, offset + FRAME_BYTES);
    const timeS  = offset / 2 / SAMPLE_RATE;
    const event  = await vad.processAudio(frame, SAMPLE_RATE);
    frames.push({ timeS, isVoice: event === NodeVAD.Event.VOICE });
  }

  const speechSegments = mergeVoiceFrames(frames, FRAME_MS / 1000, totalDuration);
  console.log('[Audio/VAD] duration:', r2(totalDuration), 'segments:', speechSegments.length);
  return { speechSegments, totalDuration: r2(totalDuration) };
}

// Merge adjacent VOICE frames into speech segments, with padding and gap thresholds
function mergeVoiceFrames(frames, frameDurS, totalDuration) {
  const SILENCE_GAP_S  = 0.4;   // consecutive silence longer than this → new segment
  const MIN_SPEECH_S   = 0.2;   // discard very short spurious detections
  const PAD_S          = 0.12;  // pad each segment slightly to avoid clipping at edges

  const gapFrames = Math.ceil(SILENCE_GAP_S / frameDurS);
  const segments  = [];
  let speechStart   = null;
  let silenceCount  = 0;

  for (const { timeS, isVoice } of frames) {
    if (isVoice) {
      if (speechStart === null) speechStart = Math.max(0, timeS - PAD_S);
      silenceCount = 0;
    } else if (speechStart !== null) {
      silenceCount++;
      if (silenceCount >= gapFrames) {
        const end = Math.min(totalDuration, timeS + PAD_S);
        if (end - speechStart >= MIN_SPEECH_S) {
          segments.push({ start: r2(speechStart), end: r2(end) });
        }
        speechStart  = null;
        silenceCount = 0;
      }
    }
  }

  if (speechStart !== null) {
    const last = frames[frames.length - 1].timeS;
    segments.push({ start: r2(speechStart), end: r2(Math.min(totalDuration, last + PAD_S)) });
  }

  return segments;
}

// ══════════════════════════════════════════════════════════════════════════════
// Strategy 2: Bandpass-filtered silencedetect (fallback when node-vad unavailable)
// Filters to human speech frequencies (200–3500 Hz) before amplitude detection,
// which attenuates most background music compared to pure wideband detection.
// ══════════════════════════════════════════════════════════════════════════════
async function detectViaSilence(audioBuffer, ext) {
  if (!ffmpegAvailable()) throw new Error('ffmpeg not available');

  const tmpFile = tmpPath(`sd.${ext}`);
  fs.writeFileSync(tmpFile, audioBuffer);
  try {
    const { stderr } = await runFfmpeg([
      '-i', tmpFile,
      '-af', 'highpass=f=200,lowpass=f=3500,silencedetect=noise=-25dB:duration=0.4',
      '-f', 'null', '-',
    ]);
    const result = parseSilenceOutput(stderr);
    console.log('[Audio/Silence] duration:', result.totalDuration, 'segments:', result.speechSegments.length);
    return result;
  } finally {
    tryUnlink(tmpFile);
  }
}

function parseSilenceOutput(stderr) {
  const durMatch = stderr.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2})[.,](\d+)/);
  let totalDuration = 0;
  if (durMatch) {
    const ms = durMatch[4].length === 2 ? 100 : 1000;
    totalDuration = Number(durMatch[1]) * 3600 + Number(durMatch[2]) * 60
                  + Number(durMatch[3]) + Number(durMatch[4]) / ms;
  }

  const starts = [...stderr.matchAll(/silence_start:\s*([\d.]+)/g)].map(m => Number(m[1]));
  const ends   = [...stderr.matchAll(/silence_end:\s*([\d.]+)/g)].map(m => Number(m[1]));

  const speech = [];
  let cursor = 0;
  for (let i = 0; i < starts.length; i++) {
    if (starts[i] > cursor + 0.05) speech.push({ start: r2(cursor), end: r2(starts[i]) });
    cursor = ends[i] ?? totalDuration;
  }
  if (totalDuration > 0 && cursor < totalDuration - 0.1) {
    speech.push({ start: r2(cursor), end: r2(totalDuration) });
  }

  return { speechSegments: speech, totalDuration: r2(totalDuration) };
}

// ── Main entry: VAD → silencedetect → error ───────────────────────────────────
async function analyzeSilence(audioBuffer, ext) {
  try {
    return await detectViaVAD(audioBuffer, ext);
  } catch (vadErr) {
    console.log('[Audio] VAD unavailable (' + vadErr.message + '), using bandpass silencedetect');
    return await detectViaSilence(audioBuffer, ext);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Text → timed segments (1:1 with detected speech bursts)
// ══════════════════════════════════════════════════════════════════════════════
function mapTextToSegments(transcript, speechSegments, totalDuration) {
  const intervals = speechSegments.length > 0
    ? speechSegments
    : (totalDuration > 0 ? [{ start: 0, end: r2(totalDuration) }] : null);

  if (!intervals || !transcript) return [];

  const chunks = splitIntoNChunks(transcript.trim(), intervals.length);

  return chunks
    .map((text, i) => ({
      start: intervals[i]?.start ?? intervals[intervals.length - 1].start,
      end:   intervals[i]?.end   ?? intervals[intervals.length - 1].end,
      text,
    }))
    .filter(s => s.text.trim());
}

// Split text into exactly N chunks, preferring natural boundaries
const SPLIT_CHARS = new Set(['。', '！', '？', '、', ' ', '\n', ')', '）', '」', '』', '…']);

function splitIntoNChunks(text, n) {
  if (!text) return [];
  if (n <= 1) return [text];

  const len = text.length;
  if (n >= len) return [...text].filter(c => c.trim());

  const idealSize = len / n;
  const chunks    = [];
  let pos = 0;

  for (let i = 1; i < n; i++) {
    const target = Math.round(i * idealSize);
    if (target >= len) break;
    const window = Math.min(8, Math.max(1, Math.round(idealSize * 0.35)));
    let bestPos  = target;
    for (let d = 0; d <= window; d++) {
      if (target + d < len && SPLIT_CHARS.has(text[target + d])) { bestPos = target + d + 1; break; }
      if (d > 0 && target - d > pos && SPLIT_CHARS.has(text[target - d])) { bestPos = target - d + 1; break; }
    }
    const chunk = text.slice(pos, bestPos).trim();
    if (chunk) chunks.push(chunk);
    pos = bestPos;
  }

  const last = text.slice(pos).trim();
  if (last) chunks.push(last);
  return chunks;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function r2(n) { return Math.round(n * 100) / 100; }
function tmpPath(name) { return path.join(os.tmpdir(), `kn_${Date.now()}_${Math.random().toString(36).slice(2)}_${name}`); }
function tryUnlink(f) { try { fs.unlinkSync(f); } catch {} }

module.exports = { analyzeSilence, mapTextToSegments };
