#!/usr/bin/env bash
#
# Boot the freshly built container image with a minimal, production-like
# environment and verify its health, root asset links, and favicon responses.
# The optional operator-assets fixture mode additionally proves that incomplete
# read-only overlays fail fast and that a complete harmless overlay is served
# with the expected link order and MIME types.
#
# Usage: scripts/smoke-test-container.sh <image-ref>
#
# Optional environment variables:
#   CONTAINER_TOOL                       Container CLI to use (default: docker).
#   SMOKE_TEST_PORT                      Host port to publish (default: 3000).
#   SMOKE_TEST_TIMEOUT_SECONDS           Overall wait budget (default: 60).
#   SMOKE_TEST_POLL_INTERVAL_SECONDS     Delay between polls (default: 2).
#   SMOKE_TEST_OPERATOR_ASSETS_FIXTURE   Use the temporary overlay fixture
#                                        (default: false; accepted: false/true).

set -euo pipefail

IMAGE="${1:?usage: smoke-test-container.sh <image-ref>}"

CONTAINER_TOOL="${CONTAINER_TOOL:-docker}"
CONTAINER_NAME="relanto-smoke-test-$$"
HOST_PORT="${SMOKE_TEST_PORT:-3000}"
BASE_URL="http://127.0.0.1:${HOST_PORT}"
HEALTH_URL="${BASE_URL}/health"
TIMEOUT_SECONDS="${SMOKE_TEST_TIMEOUT_SECONDS:-60}"
POLL_INTERVAL_SECONDS="${SMOKE_TEST_POLL_INTERVAL_SECONDS:-2}"
OPERATOR_FIXTURE_MODE="${SMOKE_TEST_OPERATOR_ASSETS_FIXTURE:-false}"

case "${OPERATOR_FIXTURE_MODE}" in
  false | true) ;;
  *)
    echo "SMOKE_TEST_OPERATOR_ASSETS_FIXTURE must be 'false' or 'true'." >&2
    exit 2
    ;;
esac

if ! [[ "${HOST_PORT}" =~ ^[0-9]+$ ]] || (( HOST_PORT < 1 || HOST_PORT > 65535 )); then
  echo "SMOKE_TEST_PORT must be an integer between 1 and 65535." >&2
  exit 2
fi

if ! [[ "${TIMEOUT_SECONDS}" =~ ^[0-9]+$ ]] || (( TIMEOUT_SECONDS < 1 )); then
  echo "SMOKE_TEST_TIMEOUT_SECONDS must be a positive integer." >&2
  exit 2
fi

if ! [[ "${POLL_INTERVAL_SECONDS}" =~ ^[0-9]+$ ]] || (( POLL_INTERVAL_SECONDS < 1 )); then
  echo "SMOKE_TEST_POLL_INTERVAL_SECONDS must be a positive integer." >&2
  exit 2
fi

PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
TEMP_ROOT=""
active_containers=()

cleanup_container() {
  local container_name="$1"
  "${CONTAINER_TOOL}" rm --force "${container_name}" >/dev/null 2>&1 || true
}

cleanup() {
  local container_name

  for container_name in "${active_containers[@]-}"; do
    if [ -n "${container_name}" ]; then
      cleanup_container "${container_name}"
    fi
  done

  if [ -n "${TEMP_ROOT}" ]; then
    case "${TEMP_ROOT}" in
      "${PROJECT_ROOT}"/.relanto-smoke-test.*) rm -rf -- "${TEMP_ROOT}" ;;
      *) echo "Refusing to remove unexpected temporary path: ${TEMP_ROOT}" >&2 ;;
    esac
  fi
}
trap cleanup EXIT
TEMP_ROOT="$(mktemp -d "${PROJECT_ROOT}/.relanto-smoke-test.XXXXXX")"

runtime_environment=(
  --env NODE_ENV=production
  --env PORT=3000
  --env MAILER_DB_PATH=/tmp/relanto-smoke-test.sqlite
  --env MAILER_SECRET_KEY=smoke-test-mailer-secret-key-0123456789abcdef
  --env APP_SESSION_SECRET=smoke-test-session-secret-key-0123456789abcdef
  --env POCKET_ID_ISSUER=https://pocket-id.smoke-test.example.com
  --env POCKET_ID_CLIENT_ID=smoke-test-client
  --env POCKET_ID_REDIRECT_URI=http://127.0.0.1:3000/auth/callback
)

