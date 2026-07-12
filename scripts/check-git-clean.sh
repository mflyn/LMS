#!/usr/bin/env bash
set -euo pipefail

if ! git diff --quiet --exit-code; then
  echo "FAIL: tracked files changed after the command:"
  git status --short
  exit 1
fi

if ! git diff --cached --quiet --exit-code; then
  echo "FAIL: staged files changed after the command:"
  git status --short
  exit 1
fi

if [ -n "$(git status --porcelain --untracked-files=all)" ]; then
  echo "FAIL: untracked non-ignored files detected after the command:"
  git status --short
  exit 1
fi

echo "PASS: working tree is clean"
