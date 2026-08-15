#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:-1.0.2}"
TAG="v${VERSION#v}"
BRANCH="${RELEASE_BRANCH:-enterprise/foundation-v2}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

command -v git >/dev/null || { echo "git is required" >&2; exit 1; }
command -v gh >/dev/null || { echo "GitHub CLI (gh) is required" >&2; exit 1; }

gh auth status >/dev/null 2>&1 || {
  echo "GitHub CLI is not authenticated. Run: gh auth login" >&2
  exit 2
}

[[ -f .github/workflows/windows-release.yml ]] || {
  echo "Missing .github/workflows/windows-release.yml; refusing to publish." >&2
  exit 3
}
[[ -f electron/main.cjs && -f electron/preload.cjs ]] || {
  echo "Missing Electron entrypoints; refusing to publish." >&2
  exit 3
}
[[ -f scripts/build-windows.mjs ]] || {
  echo "Missing Windows build script; refusing to publish." >&2
  exit 3
}

PKG_VERSION="$(node -p "require('./package.json').version")"
[[ "$PKG_VERSION" == "${TAG#v}" ]] || {
  echo "package.json version ${PKG_VERSION} does not match ${TAG}." >&2
  exit 4
}

git diff --check
git status --short

git switch "$BRANCH"
git add package.json pnpm-lock.yaml .github/workflows electron scripts server client drizzle shared
if ! git diff --cached --quiet; then
  git commit -m "chore: prepare PipeFlow Pro ${TAG}"
fi

REMOTE_SHA="$(git ls-remote --heads origin "refs/heads/${BRANCH}" | awk '{print $1}')"
if [[ -n "$REMOTE_SHA" ]]; then
  git push --force-with-lease="refs/heads/${BRANCH}:${REMOTE_SHA}" -u origin "$BRANCH"
else
  git push -u origin "$BRANCH"
fi
if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "Tag ${TAG} already exists locally; refusing to overwrite." >&2
  exit 5
fi
if git ls-remote --exit-code --tags origin "refs/tags/${TAG}" >/dev/null 2>&1; then
  echo "Tag ${TAG} already exists on origin; refusing to overwrite." >&2
  exit 5
fi

git tag -a "$TAG" -m "PipeFlow Pro ${TAG} - corrected paths and Windows CI"
git push origin "$TAG"

gh release create "$TAG" --target "$BRANCH" --generate-notes --title "PipeFlow Pro ${TAG} - Corrected Windows CI" --prerelease

echo "Published ${TAG}; monitor: https://github.com/Ali-Marandi/pipeflow-engine/actions"
