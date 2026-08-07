#!/usr/bin/env node
// cut-video — render in/out spans of a video into one trimmed, joined clip.
//
//   node cut.mjs <input> --cut 1:02-1:04.5,2:10-2:12 [--out FILE] [--pad 0.15]
//   node cut.mjs <input> --keep 0:00-1:00,2:30-3:15  [--out FILE]
//   node cut.mjs <input> --detect-silence            (proposes spans, renders nothing)
//
// Each kept span is re-encoded on its own, then the segments are joined with the
// concat demuxer. Cuts land on frame boundaries, so the segments never sum to the
// span arithmetic — the real duration is always read back with ffprobe.

import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, extname, join, resolve } from 'node:path'

const MIN_SPAN_SEC = 0.05 // shorter than about one frame — nothing useful survives
const SILENCE_DB = -30 // silencedetect noise floor
const SILENCE_MIN_SEC = 0.6 // shortest gap worth calling a pause
const CRF = 20
const PRESET = 'veryfast'
const AUDIO_BITRATE = '192k'
const AUDIO_RATE = '48000'
const AUDIO_CHANNELS = '2'

function fail(message) {
  process.stderr.write(`cut-video: ${message}\n`)
  process.exit(1)
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  if (result.error?.code === 'ENOENT') {
    fail(`${command} is not on PATH. Install it with: brew install ffmpeg`)
  }
  if (result.status !== 0) {
    fail(`${command} failed:\n${(result.stderr || '').trim()}`)
  }
  return result
}

// --- arguments ---------------------------------------------------------------

function parseArgs(argv) {
  const options = {
    input: null,
    cut: null,
    keep: null,
    output: null,
    pad: 0,
    dryRun: false,
    detectSilence: false,
    silenceDb: SILENCE_DB,
    silenceMin: SILENCE_MIN_SEC,
  }
  const takeValue = (flag, index) => {
    const value = argv[index + 1]
    if (value === undefined) fail(`${flag} needs a value`)
    return value
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    switch (arg) {
      case '--cut':
        options.cut = takeValue(arg, i++)
        break
      case '--keep':
        options.keep = takeValue(arg, i++)
        break
      case '--out':
        options.output = takeValue(arg, i++)
        break
      case '--pad':
        options.pad = Number(takeValue(arg, i++))
        break
      case '--dry-run':
        options.dryRun = true
        break
      case '--detect-silence':
        options.detectSilence = true
        break
      case '--silence-db':
        options.silenceDb = Number(takeValue(arg, i++))
        break
      case '--silence-min':
        options.silenceMin = Number(takeValue(arg, i++))
        break
      default:
        if (arg.startsWith('--')) fail(`unknown flag ${arg}`)
        if (options.input) fail('more than one input given')
        options.input = arg
    }
  }

  if (!options.input) fail('no input video given')
  if (!Number.isFinite(options.pad) || options.pad < 0) fail('--pad must be a number of seconds, 0 or more')
  if (options.cut && options.keep) fail('pass --cut or --keep, not both')
  if (!options.cut && !options.keep && !options.detectSilence) fail('pass --cut, --keep, or --detect-silence')

  options.input = resolve(options.input)
  if (!existsSync(options.input)) fail(`input not found: ${options.input}`)
  return options
}

// Accepts SS, SS.ss, MM:SS, MM:SS.ss, HH:MM:SS, HH:MM:SS.ss
function parseTime(raw) {
  const text = String(raw).trim()
  if (!/^\d+(:\d{1,2}){0,2}(\.\d+)?$/.test(text)) fail(`bad timestamp: "${raw}"`)
  return text.split(':').map(Number).reduce((total, part) => total * 60 + part, 0)
}

function parseSpans(raw) {
  return raw
    .split(',')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const parts = chunk.split('-')
      if (parts.length !== 2) fail(`bad span: "${chunk}" — expected START-END`)
      const start = parseTime(parts[0])
      const end = parseTime(parts[1])
      if (end <= start) fail(`span end must come after its start: "${chunk}"`)
      return { start, end }
    })
}