inspect_standard_image() {
  echo "Inspecting the standard image asset boundary..."
  # Variables intentionally expand inside the container shell.
  # shellcheck disable=SC2016
  "${CONTAINER_TOOL}" run --rm --entrypoint sh "${IMAGE}" -eu -c '
    scoped_asset_package_pattern="@[[:alnum:]._-]+/assets"
    font_file="$(find /app -type f \( -iname "*.woff" -o -iname "*.woff2" -o -iname "*.ttf" -o -iname "*.otf" \) -print -quit)"
    private_package_path="$(find /app -path "*node_modules/@*/assets*" -print -quit)"

    if [ -n "${font_file}" ]; then
      echo "Standard image contains a font binary: ${font_file}" >&2
      exit 1
    fi

    if [ -n "${private_package_path}" ]; then
      echo "Standard image contains the private asset package path." >&2
      exit 1
    fi

    if [ -e /app/build/client/operator-assets ]; then
      echo "Standard image contains the reserved operator-assets directory." >&2
      exit 1
    fi

    if grep -R -I -q -E "${scoped_asset_package_pattern}" /app; then
      echo "Standard image contains the private asset package marker." >&2
      exit 1
    fi

    if grep -R -I -q -E "(Sa""ns|Ser""if|Sl""ab)" /app; then
      echo "Standard image contains a proprietary font-family marker." >&2
      exit 1
    fi
  '
}

create_overlay_fixture() {
  local fixture_directory="$1"
  local omitted_file="${2:-}"

  mkdir -p "${fixture_directory}"

  if [ "${omitted_file}" != "theme.css" ]; then
    printf '%s\n' \
      ':root {' \
      '  --relanto-font-body: system-ui, sans-serif;' \
      '  --relanto-font-display: Georgia, serif;' \
      '  --relanto-font-accent: ui-monospace, monospace;' \
      '  --relanto-color-night: #17233a;' \
      '  --relanto-color-base: #fff8e8;' \
      '  --relanto-color-bright: #d89b2b;' \
      '  --relanto-color-paper: #fffdf7;' \
      '}' >"${fixture_directory}/theme.css"
  fi

  if [ "${omitted_file}" != "logo-software.svg" ]; then
    printf '%s\n' \
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 40" role="img" aria-label="Fixture operator">' \
      '  <rect width="160" height="40" rx="4" fill="#17233a"/>' \
      '  <text x="12" y="26" fill="#fffdf7" font-family="system-ui" font-size="16">Fixture operator</text>' \
      '</svg>' >"${fixture_directory}/logo-software.svg"
  fi

  if [ "${omitted_file}" != "favicon.svg" ]; then
    printf '%s\n' \
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" role="img" aria-label="Fixture favicon">' \
      '  <rect width="32" height="32" rx="6" fill="#d89b2b"/>' \
      '  <circle cx="16" cy="16" r="7" fill="#17233a"/>' \
      '</svg>' >"${fixture_directory}/favicon.svg"
  fi
}

