#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:?Usage: ./scripts/publish-release.sh <version> [branch]}"
TAG="v${VERSION#v}"
BRANCH="${2:-${RELEASE_BRANCH:-enterprise/foundation-v2}}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

command -v git >/dev/null || { echo "git is required" >&2; exit 1; }
command -v gh >/dev/null || { echo "GitHub CLI (gh) is required" >&2; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "GitHub CLI is not authenticated. Run: gh auth login" >&2; exit 2; }

for required in .github/workflows/windows-release.yml electron/main.cjs electron/preload.cjs scripts/build-windows.mjs Dockerfile docker-compose.yml; do
  [[ -f "$required" ]] || { echo "Missing required release file: $required" >&2; exit 3; }
done

PKG_VERSION="$(node -p "require('./package.json').version")"
[[ "$PKG_VERSION" == "${TAG#v}" ]] || { echo "package.json version $PKG_VERSION does not match $TAG" >&2; exit 4; }

git diff --check
git switch "$BRANCH"
git add package.json pnpm-lock.yaml .github Dockerfile .dockerignore docker-compose.yml .env.example electron scripts server client drizzle shared deploy docs
if ! git diff --cached --quiet; then
  git commit -m "chore: prepare PipeFlow Pro ${TAG}"
fi

if git rev-parse "$TAG" >/dev/null 2>&1 || git ls-remote --exit-code --tags origin "refs/tags/${TAG}" >/dev/null 2>&1; then
  echo "Tag ${TAG} already exists; refusing to overwrite immutable release history." >&2
  exit 5
fi

REMOTE_SHA="$(git ls-remote --heads origin "refs/heads/${BRANCH}" | awk '{print $1}')"
if [[ -n "$REMOTE_SHA" ]]; then
  git push --force-with-lease="refs/heads/${BRANCH}:${REMOTE_SHA}" -u origin "$BRANCH"
else
  git push -u origin "$BRANCH"
fi

git tag -a "$TAG" -m "PipeFlow Pro ${TAG}"
git push origin "$TAG"
gh release create "$TAG" --target "$BRANCH" --generate-notes --title "PipeFlow Pro ${TAG}" --prerelease

echo "Published ${TAG}; monitor: https://github.com/Ali-Marandi/pipeflow-engine/actions"
