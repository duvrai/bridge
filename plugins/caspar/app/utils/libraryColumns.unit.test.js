import { cellText, formatBytes, normalizeLayout, sortLibraryItems, visibleColumns } from './libraryColumns.js'

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
  expect(cellText(movie, 'resolution')).toEqual('1920×1080')
  expect(cellText(movie, 'framerate')).toEqual('50 fps')
  expect(cellText(movie, 'duration')).toEqual('1:08')
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

test('sortLibraryItems orders by duration descending', () => {
  const items = [
    { name: 'A', scanner: { duration: 4, frames: 100 } },
    { name: 'B', scanner: { duration: 68, frames: 1000 } }
  ]
  const sorted = sortLibraryItems(items, { id: 'duration', direction: 'desc' })
  expect(sorted.map(item => item.name)).toEqual(['B', 'A'])
})
