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

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-projects-'))
process.env.APP_DATA_BASE_PATH = directory

let projects

beforeAll(() => {
  jest.resetModules()
  process.env.APP_DATA_BASE_PATH = directory
  projects = require('./serverProjects')
})

afterAll(() => {
  projects.stop()
  fs.rmSync(directory, { recursive: true, force: true })
})

test('a name that leaves the projects directory is rejected', () => {
  const outside = path.join(directory, 'outside.bridge')
  for (const name of ['../outside', '..', '.', 'foo/bar', 'foo\\bar', 'nested/../../outside']) {
    expect(() => projects.resolveProjectPath(name)).toThrow(/not allowed/)
  }
  expect(fs.existsSync(outside)).toBe(false)
})

test('saving replaces state.json and keeps other files in the archive', async () => {
  const ProjectFile = require('./ProjectFile')
  const JSZip = require('jszip')
  const original = new JSZip()
  original.file('state.json', JSON.stringify({ url: 'dpro', marker: 1 }))
  original.file('notes/readme.txt', 'keep me')
  const existing = await original.generateAsync({ type: 'nodebuffer' })
  const saved = ProjectFile.main.toBuffer({
    state: { toStaticString: () => JSON.stringify({ url: 'dpro', marker: 2 }) }
  }, existing)
  const zip = await JSZip.loadAsync(saved)
  expect(JSON.parse(await zip.file('state.json').async('text'))).toEqual({ url: 'dpro', marker: 2 })
  expect(await zip.file('notes/readme.txt').async('text')).toBe('keep me')
})

test('a project buffer is a zip JSZip can read back', async () => {
  const ProjectFile = require('./ProjectFile')
  const JSZip = require('jszip')
  const buffer = ProjectFile.main.toBuffer({
    state: { toStaticString: () => JSON.stringify({ url: 'dpro', marker: 321 }) }
  })
  const zip = await JSZip.loadAsync(buffer)
  const state = JSON.parse(await zip.file('state.json').async('text'))
  expect(state).toEqual({ url: 'dpro', marker: 321 })
})

test('projects can be duplicated, renamed and deleted inside the directory', () => {
  const { filePath } = projects.resolveProjectPath('dpro')
  expect(filePath.startsWith(path.join(directory, 'projects') + path.sep)).toBe(true)
  fs.writeFileSync(filePath, Buffer.from('project'))

  expect(projects.list().projects.map(project => project.name)).toEqual(['dpro'])
  expect(projects.exists('dpro')).toBe(true)
  expect(projects.exists('../outside')).toBe(false)

  projects.duplicate('dpro', 'dpro-copy')
  projects.rename('dpro-copy', 'copy-two')
  expect(projects.exists('copy-two')).toBe(true)
  expect(projects.exists('dpro-copy')).toBe(false)

  projects.remove('dpro')
  expect(projects.exists('dpro')).toBe(false)
  expect(projects.list().projects.map(project => project.name)).toEqual(['copy-two'])
  expect(fs.existsSync(path.join(directory, 'outside.bridge'))).toBe(false)
})
