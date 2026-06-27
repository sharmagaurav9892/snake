/**
 * Snake game server.
 * Zero dependencies — uses only built-in Node modules.
 *
 *   GET    /api/scores  -> returns the leaderboard JSON
 *   POST   /api/scores  -> body: { name, score } ; adds & keeps top 3
 *   DELETE /api/scores  -> wipes the leaderboard
 *
 * Static files (index.html, styles.css, game.js) are served from this folder.
 * Scores are persisted to ./scores.json in the project root.
 */

"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const SCORES_FILE = path.join(ROOT, "scores.json");
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "localhost";
const MAX_LEADERS = 3;
const MAX_BODY_BYTES = 4 * 1024; // 4KB is plenty for a score payload

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg":  "image/svg+xml",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico":  "image/x-icon",
  ".map":  "application/json; charset=utf-8",
};

// ---------- Scores: read / write ----------

function readScoresSync() {
  try {
    const raw = fs.readFileSync(SCORES_FILE, "utf8");
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(isValidEntry).slice(0, MAX_LEADERS);
  } catch (_) {
    return [];
  }
}

// Serialize writes so simultaneous submissions don't clobber each other.
let writeChain = Promise.resolve();
function writeScores(arr) {
  writeChain = writeChain
    .catch(() => {}) // swallow previous error so the chain doesn't lock up
    .then(() => fs.promises.writeFile(
      SCORES_FILE,
      JSON.stringify(arr, null, 2),
      "utf8"
    ));
  return writeChain;
}

function isValidEntry(e) {
  return (
    e &&
    typeof e === "object" &&
    typeof e.name === "string" &&
    typeof e.score === "number" &&
    Number.isFinite(e.score) &&
    e.score >= 0
  );
}

function sanitizeName(raw) {
  if (typeof raw !== "string") return "";
  return raw.replace(/\s+/g, " ").trim().slice(0, 20);
}

// ---------- HTTP helpers ----------

function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(data),
    "Cache-Control": "no-store",
  });
  res.end(data);
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        reject(new Error("Payload too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function safeStaticPath(urlPath) {
  // Decode and strip query/hash, default to index.html
  let p = decodeURIComponent(urlPath.split("?")[0].split("#")[0]);
  if (p === "/" || p === "") p = "/index.html";
  // Resolve and ensure it stays inside ROOT (no path traversal)
  const resolved = path.resolve(ROOT, "." + p);
  if (!resolved.startsWith(ROOT + path.sep) && resolved !== ROOT) {
    return null;
  }
  return resolved;
}

// ---------- Server ----------

const server = http.createServer(async (req, res) => {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = req.url || "/";

  // ----- API -----
  if (url.startsWith("/api/scores")) {
    try {
      if (req.method === "GET") {
        return sendJson(res, 200, readScoresSync());
      }

      if (req.method === "POST") {
        const raw = await readBody(req);
        let payload;
        try { payload = JSON.parse(raw || "{}"); }
        catch { return sendJson(res, 400, { error: "Invalid JSON" }); }

        const name = sanitizeName(payload.name);
        const score = Number(payload.score);

        if (!name) return sendJson(res, 400, { error: "Missing name" });
        if (!Number.isFinite(score) || score < 0 || score > 100000) {
          return sendJson(res, 400, { error: "Invalid score" });
        }

        const list = readScoresSync();
        list.push({ name, score, at: Date.now() });
        list.sort((a, b) => b.score - a.score || a.at - b.at);
        const top = list.slice(0, MAX_LEADERS);
        await writeScores(top);
        return sendJson(res, 200, top);
      }

      if (req.method === "DELETE") {
        await writeScores([]);
        return sendJson(res, 200, []);
      }

      res.writeHead(405, { Allow: "GET, POST, DELETE" });
      return res.end();
    } catch (err) {
      console.error("API error:", err);
      return sendJson(res, 500, { error: "Server error" });
    }
  }

  // ----- Static files -----
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" });
    return res.end();
  }

  const filePath = safeStaticPath(url);
  if (!filePath) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Not found");
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Content-Length": stat.size,
      "Cache-Control": "no-cache",
    });
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`\n  Snake server is up.`);
  console.log(`  Open  ->  http://${HOST}:${PORT}/`);
  console.log(`  Scores file: ${SCORES_FILE}`);
  if (!fs.existsSync(SCORES_FILE)) {
    console.log(`  (scores.json will be created on the first save.)\n`);
  } else {
    console.log("");
  }
});

// Graceful shutdown
function shutdown() {
  console.log("\nShutting down...");
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 3000).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
