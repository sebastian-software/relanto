#!/usr/bin/env bash

set -euo pipefail

VOLUME_NAME="${RELANTO_VOLUME_NAME:-relanto-data}"
CONTAINER_IMAGE="${RELANTO_BACKUP_IMAGE:-docker.io/library/alpine:3.22}"
confirmed="false"

resolve_existing_dir() {
  local dir_path="$1"
  (
    cd "$dir_path"
    pwd -P
  )
}

print_usage() {
  cat <<'EOF'
Usage:
  deploy/restore-relanto-data.sh --yes ARCHIVE_PATH

Restores the persistent Relanto volume from a gzipped tar archive.

The archive holds a consistent standalone SQLite snapshot (created by
backup-relanto-data.sh via the online ".backup" API) without -wal/-shm
sidecars. The current volume contents -- including any stale -wal/-shm or
-journal files -- are deleted before extraction, so the restored database
is a clean, consistent copy.

Important:
  Stop the Relanto container or Quadlet unit before running restore.
  The current volume contents will be deleted before extraction.

Arguments:
  ARCHIVE_PATH  Required backup archive path on the host.

Options:
  --yes         Required confirmation flag for destructive restore.
  --help, -h    Show this help message.

Environment:
  RELANTO_VOLUME_NAME   Podman volume name to restore. Default: relanto-data
  RELANTO_BACKUP_IMAGE  Helper image used for tar. Default: docker.io/library/alpine:3.22
EOF
}

while (($# > 0)); do
  case "$1" in
    --yes)
      confirmed="true"
      shift
      ;;
    --help|-h)
      print_usage
      exit 0
      ;;
    *)
      break
      ;;
  esac
done

if [[ "$confirmed" != "true" ]]; then
  echo "Restore requires --yes because it overwrites the current volume contents." >&2
  exit 1
fi

if (($# != 1)); then
  print_usage >&2
  exit 1
fi

if ! command -v podman >/dev/null 2>&1; then
  echo "podman is required for restore." >&2
  exit 1
fi

archive_path="$1"

if [[ ! -f "$archive_path" ]]; then
  echo "Backup archive not found: $archive_path" >&2
  exit 1
fi

archive_dir_absolute="$(resolve_existing_dir "$(dirname "$archive_path")")"
archive_name="$(basename "$archive_path")"

# Wipe the volume completely (this also removes any leftover -wal/-shm/-journal
# files that could otherwise reintroduce inconsistency) and extract the
# consistent snapshot from the archive.
podman run --rm \
  --volume "${VOLUME_NAME}:/volume" \
  --volume "${archive_dir_absolute}:/backup:ro" \
  --env ARCHIVE_NAME="${archive_name}" \
  "${CONTAINER_IMAGE}" \
  sh -eu -c 'find /volume -mindepth 1 -maxdepth 1 -exec rm -rf {} + && tar -C /volume -xzf "/backup/${ARCHIVE_NAME}"'

echo "Restore completed for volume ${VOLUME_NAME} from ${archive_dir_absolute}/${archive_name}"