assert_missing_fixture_rejected() {
  local missing_file="$1"
  local fixture_directory="${TEMP_ROOT}/missing-${missing_file%.svg}"
  local container_name="${CONTAINER_NAME}-missing-${missing_file//./-}"
  local deadline
  local is_running
  local exit_code
  local logs

  create_overlay_fixture "${fixture_directory}" "${missing_file}"
  active_containers+=("${container_name}")

  echo "Checking fail-fast startup with missing ${missing_file}..."
  "${CONTAINER_TOOL}" run --detach \
    --name "${container_name}" \
    "${runtime_environment[@]}" \
    --env RELANTO_OPERATOR_ASSETS=true \
    --volume "${fixture_directory}:/app/build/client/operator-assets:ro" \
    "${IMAGE}" >/dev/null

  deadline=$(( $(date +%s) + TIMEOUT_SECONDS ))
  while true; do
    is_running="$("${CONTAINER_TOOL}" inspect --format '{{.State.Running}}' "${container_name}")"
    if [ "${is_running}" = "false" ]; then
      break
    fi

    if [ "$(date +%s)" -ge "${deadline}" ]; then
      echo "::error::Container stayed running with missing ${missing_file}."
      "${CONTAINER_TOOL}" logs "${container_name}" || true
      return 1
    fi

    sleep "${POLL_INTERVAL_SECONDS}"
  done

  exit_code="$("${CONTAINER_TOOL}" inspect --format '{{.State.ExitCode}}' "${container_name}")"
  logs="$("${CONTAINER_TOOL}" logs "${container_name}" 2>&1 || true)"

  if [ "${exit_code}" = "0" ]; then
    echo "::error::Container exited successfully despite missing ${missing_file}."
    return 1
  fi

  if ! grep -F -q "${missing_file}" <<<"${logs}"; then
    echo "::error::Startup error did not identify missing ${missing_file}."
    printf '%s\n' "${logs}"
    return 1
  fi

  if grep -F -q 'smoke-test-mailer-secret-key-0123456789abcdef' <<<"${logs}" || \
    grep -F -q 'smoke-test-session-secret-key-0123456789abcdef' <<<"${logs}"; then
    echo "::error::Startup error exposed a configured secret."
    return 1
  fi

  cleanup_container "${container_name}"
}

assert_http_asset() {
  local path="$1"
  local expected_content_type="$2"
  local alternate_content_type="${3:-}"
  local headers_file="${TEMP_ROOT}/headers-${path//\//_}"
  local status_code
  local content_type

  status_code="$(curl --silent --show-error \
    --dump-header "${headers_file}" \
    --output /dev/null \
    --write-out '%{http_code}' \
    "${BASE_URL}${path}")"

  if [ "${status_code}" != "200" ]; then
    echo "::error::${path} returned HTTP ${status_code}, expected 200."
    return 1
  fi

  content_type="$(awk '
    {
      line = $0
      sub(/\r$/, "", line)
      if (tolower(line) ~ /^content-type:[[:space:]]*/) {
        sub(/^[^:]*:[[:space:]]*/, "", line)
        value = tolower(line)
      }
    }
    END { print value }
  ' "${headers_file}")"
  case "${content_type}" in
    "${expected_content_type}" | "${expected_content_type};"* | "${alternate_content_type}" | "${alternate_content_type};"*) ;;
    *)
      echo "::error::${path} returned Content-Type '${content_type}', expected '${expected_content_type}'."
      return 1
      ;;
  esac

  echo "${path}: HTTP 200, Content-Type ${content_type}"
}

