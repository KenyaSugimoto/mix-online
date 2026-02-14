#!/usr/bin/env bash

set -u

API_CAPABLE_FALLBACK_EXCLUDES="edge-runtime,logflare,vector"
DB_ONLY_FALLBACK_EXCLUDES="gotrue,realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor"

is_colima_context() {
  local context
  context="$(docker context show 2>/dev/null || true)"
  if [ "${context}" = "colima" ]; then
    return 0
  fi

  case "${DOCKER_HOST:-}" in
    *".colima/"*)
      return 0
      ;;
  esac

  return 1
}

if supabase start "$@"; then
  exit 0
fi
status=$?

if ! command -v docker >/dev/null 2>&1; then
  exit "${status}"
fi

if is_colima_context; then
  echo "supabase start failed on Colima. Retrying without edge-runtime/logflare/vector..." >&2
  if supabase start -x "${API_CAPABLE_FALLBACK_EXCLUDES}" "$@"; then
    exit 0
  fi

  echo "API-capable fallback failed on Colima. Retrying with DB-only services..." >&2
  supabase start -x "${DB_ONLY_FALLBACK_EXCLUDES}" "$@"
  exit $?
fi

exit "${status}"
