import { buildLibraryRows, cellText, formatBytes, normalizeLayout, scannerDisplayPath, sortLibraryItems, visibleColumns } from './libraryColumns.js'
import { constructPlayableItemInit } from './libraryItem.js'

test('normalizeLayout keeps name visible and fills missing columns', () => {
  const layout = normalizeLayout({
    order: ['date', 'name'],
    hidden: { name: true, type: true },
    widths: { name: 10, date: 4000 },
    sort: { id: 'nope', direction: 'desc' }
  })
  expect(layout.hidden.name).toEqual(false)
  expect(layout.hidden.type).toEqual(true)
  expect(layout.order[0]).toEqual('date')
  expect(layout.order).toContain('thumbnail')
  expect(layout.widths.name).toEqual(48)
  expect(layout.widths.date).toEqual(800)
  expect(layout.sort).toEqual({ id: 'name', direction: 'desc' })
  expect(visibleColumns(layout).some(column => column.id === 'type')).toEqual(false)
})

test('cellText formats a 1080p50 movie and leaves a still without duration', () => {
  const movie = {
    name: 'CLIP',
    type: 'VIDEO',
    size: '123378979',
    timestamp: '20261007134754',
    scanner: { width: 1920, height: 1080, frameRate: '50/1', duration: 68.34, frames: 3417 }
  }
  expect(cellText(movie, 'resolution')).toEqual('1080p50')
  expect(cellText(movie, 'framerate')).toEqual('50')
  expect(cellText(movie, 'duration')).toEqual('00:01:08:17')
  expect(cellText(movie, 'size')).toEqual(formatBytes(123378979))
  expect(cellText(movie, 'date')).toEqual('2026-10-07 13:47')

  const still = {
    name: 'QR',
    type: 'STILL',
    scanner: { width: 1250, height: 1250, frameRate: '25/1', duration: 0, frames: 1 }
  }
  expect(cellText(still, 'resolution')).toEqual('1250×1250')
  expect(cellText(still, 'framerate')).toEqual('')
  expect(cellText(still, 'duration')).toEqual('')
})

test('tree uses the scanner path, keeps case and extension, and PLAY keeps the CLS id', () => {
  const cellen = {
    name: '20261008 VIB/CELLEN04',
    type: 'VIDEO',
    displayPath: scannerDisplayPath('media/20261008 VIB/cellen04.mp4')
  }
  const cathedral = {
    name: '00ANTWERPEN/KATHEDRAAL STEUN',
    type: 'VIDEO',
    displayPath: scannerDisplayPath('media/00antwerpen/Kathedraal steun.mov')
  }
  const dash = {
    name: '20261008 VIB/VIDEO/IMPACT STORY 1 – VIDEO 2 – DATA CORE AI STUDIO- V005 NO WHITE',
    type: 'VIDEO',
    displayPath: scannerDisplayPath('media/20261008 VIB/Video/Impact story 1 – Video 2 – Data Core AI Studio- V005 no white.mp4')
  }
  const upper = { name: 'DIR/FILE', type: 'VIDEO', displayPath: 'Dir/File.mp4' }
  const lower = { name: 'DIR/OTHER', type: 'VIDEO', displayPath: 'dir/File.mov' }

  const rows = buildLibraryRows([cellen, cathedral, dash, upper, lower], { forceOpen: true })
  const folders = rows.filter(row => row.kind === 'folder').map(row => row.path)
  expect(folders).toContain('20261008 VIB')
  expect(folders).toContain('20261008 VIB/Video')
  expect(folders).toContain('00antwerpen')
  expect(folders).toContain('Dir')
  expect(folders).toContain('dir')
  expect(folders).not.toContain('20261008 VIB/VIDEO')

  expect(cellText(cellen, 'name')).toEqual('cellen04.mp4')
  expect(cellText(cathedral, 'name')).toEqual('Kathedraal steun.mov')
  expect(cellText(dash, 'name')).toEqual('Impact story 1 – Video 2 – Data Core AI Studio- V005 no white.mp4')
  expect(cellText(upper, 'name')).toEqual('File.mp4')
  expect(cellText(lower, 'name')).toEqual('File.mov')

  const closed = buildLibraryRows([cellen], { expanded: {} })
  expect(closed.some(row => row.kind === 'file')).toEqual(false)

  const fallback = { name: '20261008 VIB/CELLEN04', type: 'VIDEO' }
  expect(cellText(fallback, 'name')).toEqual('CELLEN04')
  expect(cellText(fallback, 'path')).toEqual('20261008 VIB/CELLEN04')

  const playable = constructPlayableItemInit({ ...cellen, _filter: { serverId: 'server-1' } })
  expect(playable.data.name).toEqual('cellen04.mp4')
  expect(playable.data.caspar.target).toEqual('20261008 VIB/CELLEN04')
  expect(playable.data.caspar.path).toEqual('20261008 VIB/cellen04.mp4')
})

test('the name column stays first and sorting stays inside each folder', () => {
  const layout = normalizeLayout({ order: ['date', 'type', 'name'], hidden: {} })
  expect(visibleColumns(layout)[0].id).toEqual('name')

  const rows = buildLibraryRows([
    { name: 'A', displayPath: 'Folder/slow.mp4', type: 'VIDEO', scanner: { duration: 10, frames: 10 } },
    { name: 'B', displayPath: 'Folder/fast.mp4', type: 'VIDEO', scanner: { duration: 2, frames: 10 } },
    { name: 'C', displayPath: 'other.mp4', type: 'VIDEO', scanner: { duration: 100, frames: 10 } }
  ], { expanded: { Folder: true }, sort: { id: 'duration', direction: 'asc' } })

  expect(rows.map(row => row.kind === 'folder' ? row.name : cellText(row.item, 'name'))).toEqual([
    'Folder',
    'fast.mp4',
    'slow.mp4',
    'other.mp4'
  ])
  expect(rows[0].count).toEqual(2)
})

test('sortLibraryItems orders by duration descending', () => {
  const items = [
    { name: 'A', scanner: { duration: 4, frames: 100 } },
    { name: 'B', scanner: { duration: 68, frames: 1000 } }
  ]
  const sorted = sortLibraryItems(items, { id: 'duration', direction: 'desc' })
  expect(sorted.map(item => item.name)).toEqual(['B', 'A'])
})
