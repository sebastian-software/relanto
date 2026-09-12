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

first_line() {
  grep -E -n -m 1 -- "$2" "$1" | cut -d : -f 1 || true
}

last_line() {
  grep -E -n -- "$2" "$1" | tail -n 1 | cut -d : -f 1 || true
}

DOCKERIGNORE=.dockerignore
DOCKERFILE=Dockerfile
CI_WORKFLOW=.github/workflows/ci.yml
RELEASE_WORKFLOW=.github/workflows/release-please.yml
IMAGE_VERIFIER=scripts/verify-container-image.sh
RELEASE_ARCHIVE_GATE=scripts/verify-release-archive.sh
RELEASE_ARCHIVE_LOADER=scripts/load-release-archive.sh

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
  forbid_pattern "${IMAGE_VERIFIER}" 'grep[[:space:]]+-R' \
    'the image verifier must not follow extracted rootfs symlinks into the host'
  require_pattern "${IMAGE_VERIFIER}" 'find[[:space:]]+-P' \
    'the image verifier must traverse the extracted rootfs without following symlinks'
  require_pattern "${IMAGE_VERIFIER}" 'readlink' \
    'the image verifier must inspect symlink targets as data'
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
  fail "release workflow must recheck OCI archive bytes after smoke and before copy (found ${archive_checksum_count} checksum commands)"
fi

# Pre-merge CI and the release workflow share one non-publishing archive gate:
# checksum and digest record, Trivy positive control, secret scan and a local
# digest-preservation proof. Both workflows must call it so they cannot drift.
require_file "${RELEASE_ARCHIVE_GATE}" \
  'a shared non-publishing release archive gate must exist'
for workflow in "${CI_WORKFLOW}" "${RELEASE_WORKFLOW}"; do
  require_pattern "${workflow}" 'scripts/verify-release-archive\.sh[[:space:]]+relanto-release\.oci\.tar[[:space:]]' \
    'the workflow must run the shared release archive gate on relanto-release.oci.tar'
  require_pattern "${workflow}" 'aquasecurity/trivy-action@[0-9a-f]{40}' \
    'the secret scanner used by the shared archive gate must be pinned to an immutable commit'
  require_pattern "${workflow}" 'SKOPEO_IMAGE:[[:space:]]*quay\.io/skopeo/stable@sha256:[0-9a-f]{64}' \
    'the shared archive gate must run a digest-pinned Skopeo image'
  forbid_pattern "${workflow}" '--input[=[:space:]]+[^[:space:]]*\.oci\.tar' \
    'Trivy cannot read an OCI archive tarball; --input must point at an OCI layout directory'
done
ci_skopeo_image="$(grep -E -o 'quay\.io/skopeo/stable@sha256:[0-9a-f]{64}' "${CI_WORKFLOW}" | sort -u || true)"
release_skopeo_image="$(grep -E -o 'quay\.io/skopeo/stable@sha256:[0-9a-f]{64}' "${RELEASE_WORKFLOW}" | sort -u || true)"
if [ -z "${ci_skopeo_image}" ] || [ "${ci_skopeo_image}" != "${release_skopeo_image}" ]; then
  fail 'CI and release must run the shared archive gate with the same single pinned Skopeo image'
fi

require_pattern "${CI_WORKFLOW}" 'type=oci,dest=relanto-release\.oci\.tar' \
  'the pre-merge archive gate must build a linux/amd64 OCI archive'
forbid_pattern "${CI_WORKFLOW}" '(docker/login-action|push:[[:space:]]*true|docker\.sock|docker-daemon:)' \
  'the pre-merge archive gate must not log in, push or reach a container daemon socket'

# Pre-merge CI builds exactly one OCI archive, loads that archive and runs the
# image verifier, the vulnerability scan and both smoke tests against the loaded
# tag. A second `load: true` image would leave the archive itself untested.
ci_build_action_count="$(grep -E -c 'uses:[[:space:]]*docker/build-push-action@' "${CI_WORKFLOW}" || true)"
if [ "${ci_build_action_count}" -ne 1 ]; then
  fail "CI must build the container image exactly once as the release OCI archive (found ${ci_build_action_count} build-push-action steps)"
fi
forbid_pattern "${CI_WORKFLOW}" 'load:[[:space:]]*true' \
  'CI must not build a separate daemon-loaded image next to the release archive'
forbid_pattern "${CI_WORKFLOW}" 'relanto:smoke-test' \
  'CI must test the loaded release archive instead of a separately built smoke-test image'
require_pattern "${CI_WORKFLOW}" 'LOADED_IMAGE:[[:space:]]*relanto:ci-\$\{\{[[:space:]]*github\.run_id[[:space:]]*\}\}' \
  'CI must define the per-run tag of the loaded release archive'
