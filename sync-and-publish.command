#!/bin/zsh

set -euo pipefail

PROJECT_ROOT="$(cd -- "$(dirname -- "$0")" && pwd)"
cd "$PROJECT_ROOT"

echo "Syncing plates from Airtable..."
(cd scripts && npm run sync)

echo "Staging synced data and photos..."
git add -- data/plates.json assets/img/plates

if git diff --cached --quiet; then
  echo "No changes to commit. Nothing to push."
  exit 0
fi

git commit -m "Sync plates from Airtable"
git push

echo "Sync complete and pushed to GitHub."