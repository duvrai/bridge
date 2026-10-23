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

  const duration = moving ? formatDuration(info.duration) : undefined
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
