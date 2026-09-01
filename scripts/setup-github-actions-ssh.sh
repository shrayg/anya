#!/usr/bin/env bash
# Run on YOUR LOCAL MACHINE (or anywhere) to create the key GitHub Actions
# uses to SSH into the VPS and trigger deploys.
set -euo pipefail

OUT_DIR="${1:-./deploy-keys}"
mkdir -p "${OUT_DIR}"

KEY_FILE="${OUT_DIR}/github_actions_vps_deploy"

if [[ -f "${KEY_FILE}" ]]; then
  echo "Key already exists: ${KEY_FILE}"
else
  echo "==> Generating ed25519 key for GitHub Actions -> VPS SSH..."
  ssh-keygen -t ed25519 -C "github-actions-anya-int-deploy" -f "${KEY_FILE}" -N ""
fi

echo
echo "================================================================"
echo " STEP 1 — Add PUBLIC key to the VPS authorized_keys"
echo " On the VPS, run:"
echo
echo "   mkdir -p ~/.ssh && chmod 700 ~/.ssh"
echo "   echo '$(cat "${KEY_FILE}.pub")' >> ~/.ssh/authorized_keys"
echo "   chmod 600 ~/.ssh/authorized_keys"
echo
echo " Or as root for root login:"
echo "   echo '$(cat "${KEY_FILE}.pub")' >> /root/.ssh/authorized_keys"
echo "================================================================"
echo
echo " STEP 2 — Add GitHub repository secrets"
echo " https://github.com/shrayg/anya/settings/secrets/actions"
echo
echo "   VPS_HOST          = your server IP or domain"
echo "   VPS_USER          = root (or deploy user)"
echo "   VPS_SSH_PRIVATE_KEY = entire contents of:"
echo "                         ${KEY_FILE}"
echo
echo " Optional:"
echo "   VPS_PORT          = 22 (if not default)"
echo "   APP_DIR           = /var/www/anya.int"
echo "================================================================"
echo
echo " Private key (for GitHub secret VPS_SSH_PRIVATE_KEY):"
echo "-----"
cat "${KEY_FILE}"
echo "-----"
echo
echo " Public key saved at: ${KEY_FILE}.pub"
echo " After secrets are set, push to main to trigger auto-deploy."
