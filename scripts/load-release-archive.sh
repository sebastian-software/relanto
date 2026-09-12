#!/usr/bin/env bash
#
# Load one verified OCI release archive into the local image store and prove
# that the loaded image is exactly the archived image. Pre-merge CI and the
# release workflow run the image verifier and both smoke tests against the
# reference loaded here, so they test the same archive that
# scripts/verify-release-archive.sh scanned instead of a second build or a
# daemon-transport import. It never logs in, never publishes, never mounts a
# container daemon socket and never uses the docker-daemon transport: the
# archive is read daemonlessly with Skopeo and loaded with the plain
# `docker load` CLI.
#
# Steps, in order:
#   1. Read the selected OCI manifest digest, its config digest and the config's
#      rootfs.diff_ids from the archive. When <archive-stem>.source.digest
#      (written by verify-release-archive.sh) exists, require the manifest
#      digest to equal it.
#   2. `docker load` the unchanged OCI archive. The containerd image store
#      accepts it. The classic image store (for example Docker 28 on the GitHub
#      ubuntu-24.04 runner) rejects a Buildx OCI archive without manifest.json.
#      Only when the load fails or the reference is absent afterwards, convert the
#      archive file-to-file into a temporary <archive-stem>.docker.tar with
#      Skopeo (docker-archive transport, archive directory mounted, no socket),
#      prove that the conversion kept the archived config blob and layer count,
#      and `docker load` that file. The original archive bytes are never
#      modified; the temporary Docker archive is removed on exit.
#   3. Prove identity strictly for the load path taken; CLI output is never
#      trusted and the exact reference must resolve with `docker image inspect`:
#        - OCI archive on the containerd image store: image ID equals the OCI
#          manifest digest;
#        - OCI archive on a classic image store that accepts it: image ID equals
#          the config digest;
#        - Docker archive: image ID equals the config digest (classic image
#          store). A containerd image store would synthesize a new manifest
#          digest that the archive cannot vouch for, so any other ID fails.
#      In every case the RootFS layers must equal the archive config's
#      rootfs.diff_ids in the same order.
#   4. Print validated, non-secret evidence to the log and, when set, to
#      $GITHUB_STEP_SUMMARY.
#
# Usage: scripts/load-release-archive.sh <oci-archive> <image-tag>
#
# <image-tag> is the exact [registry-host[:port]/]name:tag reference the archive
# was built with, for example relanto:ci-123 in pre-merge CI or
# ghcr.io/sebastian-software/relanto:frontend-v1.2.3 in the release workflow.
# Buildx records that reference as io.containerd.image.name, which a containerd
# image store restores on `docker load`, and its tag part as the archive's
# org.opencontainers.image.ref.name, which addresses the manifest inside the
# archive. A registry host only names the local reference: this loader never
# contacts a registry. Digest references are rejected.
#
# Requirements: docker, jq, tar, sha256sum and skopeo.
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

# [registry-host[:port]/]name:tag without a digest. A registry host must carry a
# dot or a port (for example ghcr.io or localhost:5000), so it cannot be mistaken
# for a lowercase path component, and the tag is always the part after the last
# colon.
HOST_COMPONENT_PATTERN='[a-z0-9]([a-z0-9-]*[a-z0-9])?'
REGISTRY_HOST_PATTERN="${HOST_COMPONENT_PATTERN}((\\.${HOST_COMPONENT_PATTERN})+(:[0-9]{1,5})?|:[0-9]{1,5})"
NAME_COMPONENT_PATTERN='[a-z0-9]+([._-][a-z0-9]+)*'
TAG_PATTERN='[A-Za-z0-9][A-Za-z0-9._-]{0,127}'
IMAGE_REFERENCE_PATTERN="^(${REGISTRY_HOST_PATTERN}/)?${NAME_COMPONENT_PATTERN}(/${NAME_COMPONENT_PATTERN})*:${TAG_PATTERN}\$"
if ! [[ "${IMAGE_TAG}" =~ ${IMAGE_REFERENCE_PATTERN} ]]; then
  error 'Image tag must be a [registry-host[:port]/]<name>:<tag> reference without a digest.'
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
DOCKER_ARCHIVE_NAME="${ARCHIVE_STEM}.docker.tar"
REF_NAME="${IMAGE_TAG##*:}"
ARCHIVE_REF="oci-archive:${ARCHIVE_NAME}:${REF_NAME}"
DIGEST_PATTERN='^sha256:[0-9a-f]{64}$'

