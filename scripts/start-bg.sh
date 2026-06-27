#!/usr/bin/env bash
# Start the Snake server in the background.
# Saves PID to server.pid and logs to server.log in the project root.
set -e

DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"

LOG="$DIR/server.log"
PIDFILE="$DIR/server.pid"
PORT="${PORT:-3000}"

# Already running?
if [ -f "$PIDFILE" ]; then
  EXISTING_PID="$(cat "$PIDFILE")"
  if [ -n "$EXISTING_PID" ] && kill -0 "$EXISTING_PID" 2>/dev/null; then
    echo "Server is already running (PID $EXISTING_PID)."
    echo "  Open:  http://localhost:$PORT/"
    echo "  Stop:  npm run stop"
    exit 0
  fi
  rm -f "$PIDFILE"
fi

# Is the port already taken by something else?
if command -v lsof >/dev/null 2>&1; then
  if lsof -ti ":$PORT" >/dev/null 2>&1; then
    echo "Port $PORT is already in use by another process:"
    lsof -i ":$PORT"
    echo
    echo "Either stop it, or pick a different port:  PORT=3001 npm run start:bg"
    exit 1
  fi
fi

# Start detached: nohup + redirected fds + disown
nohup node server.js > "$LOG" 2>&1 < /dev/null &
PID=$!
disown "$PID" 2>/dev/null || true
echo "$PID" > "$PIDFILE"

# Give it a moment to bind to the port (or fail fast)
sleep 0.5

if kill -0 "$PID" 2>/dev/null; then
  echo "Server started in background."
  echo "  PID:   $PID  (saved to server.pid)"
  echo "  Open:  http://localhost:$PORT/"
  echo "  Logs:  npm run logs   (or: tail -f server.log)"
  echo "  Stop:  npm run stop"
else
  echo "Failed to start. Last lines of $LOG:"
  echo "------------------------------------"
  tail -n 20 "$LOG" 2>/dev/null || echo "(no log)"
  echo "------------------------------------"
  rm -f "$PIDFILE"
  exit 1
fi
