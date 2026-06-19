#!/usr/bin/env bash
set -euo pipefail

namespace="${KUBE_NAMESPACE:-default}"
mode="${1:-apply}"

if [[ "$mode" != "apply" && "$mode" != "--dry-run" ]]; then
  echo "usage: $0 [apply|--dry-run]" >&2
  exit 2
fi

for variable in JWT_SECRET GATEWAY_IDENTITY_SECRET INTERNAL_SERVICE_TOKEN; do
  value="${!variable:-}"
  if [[ ${#value} -lt 32 || "$value" == *$'\n'* || "$value" == *$'\r'* ]]; then
    echo "$variable must be at least 32 characters and contain no line breaks" >&2
    exit 2
  fi
done

render_secret() {
  printf '%s\n' \
    "jwt-secret=$JWT_SECRET" \
    "gateway-identity-secret=$GATEWAY_IDENTITY_SECRET" \
    "internal-service-token=$INTERNAL_SERVICE_TOKEN" \
    | kubectl create secret generic family-growth-secrets \
      --namespace "$namespace" \
      --from-env-file=/dev/stdin \
      --dry-run=client \
      --output=yaml
}

if [[ "$mode" == "--dry-run" ]]; then
  render_secret
else
  render_secret | kubectl apply --namespace "$namespace" --filename=-
fi
