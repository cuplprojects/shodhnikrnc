#!/usr/bin/env bash
# Builds and publishes ONLY what has been pushed to origin -- never the
# local working tree's state -- to the existing IIS-servable output folders:
#   API -> "API BUILD"   (dotnet publish, FolderProfile.pubxml's target,
#                          in-process hosting via web.config's AspNetCoreModuleV2)
#   UI  -> "UI/dist"      (vite build, includes public/web.config's SPA rewrite)
#
# Why a disposable worktree: a merely "clean" working tree (git status
# empty) can still sit on local commits origin doesn't have, or on a
# different branch than intended -- neither is "what's been pushed." This
# script fetches, then builds from a temporary `git worktree` checked out
# at origin/<branch>'s exact tip, so unfinished/unpushed module work in the
# main working copy can never leak into the build no matter what state it's
# left in.
#
# This only rebuilds "API BUILD" and "UI/dist" in place -- it does not
# touch IIS itself (no site/app-pool recycle). If IIS is pointed directly
# at these folders, publishing new binaries into a running in-process site
# usually requires a nudge to make the ASP.NET Core Module reload; this
# script touches web.config in "API BUILD" as that nudge (standard practice
# for in-process hosting) but does not attempt an app-pool recycle since no
# IIS management tooling is available on this machine to identify the site.
#
# Usage: ./deploy.sh [api|ui|all] [branch]
#   (default target: all, default branch: main)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_ROOT"

TARGET="${1:-all}"
BRANCH="${2:-main}"

if [[ "$TARGET" != "api" && "$TARGET" != "ui" && "$TARGET" != "all" ]]; then
  echo "Usage: $0 [api|ui|all] [branch]" >&2
  exit 1
fi

echo "==> Fetching origin"
git fetch origin "$BRANCH"

REMOTE_SHA="$(git rev-parse "origin/$BRANCH")"
echo "Deploying origin/$BRANCH at $REMOTE_SHA"

# --- build from a disposable worktree at origin/<branch>'s exact tip -------
# Never the current working directory: that guarantees local edits (staged,
# unstaged, or committed-but-unpushed) cannot end up in the build, matching
# "only build what's on git" regardless of what the working copy looks like
# right now.
WORKTREE_DIR="$REPO_ROOT/.deploy-worktree"

cleanup() {
  if [[ -d "$WORKTREE_DIR" ]]; then
    # MSBuild/VBCSCompiler nodes spawned by `dotnet publish` inside the
    # worktree can briefly hold file handles open after the build reports
    # done, which makes both `git worktree remove` and a plain `rm -rf` fail
    # with "Device or resource busy" -- shutting down the build server (the
    # dotnet CLI's own compiler-server processes) clears the common case.
    dotnet build-server shutdown >/dev/null 2>&1 || true

    git worktree remove --force "$WORKTREE_DIR" 2>/dev/null || true
    git worktree prune

    if [[ -d "$WORKTREE_DIR" ]]; then
      for _ in 1 2 3 4 5; do
        rm -rf "$WORKTREE_DIR" 2>/dev/null && break
        sleep 2
      done
    fi

    if [[ -d "$WORKTREE_DIR" ]]; then
      echo "WARNING: could not remove $WORKTREE_DIR (still locked by some process)." >&2
      echo "         The build and publish/deploy above still completed successfully --" >&2
      echo "         this only affects cleanup of the temporary worktree." >&2
      echo "         Most commonly: Visual Studio has this repo open and auto-restored" >&2
      echo "         inside $WORKTREE_DIR the moment it appeared. Close that solution" >&2
      echo "         (or wait for VS's background build to finish) and either rerun this" >&2
      echo "         script or remove $WORKTREE_DIR by hand." >&2
    fi
  fi
}
trap cleanup EXIT

cleanup  # in case a previous run left one behind
git worktree add --detach "$WORKTREE_DIR" "$REMOTE_SHA"

deploy_api() {
  echo
  echo "==> Publishing API to \"API BUILD\" (Release) from $REMOTE_SHA"

  # Kill any process holding the previous publish output's DLLs locked --
  # matches the pattern this session hit repeatedly rebuilding Release.
  # taskkill /F is asynchronous: the process can still hold its file handles
  # open for a moment after taskkill reports success, so poll until it's
  # actually gone (or a few seconds pass) before handing off to MSBuild,
  # rather than racing it.
  if tasklist //FI "IMAGENAME eq API.exe" 2>/dev/null | grep -q API.exe; then
    taskkill //F //IM API.exe 2>/dev/null || true
    for _ in 1 2 3 4 5 6 7 8 9 10; do
      tasklist //FI "IMAGENAME eq API.exe" 2>/dev/null | grep -q API.exe || break
      sleep 1
    done
  fi

  dotnet publish "$WORKTREE_DIR/API/API/API.csproj" \
    -c Release \
    -p:PublishProfile=FolderProfile \
    -p:PublishDir="$REPO_ROOT/API BUILD/"

  # Release MSBuild/VBCSCompiler's file handles into the worktree right
  # away, rather than leaving them for the cleanup trap to fight with --
  # see the cleanup() comment for why this matters.
  dotnet build-server shutdown >/dev/null 2>&1 || true

  # Nudge IIS's ASP.NET Core Module (in-process hosting) to reload the new
  # binaries: touching web.config's timestamp is the standard, documented
  # way to signal a restart without an app-pool recycle.
  if [[ -f "$REPO_ROOT/API BUILD/web.config" ]]; then
    touch "$REPO_ROOT/API BUILD/web.config"
    echo "Touched \"API BUILD/web.config\" to prompt IIS to reload the app."
  fi

  echo "API published: $REMOTE_SHA -> \"API BUILD\""
}

deploy_ui() {
  echo
  echo "==> Building UI to \"UI/dist\" from $REMOTE_SHA"

  ( cd "$WORKTREE_DIR/UI" && npm ci && npm run build )

  rm -rf "$REPO_ROOT/UI/dist"
  mv "$WORKTREE_DIR/UI/dist" "$REPO_ROOT/UI/dist"

  echo "UI built: $REMOTE_SHA -> \"UI/dist\""
}

case "$TARGET" in
  api) deploy_api ;;
  ui) deploy_ui ;;
  all) deploy_api; deploy_ui ;;
esac

echo
echo "Done. Deployed origin/$BRANCH @ $REMOTE_SHA"
