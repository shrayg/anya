#!/usr/bin/env bash
# Retired: archive/tar deploys caused path-flatten outages and stopped PM2
# before a verified build. Use the git-based hardened path instead.
set -euo pipefail

echo "ERROR: scripts/vps-deploy.sh is retired (tar/archive deploys are unsafe)."
echo "Deploy with:"
echo "  cd /var/www/anya.int && bash scripts/vps-pull-deploy.sh"
echo
echo "That path uses flock, build-then-swap, single PM2, and health rollback."
exit 1
