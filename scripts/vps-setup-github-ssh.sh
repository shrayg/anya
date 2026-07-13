#!/usr/bin/env bash
# Run this ON THE VPS (as root or your deploy user).
# Creates a deploy key so the server can `git pull` from GitHub.
set -euo pipefail

REPO_SSH="git@github.com:fillingorders/anya.int.git"
APP_DIR="${APP_DIR:-/var/www/anya.int}"
DEPLOY_USER="${DEPLOY_USER:-$(whoami)}"
KEY_DIR="${HOME}/.ssh"
KEY_FILE="${KEY_DIR}/github_anya_int_deploy"

echo "==> Anya.Int VPS GitHub deploy key setup"
echo "    User:     ${DEPLOY_USER}"
echo "    App dir:  ${APP_DIR}"
echo

mkdir -p "${KEY_DIR}"
chmod 700 "${KEY_DIR}"

if [[ -f "${KEY_FILE}" ]]; then
  echo "==> Key already exists at ${KEY_FILE}"
  echo "    Delete it first if you want a new key."
else
  echo "==> Generating ed25519 deploy key (no passphrase)..."
  ssh-keygen -t ed25519 -C "anya-int-vps-${DEPLOY_USER}@$(hostname)" -f "${KEY_FILE}" -N ""
  chmod 600 "${KEY_FILE}"
  chmod 644 "${KEY_FILE}.pub"
fi

if ! grep -q "Host github.com" "${KEY_DIR}/config" 2>/dev/null; then
  echo "==> Writing ~/.ssh/config for GitHub..."
  cat >> "${KEY_DIR}/config" <<EOF

Host github.com
  HostName github.com
  User git
  IdentityFile ${KEY_FILE}
  IdentitiesOnly yes
EOF
  chmod 600 "${KEY_DIR}/config"
fi

echo "==> Adding github.com to known_hosts..."
ssh-keyscan -t ed25519 github.com >> "${KEY_DIR}/known_hosts" 2>/dev/null || true
sort -u "${KEY_DIR}/known_hosts" -o "${KEY_DIR}/known_hosts"
chmod 644 "${KEY_DIR}/known_hosts"

echo
echo "================================================================"
echo " ADD THIS PUBLIC KEY TO GITHUB (Deploy key — read-only is fine)"
echo " https://github.com/fillingorders/anya.int/settings/keys"
echo " Title: anya-int-vps-$(hostname)"
echo "================================================================"
echo
cat "${KEY_FILE}.pub"
echo
echo "================================================================"
echo " After adding the key on GitHub, press Enter to test clone/pull..."
read -r _

echo "==> Testing GitHub SSH..."
ssh -T git@github.com || true

mkdir -p "$(dirname "${APP_DIR}")"

if [[ -d "${APP_DIR}/.git" ]]; then
  echo "==> Repo exists — fetching..."
  cd "${APP_DIR}"
  git remote set-url origin "${REPO_SSH}" || true
  git fetch origin main
  git checkout main 2>/dev/null || git checkout -b main origin/main
  git pull origin main
else
  echo "==> Cloning repo into ${APP_DIR}..."
  git clone "${REPO_SSH}" "${APP_DIR}"
  cd "${APP_DIR}"
fi

echo
echo "==> Done. Repo ready at ${APP_DIR}"
echo "    Next: copy .env.local, then run: bash scripts/vps-pull-deploy.sh"
