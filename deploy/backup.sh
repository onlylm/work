#!/bin/sh
set -eu
umask 077
stamp=$(date -u +%Y%m%dT%H%M%SZ)
pg_dump -h db -U workbench -d workbench -Fc -f "/backups/workbench-${stamp}.dump"
find /backups -type f -name 'workbench-*.dump' -mtime +14 -delete
