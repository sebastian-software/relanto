#!/usr/bin/env bash
#
# Load one verified OCI release archive into the local image store and prove
# that the loaded image is exactly the archived image. Pre-merge CI runs the
# image verifier and both smoke tests against the tag loaded here, so they test
# the same archive that scripts/verify-release-archive.sh scanned instead of a
# second build. It never logs in, never publishes, never mounts a container
# daemon socket and never uses the docker-daemon transport: the archive is read
# daemonlessly with Skopeo and loaded with the plain `docker load` CLI.
#
# Steps, in order:
#   1. Read the selected OCI manifest digest, its config digest and the config's
#      rootfs.diff_ids from the archive. When <archive-stem>.source.digest
#      (written by verify-release-archive.sh) exists, require the manifest
#      digest to equal it.
#   2. `docker load` the archive. Its output is not trusted; the requested tag
#      must resolve with `docker image inspect` afterwards.
#   3. Prove identity independently of the image store: the loaded image ID must
#      equal the manifest digest (containerd image store) or the config digest
#      (classic image store), and its RootFS layers must equal the archive
#      config's rootfs.diff_ids in the same order.
#   4. Print validated, non-secret evidence to the log and, when set, to
#      $GITHUB_STEP_SUMMARY.
#
# Usage: scripts/load-release-archive.sh <oci-archive> <image-tag>
#
# <image-tag> is the name:tag the archive was built with (for example
# relanto:ci-123). Its tag part is the archive's org.opencontainers.image.ref.name
# and addresses the manifest inside the archive.
#
# Requirements: docker, jq and skopeo.
#
# Optional environment variables:
#   SKOPEO_IMAGE  Digest-pinned Skopeo container image. When set, Skopeo runs
#                 via `docker run` with only the archive directory mounted
#                 (no socket mount) as the invoking user. When unset, the host
#                 `skopeo` is used.

set -euo pipefail

ARCHIVE_ARG="${1:?usage: load-release-archive.sh <oci-archive> <image-tag>}"
IMAGE_TAG="${2:?usage: load-release-archive.sh <oci-archive> <image-tag>}"

error() {
  printf '::error::%s\n' "$1" >&2
  exit 1
}

# name:tag without registry host or port, so the tag part is unambiguous.
if ! [[ "${IMAGE_TAG}" =~ ^[a-z0-9]+([._-][a-z0-9]+)*(/[a-z0-9]+([._-][a-z0-9]+)*)*:[A-Za-z0-9][A-Za-z0-9._-]{0,127}$ ]]; then
  error 'Image tag must be a local <name>:<tag> reference without a registry host.'
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
SOURCE_DIGEST_NAME="${ARCHIVE_STEM}.source.digest"
REF_NAME="${IMAGE_TAG##*:}"
ARCHIVE_REF="oci-archive:${ARCHIVE_NAME}:${REF_NAME}"
DIGEST_PATTERN='^sha256:[0-9a-f]{64}$'

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

# 1. Read the archived identity without any daemon transport.
if ! manifest_digest="$(skopeo inspect --format '{{.Digest}}' "${ARCHIVE_REF}")"; then
  error "OCI archive has no readable manifest named ${REF_NAME}."
fi
if ! [[ "${manifest_digest}" =~ ${DIGEST_PATTERN} ]]; then
  error 'Selected OCI manifest digest is not a sha256 digest.'
fi
if [ -f "${ARCHIVE_DIR}/${SOURCE_DIGEST_NAME}" ]; then
  recorded_digest="$(cat "${ARCHIVE_DIR}/${SOURCE_DIGEST_NAME}")"
  if [ "${manifest_digest}" != "${recorded_digest}" ]; then
    error "OCI manifest digest differs from the digest recorded in ${SOURCE_DIGEST_NAME}."
  fi
  source_digest_check="equal to ${SOURCE_DIGEST_NAME}"
else
  source_digest_check="no ${SOURCE_DIGEST_NAME} recorded"
fi

if ! config_digest="$(skopeo inspect --raw "${ARCHIVE_REF}" | jq -r '.config.digest')"; then
  error 'Could not read the config digest from the archived manifest.'
fi
if ! [[ "${config_digest}" =~ ${DIGEST_PATTERN} ]]; then
  error 'Archived config digest is not a sha256 digest.'
fi
if ! archive_diff_ids="$(skopeo inspect --config "${ARCHIVE_REF}" | jq -c '.rootfs.diff_ids')"; then
  error 'Could not read rootfs.diff_ids from the archived image config.'
fi
if ! jq -e 'type == "array" and length > 0 and all(.[]; test("^sha256:[0-9a-f]{64}$"))' \
  <<<"${archive_diff_ids}" >/dev/null; then
  error 'Archived rootfs.diff_ids is not a non-empty list of sha256 digests.'
fi

# 2. Load the archive. The CLI output is informational only.
docker load --input "${ARCHIVE_DIR}/${ARCHIVE_NAME}"
if ! loaded_id="$(docker image inspect --format '{{.Id}}' "${IMAGE_TAG}" 2>/dev/null)"; then
  error "Image tag ${IMAGE_TAG} is absent after docker load; the image store did not tag the OCI archive. Refusing to fall back to a rebuild or a daemon transport."
fi
loaded_layers="$(docker image inspect --format '{{json .RootFS.Layers}}' "${IMAGE_TAG}" | jq -c '.')"

# 3. Prove that the loaded tag is the archived image.
if [ "${loaded_id}" = "${manifest_digest}" ]; then
  identity_branch='containerd image store: image ID equals the OCI manifest digest'
elif [ "${loaded_id}" = "${config_digest}" ]; then
  identity_branch='classic image store: image ID equals the OCI config digest'
else
  error "Loaded image ${IMAGE_TAG} (${loaded_id}) is neither the archived manifest digest nor the archived config digest."
fi
if [ "${loaded_layers}" != "${archive_diff_ids}" ]; then
  error "Loaded image ${IMAGE_TAG} RootFS layers differ from the archived config rootfs.diff_ids."
fi
layer_count="$(jq 'length' <<<"${archive_diff_ids}")"

# 4. Every check passed; publish only validated, non-secret evidence.
printf 'Loaded image tag: %s\n' "${IMAGE_TAG}"
printf 'Selected OCI manifest digest: %s (%s)\n' "${manifest_digest}" "${source_digest_check}"
printf 'Archived config digest: %s\n' "${config_digest}"
printf 'Loaded image ID: %s\n' "${loaded_id}"
printf 'Identity: %s\n' "${identity_branch}"
printf 'RootFS layers: %s, equal to the archived rootfs.diff_ids in order\n' "${layer_count}"
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    printf '### Loaded release archive identity\n\n'
    printf '| Evidence | Value |\n'
    printf '| --- | --- |\n'
    printf '| Loaded image tag | `%s` |\n' "${IMAGE_TAG}"
    printf '| Selected OCI manifest digest | `%s` (%s) |\n' "${manifest_digest}" "${source_digest_check}"
    printf '| Archived config digest | `%s` |\n' "${config_digest}"
    printf '| Loaded image ID | `%s` |\n' "${loaded_id}"
    printf '| Identity | %s |\n' "${identity_branch}"
    printf '| RootFS layers | %s, equal to the archived `rootfs.diff_ids` in order |\n\n' "${layer_count}"
  } >> "${GITHUB_STEP_SUMMARY}"
fi
