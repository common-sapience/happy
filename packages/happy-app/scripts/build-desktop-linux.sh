#!/usr/bin/env bash

# Builds the Linux desktop package in a container so the host needs nothing but
# Docker, and so the package links against the oldest distribution it targets
# (DESK-09, TD-07).
#
# Inputs:
#   ENGINE_REPO                    checkout of the engine fork at the pinned commit (required)
#   EXPO_PUBLIC_HAPPY_SERVER_URL   relay baked into the web app; unset ships a package that asks on first launch
#   CARGO_WORK_DIR                 where the Rust build writes (default /var/tmp/harness-tauri)
#   BUNDLES                        Tauri bundle list (default deb,appimage)
#
# The baked address reaches the web app only. The Rust shell compiles no relay
# address: the app resolves one and hands it to the daemon (HOST-14, T-30).

set -euo pipefail

app_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repo_root="$(cd "${app_dir}/../.." && pwd)"
image_tag="happy-desktop-linux-build"
cargo_work_dir="${CARGO_WORK_DIR:-/var/tmp/harness-tauri}"
bundles="${BUNDLES:-deb,appimage}"

if [[ -z "${ENGINE_REPO:-}" ]]; then
  echo "ENGINE_REPO must point at a checkout of the engine fork" >&2
  exit 1
fi
engine_repo="$(cd "${ENGINE_REPO}" && pwd)"

# The engine build names its version after the checked-out branch. Git is asked
# here, on the host, because a worktree's git directory is outside the checkout
# and therefore not visible inside the container.
engine_channel="$(git -C "${engine_repo}" branch --show-current)"
if [[ -z "${engine_channel}" ]]; then
  engine_channel="$(git -C "${engine_repo}" rev-parse --short HEAD)"
fi

mkdir -p "${cargo_work_dir}/cargo-home" "${cargo_work_dir}/target"

docker build \
  -f "${app_dir}/src-tauri/docker/Dockerfile.linux-build" \
  -t "${image_tag}" \
  "${app_dir}/src-tauri/docker"

docker run --rm \
  -v "${repo_root}:/workspace" \
  -v "${engine_repo}:/engine" \
  -v "${cargo_work_dir}/cargo-home:/cargo-home" \
  -v "${cargo_work_dir}/target:/target" \
  -e CARGO_HOME=/cargo-home \
  -e CARGO_TARGET_DIR=/target \
  -e ENGINE_REPO=/engine \
  -e OPENCODE_CHANNEL="${engine_channel}" \
  -e EXPO_PUBLIC_HAPPY_SERVER_URL="${EXPO_PUBLIC_HAPPY_SERVER_URL:-}" \
  -e CI=true \
  -e HOME=/tmp/build-home \
  -u "$(id -u):$(id -g)" \
  -w /workspace/packages/happy-app \
  "${image_tag}" \
  bash -lc "
    set -euo pipefail
    mkdir -p \"\$HOME\"
    node scripts/stage-sidecars.mjs --engine-repo /engine
    pnpm exec tauri build --bundles ${bundles}
    mkdir -p src-tauri/target/release
    rm -rf src-tauri/target/release/bundle
    cp -r /target/release/bundle src-tauri/target/release/bundle
  "

echo
echo "Bundles in ${app_dir}/src-tauri/target/release/bundle:"
find "${app_dir}/src-tauri/target/release/bundle" -maxdepth 2 -type f \
  \( -name '*.deb' -o -name '*.AppImage' -o -name '*.rpm' \) -printf '%p  %s bytes\n' 2>/dev/null || true
