// SPDX-FileCopyrightText: 2023 Sveriges Television AB
//
// SPDX-License-Identifier: MIT

const fs = require('fs')
const zlib = require('node:zlib')
const JSZip = require('jszip')

/**
 * A stored (uncompressed) zip of one file.
 * JSZip 3 removed the synchronous generate() method, and a service
 * stop has to be able to finish the write before the process exits.
 * @param { string } name
 * @param { Buffer } data
 * @returns { Buffer }
 */
function zipStored (name, data) {
  const fileName = Buffer.from(name)
  const crc = zlib.crc32(data)
  const local = Buffer.alloc(30 + fileName.length)
  local.writeUInt32LE(0x04034b50, 0)
  local.writeUInt16LE(20, 4)
  local.writeUInt16LE(fileName.length, 26)
  fileName.copy(local, 30)
  local.writeUInt32LE(crc, 14)
  local.writeUInt32LE(data.length, 18)
  local.writeUInt32LE(data.length, 22)

  const central = Buffer.alloc(46 + fileName.length)
  central.writeUInt32LE(0x02014b50, 0)
  central.writeUInt16LE(20, 4)
  central.writeUInt16LE(20, 6)
  central.writeUInt32LE(crc, 16)
  central.writeUInt32LE(data.length, 20)
  central.writeUInt32LE(data.length, 24)
  central.writeUInt16LE(fileName.length, 28)
  central.writeUInt32LE(0, 42)
  fileName.copy(central, 46)

  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(1, 8)
  end.writeUInt16LE(1, 10)
  end.writeUInt32LE(central.length, 12)
  end.writeUInt32LE(local.length + data.length, 16)
  return Buffer.concat([local, data, central, end])
}

const DIController = require('../shared/DIController')

const Logger = require('./Logger')
const logger = new Logger({ name: 'ProjectFile' })

class ProjectFile {
  /**
   * The singleton instance
   * of this class
   * @type { ProjectFile }
   */
  static main = new ProjectFile()

  /**
   * Create a writable archive
   * at the given filePath
   * @param { String } filePath
   * @returns {{
   *   finalize: { Function },
   *   zip: JSZip
   * }}
   */
  createArchive (filePath) {
    const zip = new JSZip()
    function finalize () {
      try {
        const ws = fs.createWriteStream(filePath)
        const rs = zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true })
        rs.pipe(ws)
        logger.debug('Writing workspace archive to', filePath)
      } catch (err) {
        logger.error('Unable to write workspace archive', err)
      }
    }

    return {
      zip,
      finalize
    }
  }

  /**
   * Read a zip archive
   * from a file path
   * @param { String } filePath
   * @returns { JSZip }
   */
  async readArchive (filePath) {
    const data = await fs.promises.readFile(filePath)
    return JSZip.loadAsync(data)
  }

  /**
   * Write the provided workspace
   * as a zipped workspace file
   * at the provided filePath
   * @param { String } filePath
   * @param { Workspace } workspace
   */
  writeWorkspace (filePath, workspace) {
    const archive = this.createArchive(filePath)
    archive.zip.file('state.json', workspace.state.toStaticString(), { binary: false })
    archive.finalize()
  }

  /**
   * Build the same archive as writeWorkspace, as a buffer,
   * so a caller can replace the file atomically.
   * @param { Workspace } workspace
   * @returns { Buffer }
   */
  toBuffer (workspace) {
    return zipStored('state.json', Buffer.from(workspace.state.toStaticString()))
  }

  /**
   * Read a workspace from
   * a project file
   * @param { String } filePath
   * @returns { Promise.<Workspace?> }
   */
  async readWorkspace (filePath) {
    const zip = await this.readArchive(filePath)

    if (!zip.files['state.json']) {
      logger.warn('Invalid workspace file, missing state.json, aborting')
      return
    }

    try {
      const stateStr = await zip.files['state.json'].async('text')
      const state = JSON.parse(stateStr)

      const workspace = DIController.main.instantiate('Workspace')
      workspace.setup(state)
      return workspace
    } catch (err) {
      logger.error('Unable to parse state, aborting', err)
    }
  }
}
module.exports = ProjectFile

/**
 * A collection of file extensions
 * to be used with this module
 */
module.exports.extensions = Object.freeze({
  workspace: 'bridge'
})
