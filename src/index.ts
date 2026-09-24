/**
 * dsh-sdd-progress-xc — host half.
 *
 * Serves SDD progress data (todos + ledger) to the client tab.
 *
 * Endpoints:
 *   GET /api/dsh-sdd-progress-xc/progress
 *     Returns { todos, ledger, requirementName, sessionId } for the most
 *     recently active session.
 *   GET /api/dsh-sdd-progress-xc/health
 *     Liveness probe.
 *
 * @module dsh-sdd-progress-xc
 */

import { readdir, readFile, stat } from 'node:fs/promises'
import { zstdDecompressSync } from 'node:zlib'
import { join } from 'node:path'
import os from 'node:os'
import { createRequire } from 'node:module'
import z from '@deepseek-ai/schemastery'

/** Plugin version, read from package.json so /health can report it. */
const require = createRequire(import.meta.url)
const PLUGIN_VERSION = (require('../package.json') as { version?: string }).version ?? '0.0.0'

export const name = 'dsh-sdd-progress-xc'
export const inject = ['webServer']

export interface Config {
  requirementsRoot: string
}

export const Config: z<Config> = z.object({
  /**
   * Optional fallback root for resolving sdd/progress.md when the session
   * content carries only a relative path (no drive/root prefix). When empty
   * (default), the ledger path comes entirely from the session content.
   */
  requirementsRoot: z.string().default(''),
})

const CANONICAL_GEN_RE = /^session(?:\.v([1-9][0-9]*))?\.jsonl(?:\.zstd)?$/

function dshHome(): string {
  const env = process.env.DSH_HOME?.trim()
  if (env !== undefined && env !== '') return env
  return join(os.homedir(), '.dsh')
}

function sessionsRoot(): string {
  return join(dshHome(), 'sessions')
}

async function findLatestLog(dir: string): Promise<{ path: string; zstd: boolean; version: number } | null> {
  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch {
    return null
  }
  let best: { path: string; zstd: boolean; version: number } | null = null
  for (const name of entries) {
    const m = CANONICAL_GEN_RE.exec(name)
    if (!m) continue
    const version = m[1] === undefined ? 0 : Number(m[1])
    const isZstd = name.endsWith('.zstd')
    if (!best || version > best.version) {
      best = { path: join(dir, name), zstd: isZstd, version }
    }
  }
  return best
}

/** Locate a canonical session log within one session directory. */
async function findLatestLogIn(sessPath: string): Promise<{ logPath: string; zstd: boolean } | null> {
  const log = await findLatestLog(sessPath)
  return log ? { logPath: log.path, zstd: log.zstd } : null
}

/**
 * Find a session's canonical log by session id (or its encoded directory).
 * If the session id is not found as a directory name, falls back to the most
 * recently modified session.
 */
async function findSessionById(sessionId: string): Promise<{ logPath: string; zstd: boolean } | null> {
  const root = sessionsRoot()
  let projectDirs: string[]
  try {
    projectDirs = await readdir(root)
  } catch {
    return null
  }
  for (const proj of projectDirs) {
    const projPath = join(root, proj)
    try {
      const projStat = await stat(projPath)
      if (!projStat.isDirectory()) continue
    } catch { continue }
    let sessionDirs: string[]
    try {
      sessionDirs = await readdir(projPath)
    } catch { continue }
    for (const sess of sessionDirs) {
      if (sess === sessionId) {
        const found = await findLatestLogIn(join(projPath, sess))
        if (found) return found
      }
    }
  }
  return null
}

/**
 * Walk all session directories and find the most recently modified session log.
 * Returns the log path and whether it is zstd-compressed.
 */
async function findMostRecentSession(): Promise<{ logPath: string; zstd: boolean } | null> {
  const root = sessionsRoot()
  let projectDirs: string[]
  try {
    projectDirs = await readdir(root)
  } catch {
    return null
  }
  let best: { logPath: string; zstd: boolean; mtime: number } | null = null
  for (const proj of projectDirs) {
    const projPath = join(root, proj)
    try {
      const projStat = await stat(projPath)
      if (!projStat.isDirectory()) continue
    } catch { continue }
    let sessionDirs: string[]
    try {
      sessionDirs = await readdir(projPath)
    } catch { continue }
    for (const sess of sessionDirs) {
      const sessPath = join(projPath, sess)
      const log = await findLatestLog(sessPath)
      if (!log) continue
      try {
        const logStat = await stat(log.path)
        if (!best || logStat.mtimeMs > best.mtime) {
          best = { logPath: log.path, zstd: log.zstd, mtime: logStat.mtimeMs }
        }
      } catch { continue }
    }
  }
  return best ? { logPath: best.logPath, zstd: best.zstd } : null
}

