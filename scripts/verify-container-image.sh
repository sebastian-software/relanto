#!/usr/bin/env bash

set -euo pipefail

IMAGE="${1:?usage: verify-container-image.sh <image-ref> <canary-pattern-file>}"
CANARY_PATTERN_FILE="${2:?usage: verify-container-image.sh <image-ref> <canary-pattern-file>}"
CONTAINER_TOOL="${CONTAINER_TOOL:-docker}"
RUNTIME_CANARY_SOURCE_PATH="packages/frontend/.relanto-runtime-canary"

# The canary stays in a pattern file so its value never appears in command-line
# arguments or successful verifier output.
if [ ! -s "${CANARY_PATTERN_FILE}" ]; then
  echo "Canary pattern file is missing or empty." >&2
  exit 2
fi

TEMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/relanto-image-verify.XXXXXX")"
CONTAINER_ID=""

cleanup() {
  if [ -n "${CONTAINER_ID}" ]; then
    "${CONTAINER_TOOL}" rm --force "${CONTAINER_ID}" >/dev/null 2>&1 || true
  fi
  rm -rf -- "${TEMP_ROOT}"
}
trap cleanup EXIT

CONTAINER_ID="$("${CONTAINER_TOOL}" create "${IMAGE}")"
"${CONTAINER_TOOL}" export --output "${TEMP_ROOT}/rootfs.tar" "${CONTAINER_ID}"
mkdir "${TEMP_ROOT}/rootfs"
tar -xf "${TEMP_ROOT}/rootfs.tar" -C "${TEMP_ROOT}/rootfs"
"${CONTAINER_TOOL}" image inspect "${IMAGE}" >"${TEMP_ROOT}/inspect.json"
"${CONTAINER_TOOL}" history --no-trunc --format '{{json .}}' "${IMAGE}" >"${TEMP_ROOT}/history.jsonl"

if grep -R -I -F -q -f "${CANARY_PATTERN_FILE}" "${TEMP_ROOT}/rootfs" || \
  grep -F -q -f "${CANARY_PATTERN_FILE}" "${TEMP_ROOT}/inspect.json" || \
  grep -F -q -f "${CANARY_PATTERN_FILE}" "${TEMP_ROOT}/history.jsonl"; then
  echo "Final image contains the protected runtime canary." >&2
  exit 1
fi

if find "${TEMP_ROOT}/rootfs" -path "*/${RUNTIME_CANARY_SOURCE_PATH}" -print -quit | grep -q .; then
  echo "Final image contains the runtime-canary source path." >&2
  exit 1
fi

app_root="${TEMP_ROOT}/rootfs/app"
for required_path in \
  build/server/index.js \
  serverStartup.mjs \
  node_modules/@react-router/serve/package.json \
  node_modules/@relanto/backend/package.json; do
  if [ ! -e "${app_root}/${required_path}" ]; then
    echo "Final image is missing required runtime content: /app/${required_path}" >&2
    exit 1
  fi
done

runtime_root_inventory="$(
  cd "${app_root}"
  find . -mindepth 1 -maxdepth 1 -print | LC_ALL=C sort
)"
expected_runtime_root_inventory="$(cat <<'EOF'
./LICENSE
./README.md
./build
./node_modules
./package.json
./serverStartup.mjs
EOF
)"
if [ "${runtime_root_inventory}" != "${expected_runtime_root_inventory}" ]; then
  echo "Final image runtime root inventory differs from the explicit allowlist." >&2
  exit 1
fi

forbidden_path="$(find "${app_root}" \
  \( -name '.env' -o -name '.env.*' -o -name '.npmrc' -o -name '.yarnrc*' \
     -o -name '*.pem' -o -name '*.key' -o -name '*.p12' -o -name '*.pfx' \
     -o -name '*.test.*' -o -name '*.spec.*' -o -name '__tests__' \
     -o -name '.relanto-runtime-canary' \) -print -quit)"
if [ -n "${forbidden_path}" ]; then
  echo "Final image contains a forbidden runtime path." >&2
  exit 1
fi

first_party_inventory="$(find "${app_root}/node_modules" -path '*/@relanto/*/package.json' -print | sort)"
expected_first_party="${app_root}/node_modules/@relanto/backend/package.json"
if [ "${first_party_inventory}" != "${expected_first_party}" ]; then
  echo "Final image contains an unexpected first-party package inventory." >&2
  exit 1
fi

backend_root="${app_root}/node_modules/@relanto/backend"
backend_inventory="$(
  cd "${backend_root}"
  find . -type f -print | LC_ALL=C sort
)"
expected_backend_inventory="$(cat <<'EOF'
./LICENSE
./README.md
./openapi.json
./package.json
./src/db.ts
./src/env.ts
./src/index.ts
./src/metrics.ts
./src/openapi/generate.ts
./src/openapi/registry.ts
./src/openapi/responses.ts
./src/security.ts
./src/service.ts
./src/structured-log.ts
./src/types.ts
./src/worker.ts
EOF
)"
if [ "${backend_inventory}" != "${expected_backend_inventory}" ]; then
  echo "Final image backend runtime inventory differs from the explicit allowlist." >&2
  exit 1
fi

if jq -e '.[0].Config.Env[]? | split("=")[0] | test("(SECRET|TOKEN|PASSWORD|CREDENTIAL|AUTH|OIDC|CLIENT)"; "i")' \
  "${TEMP_ROOT}/inspect.json" >/dev/null; then
  echo "Final image configuration contains a secret-bearing environment key." >&2
  exit 1
fi

if jq -e '.[0].Config.Labels // {} | keys[] | test("(SECRET|TOKEN|PASSWORD|CREDENTIAL|AUTH|OIDC|CLIENT)"; "i")' \
  "${TEMP_ROOT}/inspect.json" >/dev/null; then
  echo "Final image configuration contains a secret-bearing label key." >&2
  exit 1
fi

echo "Final container image inventory and metadata are clean."
