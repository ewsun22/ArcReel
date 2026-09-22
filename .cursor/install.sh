#!/usr/bin/env bash
# Cloud Agent bootstrap for ArcReel. Idempotent: safe to re-run.
set -euo pipefail

cd "$(dirname "$0")/.."

export PATH="$HOME/.local/bin:$PATH"

# uv (backend package manager) — install if missing.
if ! command -v uv >/dev/null 2>&1; then
  curl -LsSf https://astral.sh/uv/install.sh | sh
fi

# System deps required by the agent-runtime sandbox and media pipeline.
missing_pkgs=()
for pkg_cmd in bwrap:bubblewrap socat:socat ffmpeg:ffmpeg; do
  cmd="${pkg_cmd%%:*}"
  pkg="${pkg_cmd##*:}"
  command -v "$cmd" >/dev/null 2>&1 || missing_pkgs+=("$pkg")
done
if [ "${#missing_pkgs[@]}" -gt 0 ]; then
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends "${missing_pkgs[@]}"
fi

# Backend dependencies.
uv sync

# Frontend dependencies (pnpm pinned via package.json packageManager).
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
corepack enable >/dev/null 2>&1 || true
(cd frontend && pnpm install --frozen-lockfile)

# Local runtime config (auto-generates AUTH_PASSWORD into .env on first boot).
[ -f .env ] || cp .env.example .env

# Database schema.
uv run alembic upgrade head

echo "ArcReel environment ready."
