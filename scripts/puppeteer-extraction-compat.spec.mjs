/**
 * @license
 * Copyright 2026 Eslam Muatamed
 * SPDX-License-Identifier: Apache-2.0
 */

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { crc32, deflateRawSync } from 'node:zlib'
import { afterEach, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const forkCommit = '9c87c39d0bbdb78499b204c39f66a4196939092f'
const temporaryRoots = []

function makeZip(entries) {
  const localParts = []
  const centralParts = []
  let offset = 0

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8')
    const data = Buffer.from(entry.data)
    const compressed = deflateRawSync(data)
    const checksum = crc32(data)

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x0800, 6)
    local.writeUInt16LE(8, 8)
    local.writeUInt32LE(checksum, 14)
    local.writeUInt32LE(compressed.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(name.length, 26)
    localParts.push(local, name, compressed)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE((3 << 8) | 20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0x0800, 8)
    central.writeUInt16LE(8, 10)
    central.writeUInt32LE(checksum, 16)
    central.writeUInt32LE(compressed.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt32LE((0o100644 << 16) >>> 0, 38)
    central.writeUInt32LE(offset, 42)
    centralParts.push(central, name)
    offset += local.length + name.length + compressed.length
  }

  const centralDirectory = Buffer.concat(centralParts)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(centralDirectory.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...localParts, centralDirectory, end])
}

async function fixture(entries) {
  const root = await mkdtemp(join(tmpdir(), 'web-puppeteer-extraction-'))
  temporaryRoots.push(root)
  const archive = join(root, 'fixture.zip')
  const destination = join(root, 'destination')
  await writeFile(archive, makeZip(entries))
  return { archive, destination, root }
}

async function resolvedFork() {
  const mainPath = require.resolve('@puppeteer/browsers')
  const packageRoot = resolve(dirname(mainPath), '../..')
  const manifest = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'))
  const fileUtil = await import(pathToFileURL(join(packageRoot, 'lib/esm/fileUtil.js')).href)
  return { fileUtil, manifest }
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('Puppeteer browser extraction compatibility fork', () => {
  it('resolves the reviewed 2.13.2 fork and eliminates extract-zip', async () => {
    const { manifest } = await resolvedFork()
    const lock = await readFile(new URL('../package-lock.json', import.meta.url), 'utf8')

    expect(manifest.name).toBe('@puppeteer/browsers')
    expect(manifest.version).toBe('2.13.2')
    expect(manifest.dependencies.yauzl).toBe('3.4.0')
    expect(manifest.dependencies).not.toHaveProperty('extract-zip')
    expect(lock).toContain('eslammuatamed/puppeteer-browsers-safe-extract')
    expect(lock).toContain(forkCommit)
  })

  it('extracts a representative compressed browser payload', async () => {
    const { fileUtil } = await resolvedFork()
    const { archive, destination } = await fixture([
      { name: 'chrome-linux64/chrome', data: '#!/bin/sh\necho browser\n' },
      { name: 'chrome-linux64/locales/ar.pak', data: 'arabic locale' },
    ])

    await fileUtil.unpackArchive(archive, destination)

    await expect(readFile(join(destination, 'chrome-linux64/chrome'), 'utf8'))
      .resolves.toBe('#!/bin/sh\necho browser\n')
    await expect(readFile(join(destination, 'chrome-linux64/locales/ar.pak'), 'utf8'))
      .resolves.toBe('arabic locale')
  })

  it('rejects a traversal entry without writing outside the destination', async () => {
    const { fileUtil } = await resolvedFork()
    const { archive, destination, root } = await fixture([
      { name: '../escaped', data: 'must not escape' },
    ])

    await expect(fileUtil.unpackArchive(archive, destination)).rejects.toThrow(/unsafe zip entry path|invalid relative path/i)
    await expect(readFile(join(root, 'escaped'))).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
