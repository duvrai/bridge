import { formatFrameRate, formatTimecode } from './mediaInfo.js'

export const LIBRARY_COLUMNS = [
  { id: 'thumbnail', label: 'Thumbnail', defaultWidth: 76, sortable: false },
  { id: 'name', label: 'Name', defaultWidth: 280, sortable: true },
  { id: 'path', label: 'Path', defaultWidth: 240, sortable: true },
  { id: 'type', label: 'Type', defaultWidth: 96, sortable: true },
  { id: 'resolution', label: 'Resolution', defaultWidth: 120, sortable: true },
  { id: 'framerate', label: 'Frame rate', defaultWidth: 110, sortable: true },
  { id: 'duration', label: 'Duration', defaultWidth: 96, sortable: true },
  { id: 'size', label: 'Size', defaultWidth: 96, sortable: true },
  { id: 'date', label: 'Date', defaultWidth: 150, sortable: true }
]

const COLUMN_IDS = LIBRARY_COLUMNS.map(column => column.id)
const MIN_WIDTH = 48
const MAX_WIDTH = 800
const STORAGE_KEY = 'bridge-plugin-caspar.libraryColumns'
export const LIBRARY_COLUMNS_STATE_PATH = 'plugins.bridge-plugin-caspar.settings.libraryColumns'

/**
 * @returns {{ order: string[], hidden: Record<string, boolean>, widths: Record<string, number>, sort: { id: string, direction: 'asc' | 'desc' } }}
 */
export function defaultLayout () {
  return {
    order: [...COLUMN_IDS],
    hidden: { path: true, thumbnail: true },
    widths: Object.fromEntries(LIBRARY_COLUMNS.map(column => [column.id, column.defaultWidth])),
    sort: { id: 'name', direction: 'asc' },
    expanded: {}
  }
}

/**
 * File name without the Caspar folder prefix.
 * @param { string } path
 * @returns { string }
 */
export function baseName (path) {
  const parts = String(path || '').split('/').filter(part => part.length > 0)
  return parts[parts.length - 1] || ''
}

/**
 * Filesystem path from the scanner, without the leading media folder.
 * Keeps the original case, spaces, accents and extension.
 * @param { string | undefined } filePath
 * @returns { string }
 */
export function scannerDisplayPath (filePath) {
  const text = String(filePath || '').replace(/\\/g, '/')
  if (text.startsWith('media/')) {
    return text.slice('media/'.length)
  }
  return text
}

/**
 * Caspar id for a scanner row. The installed scanner puts that id in `name`.
 * @param { { id?: string, name?: string } | undefined } entry
 * @returns { string }
 */
export function scannerCasparId (entry) {
  return entry?.id || entry?.name || ''
}

/**
 * Path used for the tree and the visible file name.
 * Falls back to the CLS name when the scanner has no row.
 * @param { any } item
 * @returns { string }
 */
export function libraryPath (item) {
  return item?.displayPath || item?.name || ''
}

/**
 * Drop unknown ids and fill anything a newer build added.
 * The name column stays visible.
 * @param { any } raw
 */
export function normalizeLayout (raw) {
  const base = defaultLayout()
  const order = []
  for (const id of raw?.order || []) {
    if (COLUMN_IDS.includes(id) && !order.includes(id)) {
      order.push(id)
    }
  }
  for (const id of COLUMN_IDS) {
    if (!order.includes(id)) {
      order.push(id)
    }
  }

  const hidden = {}
  for (const id of COLUMN_IDS) {
    if (id === 'name') {
      hidden[id] = false
      continue
    }
    if (raw?.hidden?.[id] === undefined) {
      hidden[id] = Boolean(base.hidden[id])
      continue
    }
    hidden[id] = Boolean(raw.hidden[id])
  }

  const expanded = {}
  if (raw?.expanded && typeof raw.expanded === 'object') {
    for (const [path, open] of Object.entries(raw.expanded)) {
      if (path) {
        expanded[path] = Boolean(open)
      }
    }
  }

  const widths = { ...base.widths }
  for (const id of COLUMN_IDS) {
    const width = Number(raw?.widths?.[id])
    if (Number.isFinite(width)) {
      widths[id] = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(width)))
    }
  }

  const sortId = COLUMN_IDS.includes(raw?.sort?.id) ? raw.sort.id : 'name'
  const direction = raw?.sort?.direction === 'desc' ? 'desc' : 'asc'

  return { order, hidden, widths, sort: { id: sortId, direction }, expanded }
}