assert_root_links() {
  local root_html="${TEMP_ROOT}/root.html"
  local root_links="${TEMP_ROOT}/root-links.txt"
  local status_code
  local svg_icon_count
  local expected_favicon

  status_code="$(curl --silent --show-error --location \
    --output "${root_html}" \
    --write-out '%{http_code}' \
    "${BASE_URL}/")"

  if [ "${status_code}" != "200" ]; then
    echo "::error::Root request returned HTTP ${status_code}, expected 200."
    return 1
  fi

  sed 's/></>\n</g' "${root_html}" >"${root_links}"
  svg_icon_count="$(grep '<link' "${root_links}" | grep 'rel="icon"' | grep -c 'type="image/svg+xml"' || true)"

  if [ "${svg_icon_count}" != "1" ]; then
    echo "::error::Root head contains ${svg_icon_count} SVG favicon links, expected exactly one."
    grep '<link' "${root_links}" || true
    return 1
  fi

  if [ "${OPERATOR_FIXTURE_MODE}" = "true" ]; then
    local operator_stylesheet_line
    local operator_stylesheet_count
    local last_application_stylesheet_line

    expected_favicon='/operator-assets/favicon.svg'
    operator_stylesheet_count="$(grep -c 'href="/operator-assets/theme.css"' "${root_links}" || true)"
    operator_stylesheet_line="$(grep -n 'href="/operator-assets/theme.css"' "${root_links}" | cut -d: -f1 || true)"
    last_application_stylesheet_line="$(grep -n 'rel="stylesheet"' "${root_links}" | grep -v '/operator-assets/theme.css' | tail -n 1 | cut -d: -f1 || true)"

    if [ "${operator_stylesheet_count}" != "1" ]; then
      echo "::error::Root head contains ${operator_stylesheet_count} operator stylesheet links, expected exactly one."
      return 1
    fi

    if [ -z "${operator_stylesheet_line}" ] || [ -z "${last_application_stylesheet_line}" ]; then
      echo "::error::Root head is missing the operator or application stylesheet link."
      return 1
    fi

    if [ "${operator_stylesheet_line}" -le "${last_application_stylesheet_line}" ]; then
      echo "::error::Operator stylesheet must follow all application stylesheet links."
      return 1
    fi
  else
    expected_favicon='/favicon.svg'
    if grep -F -q '/operator-assets/' "${root_html}"; then
      echo "::error::Standard root unexpectedly links operator assets."
      return 1
    fi
  fi

  if ! grep '<link' "${root_links}" | grep 'rel="icon"' | grep -F -q "href=\"${expected_favicon}\""; then
    echo "::error::Root head does not select ${expected_favicon} as its SVG favicon."
    return 1
  fi

  echo "Root request: HTTP 200 with one correctly ordered SVG favicon link."
}

inspect_standard_image

overlay_directory=""
if [ "${OPERATOR_FIXTURE_MODE}" = "true" ]; then
  for required_file in theme.css logo-software.svg favicon.svg; do
    assert_missing_fixture_rejected "${required_file}"
  done

  overlay_directory="${TEMP_ROOT}/complete"
  create_overlay_fixture "${overlay_directory}"
fi

# Drop any leftover container from a previous interrupted run before starting.
cleanup_container "${CONTAINER_NAME}"
active_containers+=("${CONTAINER_NAME}")

echo "Starting container '${CONTAINER_NAME}' from image '${IMAGE}'..."
run_arguments=(
  --detach
  --name "${CONTAINER_NAME}"
  --publish "${HOST_PORT}:3000"
  "${runtime_environment[@]}"
)

if [ "${OPERATOR_FIXTURE_MODE}" = "true" ]; then
  run_arguments+=(
    --env RELANTO_OPERATOR_ASSETS=true
    --volume "${overlay_directory}:/app/build/client/operator-assets:ro"
  )
fi

"${CONTAINER_TOOL}" run "${run_arguments[@]}" "${IMAGE}" >/dev/null

echo "Waiting up to ${TIMEOUT_SECONDS}s for ${HEALTH_URL} to return HTTP 200..."
deadline=$(( $(date +%s) + TIMEOUT_SECONDS ))
while true; do
  status_code="$(curl --silent --output /dev/null --write-out '%{http_code}' "${HEALTH_URL}" || true)"
  if [ "${status_code}" = "200" ]; then
    echo "Health check succeeded (HTTP 200)."
    break
  fi

  if [ "$(date +%s)" -ge "${deadline}" ]; then
    echo "::error::Container did not become healthy within ${TIMEOUT_SECONDS}s (last status: ${status_code:-none})."
    echo "----- container logs -----"
    "${CONTAINER_TOOL}" logs "${CONTAINER_NAME}" || true
    echo "--------------------------"
    exit 1
  fi

  echo "  not ready yet (status: ${status_code:-none}); retrying in ${POLL_INTERVAL_SECONDS}s..."
  sleep "${POLL_INTERVAL_SECONDS}"
done

assert_root_links

if [ "${OPERATOR_FIXTURE_MODE}" = "true" ]; then
  assert_http_asset /operator-assets/theme.css text/css
  assert_http_asset /operator-assets/logo-software.svg image/svg+xml
  assert_http_asset /operator-assets/favicon.svg image/svg+xml
else
  assert_http_asset /favicon.svg image/svg+xml
fi

assert_http_asset /favicon.ico image/vnd.microsoft.icon image/x-icon
