#!/usr/bin/env bash
# Update 9router: rebase home branch onto upstream master, rebuild container.
# If rebase (or stash pop) hits a conflict: stop, hand off to non-interactive `pi` for resolution.
# Never deploys when conflicts are present.
#
# Env:
#   HOME_BRANCH  - branch to keep current (default: feature/usage-period-extended)
#   UPSTREAM     - rebase target (default: origin/master)
set -euo pipefail

HOME_BRANCH="${HOME_BRANCH:-feature/usage-period-extended}"
UPSTREAM="${UPSTREAM:-origin/master}"

cd "$(dirname "$(readlink -f "$0")")"

finish_registry_only_rebase_conflicts() {
  while [[ -d .git/rebase-merge || -d .git/rebase-apply ]]; do
    mapfile -t unmerged < <(git diff --name-only --diff-filter=U)
    if [[ ${#unmerged[@]} -ne 1 || "${unmerged[0]}" != "open-sse/providers/registry/index.js" ]]; then
      return 1
    fi

    echo "==> Regenerating conflicted provider registry index"
    npm run generate:registry
    git add open-sse/providers/registry/index.js

    if git diff --cached --quiet; then
      echo "==> Generated-only commit is now empty; skipping it"
      if git rebase --skip; then
        return 0
      fi
    elif GIT_EDITOR=true git rebase --continue; then
      return 0
    fi
  done

  return 0
}

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$CURRENT_BRANCH" != "$HOME_BRANCH" ]]; then
  echo "!!  Wrong branch: $CURRENT_BRANCH (expected $HOME_BRANCH)"
  echo "    Switch with:  git checkout $HOME_BRANCH"
  exit 1
fi

echo "==> Stashing local changes (if any)"
STASH_REF=""
if ! git diff --quiet || ! git diff --cached --quiet; then
  git stash push -u -m "9router-update-$(date +%s)" >/dev/null
  STASH_REF=$(git stash list | head -n1 | cut -d: -f1)
  echo "    stashed as: $STASH_REF"
fi

echo "==> Fetching latest from origin"
git fetch --all --tags --prune

PRE_REBASE=$(git rev-parse HEAD)
echo "==> Rebasing $HOME_BRANCH onto $UPSTREAM (from $PRE_REBASE)"
if ! git rebase "$UPSTREAM"; then
  if ! finish_registry_only_rebase_conflicts; then
    echo "!!  Rebase failed on $HOME_BRANCH -> $UPSTREAM."
    # don't --abort; leave state as-is so pi can see what failed
    echo "    Repo left as-is (rebase in progress or halted). Do NOT run docker compose up."
    PROMPT="git rebase $UPSTREAM into $HOME_BRANCH failed in $(pwd). Run \`git status\` to see what needs attention (conflicts, missing upstream, etc.), fix it, then \`git rebase --continue\` if mid-rebase. Do NOT run docker compose up — I'll re-run update.sh after."
    if [[ -n "$STASH_REF" ]]; then
      PROMPT+=" Working-tree snapshot $STASH_REF is stashed; ignore it for now."
    fi
    if command -v pi >/dev/null 2>&1; then
      echo "==> Handing conflict to Pi (9router/minimax-m3)"
      exec pi --print --no-session --approve --model 9router/minimax-m3 "$PROMPT"
    else
      echo "!!  pi not found on PATH. Resolve manually:"
      echo "    git status; fix; git rebase --continue (or --abort); re-run ./update.sh"
      exit 2
    fi
  fi
fi

if [[ -n "$STASH_REF" ]]; then
  echo "==> Re-applying local stash"
  if ! git stash pop "$STASH_REF"; then
    echo "!!  Stash pop conflict after a clean rebase. Handing off to Pi."
    PROMPT="git stash pop failed after a clean rebase of $HOME_BRANCH onto $UPSTREAM in $(pwd). Run \`git status\`, resolve the conflicts, \`git add\` them, then commit. Do NOT run docker compose up — I'll re-run update.sh after."
    if command -v pi >/dev/null 2>&1; then
      echo "==> Handing conflict to Pi (9router/minimax-m3)"
      exec pi --print --no-session --approve --model 9router/minimax-m3 "$PROMPT"
    else
      echo "!!  pi not found. Resolve manually: git status, then git stash pop"
      exit 2
    fi
  fi
fi

if [[ "$PRE_REBASE" == "$(git rev-parse HEAD)" ]]; then
  echo "==> Already up to date ($PRE_REBASE); rebuilding anyway to keep container current"
else
  echo "==> Rebased to $(git rev-parse --short HEAD)"
fi

echo "==> Verifying generated provider registry"
npm run check:registry

echo "==> Rebuilding and restarting container"
docker compose up -d --build

echo "==> Removing old unused Docker build images"
docker image prune -f

echo "==> Waiting for container to settle"
sleep 5
docker ps --filter name=9router --format 'table {{.Names}}\t{{.Status}}'
echo "==> Recent logs:"
docker logs --tail 15 9router
echo "==> Done."
