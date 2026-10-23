// SPDX-FileCopyrightText: 2026 duvrai
//
// SPDX-License-Identifier: MIT

const fs = require('node:fs')
const path = require('node:path')

const paths = require('./paths')
const platform = require('./platform')
const ProjectFile = require('./ProjectFile')
const UserDefaults = require('./UserDefaults')
const HttpError = require('./error/HttpError')

const Logger = require('./Logger')
const logger = new Logger({ name: 'ServerProjects' })

const WRITE_DELAY_MS = 750
const EXTENSION = `.${ProjectFile.extensions.workspace}`

/**
 * file path -> workspace already loaded in this process
 * @type { Map.<string, import('./workspace/Workspace')> }
 */
const openByPath = new Map()
const dirty = new Set()
const timers = new Map()
const opening = new Map()
let signalsBound = false

/**
 * Server projects are on for a headless node process, and whenever
 * APP_DATA_BASE_PATH is set explicitly (the .113 service). A normal
 * Electron app on a laptop leaves the variable unset and keeps the
 * save and open dialogs.
 * @returns { boolean }
 */
function enabled () {
  if (!platform.isElectron()) {
    return true
  }
  return typeof process.env.APP_DATA_BASE_PATH === 'string' && process.env.APP_DATA_BASE_PATH.length > 0
}

function ensureDir () {
  fs.mkdirSync(paths.projects, { recursive: true })
}

function badName () {
  return new HttpError('Project name is not allowed', 'ERR_PROJECT_NAME', 400)
}

/**
 * Turn a project name into a file inside the projects directory.
 * Names that would leave that directory are rejected.
 * @param { string } name
 * @returns {{ name: string, filePath: string }}
 */
function resolveProjectPath (name) {
  if (typeof name !== 'string') {
    throw badName()
  }
  if (!name || name !== name.trim() || name.length > 80) {
    throw badName()
  }
  if (name === '.' || name === '..' || name.includes('..') || name.includes('\0') || /[/\\]/.test(name)) {
    throw badName()
  }

  ensureDir()
  const root = fs.realpathSync(paths.projects)
  const filePath = path.resolve(root, `${name}${EXTENSION}`)
  const relative = path.relative(root, filePath)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw badName()
  }

  if (fs.existsSync(filePath)) {
    const real = fs.realpathSync(filePath)
    const fromRoot = path.relative(root, real)
    if (!fromRoot || fromRoot.startsWith('..') || path.isAbsolute(fromRoot)) {
      throw new HttpError('Project path is not allowed', 'ERR_PROJECT_PATH', 400)
    }
  }

  return { name, filePath }
}

function lastName () {
  const value = UserDefaults.data?.serverProjects?.lastName
  return typeof value === 'string' ? value : ''
}

function remember (name) {
  UserDefaults.apply({
    serverProjects: {
      lastName: name
    }
  })
}

function persistentChange (set) {
  const changes = Array.isArray(set) ? set : [set]
  return changes.some(change => {
    if (!change || typeof change !== 'object') {
      return false
    }
    return Object.keys(change).some(key => !key.startsWith('_'))
  })
}

function writeAtomic (filePath, buffer) {
  const directory = path.dirname(filePath)
  fs.mkdirSync(directory, { recursive: true })
  const tempPath = path.join(directory, `.${path.basename(filePath)}.${process.pid}.tmp`)
  const fd = fs.openSync(tempPath, 'w')
  try {
    fs.writeSync(fd, buffer)
    fs.fsyncSync(fd)
  } catch (err) {
    fs.closeSync(fd)
    fs.rmSync(tempPath, { force: true })
    throw err
  }
  fs.closeSync(fd)
  try {
    fs.renameSync(tempPath, filePath)
  } catch (err) {
    fs.rmSync(tempPath, { force: true })
    throw err
  }
}

