#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
cd "${PROJECT_ROOT}"

failures=0

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  failures=$((failures + 1))
}

require_pattern() {
  local file="$1"
  local pattern="$2"
  local claim="$3"

  if ! grep -E -q -- "${pattern}" "${file}"; then
    fail "${claim} (${file})"
  fi
}

forbid_pattern() {
  local file="$1"
  local pattern="$2"
  local claim="$3"

  if grep -E -q -- "${pattern}" "${file}"; then
    fail "${claim} (${file})"
  fi
}

require_file() {
  local file="$1"
  local claim="$2"

  if [ ! -f "${file}" ]; then
    fail "${claim} (${file})"
  fi
}

DOCKERIGNORE=.dockerignore
DOCKERFILE=Dockerfile
CI_WORKFLOW=.github/workflows/ci.yml
RELEASE_WORKFLOW=.github/workflows/release-please.yml
IMAGE_VERIFIER=scripts/verify-container-image.sh

# The canary lives at a path that a recursive local-secret rule must exclude.
require_pattern "${DOCKERIGNORE}" '^\*\*/\.env$' \
  'recursive .env files must be excluded from the Docker context'
require_pattern "${DOCKERIGNORE}" '^\*\*/\.env\.\*$' \
  'recursive .env variants must be excluded from the Docker context'
require_pattern "${DOCKERIGNORE}" '^!packages/frontend/\.env\.development\.example$' \
  'the harmless development example must be the narrowly scoped exception'
require_pattern "${DOCKERIGNORE}" '^\*\*/\*\.pem$' \
  'recursive PEM material must be excluded from the Docker context'
require_pattern "${DOCKERIGNORE}" '^\*\*/\*\.key$' \
  'recursive private-key material must be excluded from the Docker context'

require_pattern "${DOCKERFILE}" 'AS[[:space:]]+context-probe([[:space:]]|$)' \
  'Dockerfile must expose the dedicated BuildKit context-probe target'
require_pattern "${DOCKERFILE}" 'packages/frontend/\.env\.context-canary' \
  'context-probe must prove that the ignored context canary is absent'
require_pattern "${CI_WORKFLOW}" 'packages/frontend/\.env\.context-canary' \
  'CI must generate the synthetic context canary before context transfer'
require_pattern "${CI_WORKFLOW}" '(--target[=[:space:]]+context-probe|target:[[:space:]]*context-probe)' \
  'CI must execute the context-probe target'

if ! node <<'NODE'
import { readFileSync } from 'node:fs';

const manifests = ['packages/frontend/package.json', 'packages/backend/package.json'];
const forbidden = /(^|\/)(?:\.env(?:\.|$)|coverage(?:\/|$)|tmp(?:\/|$)|temp(?:\/|$))|(?:^|\/)(?:__tests__|tests?)(?:\/|$)|\.(?:test|spec)\.[^/]+$/i;
let valid = true;

for (const file of manifests) {
  const manifest = JSON.parse(readFileSync(file, 'utf8'));
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
    console.error(`FAIL: ${file} must define a non-empty runtime files allowlist`);
    valid = false;
    continue;
  }

  for (const entry of manifest.files) {
    if (typeof entry !== 'string' || entry.length === 0 || forbidden.test(entry)) {
      console.error(`FAIL: ${file} contains a non-runtime files entry: ${JSON.stringify(entry)}`);
      valid = false;
    }
  }
}

process.exit(valid ? 0 : 1);
NODE
then
  failures=$((failures + 1))
fi

require_file "${IMAGE_VERIFIER}" \
  'a focused final-image filesystem and metadata verifier must exist'
if [ -f "${IMAGE_VERIFIER}" ]; then
  require_pattern "${IMAGE_VERIFIER}" 'packages/frontend/\.relanto-runtime-canary' \
    'the image verifier must check the synthetic runtime canary'
  require_pattern "${IMAGE_VERIFIER}" '(export|save|create|find|tar)' \
    'the image verifier must inspect the complete final filesystem inventory'
  require_pattern "${IMAGE_VERIFIER}" 'expected_backend_inventory' \
    'the image verifier must compare the complete backend runtime inventory with an explicit allowlist'
  require_pattern "${IMAGE_VERIFIER}" '(inspect|Config|Env|Labels)' \
    'the image verifier must inspect image configuration, environment and labels'
  require_pattern "${IMAGE_VERIFIER}" 'history[[:space:]].*--no-trunc|--no-trunc[[:space:]].*history' \
    'the image verifier must inspect untruncated layer history'
fi
require_pattern "${CI_WORKFLOW}" 'packages/frontend/\.relanto-runtime-canary' \
  'CI must create the build-stage runtime canary'
require_pattern "${CI_WORKFLOW}" 'scripts/verify-container-image\.sh' \
  'CI must execute the final-image filesystem and metadata verifier'

build_action_count="$(grep -E -c 'uses:[[:space:]]*docker/build-push-action@' "${RELEASE_WORKFLOW}" || true)"
if [ "${build_action_count}" -ne 1 ]; then
  fail "release workflow must build exactly once (found ${build_action_count} build-push-action steps)"
fi

