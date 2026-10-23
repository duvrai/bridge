/**
 * Label for one scanner row shown in the library.
 * Frame rate and duration are omitted when the file is a still
 * (no real frame count and no positive duration).
 * @param {{
 *  width: number | undefined,
 *  height: number | undefined,
 *  frameRate: string | undefined,
 *  duration: number | undefined,
 *  frames: number | undefined
 * }} info
 * @returns { string }
 */
export function formatScannerDetails (info) {
  if (!info) {
    return ''
  }

  const parts = []
  if (info.width && info.height) {
    parts.push(`${info.width}×${info.height}`)
  }

  const moving = (info.frames || 0) > 1 || (info.duration || 0) > 0
  const fps = moving ? formatFrameRate(info.frameRate) : undefined
  if (fps) {
    parts.push(`${fps} fps`)
  }

  const duration = moving ? formatTimecode(info.duration, info.frameRate) : undefined
  if (duration) {
    parts.push(duration)
  }

  return parts.join(' · ')
}

/**
 * Scanner frame_rate is a fraction of frames per second, such as 50/1.
 * @param { string | undefined } fraction
 * @returns { string | undefined }
 */
export function formatFrameRate (fraction) {
  const [numText, denText] = String(fraction || '').split('/')
  const numerator = Number(numText)
  const denominator = Number(denText)
  if (!numerator || !denominator) {
    return
  }
  const fps = numerator / denominator
  if (!Number.isFinite(fps) || fps <= 0) {
    return
  }
  if (Number.isInteger(fps)) {
    return String(fps)
  }
  return fps.toFixed(2)
}

/**
 * @param { number | undefined } seconds
 * @returns { string | undefined }
 */
export function formatDuration (seconds) {
  if (!seconds || seconds <= 0) {
    return
  }
  const total = Math.round(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const remain = total % 60
  const pad = value => String(value).padStart(2, '0')
  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(remain)}`
  }
  return `${minutes}:${pad(remain)}`
}

/**
 * Exact seconds for a tooltip. Not rounded to a frame.
 * @param { number | undefined } seconds
 * @returns { string }
 */
export function formatExactSeconds (seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return ''
  }
  const text = seconds.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
  return `${text} s`
}

/**
 * Describe a frame rate for timecode.
 * 29.97 and 59.94 are drop-frame. Other rates count ff from 0 to fps-1.
 * @param { string | undefined } fraction Scanner frame_rate, such as 50/1 or 30000/1001
 */
export function frameRateSpec (fraction) {
  const [numText, denText] = String(fraction || '').split('/')
  const numerator = Number(numText)
  const denominator = Number(denText)
  if (!numerator || !denominator) {
    return
  }
  const fps = numerator / denominator
  if (!Number.isFinite(fps) || fps <= 0) {
    return
  }
  if ((numerator === 30000 && denominator === 1001) || Math.abs(fps - 29.97) < 0.01) {
    return { fps, nominal: 30, drop: true }
  }
  if ((numerator === 60000 && denominator === 1001) || Math.abs(fps - 59.94) < 0.01) {
    return { fps, nominal: 60, drop: true }
  }
  const nominal = Math.round(fps)
  if (nominal <= 0) {
    return
  }
  return { fps, nominal, drop: false }
}

function pad2 (value) {
  return String(value).padStart(2, '0')
}

function formatNonDrop (frameCount, fps) {
  const ff = frameCount % fps
  let rest = Math.floor(frameCount / fps)
  const ss = rest % 60
  rest = Math.floor(rest / 60)
  const mm = rest % 60
  const hh = Math.floor(rest / 60)
  return `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}:${pad2(ff)}`
}

/**
 * SMPTE drop-frame. nominal is 30 or 60.
 * @param { number } frameCount
 * @param { number } nominal
 */
function formatDropFrame (frameCount, nominal) {
  const dropFrames = nominal === 60 ? 4 : 2
  const framesPerMinute = nominal * 60 - dropFrames
  const framesPer10Minutes = nominal * 60 * 10 - dropFrames * 9
  let frames = frameCount
  const tens = Math.floor(frames / framesPer10Minutes)
  const within = frames % framesPer10Minutes
  if (within > dropFrames) {
    frames += dropFrames * 9 * tens + dropFrames * Math.floor((within - dropFrames) / framesPerMinute)
  } else {
    frames += dropFrames * 9 * tens
  }
  const ff = frames % nominal
  let rest = Math.floor(frames / nominal)
  const ss = rest % 60
  rest = Math.floor(rest / 60)
  const mm = rest % 60
  const hh = Math.floor(rest / 60)
  return `${pad2(hh)}:${pad2(mm)}:${pad2(ss)};${pad2(ff)}`
}

/**
 * SMPTE hh:mm:ss:ff, or hh:mm:ss;ff for 29.97 and 59.94.
 * @param { number | undefined } seconds
 * @param { string | undefined } fraction
 * @returns { string }
 */
export function formatTimecode (seconds, fraction) {
  if (!seconds || seconds <= 0) {
    return ''
  }
  const spec = frameRateSpec(fraction)
  if (!spec) {
    return ''
  }
  const frameCount = Math.max(0, Math.round(seconds * spec.fps))
  if (spec.drop) {
    return formatDropFrame(frameCount, spec.nominal)
  }
  return formatNonDrop(frameCount, spec.nominal)
}
