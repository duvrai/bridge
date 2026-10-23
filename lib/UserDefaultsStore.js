// SPDX-FileCopyrightText: 2026 duvrai
//
// SPDX-License-Identifier: MIT

const fs = require('node:fs')
const path = require('node:path')

const paths = require('./paths')
const UserDefaults = require('./UserDefaults')

const Logger = require('./Logger')
const logger = new Logger({ name: 'UserDefaults' })

/**
 * Wait briefly so a burst of changes becomes one write.
 * Short enough that a setting survives a restart a moment later.
 * @type { number }
 */
const WRITE_DELAY_MS = 750

let started = false
let dirty = false
let timer = null

/**
 * Replace the defaults file by writing a sibling temp file
 * and renaming it into place. A crash during the write leaves
 * the previous file intact.
 */
function writeAtomic () {
  const filePath = paths.userDefaults
  const directory = path.dirname(filePath)
  const tempPath = path.join(directory, `.UserDefaults.${process.pid}.tmp`)

  fs.mkdirSync(directory, { recursive: true })

  const fd = fs.openSync(tempPath, 'w')
  try {
    fs.writeSync(fd, JSON.stringify(UserDefaults.data))
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

function writeIfDirty () {
  if (!dirty) {
    return
  }
  try {
    writeAtomic()
    dirty = false
    logger.debug('Wrote user defaults', paths.userDefaults)
  } catch (err) {
    logger.warn('Failed to write user defaults', err)
    throw err
  }
}

function schedule () {
  dirty = true
  if (timer) {
    clearTimeout(timer)
  }
  timer = setTimeout(() => {
    timer = null
    try {
      writeIfDirty()
    } catch {
      // writeIfDirty already logged the failure and left dirty set
    }
  }, WRITE_DELAY_MS)
}

/**
 * Write immediately and cancel a pending debounced write.
 * Safe to call more than once: a second call does nothing
 * when nothing changed since the last successful write.
 */
function flush () {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  try {
    writeIfDirty()
  } catch {
    // Already logged. Keep dirty so a later flush can retry.
  }
}

function onTerminate () {
  flush()
}

/**
 * Persist user defaults whenever they change, and on SIGTERM/SIGINT.
 * This runs for both Electron and plain node, because a service stop
 * does not reliably reach Electron's will-quit handler.
 */
function start () {
  if (started) {
    return
  }
  started = true
  UserDefaults.on('change', schedule)
  process.on('SIGTERM', onTerminate)
  process.on('SIGINT', onTerminate)
  logger.debug('Persisting user defaults on change', paths.userDefaults)
}

function stop () {
  if (!started) {
    return
  }
  started = false
  UserDefaults.removeListener('change', schedule)
  process.removeListener('SIGTERM', onTerminate)
  process.removeListener('SIGINT', onTerminate)
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
}

exports.WRITE_DELAY_MS = WRITE_DELAY_MS
exports.start = start
exports.stop = stop
exports.flush = flush