# The temporary Docker archive is derived from the OCI archive and removed on
# every exit; the OCI archive itself is only ever read.
cleanup() {
  rm -f -- "${ARCHIVE_DIR}/${DOCKER_ARCHIVE_NAME}"
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
layer_count="$(jq 'length' <<<"${archive_diff_ids}")"

# 2. Load the unchanged OCI archive; fall back to a file-based Docker archive
#    only when the image store rejects it. CLI output is informational only.
if docker load --input "${ARCHIVE_DIR}/${ARCHIVE_NAME}" && \
  docker image inspect --format '{{.Id}}' "${IMAGE_TAG}" >/dev/null 2>&1; then
  load_path='oci-archive'
else
  printf 'The image store did not load the OCI archive as %s; converting it daemonlessly into a temporary Docker archive.\n' "${IMAGE_TAG}"
  load_path='docker-archive'
  # Skopeo refuses to write into an existing Docker archive; a leftover file
  # can only come from an interrupted earlier run of this loader.
  rm -f -- "${ARCHIVE_DIR}/${DOCKER_ARCHIVE_NAME}"
  if ! skopeo copy "${ARCHIVE_REF}" "docker-archive:${DOCKER_ARCHIVE_NAME}:${IMAGE_TAG}"; then
    error 'Could not convert the OCI archive into a Docker archive with Skopeo.'
  fi

  # The converted archive must carry exactly the archived config blob and one
  # layer per archived diff_id; its layer contents are proven after the load.
  if ! converted_manifest="$(tar -xOf "${ARCHIVE_DIR}/${DOCKER_ARCHIVE_NAME}" manifest.json)"; then
    error 'Converted Docker archive has no readable manifest.json.'
  fi
  if ! jq -e --arg layers "${layer_count}" \
    'type == "array" and length == 1 and (.[0].Layers | length) == ($layers | tonumber)' \
    <<<"${converted_manifest}" >/dev/null; then
    error 'Converted Docker archive must describe exactly one image with one layer per archived diff_id.'
  fi
  converted_config_name="$(jq -r '.[0].Config' <<<"${converted_manifest}")"
  if [ "${converted_config_name}" != "${config_digest#sha256:}.json" ]; then
    error 'Converted Docker archive does not reference the archived config blob.'
  fi
  if ! converted_config_hex="$(tar -xOf "${ARCHIVE_DIR}/${DOCKER_ARCHIVE_NAME}" "${converted_config_name}" | sha256sum | cut -d ' ' -f 1)"; then
    error 'Could not read the config blob from the converted Docker archive.'
  fi
  converted_config_digest="sha256:${converted_config_hex}"
  if [ "${converted_config_digest}" != "${config_digest}" ]; then
    error 'Converted Docker archive config bytes differ from the archived config digest.'
  fi

  if ! docker load --input "${ARCHIVE_DIR}/${DOCKER_ARCHIVE_NAME}"; then
    error 'The image store rejected the converted Docker archive as well.'
  fi
  cleanup
fi
if ! loaded_id="$(docker image inspect --format '{{.Id}}' "${IMAGE_TAG}" 2>/dev/null)"; then
  error "Image tag ${IMAGE_TAG} is absent after docker load of the ${load_path}. Refusing to fall back to a rebuild or a daemon transport."
fi
loaded_layers="$(docker image inspect --format '{{json .RootFS.Layers}}' "${IMAGE_TAG}" | jq -c '.')"

# 3. Prove that the loaded tag is the archived image for the path taken.
if [ "${load_path}" = 'oci-archive' ] && [ "${loaded_id}" = "${manifest_digest}" ]; then
  identity_branch='OCI archive, containerd image store: image ID equals the OCI manifest digest'
elif [ "${load_path}" = 'oci-archive' ] && [ "${loaded_id}" = "${config_digest}" ]; then
  identity_branch='OCI archive, classic image store: image ID equals the OCI config digest'
elif [ "${load_path}" = 'docker-archive' ] && [ "${loaded_id}" = "${config_digest}" ]; then
  identity_branch='Docker archive converted by Skopeo, classic image store: image ID equals the OCI config digest'
elif [ "${load_path}" = 'docker-archive' ]; then
  error "Loaded image ${IMAGE_TAG} (${loaded_id}) from the converted Docker archive is not the archived config digest; this image store does not prove the archive identity."
else
  error "Loaded image ${IMAGE_TAG} (${loaded_id}) is neither the archived manifest digest nor the archived config digest."
fi
if [ "${loaded_layers}" != "${archive_diff_ids}" ]; then
  error "Loaded image ${IMAGE_TAG} RootFS layers differ from the archived config rootfs.diff_ids."
fi

# 4. Every check passed; publish only validated, non-secret evidence.
printf 'Loaded image tag: %s\n' "${IMAGE_TAG}"
printf 'Load path: %s\n' "${load_path}"
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
    printf '| Load path | `%s` |\n' "${load_path}"
    printf '| Selected OCI manifest digest | `%s` (%s) |\n' "${manifest_digest}" "${source_digest_check}"
    printf '| Archived config digest | `%s` |\n' "${config_digest}"
    printf '| Loaded image ID | `%s` |\n' "${loaded_id}"
    printf '| Identity | %s |\n' "${identity_branch}"
    printf '| RootFS layers | %s, equal to the archived `rootfs.diff_ids` in order |\n\n' "${layer_count}"
  } >> "${GITHUB_STEP_SUMMARY}"
fi
