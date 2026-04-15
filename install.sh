#!/usr/bin/env bash

set -euo pipefail

REPO_URL="${NOVA_REPO_URL:-https://github.com/ekpangmichael/nova.git}"
TARGET_DIR="${NOVA_INSTALL_DIR:-nova}"
REQUESTED_REF="${NOVA_REF:-}"
SKIP_INSTALL="${NOVA_SKIP_INSTALL:-0}"
SKIP_BOOTSTRAP="${NOVA_SKIP_BOOTSTRAP:-0}"

usage() {
  cat <<'EOF'
Nova installer

Usage:
  ./install.sh [--dir <directory>] [--repo <url>] [--ref <git-ref>] [--skip-install] [--skip-bootstrap]

Examples:
  curl -fsSL https://raw.githubusercontent.com/ekpangmichael/nova/main/install.sh | bash
  curl -fsSL https://raw.githubusercontent.com/ekpangmichael/nova/main/install.sh | bash -s -- --dir my-nova
  curl -fsSL https://raw.githubusercontent.com/ekpangmichael/nova/main/install.sh | bash -s -- --ref v0.1.0
EOF
}

log() {
  printf '%s\n' "$1"
}

fail() {
  printf '\nInstaller failed.\n%s\n' "$1" >&2
  exit 1
}

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "Missing required tool: $1"
  fi
}

ensure_pnpm() {
  if command -v pnpm >/dev/null 2>&1; then
    return
  fi

  if command -v corepack >/dev/null 2>&1; then
    log "Activating pnpm via corepack"
    corepack enable >/dev/null 2>&1 || true
    corepack prepare pnpm@latest --activate >/dev/null 2>&1 || fail "Unable to activate pnpm with corepack."

    if command -v pnpm >/dev/null 2>&1; then
      return
    fi
  fi

  fail "pnpm is required. Install pnpm or ensure corepack is available."
}

looks_like_nova_checkout() {
  local dir="$1"
  [[ -f "$dir/package.json" && -f "$dir/scripts/setup.mjs" ]]
}

resolve_latest_release_tag() {
  git ls-remote --tags "$REPO_URL" 2>/dev/null \
    | awk '{print $2}' \
    | sed 's#refs/tags/##' \
    | grep -Ev '\^\{\}$' \
    | grep -E '^v?[0-9]+\.[0-9]+\.[0-9]+$' \
    | sort -V \
    | tail -n1 || true
}

clone_if_needed() {
  local dir="$1"
  local ref="$2"

  if looks_like_nova_checkout "$dir"; then
    log "Reusing existing Nova checkout in $dir"
    return
  fi

  if [[ -e "$dir" ]]; then
    if [[ -n "$(find "$dir" -mindepth 1 -maxdepth 1 2>/dev/null)" ]]; then
      fail "Target directory $dir already exists and is not empty."
    fi
  else
    mkdir -p "$dir"
  fi

  log "Cloning Nova into $dir"

  if [[ -n "$ref" ]]; then
    log "Using ref $ref"
    git clone --branch "$ref" --depth 1 "$REPO_URL" "$dir"
    return
  fi

  local latest_tag
  latest_tag="$(resolve_latest_release_tag)"

  if [[ -n "$latest_tag" ]]; then
    log "Using latest tagged release $latest_tag"
    git clone --branch "$latest_tag" --depth 1 "$REPO_URL" "$dir"
    return
  fi

  log "No release tags found. Falling back to the repository default branch."
  git clone "$REPO_URL" "$dir"
}

run_bootstrap() {
  local dir="$1"

  if [[ "$SKIP_INSTALL" != "1" ]]; then
    log "Installing dependencies"
    (cd "$dir" && pnpm install)
  fi

  if [[ "$SKIP_BOOTSTRAP" != "1" ]]; then
    log "Bootstrapping local Nova config"
    (cd "$dir" && pnpm setup)
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dir)
      [[ $# -ge 2 ]] || fail "Missing value for --dir"
      TARGET_DIR="$2"
      shift 2
      ;;
    --repo)
      [[ $# -ge 2 ]] || fail "Missing value for --repo"
      REPO_URL="$2"
      shift 2
      ;;
    --ref)
      [[ $# -ge 2 ]] || fail "Missing value for --ref"
      REQUESTED_REF="$2"
      shift 2
      ;;
    --skip-install)
      SKIP_INSTALL="1"
      shift
      ;;
    --skip-bootstrap)
      SKIP_BOOTSTRAP="1"
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      fail "Unknown option: $1"
      ;;
  esac
done

need_cmd git
need_cmd node
ensure_pnpm

clone_if_needed "$TARGET_DIR" "$REQUESTED_REF"
run_bootstrap "$TARGET_DIR"

log ""
log "Nova is ready."
log "Next steps:"
log "  cd $TARGET_DIR"
log "  pnpm dev"

if [[ "$(uname -s)" == "Darwin" ]]; then
  log "  pnpm build && pnpm service:macos:install"
else
  log "  pnpm build && pnpm start"
fi