/**
 * Scan requirements root for the most recently modified sdd/progress.md.
 * Returns the requirement name and the ledger markdown.
 */
/** Zstandard frame magic (`28 B5 2F FD` as little-endian u32). */
const ZSTD_MAGIC = 4247762216

/**
 * Locate all complete zstd frames in a buffer (DSH session logs are
 * multi-frame containers: frame 0 = the one-line header, following frames =
 * event batches, possibly a torn tail frame at EOF).
 * Ported from dsh-session-xc / official dsh-session-persistence-jsonl.
 */
function scanZstdFrames(buffer: Buffer): { frames: { start: number; end: number }[]; tornStart?: number } {
  const frames: { start: number; end: number }[] = []
  let offset = 0
  while (offset < buffer.length) {
    const start = offset
    if (buffer.length - offset < 4) return { frames, tornStart: start }
    if (buffer.readUInt32LE(offset) !== ZSTD_MAGIC) {
      throw new Error('corrupt Zstandard session log: invalid frame magic at byte ' + offset)
    }
    offset += 4
    if (offset === buffer.length) return { frames, tornStart: start }
    const descriptor = buffer.readUInt8(offset)
    offset += 1
    if ((descriptor & 24) !== 0) throw new Error('corrupt Zstandard session log: reserved frame-header bit')
    const contentSizeFlag = descriptor >>> 6
    const singleSegment = (descriptor & 32) !== 0
    const checksum = (descriptor & 4) !== 0
    const dictionaryFlag = descriptor & 3
    const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag
    const contentSizeBytes = contentSizeFlag === 0 ? (singleSegment ? 1 : 0) : 1 << contentSizeFlag
    const remainingHeaderBytes = (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes
    if (buffer.length - offset < remainingHeaderBytes) return { frames, tornStart: start }
    offset += remainingHeaderBytes
    for (;;) {
      if (buffer.length - offset < 3) return { frames, tornStart: start }
      const blockHeader = buffer.readUIntLE(offset, 3)
      offset += 3
      const lastBlock = (blockHeader & 1) !== 0
      const blockType = (blockHeader >>> 1) & 3
      const blockSize = blockHeader >>> 3
      if (blockType === 3) throw new Error('corrupt Zstandard session log: reserved block type')
      const payloadBytes = blockType === 1 ? 1 : blockSize
      if (buffer.length - offset < payloadBytes) return { frames, tornStart: start }
      offset += payloadBytes
      if (lastBlock) break
    }
    if (checksum) {
      if (buffer.length - offset < 4) return { frames, tornStart: start }
      offset += 4
    }
    frames.push({ start, end: offset })
  }
  return { frames }
}

/**
 * Read a session log, decompressing every zstd frame (one-shot
 * zstdDecompressSync only yields the FIRST frame = the header line, so it
 * cannot surface event data). Torn tail frames are dropped silently.
 */
async function readSessionLog(logPath: string, isZstd: boolean): Promise<string> {
  const buf = await readFile(logPath)
  if (!isZstd) {
    return buf.toString('utf-8')
  }
  try {
    const { frames } = scanZstdFrames(buf)
    let out = ''
    for (const frame of frames) {
      try {
        out += zstdDecompressSync(buf.subarray(frame.start, frame.end)).toString('utf-8')
      } catch {
        // skip a frame we cannot decode; never fail the whole read for it
      }
    }
    return out
  } catch {
    return ''
  }
}

interface TodoItem {
  content: string
  status: 'pending' | 'in_progress' | 'completed'
}

function parseSessionContent(content: string): { cwd: string; sessionId: string; todos: TodoItem[] } {
  const lines = content.split('\n').filter(l => l.trim())
  let cwd = ''
  let sessionId = ''
  let todos: TodoItem[] = []

  for (const line of lines) {
    try {
      const event = JSON.parse(line)
      if (event.type === 'session' && event.cwd) {
        cwd = event.cwd
        sessionId = event.id || ''
      }
      if (event.type === 'todo/write' && event.data?.todos) {
        todos = event.data.todos
      }
    } catch {
      // skip malformed lines
    }
  }

  return { cwd, sessionId, todos }
}

/**
 * Derive the requirement name from the session cwd. Convention: requirement
 * sessions run with their workspace inside a "requirements/<name>" directory,
 * so the segment right after "requirements" identifies the active requirement.
 */
function extractRequirementName(cwd: string | undefined): string | null {
  if (!cwd) return null
  const m = cwd.match(/requirements[\\/](.+?)(?:[\\/]|$)/)
  return m ? (m[1] ?? null) : null
}

/**
 * Scan the session's own content (tool args, message text) for
 * "<root>/<name>/sdd/progress.md" path references, which SDD workflows write
 * continuously. Root-agnostic: any enclosing directory works (no hard-coded
 * "requirements" root). Returns the most frequently referenced requirement.
 */
function extractRequirementFromContent(content: string): { requirementName: string; ledgerPath: string } | null {
  // Match <root>/<name>/sdd/progress.md with any root prefix (drive letter
  // optional), accepting both / and \ separators.
  const re = /((?:[A-Za-z]:)?[\\/][^"'`\s]*?[\\/])([^\\/"'`\s]+)[\\/]sdd[\\/]progress\.md/g
  const counts = new Map<string, { count: number; root: string }>()
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    const root = m[1]
    const name = m[2]
    if (!name || !root || name === 'sdd') continue
    const cur = counts.get(name)
    if (cur) cur.count++
    else counts.set(name, { count: 1, root })
  }
  let bestName: string | null = null
  let bestRoot = ''
  let bestCount = 0
  for (const [name, info] of counts) {
    if (info.count > bestCount) {
      bestName = name
      bestRoot = info.root
      bestCount = info.count
    }
  }
  if (!bestName) return null
  // Normalize separators to the platform default for reading.
  const sep = bestRoot.includes('/') ? '/' : '\\'
  const ledgerPath = bestRoot + bestName + sep + 'sdd' + sep + 'progress.md'
  return { requirementName: bestName, ledgerPath }
}

function json(res: import('node:http').ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
  })
  res.end(JSON.stringify(payload))
}

