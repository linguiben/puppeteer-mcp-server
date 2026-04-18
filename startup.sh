#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: docker is not installed."
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Error: docker compose is not available."
  exit 1
fi

if ! docker network inspect wp-net >/dev/null 2>&1; then
  echo "Error: docker network 'wp-net' does not exist."
  echo "Create it first or start the nginx stack that provides this shared network."
  exit 1
fi

echo "Starting MCP server with docker compose..."
docker compose up -d --build

echo "Started."
echo "Test page: http://localhost:8001/test/mcp_call_tester.html"
echo "MCP endpoint: http://localhost:8001/mcp/"