function writeNow (workspace) {
  if (!dirty.has(workspace)) {
    return
  }
  const filePath = workspace.state?.data?._filePath
  if (!filePath) {
    return
  }
  try {
    let existing
    try {
      existing = fs.readFileSync(filePath)
    } catch (err) {
      if (err.code !== 'ENOENT') {
        throw err
      }
    }
    const buffer = ProjectFile.main.toBuffer(workspace, existing)
    writeAtomic(filePath, buffer)
    dirty.delete(workspace)
    workspace.state.markAsSaved()
    logger.debug('Wrote project', filePath, buffer.length)
  } catch (err) {
    logger.warn('Failed to write project', err)
    throw err
  }
}

function flushWorkspace (workspace, rethrow) {
  const timer = timers.get(workspace)
  if (timer) {
    clearTimeout(timer)
    timers.delete(workspace)
  }
  try {
    writeNow(workspace)
  } catch (err) {
    if (rethrow) {
      throw err
    }
  }
}

function schedule (workspace, set) {
  if (!persistentChange(set)) {
    return
  }
  dirty.add(workspace)
  const existing = timers.get(workspace)
  if (existing) {
    clearTimeout(existing)
  }
  timers.set(workspace, setTimeout(() => {
    timers.delete(workspace)
    try {
      writeNow(workspace)
    } catch {
      // Already logged.
    }
  }, WRITE_DELAY_MS))
}

function attach (workspace, filePath, name) {
  workspace.state.apply({
    _filePath: filePath,
    url: name
  })
  workspace.saveFn = () => flushWorkspace(workspace)
  workspace.state.on('change', set => schedule(workspace, set))
  openByPath.set(filePath, workspace)
}

function registry () {
  require('./workspace/Workspace')
  require('./workspace/WorkspaceCrypto')
  require('./workspace/WorkspaceSockets')
  require('./electron/WindowStore')
  return require('./WorkspaceRegistry').getInstance()
}

function list () {
  if (!enabled()) {
    return { enabled: false, directory: paths.projects, lastName: '', projects: [] }
  }
  ensureDir()
  const current = lastName()
  const projects = fs.readdirSync(paths.projects)
    .filter(fileName => fileName.endsWith(EXTENSION))
    .map(fileName => {
      const name = fileName.slice(0, -EXTENSION.length)
      const filePath = path.join(paths.projects, fileName)
      const stat = fs.statSync(filePath)
      return {
        name,
        size: stat.size,
        mtimeMs: stat.mtimeMs
      }
    })
    .sort((a, b) => {
      if (a.name === current) return -1
      if (b.name === current) return 1
      return b.mtimeMs - a.mtimeMs
    })
  return {
    enabled: true,
    directory: paths.projects,
    lastName: current,
    projects
  }
}

function exists (name) {
  try {
    return fs.existsSync(resolveProjectPath(name).filePath)
  } catch {
    return false
  }
}

function create (name) {
  const target = resolveProjectPath(name)
  if (fs.existsSync(target.filePath)) {
    throw new HttpError('Project already exists', 'ERR_PROJECT_EXISTS', 409)
  }
  const id = registry().create()
  const workspace = registry().get(id)
  attach(workspace, target.filePath, target.name)
  dirty.add(workspace)
  flushWorkspace(workspace, true)
  remember(target.name)
  logger.debug('Created project', target.name)
  return { id, name: target.name }
}

async function open (name) {
  const target = resolveProjectPath(name)
  const loaded = openByPath.get(target.filePath)
  if (loaded) {
    remember(target.name)
    return loaded.id
  }
  if (opening.has(target.filePath)) {
    return opening.get(target.filePath)
  }

  const pending = (async () => {
    if (!fs.existsSync(target.filePath)) {
      throw new HttpError('Project not found', 'ERR_PROJECT_NOT_FOUND', 404)
    }
    const workspace = await ProjectFile.main.readWorkspace(target.filePath)
    if (!workspace) {
      throw new HttpError('Project file is invalid', 'ERR_PROJECT_INVALID', 400)
    }
    attach(workspace, target.filePath, target.name)
    registry().add(workspace)
    remember(target.name)
    logger.debug('Opened project', target.name, workspace.id)
    return workspace.id
  })()

  opening.set(target.filePath, pending)
  try {
    return await pending
  } finally {
    opening.delete(target.filePath)
  }
}

