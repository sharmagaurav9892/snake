#!/usr/bin/env bash
# Stop the Snake server started by start-bg.sh.
# Falls back to finding the process by port if the PID file is missing.
set -e

DIR="$(cd "$(dirname "$0")/.." && pwd)"
PIDFILE="$DIR/server.pid"
PORT="${PORT:-3000}"

stopped_one=0

# 1) Try the PID file first
if [ -f "$PIDFILE" ]; then
  PID="$(cat "$PIDFILE")"
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    kill "$PID"
    # Wait for graceful exit, then force-kill if needed
    for _ in 1 2 3 4 5; do
      if kill -0 "$PID" 2>/dev/null; then sleep 0.2; else break; fi
    done
    if kill -0 "$PID" 2>/dev/null; then
      kill -9 "$PID" 2>/dev/null || true
    fi
    echo "Stopped server (PID $PID)."
    stopped_one=1
  else
    echo "PID file is stale (process $PID not running). Cleaning up."
  fi
  rm -f "$PIDFILE"
fi

# 2) Fallback: anyone still listening on the port?
if command -v lsof >/dev/null 2>&1; then
  PORT_PIDS="$(lsof -ti ":$PORT" 2>/dev/null || true)"
  if [ -n "$PORT_PIDS" ]; then
    echo "Found process(es) still on port $PORT: $PORT_PIDS"
    for p in $PORT_PIDS; do
      kill "$p" 2>/dev/null || true
    done
    sleep 0.3
    PORT_PIDS_AFTER="$(lsof -ti ":$PORT" 2>/dev/null || true)"
    if [ -n "$PORT_PIDS_AFTER" ]; then
      for p in $PORT_PIDS_AFTER; do
        kill -9 "$p" 2>/dev/null || true
      done
    fi
    echo "Stopped."
    stopped_one=1
  fi
fi

if [ "$stopped_one" -eq 0 ]; then
  echo "No server appears to be running on port $PORT."
fi
