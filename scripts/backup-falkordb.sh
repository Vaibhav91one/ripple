#!/bin/sh
# Back up FalkorDB: BGSAVE, wait, tar dump.rdb + AOF from the data dir, upload to S3, keep newest N.
# Runs where the data dir lives (the falkordb VM). Config via env, see .env.example. No BACKUP_S3_ENDPOINT = dry run.
# Needs curl >= 7.75 (--aws-sigv4), tar, redis-cli (or BACKUP_REDIS_CLI="docker exec falkordb redis-cli").
set -eu
CLI="${BACKUP_REDIS_CLI:-redis-cli -h ${FALKORDB_HOST:-localhost} -p ${FALKORDB_PORT:-6379}}"
DIR="${BACKUP_DATA_DIR:-}" # empty = copy /data out of the `falkordb` container (named volume on Zerops)
KEEP="${BACKUP_KEEP:-14}"
rc() { $CLI ${FALKORDB_PASSWORD:+-a "$FALKORDB_PASSWORD" --no-auth-warning} "$@"; }

before=$(rc LASTSAVE)
rc BGSAVE >/dev/null
i=0
while [ "$(rc LASTSAVE)" = "$before" ]; do
  i=$((i + 1)); [ "$i" -gt 120 ] && { echo "BGSAVE did not finish in 120s" >&2; exit 1; }
  sleep 1
done

name="falkordb-$(date -u +%Y%m%dT%H%M%SZ).tar.gz"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
# dump.rdb plus the AOF files (appendonly.aof or appendonlydir)
if [ -z "$DIR" ]; then DIR="$tmp/data"; docker cp falkordb:/data "$DIR"; fi
(cd "$DIR" && tar czf "$tmp/$name" dump.rdb $(ls -d appendonly* 2>/dev/null))
echo "archive: $name ($(wc -c <"$tmp/$name") bytes)"

if [ -z "${BACKUP_S3_ENDPOINT:-}" ]; then
  echo "dry run: would upload $name to <BACKUP_S3_ENDPOINT>/<BACKUP_S3_BUCKET>/ and keep the newest $KEEP"
  tar tzf "$tmp/$name"
  exit 0
fi

base="${BACKUP_S3_ENDPOINT%/}/$BACKUP_S3_BUCKET"
s3() { curl -fsS --aws-sigv4 "aws:amz:${BACKUP_S3_REGION:-us-east-1}:s3" --user "$BACKUP_S3_ACCESS_KEY:$BACKUP_S3_SECRET_KEY" "$@"; }
s3 -T "$tmp/$name" "$base/$name"
echo "uploaded $name"
# names sort by timestamp; delete everything but the newest $KEEP (list returns up to 1000 keys)
s3 "$base?list-type=2&prefix=falkordb-" | grep -o '<Key>[^<]*</Key>' | sed 's/<[^>]*>//g' | sort | awk -v k="$KEEP" '{a[NR]=$0} END{for(i=1;i<=NR-k;i++)print a[i]}' |
  while read -r k; do s3 -X DELETE "$base/$k" && echo "pruned $k"; done
