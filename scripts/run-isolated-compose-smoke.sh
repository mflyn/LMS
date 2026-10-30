#!/bin/sh
# The isolated container receives the frozen, unchanged smoke source on stdin.
set -eu
umask 077
expected_sha256=${1:?Expected frozen smoke SHA-256 is required}
work=$(mktemp -d "${TMPDIR:-/tmp}/family-compose-smoke.XXXXXX")
trap 'rm -f "$work/compose-family-smoke.cjs" "$work/output.log"; rmdir "$work"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

cat > "$work/compose-family-smoke.cjs"
if [ ! -s "$work/compose-family-smoke.cjs" ]; then
  printf 'SMOKE_SOURCE_EMPTY\n' >&2
  exit 1
fi
node -e '
  const fs = require("fs"), crypto = require("crypto");
  const actual = crypto.createHash("sha256").update(fs.readFileSync(process.argv[1])).digest("hex");
  if (!/^[a-f0-9]{64}$/.test(process.argv[2]) || actual !== process.argv[2]) {
    console.error("SMOKE_SOURCE_MISMATCH"); process.exitCode = 1;
  }
' "$work/compose-family-smoke.cjs" "$expected_sha256"

# A real file is essential: node stdin does not enter require.main === module.
status=0
node "$work/compose-family-smoke.cjs" > "$work/output.log" 2>&1 || status=$?
cat "$work/output.log"
if [ "$status" -ne 0 ]; then
  exit "$status"
fi
if [ "$(grep -Ec '^Family media smoke passed \([1-9][0-9]* bytes\)$' "$work/output.log" || true)" -ne 1 ]; then
  printf 'SMOKE_NOT_EXECUTED: missing unique successful completion output\n' >&2
  exit 1
fi
