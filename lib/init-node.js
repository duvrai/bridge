// SPDX-FileCopyrightText: 2024 Sveriges Television AB
//
// SPDX-License-Identifier: MIT

const UserDefaultsStore = require('./UserDefaultsStore')

const Logger = require('./Logger')
const logger = new Logger({ name: 'init-node' })

logger.info('Initializing')

/*
The shared store writes on change and on these signals.
Exit still has to stop the process, and flushes once more
in case a change landed after the signal handler.
*/
process.on('exit', () => UserDefaultsStore.flush())

process.on('SIGTERM', () => {
  UserDefaultsStore.flush()
  process.exit(0)
})

process.on('SIGINT', () => {
  UserDefaultsStore.flush()
  process.exit(0)
})
