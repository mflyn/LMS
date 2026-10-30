#!/bin/sh
set -eu
umask 077
directory="$(mktemp -d /tmp/family-release-prepare.XXXXXX)"
trap 'rm -rf "$directory"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
cat > "$directory/prepare.cjs"
node -e 'const fs=require("fs"),c=require("crypto");if(c.createHash("sha256").update(fs.readFileSync(process.argv[1])).digest("hex")!==process.argv[2])process.exit(1)' "$directory/prepare.cjs" "$1"
if node "$directory/prepare.cjs" > "$directory/output" 2>&1; then
  cat "$directory/output"
else
  status=$?
  cat "$directory/output" >&2
  exit "$status"
fi
test "$(grep -Fxc "Synthetic preparation passed: $2" "$directory/output" || true)" = 1
