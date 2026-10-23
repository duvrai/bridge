import { formatExactSeconds, formatRaster, formatRasterTooltip, formatTimecode } from './mediaInfo.js'

/**
 * What a rundown row shows for a Caspar media item.
 * The playable id stays on caspar.target and is not part of this label.
 * @param { any } item
 */
export function rundownMediaLabel (item) {
  const storedPath = item?.data?.caspar?.path || ''
  const fallback = item?.data?.name || item?.data?.caspar?.target || ''
  const source = storedPath || fallback
  const parts = String(source).split('/').filter(part => part.length > 0)
  const fileName = parts[parts.length - 1] || fallback
  const folder = parts.length > 1 ? parts.slice(0, -1).join('/') : ''
  const tooltip = folder ? `${folder}\n${fileName}` : fileName

  const seconds = Number.isFinite(item?.data?.durationSeconds)
    ? item.data.durationSeconds
    : (Number(item?.data?.duration) > 0 ? Number(item.data.duration) / 1000 : undefined)
  const timecode = formatTimecode(seconds, item?.data?.frameRate)
  const picture = formatRaster(item?.data?.width, item?.data?.height, item?.data?.frameRate, item?.data?.fieldOrder)
  const pictureTitle = formatRasterTooltip(item?.data?.width, item?.data?.height, item?.data?.frameRate)

  return {
    fileName,
    tooltip,
    timecode,
    picture,
    pictureTitle,
    secondsTitle: formatExactSeconds(seconds)
  }
}