require_pattern "${RELEASE_WORKFLOW}" 'relanto-release\.oci\.tar' \
  'release workflow must use the stable OCI archive path'
require_pattern "${RELEASE_WORKFLOW}" 'type=oci[^[:cntrl:]]*relanto-release\.oci\.tar|relanto-release\.oci\.tar[^[:cntrl:]]*type=oci' \
  'the single release build must emit an OCI archive'
require_pattern "${RELEASE_WORKFLOW}" 'oci-archive:.*relanto-release\.oci\.tar' \
  'smoke, scan and publication must address the same OCI archive'
require_pattern "${RELEASE_WORKFLOW}" 'docker-daemon:' \
  'the release archive must be imported for the existing container smoke test without rebuilding'
require_pattern "${RELEASE_WORKFLOW}" 'scripts/smoke-test-container\.sh' \
  'the imported release image must pass the repository-native smoke test'
require_pattern "${RELEASE_WORKFLOW}" 'packages/frontend/\.env\.context-canary' \
  'release must prove that its context canary never reaches the build context'
require_pattern "${RELEASE_WORKFLOW}" '(--target[=[:space:]]+context-probe|target:[[:space:]]*context-probe)' \
  'release must execute the context-probe target'
require_pattern "${RELEASE_WORKFLOW}" 'packages/frontend/\.relanto-runtime-canary' \
  'release must create the build-stage runtime canary'
require_pattern "${RELEASE_WORKFLOW}" '(--target[=[:space:]]+runtime-probe|target:[[:space:]]*runtime-probe)' \
  'release must execute the runtime-probe target'
require_pattern "${RELEASE_WORKFLOW}" 'scripts/verify-container-image\.sh' \
  'release must verify the imported archive filesystem and metadata'
require_pattern "${RELEASE_WORKFLOW}" 'platforms:[[:space:]]*linux/amd64' \
  'the prebuilt release image must be limited to linux/amd64'
for oci_label in \
  org.opencontainers.image.title \
  org.opencontainers.image.source \
  org.opencontainers.image.version \
  org.opencontainers.image.revision \
  io.relanto.release-tags; do
  require_pattern "${RELEASE_WORKFLOW}" "${oci_label}=" \
    "release archive must carry the ${oci_label} label"
done

archive_checksum_count="$(grep -E -c 'sha256sum[[:space:]].*relanto-release\.oci\.tar' "${RELEASE_WORKFLOW}" || true)"
if [ "${archive_checksum_count}" -lt 3 ]; then
  fail "release workflow must recheck OCI archive bytes after smoke, after scan and before copy"
fi

require_pattern "${RELEASE_WORKFLOW}" '(aquasecurity/trivy-action@[0-9a-f]{40}|aquasec/trivy[^[:space:]]*@sha256:[0-9a-f]{64})' \
  'the release secret scanner must be pinned to an immutable commit or image digest'
require_pattern "${RELEASE_WORKFLOW}" '--scanners[=[:space:]]+secret' \
  'release workflow must run the explicit Trivy secret scanner'
require_pattern "${RELEASE_WORKFLOW}" '--exit-code[=[:space:]]+1' \
  'recognized secrets must fail the release gate'
require_pattern "${RELEASE_WORKFLOW}" '--input[=[:space:]]+[^[:space:]]*relanto-release\.oci\.tar' \
  'the secret scanner must inspect the release OCI archive directly'
require_pattern "${RELEASE_WORKFLOW}" 'positive-control\.oci\.tar' \
  'the secret scanner must be proven by a disposable positive-control archive'
require_pattern "${RELEASE_WORKFLOW}" 'positive_status' \
  'the positive-control result must be checked explicitly'
forbid_pattern "${RELEASE_WORKFLOW}" '(trivyignore|--ignorefile|--config|--debug|--trace|format:[[:space:]]*sarif|--format[=[:space:]]+sarif)' \
  'release secret scanning must not use ignores, custom config, debug output or SARIF reports'
require_pattern "${RELEASE_WORKFLOW}" '--output[[:space:]]+positive-control\.json' \
  'the Trivy positive control must keep its detailed JSON finding in protected temporary storage'
require_pattern "${RELEASE_WORKFLOW}" '\.Results\[\]\?\.Secrets\[\]\?' \
  'the Trivy positive control must prove a real secret finding rather than only an exit code'

require_pattern "${RELEASE_WORKFLOW}" '(skopeo[^[:space:]]*@sha256:[0-9a-f]{64}|SKOPEO_VERSION:|skopeo[^[:cntrl:]]*(sha256sum|checksum))' \
  'skopeo must be pinned by immutable digest or exact version plus integrity check'
require_pattern "${RELEASE_WORKFLOW}" 'skopeo[[:space:]]+copy[^[:cntrl:]]*--preserve-digests' \
  'publication must preserve the scanned OCI manifest digest'
require_pattern "${RELEASE_WORKFLOW}" '--digestfile[=[:space:]]+[^[:space:]]*relanto-release\.digest' \
  'the primary copy must record its pushed digest'
require_pattern "${RELEASE_WORKFLOW}" 'docker://ghcr\.io/sebastian-software/relanto:' \
  'publication must copy to the intended GHCR package'
