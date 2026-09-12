#!/usr/bin/env bash
#
# Non-publishing release gate for one OCI archive. The pull-request CI job and
# the release workflow both run this script so the pre-merge gate and the
# release gate cannot drift apart. It never logs in, never pushes and never
# talks to a container daemon through a socket mount or the docker-daemon
# transport.
#
# Steps, in order:
#   1. Record the archive bytes (<archive>.sha256) and the selected OCI manifest
#      digest (<archive-stem>.source.digest) next to the archive.
#   2. Prove the Trivy secret scanner with a disposable positive control that
#      must fail closed with a real finding.
#   3. Scan the unchanged release archive (unpacked into an OCI layout) for
#      secrets and re-verify the archive checksum.
#   4. Prove digest preservation without publishing: copy the archive into a
#      temporary OCI layout with --preserve-digests and --digestfile and
#      require source, copy receipt and layout digests to be identical.
#   5. Print validated, non-secret evidence to the log and, when set, to
#      $GITHUB_STEP_SUMMARY. Key material, Trivy JSON and findings stay private.
#
# Usage: scripts/verify-release-archive.sh <oci-archive> <release-tag>
#
# Requirements: sha256sum, tar, jq, openssl, trivy, docker buildx (for the tiny
# positive-control image) and skopeo.
#
# Optional environment variables:
#   SKOPEO_IMAGE  Digest-pinned Skopeo container image. When set, Skopeo runs
#                 via `docker run` with only the archive directory mounted
#                 (no socket mount) as the invoking user, so both workflows
#                 use the same pinned Skopeo release instead of whatever the
#                 runner image ships. When unset, the host `skopeo` is used.
#   RUNNER_TEMP   Base directory for Trivy temporary files (default: TMPDIR).

set -euo pipefail

ARCHIVE_ARG="${1:?usage: verify-release-archive.sh <oci-archive> <release-tag>}"
RELEASE_TAG="${2:?usage: verify-release-archive.sh <oci-archive> <release-tag>}"

error() {
  printf '::error::%s\n' "$1" >&2
  exit 1
}

if ! [[ "${RELEASE_TAG}" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$ ]]; then
  error 'Release tag is not a valid container tag.'
fi
if [ ! -f "${ARCHIVE_ARG}" ]; then
  error "OCI archive does not exist: ${ARCHIVE_ARG}"
fi

ARCHIVE_DIR="$(cd -- "$(dirname -- "${ARCHIVE_ARG}")" && pwd -P)"
ARCHIVE_NAME="$(basename -- "${ARCHIVE_ARG}")"
if [[ "${ARCHIVE_NAME}" != *.oci.tar ]]; then
  error 'OCI archive file name must end in .oci.tar.'
fi
ARCHIVE_STEM="${ARCHIVE_NAME%.oci.tar}"
CHECKSUM_NAME="${ARCHIVE_NAME}.sha256"
SOURCE_DIGEST_NAME="${ARCHIVE_STEM}.source.digest"
TEMP_BASE="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"
TEMP_BASE="${TEMP_BASE%/}"
DIGEST_PATTERN='^sha256:[0-9a-f]{64}$'

control_root=""
release_scan_root=""
proof_root=""
cleanup() {
  if [ -n "${control_root}" ]; then rm -rf -- "${control_root}"; fi
  if [ -n "${release_scan_root}" ]; then rm -rf -- "${release_scan_root}"; fi
  if [ -n "${proof_root}" ]; then rm -rf -- "${proof_root}"; fi
}
trap cleanup EXIT

# All Skopeo paths are relative to the archive directory, which is the only
# directory mounted into the pinned Skopeo container.
skopeo() {
  if [ -n "${SKOPEO_IMAGE:-}" ]; then
    docker run --rm \
      --user "$(id -u):$(id -g)" \
      --env HOME=/tmp \
      --volume "${ARCHIVE_DIR}:/work" \
      --workdir /work \
      --entrypoint skopeo \
      "${SKOPEO_IMAGE}" "$@"
  else
    (cd -- "${ARCHIVE_DIR}" && command skopeo "$@")
  fi
}

verify_archive_checksum() {
  if ! (cd -- "${ARCHIVE_DIR}" && sha256sum --check --status "${CHECKSUM_NAME}"); then
    error "OCI archive bytes changed after the checksum was recorded ($1)."
  fi
  printf 'Archive checksum re-verified %s.\n' "$1"
}

skopeo --version
trivy --version

# 1. Record archive bytes and the selected OCI manifest digest.
(cd -- "${ARCHIVE_DIR}" && sha256sum "${ARCHIVE_NAME}" > "${CHECKSUM_NAME}")
archive_sha256="$(cut -d ' ' -f 1 "${ARCHIVE_DIR}/${CHECKSUM_NAME}")"
if ! [[ "${archive_sha256}" =~ ^[0-9a-f]{64}$ ]]; then
  error 'Release archive checksum is not a SHA-256 value.'
fi

if ! source_digest="$(skopeo inspect \
  --format '{{.Digest}}' \
  "oci-archive:${ARCHIVE_NAME}:${RELEASE_TAG}")"; then
  error "OCI archive has no readable manifest tagged ${RELEASE_TAG}."
fi
if ! [[ "${source_digest}" =~ ${DIGEST_PATTERN} ]]; then
  error 'Selected OCI manifest digest is not a sha256 digest.'
fi
printf '%s\n' "${source_digest}" > "${ARCHIVE_DIR}/${SOURCE_DIGEST_NAME}"