const BASE = '/api/dsh-sdd-progress-xc'

export function apply(ctx: any, config: Config): void {
  // Routes via ctx.webServer.register (prefix match), the canonical DSH plugin
  // pattern — ctx.webServer.app does not exist. See dsh-power-xc.
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: BASE,
    handler: async (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => {
      const url = new URL(req.url ?? '/', 'http://x')
      const sub = url.pathname.slice(BASE.length).replace(/\/+$/, '') || '/'
      try {
        if (sub === '/health' && req.method === 'GET') {
          return json(res, 200, { ok: true, plugin: 'dsh-sdd-progress-xc', version: PLUGIN_VERSION })
        }
        if (sub === '/progress' && req.method === 'GET') {
          // Optional ?sessionId= targets a specific session; otherwise the
          // most recently active one wins.
          const sessionIdParam = url.searchParams.get('sessionId')
          const session = sessionIdParam
            ? (await findSessionById(sessionIdParam) ?? await findMostRecentSession())
            : await findMostRecentSession()
          if (!session) {
            return json(res, 404, { ok: false, error: 'no session found' })
          }
          const content = await readSessionLog(session.logPath, session.zstd)
          if (!content) {
            return json(res, 500, { ok: false, error: 'failed to read session log' })
          }
          let { cwd, sessionId, todos } = parseSessionContent(content)
          if (sessionIdParam) sessionId = sessionIdParam
          // Requirement resolution: scan the session's OWN content (tool args,
          // message text) for "<root>/<name>/sdd/progress.md" references, which
          // SDD workflows write continuously. Root-agnostic — no hard-coded
          // directory name; the ledger is read from the exact path referenced
          // in the session. On relative-path hits, config.requirementsRoot is
          // used as an optional fallback prefix.
          const hit = extractRequirementFromContent(content)
          const requirementName = hit?.requirementName || 'none'
          let ledger = ''
          if (hit) {
            const ledgerPath = hit.ledgerPath.startsWith('.') || !/[A-Za-z]:[\/]/.test(hit.ledgerPath)
              ? (config.requirementsRoot ? join(config.requirementsRoot, hit.ledgerPath) : '')
              : hit.ledgerPath
            if (ledgerPath) {
              try {
                ledger = await readFile(ledgerPath, 'utf-8')
              } catch {
                ledger = ''
              }
            }
          }
          return json(res, 200, {
            ok: true,
            sessionId,
            requirementName,
            cwd,
            todos,
            ledger,
          })
        }
        json(res, 404, { ok: false, error: 'no dsh-sdd-progress-xc endpoint ' + sub })
      } catch (e) {
        json(res, 500, { ok: false, error: e instanceof Error ? e.message : String(e) })
      }
    },
  }), 'dsh-sdd-progress-xc: http routes')
}
