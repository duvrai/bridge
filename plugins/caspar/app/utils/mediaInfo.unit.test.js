import { formatDuration, formatExactSeconds, formatFrameRate, formatScannerDetails, formatTimecode } from './mediaInfo.js'

test('formatFrameRate reads a scanner fraction as frames per second', () => {
  expect(formatFrameRate('50/1')).toEqual('50')
  expect(formatFrameRate('30000/1001')).toEqual('29.97')
  expect(formatFrameRate('0/1')).toEqual(undefined)
})

test('formatTimecode is SMPTE and drop-frame uses a semicolon', () => {
  expect(formatTimecode(68.34, '50/1')).toEqual('00:01:08:17')
  expect(formatTimecode(4.2, '25/1')).toEqual('00:00:04:05')
  expect(formatTimecode(1, '30000/1001')).toEqual('00:00:01;00')
  expect(formatTimecode(1800 * 1001 / 30000, '30000/1001')).toEqual('00:01:00;02')
  expect(formatTimecode(1, '60000/1001').includes(';')).toEqual(true)
  expect(formatExactSeconds(68.34)).toEqual('68.34 s')
  expect(formatExactSeconds(120)).toEqual('120 s')
})

test('formatDuration rounds to minutes and seconds', () => {
  expect(formatDuration(68.34)).toEqual('1:08')
  expect(formatDuration(4.2)).toEqual('0:04')
  expect(formatDuration(120.02)).toEqual('2:00')
  expect(formatDuration(0)).toEqual(undefined)
})

test('formatScannerDetails shows resolution, frame rate and duration for a movie', () => {
  expect(formatScannerDetails({
    width: 1920,
    height: 1080,
    frameRate: '50/1',
    duration: 68.34,
    frames: 3417
  })).toEqual('1920×1080 · 50 fps · 00:01:08:17')
})

test('formatScannerDetails shows only resolution for a still', () => {
  expect(formatScannerDetails({
    width: 1250,
    height: 1250,
    frameRate: '25/1',
    duration: 0,
    frames: 1
  })).toEqual('1250×1250')
})
