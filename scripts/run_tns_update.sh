#!/bin/bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "========================================"
echo "Billingborough Observatory TNS update"
echo "Started: $(date --iso-8601=seconds)"
echo "========================================"

# ----------------------------------------------------------------------
# Synchronise the local repository with GitHub before collecting TNS data.
#
# Other Observatory automation may have committed changes since the
# previous TNS run. Bring those changes into the local checkout first.
# No force-push is ever used.
# ----------------------------------------------------------------------

echo "Synchronising repository with GitHub..."

git fetch origin

if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "ERROR: Unexpected local changes detected before update."
    git status --short
    exit 1
fi

if ! git rebase origin/main; then
    echo "ERROR: Could not synchronise with origin/main."
    echo "Aborting rebase."
    git rebase --abort || true
    exit 1
fi

# ----------------------------------------------------------------------
# Run the TNS collector.
# ----------------------------------------------------------------------

python3 scripts/update_tns_alerts.py

# ----------------------------------------------------------------------
# Check whether the collector changed the JSON.
# ----------------------------------------------------------------------

if git diff --quiet -- data/tns-alerts.json; then
    echo "No TNS data changes detected."
    echo "Nothing to commit or push."
    exit 0
fi

echo "TNS data has changed."

# ----------------------------------------------------------------------
# Stage only the TNS data file.
# ----------------------------------------------------------------------

git add data/tns-alerts.json

STAGED_FILES="$(git diff --cached --name-only)"

if [[ "$STAGED_FILES" != "data/tns-alerts.json" ]]; then
    echo "ERROR: Unexpected staged files detected."
    echo "$STAGED_FILES"
    git reset
    exit 1
fi

# ----------------------------------------------------------------------
# Commit the TNS change locally.
# ----------------------------------------------------------------------

git commit -m "Update TNS alerts"

# ----------------------------------------------------------------------
# Push the TNS commit.
#
# If another automated process updates GitHub between our fetch and push,
# the push will be rejected. Fetch the new remote commit, rebase our TNS
# commit onto it, and retry once.
# ----------------------------------------------------------------------

if git push origin main; then
    echo "TNS update committed and pushed successfully."
    echo "Finished: $(date --iso-8601=seconds)"
    exit 0
fi

echo "Remote main changed during the update."
echo "Fetching latest GitHub changes and retrying..."

git fetch origin

if ! git rebase origin/main; then
    echo "ERROR: Could not rebase TNS update onto latest origin/main."
    echo "Aborting rebase."
    git rebase --abort || true
    exit 1
fi

git push origin main

echo "TNS update committed and pushed successfully after retry."
echo "Finished: $(date --iso-8601=seconds)"
