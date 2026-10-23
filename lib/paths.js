// SPDX-FileCopyrightText: 2022 Sveriges Television AB
//
// SPDX-License-Identifier: MIT

const electron = require('electron')

const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert')

const platform = require('./platform')

;(function () {
  assert(
    platform.isElectron() || process.env.APP_DATA_BASE_PATH,
    'Missing required env variable APP_DATA_BASE_PATH since we\'re not running in Electron'
  )
})()

/**
 * Resolve the application-data directory from APP_DATA_BASE_PATH.
 *
 * An absolute value is used as given. path.join would otherwise append it
 * to dirname, because a later absolute segment no longer resets the result.
 * A relative value stays joined onto dirname, which is the previous behavior.
 *
 * @param { string } basePath
 * @param { string } dirname
 * @returns { string }
 */
function resolveAppDataPath (basePath, dirname) {
  if (path.isAbsolute(basePath)) {
    return basePath
  }
  return path.join(dirname, basePath)
}

/**
 * The base path for
 * application data,
 *
 * this includes but is
 * not limited to plugins
 * and settings
 *
 * @type { String }
 */
const appData = process.env.APP_DATA_BASE_PATH
  ? resolveAppDataPath(process.env.APP_DATA_BASE_PATH, __dirname)
  : electron.app.getPath('userData')

if (process.env.APP_DATA_BASE_PATH) {
  fs.mkdirSync(appData, { recursive: true })
}

exports.appData = appData

/**
 * The base path for plugins
 * @type { String }
 */
const plugins = path.join(appData, '/plugins')
exports.plugins = plugins

/**
 * The base path for
 * internal plugins
 * @type { String }
 */
const internalPlugins = path.join(__dirname, '../plugins')
exports.internalPlugins = internalPlugins

/**
 * The base path for temporary files
 * that will be removed when the
 * application cleans its state
 * @type { String }
 */
const temp = path.join(appData, '/temp')
exports.temp = temp

/**
 * The user defaults file for storing
 * user specific settings
 * @type { String }
 */
const userDefaults = path.join(appData, '/UserDefaults.json')
exports.userDefaults = userDefaults

/**
 * Directory of server-side project files.
 * Only used when server projects are enabled.
 * @type { String }
 */
const projects = path.join(appData, 'projects')
exports.projects = projects

/**
 * Check whether or not
 * a path is a file
 * @param { string } filePath
 * @returns { boolean }
 */
async function pathIsFile (filePath) {
  try {
    const stat = await fs.promises.stat(filePath)
    return stat.isFile()
  } catch {
    return false
  }
}
exports.pathIsFile = pathIsFile