// --- span math ---------------------------------------------------------------

function mergeSpans(spans) {
  const sorted = [...spans].sort((a, b) => a.start - b.start)
  return sorted.reduce((merged, span) => {
    const last = merged[merged.length - 1]
    if (last && span.start <= last.end) {
      return [...merged.slice(0, -1), { start: last.start, end: Math.max(last.end, span.end) }]
    }
    return [...merged, span]
  }, [])
}

// Shrink each cut by `pad` on both sides, so a word or a beat of room survives it.
function padCuts(spans, pad) {
  if (pad === 0) return spans
  return spans
    .map((span) => ({ start: span.start + pad, end: span.end - pad }))
    .filter((span) => span.end - span.start > MIN_SPAN_SEC)
}

function clampSpans(spans, duration) {
  return spans
    .map((span) => ({ start: Math.max(0, span.start), end: Math.min(duration, span.end) }))
    .filter((span) => span.end - span.start > MIN_SPAN_SEC)
}

function invertSpans(cuts, duration) {
  const keep = []
  let cursor = 0
  for (const cut of cuts) {
    if (cut.start > cursor) keep.push({ start: cursor, end: cut.start })
    cursor = Math.max(cursor, cut.end)
  }
  if (cursor < duration) keep.push({ start: cursor, end: duration })
  return keep.filter((span) => span.end - span.start > MIN_SPAN_SEC)
}

// --- ffmpeg ------------------------------------------------------------------

function probe(file) {
  const raw = run('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration:stream=codec_type,avg_frame_rate',
    '-of', 'json',
    file,
  ]).stdout
  const parsed = JSON.parse(raw)
  const duration = Number(parsed.format?.duration)
  if (!Number.isFinite(duration) || duration <= 0) fail(`ffprobe read no duration from ${file}`)
  const streams = parsed.streams ?? []
  const video = streams.find((stream) => stream.codec_type === 'video')
  if (!video) fail(`${file} has no video stream`)
  const frameRate = video.avg_frame_rate && video.avg_frame_rate !== '0/0' ? video.avg_frame_rate : null
  return {
    duration,
    frameRate,
    hasAudio: streams.some((stream) => stream.codec_type === 'audio'),
  }
}

function encodeArgs(input, span, meta, dest, faststart) {
  const args = [
    '-y', '-loglevel', 'error',
    '-ss', span.start.toFixed(3),
    '-i', input,
    '-t', (span.end - span.start).toFixed(3),
  ]
  // Force CFR at the source rate. Screen recordings are often variable frame rate,
  // which the concat demuxer joins badly.
  if (meta.frameRate) args.push('-r', meta.frameRate)
  args.push('-c:v', 'libx264', '-preset', PRESET, '-crf', String(CRF), '-pix_fmt', 'yuv420p')
  if (meta.hasAudio) args.push('-c:a', 'aac', '-b:a', AUDIO_BITRATE, '-ar', AUDIO_RATE, '-ac', AUDIO_CHANNELS)
  else args.push('-an')
  if (faststart) args.push('-movflags', '+faststart')
  args.push(dest)
  return args
}

function detectSilence(input, db, minSec, duration) {
  const result = spawnSync(
    'ffmpeg',
    ['-hide_banner', '-nostats', '-i', input, '-af', `silencedetect=noise=${db}dB:d=${minSec}`, '-f', 'null', '-'],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  )
  if (result.error?.code === 'ENOENT') fail('ffmpeg is not on PATH. Install it with: brew install ffmpeg')
  if (result.status !== 0) fail(`ffmpeg failed:\n${(result.stderr || '').trim()}`)

  const spans = []
  let openStart = null
  for (const line of (result.stderr || '').split('\n')) {
    const start = line.match(/silence_start:\s*(-?[\d.]+)/)
    if (start) openStart = Math.max(0, Number(start[1]))
    const end = line.match(/silence_end:\s*([\d.]+)/)
    if (end && openStart !== null) {
      spans.push({ start: openStart, end: Number(end[1]) })
      openStart = null
    }
  }
  if (openStart !== null && duration - openStart > MIN_SPAN_SEC) {
    spans.push({ start: openStart, end: duration })
  }
  return spans
}