# 2. Prove that the Trivy secret scanner fails closed on a real secret.
control_root="$(mktemp -d "${TEMP_BASE}/relanto-trivy-control.XXXXXX")"
chmod 700 "${control_root}"
openssl genpkey \
  -algorithm RSA \
  -pkeyopt rsa_keygen_bits:2048 \
  -out "${control_root}/positive-control.pem" \
  2>/dev/null
printf '%s\n' \
  'FROM scratch' \
  'COPY positive-control.pem /positive-control.pem' \
  > "${control_root}/Dockerfile"
docker buildx build \
  --file "${control_root}/Dockerfile" \
  --output "type=oci,dest=${control_root}/positive-control.oci.tar" \
  --platform linux/amd64 \
  --progress quiet \
  "${control_root}" >/dev/null

# Trivy's --input accepts a docker-save tarball or an OCI image layout
# directory, not an OCI archive tarball. Each unchanged archive is therefore
# unpacked into a temporary layout directory.
mkdir -m 700 "${control_root}/positive-control-layout"
tar -xf "${control_root}/positive-control.oci.tar" \
  -C "${control_root}/positive-control-layout"

set +e
# Detailed positive-control findings stay inside the mode-700 temporary
# directory; output exposes only the verdict.
(
  cd -- "${control_root}"
  trivy image \
    --scanners secret \
    --exit-code 1 \
    --format json \
    --output positive-control.json \
    --input positive-control-layout \
    >/dev/null 2>&1
)
positive_status=$?
set -e
if [ "${positive_status}" -ne 1 ] || \
  ! jq -e '[.Results[]?.Secrets[]?] | length > 0' \
    "${control_root}/positive-control.json" >/dev/null; then
  error 'Trivy secret-scanner positive control did not fail closed.'
fi
rm -rf -- "${control_root}"
control_root=""
positive_verdict='Trivy secret-scanner positive control failed closed as expected.'
printf '%s\n' "${positive_verdict}"

# 3. Scan the unchanged release archive for recognized secrets.
release_scan_root="$(mktemp -d "${TEMP_BASE}/relanto-trivy-release-root.XXXXXX")"
chmod 700 "${release_scan_root}"
mkdir -m 700 "${release_scan_root}/relanto-release-layout"
tar -xf "${ARCHIVE_DIR}/${ARCHIVE_NAME}" \
  -C "${release_scan_root}/relanto-release-layout"
if ! (
  cd -- "${release_scan_root}"
  trivy image --scanners secret --exit-code 1 --input relanto-release-layout \
    >/dev/null 2>"${release_scan_root}/trivy-release.log"
); then
  error 'Release archive secret scan failed or detected a recognized secret.'
fi
rm -rf -- "${release_scan_root}"
release_scan_root=""
scan_verdict='Release archive scan found no recognized secrets under the active Trivy rules.'
printf '%s\n' "${scan_verdict}"
verify_archive_checksum 'after the secret scan'

# 4. Prove digest preservation without publishing. The proof layout must live
# inside the archive directory because that is all the Skopeo container sees.
proof_root="$(mktemp -d "${ARCHIVE_DIR}/.relanto-digest-proof.XXXXXX")"
proof_name="$(basename -- "${proof_root}")"
skopeo copy --preserve-digests \
  --digestfile "${proof_name}/proof.digest" \
  "oci-archive:${ARCHIVE_NAME}:${RELEASE_TAG}" \
  "oci:${proof_name}/proof-layout:${RELEASE_TAG}"
digestfile_digest="$(cat "${proof_root}/proof.digest")"
layout_digest="$(skopeo inspect \
  --format '{{.Digest}}' \
  "oci:${proof_name}/proof-layout:${RELEASE_TAG}")"
if ! [[ "${digestfile_digest}" =~ ${DIGEST_PATTERN} ]] || \
  ! [[ "${layout_digest}" =~ ${DIGEST_PATTERN} ]]; then
  error 'Digest-preservation proof did not yield sha256 digests.'
fi
if [ "${source_digest}" != "${digestfile_digest}" ] || \
  [ "${source_digest}" != "${layout_digest}" ]; then
  error 'Source, copy receipt and copied OCI layout digests differ.'
fi
rm -rf -- "${proof_root}"
proof_root=""
verify_archive_checksum 'after the digest-preservation proof'

# 5. Every check passed; publish only validated, non-secret evidence.
printf 'Release tag: %s\n' "${RELEASE_TAG}"
printf '%s SHA-256: %s\n' "${ARCHIVE_NAME}" "${archive_sha256}"
printf 'Selected OCI manifest digest: %s\n' "${source_digest}"
printf 'Non-publishing copy receipt digest (--digestfile): %s\n' "${digestfile_digest}"
printf 'Copied OCI layout digest: %s\n' "${layout_digest}"
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    printf '### Release archive evidence\n\n'
    printf '| Evidence | Value |\n'
    printf '| --- | --- |\n'
    printf '| Release tag | `%s` |\n' "${RELEASE_TAG}"
    printf '| `%s` SHA-256 | `%s` |\n' "${ARCHIVE_NAME}" "${archive_sha256}"
    printf '| Selected OCI manifest digest | `%s` |\n' "${source_digest}"
    printf '| Non-publishing copy receipt digest | `%s` |\n' "${digestfile_digest}"
    printf '| Copied OCI layout digest | `%s` |\n' "${layout_digest}"
    printf '| Trivy positive control | %s |\n' "${positive_verdict}"
    printf '| Trivy release archive scan | %s |\n\n' "${scan_verdict}"
    printf 'Source, copy receipt and copied layout digests are identical; the archive checksum was re-verified after the scan and after the digest proof.\n\n'
  } >> "${GITHUB_STEP_SUMMARY}"
fi
