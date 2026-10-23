// SPDX-FileCopyrightText: 2024 Sveriges Television AB
//
// SPDX-License-Identifier: MIT

const electron = require('./electron/electron')

const UserDefaultsStore = require('./UserDefaultsStore')

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

  logger.debug('Setting up initial workspace')
  electron.initNewWorkspaceWindow()
})()

/*
Flush any change that is still inside the debounce window.
The store already writes on each change and on SIGTERM/SIGINT.
*/
electron.app.once('will-quit', () => {
  logger.debug('App will quit, performing cleanup tasks')
  UserDefaultsStore.flush()
})
