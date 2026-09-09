#!/bin/bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "========================================"
echo "Billingborough Observatory TNS update"
echo "Started: $(date --iso-8601=seconds)"
echo "========================================"

# Run the TNS collector.
python3 scripts/update_tns_alerts.py

# Check whether the collector changed the JSON.
if git diff --quiet -- data/tns-alerts.json; then
    echo "No TNS data changes detected."
    echo "Nothing to commit or push."
    exit 0
fi

echo "TNS data has changed."

# Stage only the TNS data file.
git add data/tns-alerts.json

# Safety check: make sure only the expected file is staged.
if ! git diff --cached --name-only | grep -qx "data/tns-alerts.json"; then
    echo "ERROR: Unexpected staged files detected."
    git diff --cached --name-only
    exit 1
fi

git commit -m "Update TNS alerts"
git push origin main

echo "TNS update committed and pushed successfully."
echo "Finished: $(date --iso-8601=seconds)"