require_pattern "${CI_WORKFLOW}" 'tags:[[:space:]]*\$\{\{[[:space:]]*env\.LOADED_IMAGE[[:space:]]*\}\}' \
  'the single CI archive build must carry the tag that docker load restores'
require_pattern "${CI_WORKFLOW}" 'RELEASE_TAG:[[:space:]]*ci-\$\{\{[[:space:]]*github\.run_id[[:space:]]*\}\}' \
  'the CI archive gate must address the tag part of the loaded archive tag'
require_pattern "${CI_WORKFLOW}" 'scripts/load-release-archive\.sh[[:space:]]+relanto-release\.oci\.tar[[:space:]]+"\$\{LOADED_IMAGE\}"' \
  'CI must load the verified release archive with the shared identity-proving helper'
require_pattern "${CI_WORKFLOW}" 'scripts/verify-container-image\.sh[[:space:]]+"\$\{LOADED_IMAGE\}"[[:space:]]+packages/frontend/\.relanto-runtime-canary' \
  'CI must run the image verifier against the loaded release archive'
ci_verifier_count="$(grep -E -c 'scripts/verify-container-image\.sh' "${CI_WORKFLOW}" || true)"
ci_loaded_verifier_count="$(grep -E -c 'scripts/verify-container-image\.sh[[:space:]]+"\$\{LOADED_IMAGE\}"' "${CI_WORKFLOW}" || true)"
if [ "${ci_verifier_count}" -ne "${ci_loaded_verifier_count}" ]; then
  fail 'every CI image verifier run must target the loaded release archive'
fi
require_pattern "${CI_WORKFLOW}" 'image-ref:[[:space:]]*\$\{\{[[:space:]]*env\.LOADED_IMAGE[[:space:]]*\}\}' \
  'the CI vulnerability scan must inspect the loaded release archive'
ci_smoke_count="$(grep -E -c 'scripts/smoke-test-container\.sh' "${CI_WORKFLOW}" || true)"
ci_loaded_smoke_count="$(grep -E -c 'scripts/smoke-test-container\.sh[[:space:]]+"\$\{LOADED_IMAGE\}"' "${CI_WORKFLOW}" || true)"
if [ "${ci_loaded_smoke_count}" -ne 2 ] || [ "${ci_smoke_count}" -ne "${ci_loaded_smoke_count}" ]; then
  fail "CI must run exactly the standard and the operator-assets smoke test against the loaded release archive (found ${ci_loaded_smoke_count} of ${ci_smoke_count})"
fi
require_pattern "${CI_WORKFLOW}" 'SMOKE_TEST_OPERATOR_ASSETS_FIXTURE:[[:space:]]*"?true"?' \
  'CI must smoke-test the operator-assets fixture of the loaded release archive'
require_pattern "${CI_WORKFLOW}" 'sha256sum[[:space:]]+--check[[:space:]]+relanto-release\.oci\.tar\.sha256' \
  'CI must re-verify the release archive bytes after the smoke tests'

ci_build_line="$(first_line "${CI_WORKFLOW}" 'uses:[[:space:]]*docker/build-push-action@')"
ci_gate_line="$(first_line "${CI_WORKFLOW}" '\./scripts/verify-release-archive\.sh[[:space:]]')"
ci_load_line="$(first_line "${CI_WORKFLOW}" '\./scripts/load-release-archive\.sh[[:space:]]')"
ci_verifier_line="$(first_line "${CI_WORKFLOW}" '\./scripts/verify-container-image\.sh[[:space:]]')"
ci_first_smoke_line="$(first_line "${CI_WORKFLOW}" '\./scripts/smoke-test-container\.sh[[:space:]]')"
ci_last_smoke_line="$(last_line "${CI_WORKFLOW}" '\./scripts/smoke-test-container\.sh[[:space:]]')"
ci_checksum_line="$(last_line "${CI_WORKFLOW}" 'sha256sum[[:space:]]+--check[[:space:]]+relanto-release\.oci\.tar\.sha256')"
if [ -z "${ci_build_line}" ] || [ -z "${ci_gate_line}" ] || [ -z "${ci_load_line}" ] || \
  [ -z "${ci_verifier_line}" ] || [ -z "${ci_first_smoke_line}" ] || [ -z "${ci_last_smoke_line}" ] || \
  [ -z "${ci_checksum_line}" ] || \
  [ "${ci_build_line}" -ge "${ci_gate_line}" ] || [ "${ci_gate_line}" -ge "${ci_load_line}" ] || \
  [ "${ci_load_line}" -ge "${ci_verifier_line}" ] || [ "${ci_verifier_line}" -ge "${ci_first_smoke_line}" ] || \
  [ "${ci_last_smoke_line}" -ge "${ci_checksum_line}" ]; then
  fail 'CI must run build, shared archive gate, archive load, image verifier, smoke tests and checksum re-verification in this order'