require_pattern "${RELEASE_WORKFLOW}" 'skopeo[[:space:]]+inspect' \
  'published release, SHA and latest tags must be read back from GHCR'
require_pattern "${RELEASE_WORKFLOW}" 'GH_TOKEN:[[:space:]]*\$\{\{[[:space:]]*secrets\.GITHUB_TOKEN[[:space:]]*\}\}' \
  'the package metadata gate must use the current workflow token'
require_pattern "${RELEASE_WORKFLOW}" 'gh[[:space:]]+api[[:space:]]+--method[=[:space:]]+GET' \
  'the package metadata gate must be an explicit read-only GitHub API request'
require_pattern "${RELEASE_WORKFLOW}" '/orgs/sebastian-software/packages/container/relanto' \
  'the package metadata gate must read the intended GHCR package'
require_pattern "${RELEASE_WORKFLOW}" '\.repository\.full_name[[:space:]]*==[[:space:]]*"sebastian-software/relanto"' \
  'the package metadata gate must verify the exact repository linkage'
require_pattern "${RELEASE_WORKFLOW}" '\.visibility[[:space:]]*==[[:space:]]*"private"[[:space:]]+or[[:space:]]+\.visibility[[:space:]]*==[[:space:]]*"public"' \
  'the package gate must accept only the documented private or public lifecycle states'

# The package lifecycle is private before the manual UI transition and public
# afterwards. Normalize shell continuations before proving the workflow remains
# read-only in both states; a mutating flag or payload must not hide on the next
# YAML block-scalar line.
if ! node <<'NODE'
import { readFileSync } from 'node:fs';

const workflow = readFileSync('.github/workflows/release-please.yml', 'utf8');
const normalized = workflow.replace(/\\\r?\n\s*/g, ' ');
const forbidden = [
  {
    pattern: /\bgh\s+api\b[^\n]{0,500}--method(?:=|\s+)(?:PATCH|PUT|POST|DELETE)\b/i,
    claim: 'mutating gh api method',
  },
  {
    pattern: /\bgh\s+api\b[^\n]{0,500}(?:\s-f(?:=|\s)|--field(?:=|\s)|--raw-field(?:=|\s)|--input(?:=|\s))/i,
    claim: 'implicit gh api mutation input',
  },
  {
    pattern: /\bcurl\b[^\n]{0,500}(?:-X|--request)(?:=|\s+)(?:PATCH|PUT|POST|DELETE)\b/i,
    claim: 'mutating HTTP request',
  },
  {
    pattern: /(?:change_visibility|packageVisibility)/i,
    claim: 'invented visibility automation',
  },
  {
    pattern: /["']?visibility["']?\s*(?::|=)\s*["']?(?:public|private)\b/i,
    claim: 'visibility mutation payload',
  },
  {
    pattern: /\bmutation\b[^\n]{0,500}\bvisibility\b|\bvisibility\b[^\n]{0,500}\bmutation\b/i,
    claim: 'GraphQL visibility mutation',
  },
];

let valid = true;
for (const { pattern, claim } of forbidden) {
  if (pattern.test(normalized)) {
    console.error(`FAIL: workflow contains a ${claim}`);
    valid = false;
  }
}

process.exit(valid ? 0 : 1);
NODE
then
  failures=$((failures + 1))
fi

require_pattern docs/ghcr-image-visibility.md '(MUSS|muss|bleibt|zunächst)[^[:cntrl:]]*[Pp]rivat|private' \
  'the transition runbook must keep GHCR private until the manual gate is complete'
require_pattern docs/ghcr-image-visibility.md '(manuell|Package settings|Package Settings)' \
  'the transition runbook must document the one-time manual visibility step'
require_pattern README.md '(git clone|git[[:space:]]+clone)' \
  'README must provide a credential-free source checkout path while GHCR is private'
require_pattern README.md '(podman|docker)[[:space:]]+build' \
  'README must build the image locally while GHCR is private'
forbid_pattern README.md '^[[:space:]]*(podman|docker)[[:space:]]+(pull|run)[^[:cntrl:]]*ghcr\.io/sebastian-software/relanto' \
  'README must not claim an anonymous GHCR quickstart before the post-merge proof'
forbid_pattern packages/frontend/README.md '^[[:space:]]*--env[[:space:]]+(APP_SESSION_SECRET|MAILER_SECRET_KEY)[[:space:]]+\\$' \
  'container examples must not rely on non-exported shell variables for runtime secrets'
require_pattern packages/frontend/README.md '--env[[:space:]]+APP_SESSION_SECRET="\$\{APP_SESSION_SECRET\}"' \
  'container examples must pass the generated application session secret explicitly'
require_pattern packages/frontend/README.md '--env[[:space:]]+MAILER_SECRET_KEY="\$\{MAILER_SECRET_KEY\}"' \
  'container examples must pass the generated mailer secret explicitly'

if [ "${failures}" -ne 0 ]; then
  printf '\nContainer release contract failed with %d violation(s).\n' "${failures}" >&2
  exit 1
fi

echo 'Container release contract is satisfied.'