/**
 * @param { ReturnType<typeof defaultLayout> } layout
 */
export function visibleColumns (layout) {
  const byId = Object.fromEntries(LIBRARY_COLUMNS.map(column => [column.id, column]))
  const rest = layout.order.filter(id => id !== 'name' && !layout.hidden[id])
  return [byId.name, ...rest.map(id => byId[id])]
}

/**
 * Summary shown on a folder row. Other columns stay empty.
 * @param { string } columnId
 * @param { number } count
 * @returns { string }
 */
export function folderCell (columnId, count) {
  if (columnId === 'size') {
    return count === 1 ? '1 item' : `${count} items`
  }
  return ''
}

export function readLocalLayout () {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : undefined
  } catch {
    return undefined
  }
}

export function writeLocalLayout (layout) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout))
  } catch {
    // The workspace state is the copy that is shared. Local storage is only a fallback.
  }
}

/**
 * A still has no playable frame rate or duration.
 * @param { any } item
 */
function isMoving (item) {
  const scan = item?.scanner
  return (scan?.frames || 0) > 1 || (scan?.duration || 0) > 0
}

/**
 * @param { string | undefined } fraction
 * @returns { number }
 */
export function frameRateNumber (fraction) {
  const label = formatFrameRate(fraction)
  const value = Number(label)
  return Number.isFinite(value) ? value : 0
}

/**
 * @param { number | string | undefined } bytes
 * @returns { string }
 */
export function formatBytes (bytes) {
  const value = Number(bytes)
  if (!Number.isFinite(value) || value < 0) {
    return ''
  }
  if (value < 1024) {
    return `${Math.round(value)} B`
  }
  const units = ['KB', 'MB', 'GB', 'TB']
  let sized = value / 1024
  let index = 0
  while (sized >= 1024 && index < units.length - 1) {
    sized /= 1024
    index += 1
  }
  const digits = sized >= 10 ? 0 : 1
  return `${sized.toFixed(digits)} ${units[index]}`
}

/**
 * Caspar CLS timestamps are YYYYMMDDHHmmss.
 * @param { any } item
 * @returns { string }
 */