fi

require_file "${RELEASE_ARCHIVE_LOADER}" \
  'a daemon-socket-free loader for the verified release archive must exist'
if [ -f "${RELEASE_ARCHIVE_LOADER}" ]; then
  forbid_pattern "${RELEASE_ARCHIVE_LOADER}" '(docker\.sock|docker-daemon:|docker://|login|push)' \
    'the archive loader must not mount a daemon socket, use a daemon or registry transport, log in or publish'
  require_pattern "${RELEASE_ARCHIVE_LOADER}" 'docker[[:space:]]+load[[:space:]]+--input' \
    'the archive loader must load the unchanged OCI archive with the Docker CLI'
  require_pattern "${RELEASE_ARCHIVE_LOADER}" 'skopeo[[:space:]]+inspect[[:space:]]+--raw' \
    'the archive loader must read the archived manifest config digest'
  require_pattern "${RELEASE_ARCHIVE_LOADER}" 'skopeo[[:space:]]+inspect[[:space:]]+--config' \
    'the archive loader must read the archived config rootfs.diff_ids'
  require_pattern "${RELEASE_ARCHIVE_LOADER}" 'SOURCE_DIGEST_NAME="\$\{ARCHIVE_STEM\}\.source\.digest"' \
    'the archive loader must compare against the digest recorded by the archive gate'
  require_pattern "${RELEASE_ARCHIVE_LOADER}" 'loaded_id\}"[[:space:]]+=[[:space:]]+"\$\{manifest_digest\}"' \
    'the archive loader must accept a containerd-store image only by manifest digest'
  require_pattern "${RELEASE_ARCHIVE_LOADER}" 'loaded_id\}"[[:space:]]+=[[:space:]]+"\$\{config_digest\}"' \
    'the archive loader must accept a classic-store image only by config digest'
  require_pattern "${RELEASE_ARCHIVE_LOADER}" 'loaded_layers\}"[[:space:]]+!=[[:space:]]+"\$\{archive_diff_ids\}"' \
    'the archive loader must compare loaded RootFS layers with the archived diff_ids'
fi

# Release order: build, shared gate, import and smoke, then publication.
gate_line="$(first_line "${RELEASE_WORKFLOW}" 'scripts/verify-release-archive\.sh')"
build_line="$(first_line "${RELEASE_WORKFLOW}" 'uses:[[:space:]]*docker/build-push-action@')"
import_line="$(first_line "${RELEASE_WORKFLOW}" 'docker-daemon:')"
publish_line="$(first_line "${RELEASE_WORKFLOW}" '--digestfile[=[:space:]]+[^[:space:]]*relanto-release\.digest')"
if [ -z "${gate_line}" ] || [ -z "${build_line}" ] || [ -z "${import_line}" ] || [ -z "${publish_line}" ] || \
  [ "${build_line}" -ge "${gate_line}" ] || [ "${gate_line}" -ge "${import_line}" ] || \
  [ "${import_line}" -ge "${publish_line}" ]; then
  fail 'release must run build, shared archive gate, import and smoke, and publication in this order'
fi

