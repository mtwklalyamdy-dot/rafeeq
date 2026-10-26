#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL is required}"
mkdir -p backups
file="backups/rafeeq-$(date -u +%Y%m%dT%H%M%SZ).dump"
pg_dump --format=custom --no-owner --no-acl "$DATABASE_URL" > "$file"
printf 'Backup created: %s\n' "$file"
