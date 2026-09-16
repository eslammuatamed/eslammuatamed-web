import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { createRequire } from 'node:module'
import { afterAll, describe, expect, it } from 'vitest'
import { shutdownAll } from './lib/process-group.mjs'

const require = createRequire(import.meta.url)
const children = []

async function availablePort() {
  const server = createServer()
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : null
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  if (!port) throw new Error('Could not allocate a Prism test port')
  return port
}

async function startPrism() {
  const port = await availablePort()
  const child = spawn('node_modules/.bin/prism', [
    'mock', 'openapi/openapi.json', '--port', String(port)
  ], { stdio: ['ignore', 'pipe', 'pipe'] })
  children.push(child)

  let output = ''
  child.stdout.on('data', chunk => { output += chunk })
  child.stderr.on('data', chunk => { output += chunk })

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Prism did not become ready:\n${output}`)), 15_000)
    const inspect = () => {
      if (output.includes('Prism is listening')) {
        clearTimeout(timeout)
        resolve()
      }
    }
    child.stdout.on('data', inspect)
    child.stderr.on('data', inspect)
    child.once('error', error => {
      clearTimeout(timeout)
      reject(error)
    })
    child.once('exit', (code, signal) => {
      clearTimeout(timeout)
      reject(new Error(`Prism exited before readiness (${code ?? signal}):\n${output}`))
    })
  })

  return `http://127.0.0.1:${port}`
}

afterAll(async () => {
  const survivors = await shutdownAll(children)
  expect(survivors, 'the compatibility spec must reap only the Prism processes it started').toEqual([])
})

describe('Postman Collection with the fixed Faker line', () => {
  it('starts real Prism and preserves representative EN/AR contract responses', { timeout: 25_000 }, async () => {
    const baseUrl = await startPrism()

    for (const [locale, siteName] of [['en', 'Eslam Muatamed'], ['ar', 'إسلام معتمد']]) {
      const response = await fetch(`${baseUrl}/api/v1/settings/site?locale=${locale}`, {
        headers: { Prefer: `example=${locale}` }
      })
      expect(response.status, `${locale} settings response`).toBe(200)
      expect(await response.json()).toMatchObject({
        data: {
          siteName,
          availableLocales: expect.arrayContaining(['en', 'ar'])
        }
      })
    }
  })

  it('constructs and executes every Postman dynamic generator', () => {
    const generators = require('postman-collection/lib/superstring/dynamic-variables')
    const entries = Object.entries(generators)

    expect(entries, 'the check must cover the complete Postman 4.5.0 generator register').toHaveLength(118)
    for (const [name, definition] of entries) {
      expect(definition.generator, `${name} generator`).toBeTypeOf('function')
      expect(definition.generator(), `${name} result`).not.toBeUndefined()
    }

    expect(generators.$randomIP.generator()).toMatch(/^(?:\d{1,3}\.){3}\d{1,3}$/)
    expect(generators.$randomIPV6.generator()).toMatch(/^[0-9a-f:]+$/i)
    expect(generators.$randomCreditCardMask.generator()).toMatch(/^\d{4}$/)

    const latitude = generators.$randomLatitude.generator()
    const longitude = generators.$randomLongitude.generator()
    expect(latitude).toMatch(/^-?\d+\.\d{4}$/)
    expect(longitude).toMatch(/^-?\d+\.\d{4}$/)
    expect(Number(latitude)).toBeGreaterThanOrEqual(-90)
    expect(Number(latitude)).toBeLessThanOrEqual(90)
    expect(Number(longitude)).toBeGreaterThanOrEqual(-180)
    expect(Number(longitude)).toBeLessThanOrEqual(180)

    expect(() => new URL(generators.$randomUrl.generator())).not.toThrow()
    expect(generators.$randomUUID.generator()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    )
    expect(generators.$randomPhoneNumber.generator()).toMatch(/^\d{3}-\d{3}-\d{4}$/)
    expect(generators.$randomBoolean.generator()).toBeTypeOf('boolean')
    expect(generators.$randomInt.generator()).toSatisfy(
      value => Number.isInteger(value) && value >= 0 && value <= 1000
    )
  })
})