if [ -f "${RELEASE_ARCHIVE_GATE}" ]; then
  require_pattern "${RELEASE_ARCHIVE_GATE}" 'sha256sum[[:space:]]+"\$\{ARCHIVE_NAME\}"[[:space:]]+>[[:space:]]+"\$\{CHECKSUM_NAME\}"' \
    'the archive gate must record the archive bytes before any scan'
  require_pattern "${RELEASE_ARCHIVE_GATE}" 'CHECKSUM_NAME="\$\{ARCHIVE_NAME\}\.sha256"' \
    'the archive gate must write relanto-release.oci.tar.sha256 for the publish step'
  require_pattern "${RELEASE_ARCHIVE_GATE}" 'SOURCE_DIGEST_NAME="\$\{ARCHIVE_STEM\}\.source\.digest"' \
    'the archive gate must write relanto-release.source.digest for the publish step'
  require_pattern "${RELEASE_ARCHIVE_GATE}" '\^sha256:\[0-9a-f\]\{64\}\$' \
    'the archive gate must validate sha256 manifest digests'
  require_pattern "${RELEASE_ARCHIVE_GATE}" 'sha256sum[[:space:]]+--check' \
    'the archive gate must re-verify the archive bytes'
  gate_checksum_count="$(grep -E -c "^verify_archive_checksum '" "${RELEASE_ARCHIVE_GATE}" || true)"
  if [ "${gate_checksum_count}" -lt 2 ]; then
    fail "the archive gate must recheck OCI archive bytes after the scan and after the digest proof (${RELEASE_ARCHIVE_GATE})"
  fi
  require_pattern "${RELEASE_ARCHIVE_GATE}" '--scanners[=[:space:]]+secret' \
    'the archive gate must run the explicit Trivy secret scanner'
  require_pattern "${RELEASE_ARCHIVE_GATE}" '--exit-code[=[:space:]]+1' \
    'recognized secrets must fail the archive gate'
  require_pattern "${RELEASE_ARCHIVE_GATE}" 'tar[[:space:]]+-xf[[:space:]]+"\$\{ARCHIVE_DIR\}/\$\{ARCHIVE_NAME\}"' \
    'the secret scanner must unpack the unchanged release OCI archive into a layout directory'
  require_pattern "${RELEASE_ARCHIVE_GATE}" 'trivy[[:space:]]+image[[:space:]][^[:cntrl:]]*--input[=[:space:]]+[^[:space:]]*relanto-release-layout' \
    'the release secret scan must inspect the unpacked OCI layout directory of the release archive'
  forbid_pattern "${RELEASE_ARCHIVE_GATE}" '--input[=[:space:]]+[^[:space:]]*\.oci\.tar' \
    'Trivy cannot read an OCI archive tarball; --input must point at an OCI layout directory'
  require_pattern "${RELEASE_ARCHIVE_GATE}" 'positive-control\.oci\.tar' \
    'the secret scanner must be proven by a disposable positive-control archive'
  require_pattern "${RELEASE_ARCHIVE_GATE}" 'positive_status' \
    'the positive-control result must be checked explicitly'
  require_pattern "${RELEASE_ARCHIVE_GATE}" '--output[[:space:]]+positive-control\.json' \
    'the Trivy positive control must keep its detailed JSON finding in protected temporary storage'
  require_pattern "${RELEASE_ARCHIVE_GATE}" '\.Results\[\]\?\.Secrets\[\]\?' \
    'the Trivy positive control must prove a real secret finding rather than only an exit code'
  forbid_pattern "${RELEASE_ARCHIVE_GATE}" '(trivyignore|--ignorefile|--config|--debug|--trace|--format[=[:space:]]+sarif)' \
    'archive secret scanning must not use ignores, custom config, debug output or SARIF reports'
  require_pattern "${RELEASE_ARCHIVE_GATE}" 'skopeo[[:space:]]+copy[[:space:]]+--preserve-digests' \
    'the non-publishing proof must copy with --preserve-digests'
  require_pattern "${RELEASE_ARCHIVE_GATE}" '--digestfile[=[:space:]]+' \
    'the non-publishing proof must record the copy receipt digest'
  require_pattern "${RELEASE_ARCHIVE_GATE}" '"oci-archive:\$\{ARCHIVE_NAME\}:\$\{RELEASE_TAG\}"' \
    'the non-publishing proof must read the unchanged OCI archive'
  require_pattern "${RELEASE_ARCHIVE_GATE}" '"oci:[^[:space:]]*proof-layout:\$\{RELEASE_TAG\}"' \
    'the non-publishing proof must copy into a local OCI layout'
  require_pattern "${RELEASE_ARCHIVE_GATE}" 'source_digest\}"[[:space:]]+!=[[:space:]]+"\$\{digestfile_digest' \
    'the non-publishing proof must compare source and copy receipt digests'
  require_pattern "${RELEASE_ARCHIVE_GATE}" 'source_digest\}"[[:space:]]+!=[[:space:]]+"\$\{layout_digest' \
    'the non-publishing proof must compare source and copied layout digests'
  forbid_pattern "${RELEASE_ARCHIVE_GATE}" '(docker\.sock|docker-daemon:|docker://|docker[[:space:]]+(login|push)|skopeo[[:space:]]+login)' \
    'the shared archive gate must stay daemonless and non-publishing'
  require_pattern "${RELEASE_ARCHIVE_GATE}" 'GITHUB_STEP_SUMMARY' \
    'the archive gate must publish validated, non-secret evidence to the step summary'
fi

require_pattern "${RELEASE_WORKFLOW}" '(aquasecurity/trivy-action@[0-9a-f]{40}|aquasec/trivy[^[:space:]]*@sha256:[0-9a-f]{64})' \
  'the release secret scanner must be pinned to an immutable commit or image digest'
forbid_pattern "${RELEASE_WORKFLOW}" '(trivyignore|--ignorefile|--config|--debug|--trace|format:[[:space:]]*sarif|--format[=[:space:]]+sarif)' \
  'release secret scanning must not use ignores, custom config, debug output or SARIF reports'

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
