# Kubernetes Deployment

The family-growth workloads require one externally managed Secret. Do not commit its values or a rendered Secret manifest.

## Family MVP deployment profile

The family MVP kustomization intentionally excludes `interaction-service-deployment.yaml` and `data-service-deployment.yaml`. Task 1-7 family-growth baselines do not require meetings, announcements, group chat, complex message flows, or the legacy school data service.

For a minimal family-growth deployment, validate these workloads first: `gateway`, `user-service`, `homework-service`, `progress-service`, `analytics-service`, `notification-service`, `resource-service`, MongoDB and `frontend/web`. Deploy `interaction-service` or `data-service` only when the old school-oriented surface is intentionally enabled in a separate overlay.

Set three independent values of at least 32 characters, then create or rotate the Secret before applying the workloads:

```bash
export JWT_SECRET='...'
export GATEWAY_IDENTITY_SECRET='...'
export INTERNAL_SERVICE_TOKEN='...'
export KUBE_NAMESPACE='default'

./deployment/kubernetes/create-family-growth-secrets.sh apply
kubectl apply -k deployment/kubernetes
```

Use a secret manager to inject the environment variables in CI/CD. The creation script sends the generated Secret to `kubectl apply` through standard input and does not write plaintext or rendered credentials to disk. Validate input constraints and the manifest structure without changing the cluster with:

```bash
./deployment/kubernetes/create-family-growth-secrets.sh --dry-run
```

Dry-run uses fixed non-secret placeholders for the client-side manifest check and prints only a validation status line. It never renders environment credentials or their Base64 encodings.
