#!/usr/bin/env bash
# Runs the API with secrets loaded from .env.local (gitignored).
#
# ASP.NET maps Email__Host -> configuration key "Email:Host", so nothing in
# appsettings.json needs to hold a credential. Those stay empty placeholders.
#
# Usage: ./run-api.sh [urls]
set -euo pipefail

cd "$(dirname "$0")"

if [[ -f .env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
  echo "Loaded .env.local"
else
  echo "WARNING: .env.local not found — email verification will fail with 503." >&2
fi

export ASPNETCORE_ENVIRONMENT="${ASPNETCORE_ENVIRONMENT:-Development}"
export ASPNETCORE_URLS="${1:-https://localhost:7054;http://localhost:5116}"

exec dotnet run --project API/API/API.csproj --no-launch-profile
