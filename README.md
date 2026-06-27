# Snake

A snake game with smooth motion, a clean emerald UI, and a **persistent file-based leaderboard**. The game is vanilla HTML / CSS / JS, served by a tiny zero-dependency Node server that reads/writes `scores.json` in this folder.

## Quick start

You need Node.js installed (any modern version, ≥ 14). No `npm install`, no build step — the server has no dependencies.

**Foreground (keeps the terminal busy, Ctrl-C to stop):**

```bash
npm start
```

**Background (recommended for everyday play):**

```bash
npm run start:bg     # starts detached, prints the PID & URL
npm run status       # is it running?
npm run logs         # tail the log
npm run stop         # stop it
```

Then open **http://localhost:3000**.

Want a different port?  `PORT=3001 npm run start:bg`  (the same `PORT=` works on `stop` and `status`).

## How scores are stored

| Where | What |
| ----- | ---- |
| `scores.json` (this folder) | The authoritative Top 3 leaderboard. Created on first save. |
| Browser `localStorage` (`snake.leaderboard`) | A cache of the same list, so the leaderboard panel isn't empty if the server happens to be down. |
| Browser `localStorage` (`snake.player`) | Your current player name on this browser (a per-device preference). |

Flow:

1. On page load, the game shows the locally cached leaderboard immediately, then asks the server for the fresh copy and replaces it.
2. When you die, your score is merged into the local cache **optimistically** (UI updates instantly) and POSTed to the server in the background. The server returns the new official Top 3 and the UI syncs to it.
3. The **Clear** button wipes both the local cache and `scores.json`.

So as long as `scores.json` survives, your scores survive — across browser restarts, different browsers, and even different machines if you put this folder on a shared drive or commit it to git.

## API

```
GET    /api/scores            -> [ { name, score, at }, ... ]   (top 3)
POST   /api/scores            -> body: { "name": "...", "score": 12 }
DELETE /api/scores            -> wipes the leaderboard
```

Useful curl snippets:

```bash
curl http://localhost:3000/api/scores
curl -X POST -H "Content-Type: application/json" \
     -d '{"name":"Aman","score":42}' http://localhost:3000/api/scores
curl -X DELETE http://localhost:3000/api/scores
```

## Controls

| Key                              | Action            |
| -------------------------------- | ----------------- |
| `←` `↑` `↓` `→` (or `W A S D`)   | Move the snake    |
| `Space`                          | Play / Pause      |
| `R`                              | Restart           |
| **Change** (top right)           | Switch player     |
| **Clear** (leaderboard header)   | Wipe Top 3        |

Notes:

- Two queued moves are buffered, so quick combos like `→` then `↑` both register.
- The tab auto-pauses when hidden, so you don't lose a run by alt-tabbing.
- Reversing directly into your own neck is blocked.

## Files

```
Snake Game/
├── index.html       # Markup
├── styles.css       # Theme
├── game.js          # Game loop, rendering, input, leaderboard client
├── server.js        # Node static + /api/scores server (zero deps)
├── package.json     # `npm start` / `npm run start:bg` / etc.
├── scripts/
│   ├── start-bg.sh  # detach, save PID + log
│   ├── stop-bg.sh   # kill by PID file, fallback to port
│   └── status.sh    # is the server up?
├── scores.json      # Created automatically by the server on first save
├── server.log       # Background mode log (gitignored)
├── server.pid       # Background mode PID file (gitignored)
└── README.md
```

## Deploy to the public internet (free, on Cloudflare)

This repo ships with a Cloudflare Pages Function at `functions/api/scores.js` that backs the same `/api/scores` endpoints with Cloudflare KV (free tier). Deployment is GitHub → Cloudflare Pages → custom subdomain. See the step-by-step in the chat history (or the deploy notes below):

1. Push this repo to GitHub.
2. Cloudflare dashboard → **Workers & Pages** → **KV** → create a namespace called `snake-scores`.
3. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → pick the repo.
   - Build command: *(leave blank)*
   - Build output directory: `/`
4. After the first deploy: project **Settings** → **Functions** → **KV namespace bindings** → add binding **`SCORES_KV`** → your `snake-scores` namespace → save → **Retry deployment**.
5. Project **Custom domains** → add your subdomain (e.g. `snake.gauravsharma.xyz`) → Cloudflare wires the DNS for you automatically.

Local dev still uses `server.js` and `scores.json`. Production uses the Pages Function and KV. The client `game.js` is identical for both — it just hits `/api/scores`.
