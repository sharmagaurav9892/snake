/**
 * Cloudflare Pages Function — leaderboard backend.
 *
 *   GET    /api/scores  -> top 3
 *   POST   /api/scores  -> { name, score } ; merges and returns top 3
 *   DELETE /api/scores  -> wipes the leaderboard
 *
 * Storage: a single KV key holds the JSON array. The KV namespace must be
 * bound in the Pages project settings as the variable name SCORES_KV.
 *
 * The contract is identical to server.js (the local Node server), so the
 * browser client (game.js) works against either backend without changes.
 */

const MAX_LEADERS = 3;
const KV_KEY = "leaderboard";

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function sanitizeName(raw) {
  if (typeof raw !== "string") return "";
  return raw.replace(/\s+/g, " ").trim().slice(0, 20);
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

async function readLeaders(env) {
  if (!env.SCORES_KV) return [];
  const raw = await env.SCORES_KV.get(KV_KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(isValidEntry).slice(0, MAX_LEADERS);
  } catch (_) {
    return [];
  }
}

async function writeLeaders(env, list) {
  if (!env.SCORES_KV) return;
  await env.SCORES_KV.put(KV_KEY, JSON.stringify(list.slice(0, MAX_LEADERS)));
}

export async function onRequestGet({ env }) {
  return jsonResponse(await readLeaders(env));
}

export async function onRequestPost({ request, env }) {
  let payload;
  try {
    payload = await request.json();
  } catch (_) {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const name = sanitizeName(payload && payload.name);
  const score = Number(payload && payload.score);

  if (!name) return jsonResponse({ error: "Missing name" }, 400);
  if (!Number.isFinite(score) || score < 0 || score > 100000) {
    return jsonResponse({ error: "Invalid score" }, 400);
  }

  const list = await readLeaders(env);
  list.push({ name, score, at: Date.now() });
  list.sort((a, b) => b.score - a.score || a.at - b.at);
  const top = list.slice(0, MAX_LEADERS);
  await writeLeaders(env, top);
  return jsonResponse(top);
}

export async function onRequestDelete({ env }) {
  await writeLeaders(env, []);
  return jsonResponse([]);
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
