// SPDX-FileCopyrightText: 2024 Sveriges Television AB
//
// SPDX-License-Identifier: MIT

const electron = require('./electron/electron')

const UserDefaults = require('./UserDefaults')
const UserDefaultsStore = require('./UserDefaultsStore')
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
  The service on .113 sets APP_DATA_BASE_PATH, so the window opens
  the project list. A laptop build does not, and still gets a workspace.
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
Flush any change that is still inside the debounce window.
The stores already write on each change and on SIGTERM/SIGINT.
*/
electron.app.once('will-quit', () => {
  logger.debug('App will quit, performing cleanup tasks')
  UserDefaultsStore.flush()
  serverProjects.flushAll()
})