// --- output ------------------------------------------------------------------

const round = (seconds) => Number(seconds.toFixed(3))
const asSpanList = (spans) => spans.map((span) => ({ start: round(span.start), end: round(span.end) }))
const totalOf = (spans) => spans.reduce((sum, span) => sum + (span.end - span.start), 0)

function defaultOutput(input) {
  const extension = extname(input) || '.mp4'
  return join(resolve(input, '..'), `${basename(input, extension)}-cut${extension}`)
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  const source = probe(options.input)

  if (options.detectSilence) {
    const silences = clampSpans(
      detectSilence(options.input, options.silenceDb, options.silenceMin, source.duration),
      source.duration,
    )
    process.stdout.write(`${JSON.stringify({
      mode: 'detect-silence',
      input: options.input,
      sourceDurationSec: round(source.duration),
      thresholdDb: options.silenceDb,
      minSilenceSec: options.silenceMin,
      silenceCount: silences.length,
      silentSec: round(totalOf(silences)),
      spans: asSpanList(silences),
      cutArg: silences.map((span) => `${round(span.start)}-${round(span.end)}`).join(','),
    }, null, 2)}\n`)
    return
  }

  const keep = options.keep
    ? clampSpans(mergeSpans(parseSpans(options.keep)), source.duration)
    : invertSpans(clampSpans(padCuts(mergeSpans(parseSpans(options.cut)), options.pad), source.duration), source.duration)

  if (keep.length === 0) fail('nothing left to render — the spans remove the whole video')

  const output = resolve(options.output ?? defaultOutput(options.input))
  if (output === options.input) fail('refusing to overwrite the source video — pass a different --out')

  if (options.dryRun) {
    process.stdout.write(`${JSON.stringify({
      mode: 'dry-run',
      input: options.input,
      output,
      sourceDurationSec: round(source.duration),
      keptSpans: keep.length,
      plannedKeptSec: round(totalOf(keep)),
      plannedRemovedSec: round(source.duration - totalOf(keep)),
      spans: asSpanList(keep),
      note: 'planned figures are span arithmetic; the rendered duration is probed and will differ slightly',
    }, null, 2)}\n`)
    return
  }

  const workDir = mkdtempSync(join(tmpdir(), 'cut-video-'))
  try {
    if (keep.length === 1) {
      run('ffmpeg', encodeArgs(options.input, keep[0], source, output, true))
    } else {
      const segments = keep.map((span, index) => {
        const dest = join(workDir, `seg-${String(index).padStart(4, '0')}.mp4`)
        run('ffmpeg', encodeArgs(options.input, span, source, dest, false))
        return dest
      })
      const listPath = join(workDir, 'segments.txt')
      writeFileSync(listPath, segments.map((path) => `file '${path.replace(/'/g, "'\\''")}'\n`).join(''))
      run('ffmpeg', [
        '-y', '-loglevel', 'error',
        '-f', 'concat', '-safe', '0', '-i', listPath,
        '-c', 'copy', '-movflags', '+faststart',
        output,
      ])
    }
  } finally {
    rmSync(workDir, { recursive: true, force: true })
  }

  // Never compute this from the spans — every cut snapped to a frame boundary.
  const rendered = probe(output)
  process.stdout.write(`${JSON.stringify({
    mode: 'render',
    input: options.input,
    output,
    sourceDurationSec: round(source.duration),
    outputDurationSec: round(rendered.duration),
    removedSec: round(source.duration - rendered.duration),
    keptSpans: keep.length,
    spans: asSpanList(keep),
  }, null, 2)}\n`)
}

main()
