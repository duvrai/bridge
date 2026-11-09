// SPDX-FileCopyrightText: 2024 Sveriges Television AB
//
// SPDX-License-Identifier: MIT

const fs = require('node:fs')
const electron = require('./electron/electron')

const paths = require('./paths')
const UserDefaults = require('./UserDefaults')
const serverProjects = require('./serverProjects')

const Logger = require('./Logger')
const logger = new Logger({ name: 'init-electron' })

/*
Setup a new window if running
in an electron context
*/
;(async function () {
  await electron.isReady()

  if (electron.wasOpenedByFile()) {
    return
  }

  /*
  Server mode opens the project list. A normal desktop launch still
  gets a new workspace, and keeps the save and open dialogs.
  */
  if (serverProjects.enabled()) {
    const port = UserDefaults.data.httpPort || process.env.HTTP_PORT || 5544
    logger.debug('Opening the server project list')
    electron.initStatelessWindow(`http://localhost:${port}/`)
    return
  }

  logger.debug('Setting up initial workspace')
  electron.initNewWorkspaceWindow()
})()

/*
Write the user defaults-state to disk
before the process exits
*/
function writeUserDeafults () {
  logger.debug('Writing user defaults to disk')
  fs.writeFileSync(paths.userDefaults, JSON.stringify(UserDefaults.data))
}

electron.app.once('will-quit', () => {
  logger.debug('App will quit, performing cleanup tasks')
  writeUserDeafults()
  serverProjects.flushAll()
})
