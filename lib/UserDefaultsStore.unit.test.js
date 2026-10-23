// SPDX-FileCopyrightText: 2026 duvrai
//
// SPDX-License-Identifier: MIT

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

jest.mock('electron', () => {
  const os = require('node:os')
  const path = require('node:path')
  return {
    app: {
      getPath: () => path.join(os.tmpdir(), 'bridge-electron-userdata')
    }
  }
})

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-userdefaults-'))

function load () {
  process.env.APP_DATA_BASE_PATH = directory
  jest.resetModules()
  const UserDefaults = require('./UserDefaults')
  const store = require('./UserDefaultsStore')
  const paths = require('./paths')
  store.start()
  return { UserDefaults, store, filePath: paths.userDefaults }
}

let current

beforeEach(() => {
  jest.useFakeTimers()
  current = load()
  fs.rmSync(current.filePath, { force: true })
})

afterEach(() => {
  current.store.stop()
  jest.clearAllTimers()
  jest.useRealTimers()
})

afterAll(() => {
  fs.rmSync(directory, { recursive: true, force: true })
})

test('a change is written once, after the debounce, and the temp file is removed', () => {
  current.UserDefaults.apply({ hideMessages: true })

  expect(fs.existsSync(current.filePath)).toBe(false)
  jest.advanceTimersByTime(current.store.WRITE_DELAY_MS - 1)
  expect(fs.existsSync(current.filePath)).toBe(false)

  jest.advanceTimersByTime(1)

  const saved = JSON.parse(fs.readFileSync(current.filePath, 'utf8'))
  expect(saved.hideMessages).toBe(true)
  expect(fs.readdirSync(directory).some(name => name.endsWith('.tmp'))).toBe(false)
})

test('a second change within the delay replaces the pending write', () => {
  current.UserDefaults.apply({ hideMessages: true })
  jest.advanceTimersByTime(400)
  current.UserDefaults.apply({ hideMessages: false })
  jest.advanceTimersByTime(400)

  expect(fs.existsSync(current.filePath)).toBe(false)

  jest.advanceTimersByTime(current.store.WRITE_DELAY_MS)

  const saved = JSON.parse(fs.readFileSync(current.filePath, 'utf8'))
  expect(saved.hideMessages).toBe(false)
})

test('SIGTERM writes a change that is still waiting', () => {
  current.store.stop()
  const before = new Set(process.listeners('SIGTERM'))
  current.store.start()
  const handler = process.listeners('SIGTERM').find(listener => !before.has(listener))

  current.UserDefaults.apply({ hideMessages: true })
  handler()

  const saved = JSON.parse(fs.readFileSync(current.filePath, 'utf8'))
  expect(saved.hideMessages).toBe(true)
})

test('flush writes immediately and a later timer does not write again', () => {
  current.UserDefaults.apply({ hideMessages: true })
  current.store.flush()

  const saved = JSON.parse(fs.readFileSync(current.filePath, 'utf8'))
  expect(saved.hideMessages).toBe(true)

  jest.advanceTimersByTime(current.store.WRITE_DELAY_MS * 2)
  expect(JSON.parse(fs.readFileSync(current.filePath, 'utf8')).hideMessages).toBe(true)
  expect(fs.readdirSync(directory).some(name => name.endsWith('.tmp'))).toBe(false)
})
