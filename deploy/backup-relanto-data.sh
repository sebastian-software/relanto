#!/usr/bin/env bash

set -euo pipefail

VOLUME_NAME="${RELANTO_VOLUME_NAME:-relanto-data}"
CONTAINER_IMAGE="${RELANTO_BACKUP_IMAGE:-docker.io/library/alpine:3.22}"
# Database file name inside the volume. Must match the basename of MAILER_DB_PATH
# (default deployment: /var/lib/relanto/mailer.sqlite -> "mailer.sqlite").
DB_FILENAME="${RELANTO_DB_FILENAME:-mailer.sqlite}"

timestamp() {
  date +"%Y%m%d-%H%M%S"
}

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
  deploy/backup-relanto-data.sh [ARCHIVE_PATH]

Creates a gzipped tar archive of the persistent Relanto volume.

The SQLite database is captured with a consistent online snapshot
(sqlite3 ".backup"), so the backup can run while Relanto keeps writing
and stays consistent even in WAL mode. The resulting archive contains a
standalone database snapshot (no -wal/-shm sidecars) plus any other files
found in the volume.

Arguments:
  ARCHIVE_PATH  Optional target archive path on the host.
                Default: ./relanto-backup-YYYYMMDD-HHMMSS.tar.gz

Environment:
  RELANTO_VOLUME_NAME   Podman volume name to back up. Default: relanto-data
  RELANTO_BACKUP_IMAGE  Helper image (needs sqlite3; alpine installs it on the
                        fly). Default: docker.io/library/alpine:3.22
  RELANTO_DB_FILENAME   Database file name inside the volume. Default: mailer.sqlite
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  print_usage
  exit 0
fi

if ! command -v podman >/dev/null 2>&1; then
  echo "podman is required for backup." >&2
  exit 1
fi

archive_path="${1:-./relanto-backup-$(timestamp).tar.gz}"
archive_dir="$(dirname "$archive_path")"
archive_name="$(basename "$archive_path")"

mkdir -p "$archive_dir"
archive_dir_absolute="$(resolve_existing_dir "$archive_dir")"

# The volume is mounted read-write on purpose. The SQLite online backup opens
# the live database, and in WAL mode SQLite needs to create/update the shared
# memory (-shm) file and acquire read locks -- both impossible on a ":ro" mount,
# which would break the online backup. We never modify the actual data: the
# helper only reads the volume and writes the snapshot into a private temp dir
# before tarring it, so the live database stays untouched.
podman run --rm \
  --volume "${VOLUME_NAME}:/volume" \
  --volume "${archive_dir_absolute}:/backup" \
  --env ARCHIVE_NAME="${archive_name}" \
  --env DB_FILENAME="${DB_FILENAME}" \
  "${CONTAINER_IMAGE}" \
  sh -eu -c '
    apk add --no-cache sqlite >/dev/null

    work="$(mktemp -d)"
    db="/volume/${DB_FILENAME}"

    # Copy every volume entry except the live database and its WAL/journal
    # sidecars. The database is snapshotted separately via the online backup API.
    find /volume -mindepth 1 -maxdepth 1 \
      ! -name "${DB_FILENAME}" \
      ! -name "${DB_FILENAME}-wal" \
      ! -name "${DB_FILENAME}-shm" \
      ! -name "${DB_FILENAME}-journal" \
      -exec cp -a {} "${work}/" \;

    if [ -f "${db}" ]; then
      # Consistent, WAL-safe snapshot into a single consolidated file. The
      # ".backup" command uses the SQLite online backup API and produces a
      # standalone database without accompanying -wal/-shm files.
      sqlite3 "${db}" ".backup ${work}/${DB_FILENAME}"
    fi

    tar -C "${work}" -czf "/backup/${ARCHIVE_NAME}" .
  '

echo "Backup written to ${archive_dir_absolute}/${archive_name}"
