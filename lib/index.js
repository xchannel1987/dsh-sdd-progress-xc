import { readFile, readdir, stat } from "node:fs/promises";
import { zstdDecompressSync } from "node:zlib";
import { join } from "node:path";
import os from "node:os";
import z from "@deepseek-ai/schemastery";
//#region src/index.ts
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
const name = "dsh-sdd-progress-xc";
const inject = ["webServer"];
const Config = z.object({ 
/**
* Optional fallback root for resolving sdd/progress.md when the session
* content carries only a relative path (no drive/root prefix). When empty
* (default), the ledger path comes entirely from the session content.
*/
requirementsRoot: z.string().default("") });
const CANONICAL_GEN_RE = /^session(?:\.v([1-9][0-9]*))?\.jsonl(?:\.zstd)?$/;
function dshHome() {
	const env = process.env.DSH_HOME?.trim();
	if (env !== void 0 && env !== "") return env;
	return join(os.homedir(), ".dsh");
}
function sessionsRoot() {
	return join(dshHome(), "sessions");
}
async function findLatestLog(dir) {
	let entries;
	try {
		entries = await readdir(dir);
	} catch {
		return null;
	}
	let best = null;
	for (const name of entries) {
		const m = CANONICAL_GEN_RE.exec(name);
		if (!m) continue;
		const version = m[1] === void 0 ? 0 : Number(m[1]);
		const isZstd = name.endsWith(".zstd");
		if (!best || version > best.version) best = {
			path: join(dir, name),
			zstd: isZstd,
			version
		};
	}
	return best;
}
/** Locate a canonical session log within one session directory. */
async function findLatestLogIn(sessPath) {
	const log = await findLatestLog(sessPath);
	return log ? {
		logPath: log.path,
		zstd: log.zstd
	} : null;
}
/**
* Find a session's canonical log by session id (or its encoded directory).
* If the session id is not found as a directory name, falls back to the most
* recently modified session.
*/
async function findSessionById(sessionId) {
	const root = sessionsRoot();
	let projectDirs;
	try {
		projectDirs = await readdir(root);
	} catch {
		return null;
	}
	for (const proj of projectDirs) {
		const projPath = join(root, proj);
		try {
			if (!(await stat(projPath)).isDirectory()) continue;
		} catch {
			continue;
		}
		let sessionDirs;
		try {
			sessionDirs = await readdir(projPath);
		} catch {
			continue;
		}
		for (const sess of sessionDirs) if (sess === sessionId) {
			const found = await findLatestLogIn(join(projPath, sess));
			if (found) return found;
		}
	}
	return null;
}
/**
* Walk all session directories and find the most recently modified session log.
* Returns the log path and whether it is zstd-compressed.
*/
async function findMostRecentSession() {
	const root = sessionsRoot();
	let projectDirs;
	try {
		projectDirs = await readdir(root);
	} catch {
		return null;
	}
	let best = null;
	for (const proj of projectDirs) {
		const projPath = join(root, proj);
		try {
			if (!(await stat(projPath)).isDirectory()) continue;
		} catch {
			continue;
		}
		let sessionDirs;
		try {
			sessionDirs = await readdir(projPath);
		} catch {
			continue;
		}
		for (const sess of sessionDirs) {
			const log = await findLatestLog(join(projPath, sess));
			if (!log) continue;
			try {
				const logStat = await stat(log.path);
				if (!best || logStat.mtimeMs > best.mtime) best = {
					logPath: log.path,
					zstd: log.zstd,
					mtime: logStat.mtimeMs
				};
			} catch {
				continue;
			}
		}
	}
	return best ? {
		logPath: best.logPath,
		zstd: best.zstd
	} : null;
}
/**
* Scan requirements root for the most recently modified sdd/progress.md.
* Returns the requirement name and the ledger markdown.
*/
/** Zstandard frame magic (`28 B5 2F FD` as little-endian u32). */
const ZSTD_MAGIC = 4247762216;
/**
* Locate all complete zstd frames in a buffer (DSH session logs are
* multi-frame containers: frame 0 = the one-line header, following frames =
* event batches, possibly a torn tail frame at EOF).
* Ported from dsh-session-xc / official dsh-session-persistence-jsonl.
*/
function scanZstdFrames(buffer) {
	const frames = [];
	let offset = 0;
	while (offset < buffer.length) {
		const start = offset;
		if (buffer.length - offset < 4) return {
			frames,
			tornStart: start
		};
		if (buffer.readUInt32LE(offset) !== ZSTD_MAGIC) throw new Error("corrupt Zstandard session log: invalid frame magic at byte " + offset);
		offset += 4;
		if (offset === buffer.length) return {
			frames,
			tornStart: start
		};
		const descriptor = buffer.readUInt8(offset);
		offset += 1;
		if ((descriptor & 24) !== 0) throw new Error("corrupt Zstandard session log: reserved frame-header bit");
		const contentSizeFlag = descriptor >>> 6;
		const singleSegment = (descriptor & 32) !== 0;
		const checksum = (descriptor & 4) !== 0;
		const dictionaryFlag = descriptor & 3;
		const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag;
		const contentSizeBytes = contentSizeFlag === 0 ? singleSegment ? 1 : 0 : 1 << contentSizeFlag;
		const remainingHeaderBytes = (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes;
		if (buffer.length - offset < remainingHeaderBytes) return {
			frames,
			tornStart: start
		};
		offset += remainingHeaderBytes;
		for (;;) {
			if (buffer.length - offset < 3) return {
				frames,
				tornStart: start
			};
			const blockHeader = buffer.readUIntLE(offset, 3);
			offset += 3;
			const lastBlock = (blockHeader & 1) !== 0;
			const blockType = blockHeader >>> 1 & 3;
			const blockSize = blockHeader >>> 3;
			if (blockType === 3) throw new Error("corrupt Zstandard session log: reserved block type");
			const payloadBytes = blockType === 1 ? 1 : blockSize;
			if (buffer.length - offset < payloadBytes) return {
				frames,
				tornStart: start
			};
			offset += payloadBytes;
			if (lastBlock) break;
		}
		if (checksum) {
			if (buffer.length - offset < 4) return {
				frames,
				tornStart: start
			};
			offset += 4;
		}
		frames.push({
			start,
			end: offset
		});
	}
	return { frames };
}
/**
* Read a session log, decompressing every zstd frame (one-shot
* zstdDecompressSync only yields the FIRST frame = the header line, so it
* cannot surface event data). Torn tail frames are dropped silently.
*/
async function readSessionLog(logPath, isZstd) {
	const buf = await readFile(logPath);
	if (!isZstd) return buf.toString("utf-8");
	try {
		const { frames } = scanZstdFrames(buf);
		let out = "";
		for (const frame of frames) try {
			out += zstdDecompressSync(buf.subarray(frame.start, frame.end)).toString("utf-8");
		} catch {}
		return out;
	} catch {
		return "";
	}
}
function parseSessionContent(content) {
	const lines = content.split("\n").filter((l) => l.trim());
	let cwd = "";
	let sessionId = "";
	let todos = [];
	for (const line of lines) try {
		const event = JSON.parse(line);
		if (event.type === "session" && event.cwd) {
			cwd = event.cwd;
			sessionId = event.id || "";
		}
		if (event.type === "todo/write" && event.data?.todos) todos = event.data.todos;
	} catch {}
	return {
		cwd,
		sessionId,
		todos
	};
}
/**
* Scan the session's own content (tool args, message text) for
* "<root>/<name>/sdd/progress.md" path references, which SDD workflows write
* continuously. Root-agnostic: any enclosing directory works (no hard-coded
* "requirements" root). Returns the most frequently referenced requirement.
*/
function extractRequirementFromContent(content) {
	const re = /((?:[A-Za-z]:)?[\\/][^"'`\s]*?[\\/])([^\\/"'`\s]+)[\\/]sdd[\\/]progress\.md/g;
	const counts = /* @__PURE__ */ new Map();
	let m;
	while ((m = re.exec(content)) !== null) {
		const root = m[1];
		const name = m[2];
		if (!name || !root || name === "sdd") continue;
		const cur = counts.get(name);
		if (cur) cur.count++;
		else counts.set(name, {
			count: 1,
			root
		});
	}
	let bestName = null;
	let bestRoot = "";
	let bestCount = 0;
	for (const [name, info] of counts) if (info.count > bestCount) {
		bestName = name;
		bestRoot = info.root;
		bestCount = info.count;
	}
	if (!bestName) return null;
	const sep = bestRoot.includes("/") ? "/" : "\\";
	const ledgerPath = bestRoot + bestName + sep + "sdd" + sep + "progress.md";
	return {
		requirementName: bestName,
		ledgerPath
	};
}
function json(res, status, payload) {
	res.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"cache-control": "no-store",
		"access-control-allow-origin": "*"
	});
	res.end(JSON.stringify(payload));
}
const BASE = "/api/dsh-sdd-progress-xc";
function apply(ctx, config) {
	ctx.effect(() => ctx.webServer.register({
		kind: "prefix",
		path: BASE,
		handler: async (req, res) => {
			const url = new URL(req.url ?? "/", "http://x");
			const sub = url.pathname.slice(24).replace(/\/+$/, "") || "/";
			try {
				if (sub === "/health" && req.method === "GET") return json(res, 200, {
					ok: true,
					plugin: "dsh-sdd-progress-xc",
					version: "0.1.7"
				});
				if (sub === "/progress" && req.method === "GET") {
					const sessionIdParam = url.searchParams.get("sessionId");
					const session = sessionIdParam ? await findSessionById(sessionIdParam) ?? await findMostRecentSession() : await findMostRecentSession();
					if (!session) return json(res, 404, {
						ok: false,
						error: "no session found"
					});
					const content = await readSessionLog(session.logPath, session.zstd);
					if (!content) return json(res, 500, {
						ok: false,
						error: "failed to read session log"
					});
					let { cwd, sessionId, todos } = parseSessionContent(content);
					if (sessionIdParam) sessionId = sessionIdParam;
					const hit = extractRequirementFromContent(content);
					const requirementName = hit?.requirementName || "none";
					let ledger = "";
					if (hit) {
						const ledgerPath = hit.ledgerPath.startsWith(".") || !/[A-Za-z]:[\/]/.test(hit.ledgerPath) ? config.requirementsRoot ? join(config.requirementsRoot, hit.ledgerPath) : "" : hit.ledgerPath;
						if (ledgerPath) try {
							ledger = await readFile(ledgerPath, "utf-8");
						} catch {
							ledger = "";
						}
					}
					return json(res, 200, {
						ok: true,
						sessionId,
						requirementName,
						cwd,
						todos,
						ledger
					});
				}
				json(res, 404, {
					ok: false,
					error: "no dsh-sdd-progress-xc endpoint " + sub
				});
			} catch (e) {
				json(res, 500, {
					ok: false,
					error: e instanceof Error ? e.message : String(e)
				});
			}
		}
	}), "dsh-sdd-progress-xc: http routes");
}
/**
* Scan the session's own content (tool args, message text) for
* "<root>/<name>/sdd/progress.md" path references, which SDD workflows write
* continuously. Root-agnostic: any enclosing directory works (no hard-coded
* "requirements" root). Returns the most frequently referenced requirement.
*/
function extractRequirementFromContent(content) {
	const re = /((?:[A-Za-z]:)?[\\/][^"'`\s]*?[\\/])([^\\/"'`\s]+)[\\/]sdd[\\/]progress\.md/g;
	const counts = /* @__PURE__ */ new Map();
	let m;
	while ((m = re.exec(content)) !== null) {
		const root = m[1];
		const name = m[2];
		if (!name || !root || name === "sdd") continue;
		const cur = counts.get(name);
		if (cur) cur.count++;
		else counts.set(name, {
			count: 1,
			root
		});
	}
	let bestName = null;
	let bestRoot = "";
	let bestCount = 0;
	for (const [name, info] of counts) if (info.count > bestCount) {
		bestName = name;
		bestRoot = info.root;
		bestCount = info.count;
	}
	if (!bestName) return null;
	const sep = bestRoot.includes("/") ? "/" : "\\";
	const ledgerPath = bestRoot + bestName + sep + "sdd" + sep + "progress.md";
	return {
		requirementName: bestName,
		ledgerPath
	};
}
//#endregion
export { Config, apply, inject, name };