function duplicate (name, nextName) {
  const from = resolveProjectPath(name)
  const to = resolveProjectPath(nextName)
  if (!fs.existsSync(from.filePath)) {
    throw new HttpError('Project not found', 'ERR_PROJECT_NOT_FOUND', 404)
  }
  if (fs.existsSync(to.filePath)) {
    throw new HttpError('Project already exists', 'ERR_PROJECT_EXISTS', 409)
  }
  const workspace = openByPath.get(from.filePath)
  if (workspace) {
    flushWorkspace(workspace)
  }
  fs.copyFileSync(from.filePath, to.filePath)
  logger.debug('Duplicated project', from.name, to.name)
  return { name: to.name }
}

function rename (name, nextName) {
  const from = resolveProjectPath(name)
  const to = resolveProjectPath(nextName)
  if (!fs.existsSync(from.filePath)) {
    throw new HttpError('Project not found', 'ERR_PROJECT_NOT_FOUND', 404)
  }
  if (from.filePath !== to.filePath && fs.existsSync(to.filePath)) {
    throw new HttpError('Project already exists', 'ERR_PROJECT_EXISTS', 409)
  }
  const workspace = openByPath.get(from.filePath)
  if (workspace) {
    flushWorkspace(workspace)
  }
  if (from.filePath !== to.filePath) {
    fs.renameSync(from.filePath, to.filePath)
  }
  if (workspace) {
    openByPath.delete(from.filePath)
    openByPath.set(to.filePath, workspace)
    workspace.state.apply({
      _filePath: to.filePath,
      url: to.name
    })
  }
  if (lastName() === from.name) {
    remember(to.name)
  }
  logger.debug('Renamed project', from.name, to.name)
  return { name: to.name }
}

function remove (name) {
  const target = resolveProjectPath(name)
  if (!fs.existsSync(target.filePath)) {
    throw new HttpError('Project not found', 'ERR_PROJECT_NOT_FOUND', 404)
  }
  const workspace = openByPath.get(target.filePath)
  if (workspace) {
    const timer = timers.get(workspace)
    if (timer) {
      clearTimeout(timer)
    }
    timers.delete(workspace)
    dirty.delete(workspace)
    openByPath.delete(target.filePath)
    registry().delete(workspace.id)
    try {
      workspace.teardown()
    } catch (err) {
      logger.warn('Failed to tear down deleted project', err)
    }
  }
  fs.rmSync(target.filePath)
  if (lastName() === target.name) {
    remember('')
  }
  logger.debug('Deleted project', target.name)
}

function flushAll () {
  for (const workspace of openByPath.values()) {
    dirty.add(workspace)
    flushWorkspace(workspace)
  }
}

function onTerminate () {
  flushAll()
}

function start () {
  if (!enabled() || signalsBound) {
    return
  }
  signalsBound = true
  ensureDir()
  process.on('SIGTERM', onTerminate)
  process.on('SIGINT', onTerminate)
  logger.debug('Server projects directory', paths.projects)
}

function stop () {
  if (!signalsBound) {
    return
  }
  signalsBound = false
  process.removeListener('SIGTERM', onTerminate)
  process.removeListener('SIGINT', onTerminate)
}

exports.WRITE_DELAY_MS = WRITE_DELAY_MS
exports.enabled = enabled
exports.start = start
exports.stop = stop
exports.resolveProjectPath = resolveProjectPath
exports.list = list
exports.exists = exists
exports.create = create
exports.open = open
exports.duplicate = duplicate
exports.rename = rename
exports.remove = remove
exports.flushAll = flushAll