export function formatItemDate (item) {
  const stamp = String(item?.timestamp || '')
  if (/^\d{14}$/.test(stamp)) {
    return `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)} ${stamp.slice(8, 10)}:${stamp.slice(10, 12)}`
  }
  const ms = Number(item?.scanner?.time)
  if (!Number.isFinite(ms) || ms <= 0) {
    return ''
  }
  const date = new Date(ms)
  const pad = value => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * @param { any } item
 * @param { string } columnId
 * @returns { string }
 */
export function cellText (item, columnId) {
  const scan = item?.scanner
  if (columnId === 'name') {
    return baseName(libraryPath(item))
  }
  if (columnId === 'path') {
    return libraryPath(item)
  }
  if (columnId === 'type') {
    return item?.type || ''
  }
  if (columnId === 'resolution') {
    if (!scan?.width || !scan?.height) {
      return ''
    }
    return `${scan.width}×${scan.height}`
  }
  if (columnId === 'framerate') {
    if (!isMoving(item)) {
      return ''
    }
    const fps = formatFrameRate(scan?.frameRate)
    return fps ? `${fps} fps` : ''
  }
  if (columnId === 'duration') {
    if (!isMoving(item)) {
      return ''
    }
    return formatTimecode(scan?.duration, scan?.frameRate) || ''
  }
  if (columnId === 'size') {
    return formatBytes(item?.size ?? scan?.size)
  }
  if (columnId === 'date') {
    return formatItemDate(item)
  }
  return ''
}

/**
 * @param { any } item
 * @param { string } columnId
 * @returns { string | number }
 */
export function sortValue (item, columnId) {
  const scan = item?.scanner
  if (columnId === 'name' || columnId === 'type' || columnId === 'path') {
    return String(cellText(item, columnId)).toLowerCase()
  }
  if (columnId === 'resolution') {
    return ((scan?.width || 0) * 100000) + (scan?.height || 0)
  }
  if (columnId === 'framerate') {
    return isMoving(item) ? frameRateNumber(scan?.frameRate) : 0
  }
  if (columnId === 'duration') {
    return isMoving(item) ? Number(scan?.duration) || 0 : 0
  }
  if (columnId === 'size') {
    return Number(item?.size ?? scan?.size) || 0
  }
  if (columnId === 'date') {
    const stamp = String(item?.timestamp || '')
    if (/^\d{14}$/.test(stamp)) {
      return Number(stamp)
    }
    return Number(scan?.time) || 0
  }
  return ''
}

/**
 * @param { any[] } items
 * @param { { id: string, direction: 'asc' | 'desc' } } sort
 */
export function sortLibraryItems (items, sort) {
  const direction = sort?.direction === 'desc' ? -1 : 1
  const id = sort?.id || 'name'
  return [...items].sort((a, b) => {
    const left = sortValue(a, id)
    const right = sortValue(b, id)
    if (typeof left === 'string' || typeof right === 'string') {
      return String(left).localeCompare(String(right)) * direction
    }
    return (left - right) * direction
  })
}

/**
 * Turn flat Caspar paths into folder and file rows.
 * A search passes only the matching files and sets forceOpen,
 * so matches in closed folders stay visible.
 * @param { any[] } items
 * @param {{ expanded?: Record<string, boolean>, sort?: { id: string, direction: 'asc' | 'desc' }, forceOpen?: boolean }} options
 */
export function buildLibraryRows (items, options = {}) {
  const root = { folders: new Map(), files: [] }
  for (const item of items) {
    const parts = libraryPath(item).split('/').filter(part => part.length > 0)
    if (parts.length === 0) {
      continue
    }
    let node = root
    for (let index = 0; index < parts.length - 1; index += 1) {
      const path = parts.slice(0, index + 1).join('/')
      if (!node.folders.has(path)) {
        node.folders.set(path, { path, name: parts[index], folders: new Map(), files: [] })
      }
      node = node.folders.get(path)
    }
    node.files.push(item)
  }

  const rows = []
  const direction = options.sort?.direction === 'desc' ? -1 : 1
  const sortId = options.sort?.id || 'name'

  function countFiles (node) {
    let total = node.files.length
    for (const folder of node.folders.values()) {
      total += countFiles(folder)
    }
    return total
  }

  function walk (node, depth) {
    const siblings = [
      ...[...node.folders.values()].map(folder => ({ kind: 'folder', folder })),
      ...node.files.map(item => ({ kind: 'file', item }))
    ]
    siblings.sort((a, b) => {
      if (sortId !== 'name' && a.kind !== b.kind) {
        return a.kind === 'folder' ? -1 : 1
      }
      const left = a.kind === 'folder' ? a.folder.name : sortValue(a.item, sortId)
      const right = b.kind === 'folder' ? b.folder.name : sortValue(b.item, sortId)
      if (typeof left === 'string' || typeof right === 'string') {
        return String(left).localeCompare(String(right), undefined, { numeric: true }) * (sortId === 'name' ? direction : (a.kind === 'folder' ? 1 : direction))
      }
      return (left - right) * direction
    })

    for (const sibling of siblings) {
      if (sibling.kind === 'folder') {
        const open = Boolean(options.forceOpen || options.expanded?.[sibling.folder.path])
        rows.push({
          kind: 'folder',
          path: sibling.folder.path,
          name: sibling.folder.name,
          depth,
          open,
          count: countFiles(sibling.folder)
        })
        if (open) {
          walk(sibling.folder, depth + 1)
        }
      } else {
        rows.push({ kind: 'file', item: sibling.item, depth })
      }
    }
  }
  walk(root, 0)
  return rows
}
