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

const absoluteDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-appdata-abs-'))
const relativeName = `bridge-appdata-rel-${process.pid}`

function loadPaths (basePath) {
  process.env.APP_DATA_BASE_PATH = basePath
  jest.resetModules()
  return require('./paths')
}

afterAll(() => {
  fs.rmSync(absoluteDir, { recursive: true, force: true })
  fs.rmSync(path.join(__dirname, relativeName), { recursive: true, force: true })
})

test('an absolute APP_DATA_BASE_PATH is used unchanged and the directory is created', () => {
  const paths = loadPaths(absoluteDir)

  expect(paths.appData).toBe(absoluteDir)
  expect(paths.appData).not.toBe(path.join(__dirname, absoluteDir))
  expect(paths.userDefaults).toBe(path.join(absoluteDir, 'UserDefaults.json'))
  expect(paths.plugins).toBe(path.join(absoluteDir, 'plugins'))
  expect(paths.temp).toBe(path.join(absoluteDir, 'temp'))
  expect(fs.existsSync(absoluteDir)).toBe(true)
})

test('a relative APP_DATA_BASE_PATH stays joined onto the lib directory', () => {
  const paths = loadPaths(relativeName)
  const expected = path.join(__dirname, relativeName)

  expect(paths.appData).toBe(expected)
  expect(paths.userDefaults).toBe(path.join(expected, 'UserDefaults.json'))
  expect(fs.existsSync(expected)).toBe(true)
})
