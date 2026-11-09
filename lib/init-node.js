// SPDX-FileCopyrightText: 2024 Sveriges Television AB
//
// SPDX-License-Identifier: MIT

const fs = require('node:fs')

const paths = require('./paths')
const UserDefaults = require('./UserDefaults')
const serverProjects = require('./serverProjects')

const Logger = require('./Logger')
const logger = new Logger({ name: 'init-node' })

logger.info('Initializing')

/*
Write the user defaults-state to disk
before the process exits
*/
function writeUserDeafults () {
  logger.debug('Writing user defaults to disk')
  fs.writeFileSync(paths.userDefaults, JSON.stringify(UserDefaults.data))
}

process.on('exit', () => writeUserDeafults())

process.on('SIGTERM', () => {
  writeUserDeafults()
  serverProjects.flushAll()
  process.exit(0)
})

process.on('SIGINT', () => {
  writeUserDeafults()
  serverProjects.flushAll()
  process.exit(0)
})
