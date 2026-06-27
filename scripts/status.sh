#!/usr/bin/env bash
# Report whether the Snake server is running, and where to reach it.
set -e

DIR="$(cd "$(dirname "$0")/.." && pwd)"
PIDFILE="$DIR/server.pid"
PORT="${PORT:-3000}"

running_pid=""

if [ -f "$PIDFILE" ]; then
  PID="$(cat "$PIDFILE")"
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    running_pid="$PID"
  fi
fi

if [ -z "$running_pid" ] && command -v lsof >/dev/null 2>&1; then
  running_pid="$(lsof -ti ":$PORT" 2>/dev/null | head -n 1 || true)"
fi

if [ -n "$running_pid" ]; then
  echo "Server is RUNNING (PID $running_pid)."
  echo "  Open:  http://localhost:$PORT/"
  echo "  Logs:  tail -f server.log"
  echo "  Stop:  npm run stop"
else
  echo "Server is NOT running."
  echo "  Start (foreground):   npm start"
  echo "  Start (background):   npm run start:bg"
fi
