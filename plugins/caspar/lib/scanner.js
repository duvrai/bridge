// SPDX-FileCopyrightText: 2026 Thomas Dufaux
//
// SPDX-License-Identifier: MIT

const http = require('node:http')

const SCANNER_PORT = 8000
const REQUEST_TIMEOUT_MS = 8000
const THUMBNAIL_CONCURRENCY = 4

/**
 * CasparCG media-scanner listens on the same host as the
 * server, on port 8000. The browser talks to Bridge, so
 * Bridge fetches the scanner itself.
 * @param { string } host
 * @returns { string }
 */
function scannerBaseUrl (host) {
  const name = !host || host === 'localhost' ? '127.0.0.1' : host
  const authority = name.includes(':') && !name.startsWith('[') ? `[${name}]` : name
  return `http://${authority}:${SCANNER_PORT}`
}

/**
 * @param { string } url
 * @returns { Promise.<Buffer> }
 */
function getBuffer (url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, res => {
      if (res.statusCode !== 200) {
        res.resume()
        reject(new Error(`Scanner responded ${res.statusCode} for ${url}`))
        return
      }
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => resolve(Buffer.concat(chunks)))
    })
    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error('Scanner request timed out'))
    })
    req.on('error', reject)
  })
}

/**
 * @param { any[] } items
 * @param { number } limit
 * @param { (item: any, index: number) => Promise.<any> } fn
 */
async function mapPool (items, limit, fn) {
  const out = new Array(items.length)
  let next = 0
  async function worker () {
    while (next < items.length) {
      const index = next
      next += 1
      out[index] = await fn(items[index], index)
    }
  }
  const workers = Math.min(limit, items.length)
  await Promise.all(Array.from({ length: workers }, () => worker()))
  return out
}

/**
 * Pick the stream that carries picture size.
 * @param { any } entry
 */
function pictureStream (entry) {
  const streams = entry?.streams || []
  return streams.find(stream => stream?.width && stream?.height)
}

/**
 * @param { any } entry A row from GET /media
 * @param { string | undefined } thumbnail data URL
 */
function describeEntry (entry, thumbnail) {
  const stream = pictureStream(entry)
  const duration = Number(entry?.format?.duration)
  const frames = Number(stream?.nb_frames)
  const size = Number(entry?.size)
  const time = Number(entry?.time)
  return {
    /*
    This scanner exposes the Caspar id as `name` (the :id used by
    /media/info and /thumbnail). A future build may send `id` as well.
    */
    casparId: entry?.id || entry?.name,
    name: entry?.name,
    path: entry?.path,
    width: stream?.width,
    height: stream?.height,
    frameRate: stream?.frame_rate,
    fieldOrder: entry?.field_order,
    duration: Number.isFinite(duration) ? duration : undefined,
    frames: Number.isFinite(frames) ? frames : undefined,
    size: Number.isFinite(size) ? size : undefined,
    time: Number.isFinite(time) ? time : undefined,
    thumbnail
  }
}

/**
 * List scanner media for one Caspar host, including thumbnails.
 * Names match AMCP CLS (upper case, slash-separated).
 * @param { string } host
 * @returns { Promise.<object[]> }
 */
async function listMedia (host) {
  const base = scannerBaseUrl(host)
  const body = await getBuffer(`${base}/media`)
  const entries = JSON.parse(body.toString('utf8'))
  if (!Array.isArray(entries)) {
    return []
  }

  return mapPool(entries, THUMBNAIL_CONCURRENCY, async entry => {
    let thumbnail
    const casparId = entry?.id || entry?.name
    if (casparId) {
      try {
        const png = await getBuffer(`${base}/media/thumbnail/${encodeURIComponent(casparId)}`)
        thumbnail = `data:image/png;base64,${png.toString('base64')}`
      } catch {
        thumbnail = undefined
      }
    }
    return describeEntry(entry, thumbnail)
  })
}

exports.scannerBaseUrl = scannerBaseUrl
exports.listMedia = listMedia
exports.describeEntry = describeEntry
