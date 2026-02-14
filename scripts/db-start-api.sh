#!/usr/bin/env bash

set -eu

API_EXCLUDES="edge-runtime,logflare,vector"

supabase start -x "${API_EXCLUDES}" "$@"
