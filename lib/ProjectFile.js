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

function findEocd (buffer) {
  const minimum = Math.max(0, buffer.length - 22 - 65535)
  for (let offset = buffer.length - 22; offset >= minimum; offset--) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      return offset
    }
  }
  return -1
}

/**
 * Copy every entry except state.json, then write a new state.json.
 * Offsets in the central directory are rewritten. Compression of the
 * other entries is left untouched.
 * @param { Buffer } existing
 * @param { Buffer } state
 * @returns { Buffer }
 */
function replaceStateJson (existing, state) {
  const eocd = findEocd(existing)
  if (eocd < 0) {
    throw new Error('Project file is not a zip archive')
  }
  const count = existing.readUInt16LE(eocd + 10)
  let cursor = existing.readUInt32LE(eocd + 16)
  const entries = []
  for (let index = 0; index < count; index++) {
    if (existing.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error('Project file has a broken central directory')
    }
    const nameLength = existing.readUInt16LE(cursor + 28)
    const extraLength = existing.readUInt16LE(cursor + 30)
    const commentLength = existing.readUInt16LE(cursor + 32)
    const compressedSize = existing.readUInt32LE(cursor + 20)
    const localOffset = existing.readUInt32LE(cursor + 42)
    const name = existing.slice(cursor + 46, cursor + 46 + nameLength).toString()
    const centralLength = 46 + nameLength + extraLength + commentLength
    entries.push({
      name,
      compressedSize,
      localOffset,
      central: existing.slice(cursor, cursor + centralLength)
    })
    cursor += centralLength
  }

  const locals = []
  const centrals = []
  let offset = 0
  let replaced = false
  for (const entry of entries) {
    if (entry.name === 'state.json') {
      replaced = true
      const header = localHeader('state.json', state)
      locals.push(header, state)
      centrals.push(centralHeader('state.json', state, offset))
      offset += header.length + state.length
      continue
    }
    const flags = existing.readUInt16LE(entry.localOffset + 6)
    const nameLength = existing.readUInt16LE(entry.localOffset + 26)
    const extraLength = existing.readUInt16LE(entry.localOffset + 28)
    let recordEnd = entry.localOffset + 30 + nameLength + extraLength + entry.compressedSize
    if (flags & 0x8) {
      recordEnd += existing.readUInt32LE(recordEnd) === 0x08074b50 ? 16 : 12
    }
    const record = existing.slice(entry.localOffset, recordEnd)
    const central = Buffer.from(entry.central)
    central.writeUInt32LE(offset, 42)
    locals.push(record)
    centrals.push(central)
    offset += record.length
  }
  if (!replaced) {
    const header = localHeader('state.json', state)
    locals.push(header, state)
    centrals.push(centralHeader('state.json', state, offset))
    offset += header.length + state.length
  }

  const centralDirectory = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(centrals.length, 8)
  end.writeUInt16LE(centrals.length, 10)
  end.writeUInt32LE(centralDirectory.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, centralDirectory, end])
}

function localHeader (name, data) {
  const fileName = Buffer.from(name)
  const crc = zlib.crc32(data)
  const header = Buffer.alloc(30 + fileName.length)
  header.writeUInt32LE(0x04034b50, 0)
  header.writeUInt16LE(20, 4)
  header.writeUInt16LE(fileName.length, 26)
  fileName.copy(header, 30)
  header.writeUInt32LE(crc, 14)
  header.writeUInt32LE(data.length, 18)
  header.writeUInt32LE(data.length, 22)
  return header
}

function centralHeader (name, data, offset) {
  const fileName = Buffer.from(name)
  const crc = zlib.crc32(data)
  const header = Buffer.alloc(46 + fileName.length)
  header.writeUInt32LE(0x02014b50, 0)
  header.writeUInt16LE(20, 4)
  header.writeUInt16LE(20, 6)
  header.writeUInt32LE(crc, 16)
  header.writeUInt32LE(data.length, 20)
  header.writeUInt32LE(data.length, 24)
  header.writeUInt16LE(fileName.length, 28)
  header.writeUInt32LE(offset, 42)
  fileName.copy(header, 46)
  return header
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
   * Zip the workspace state. When an existing archive is given,
   * only state.json is replaced and every other entry is kept.
   * @param { Workspace } workspace
   * @param { Buffer } [existing]
   * @returns { Buffer }
   */
  toBuffer (workspace, existing) {
    const state = Buffer.from(workspace.state.toStaticString())
    if (!existing || existing.length === 0) {
      return zipStored('state.json', state)
    }
    return replaceStateJson(existing, state)
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
