# Kubernetes Deployment

The family-growth workloads require one externally managed Secret. Do not commit its values or a rendered Secret manifest.

Set three independent values of at least 32 characters, then create or rotate the Secret before applying the workloads:

```bash
export JWT_SECRET='...'
export GATEWAY_IDENTITY_SECRET='...'
export INTERNAL_SERVICE_TOKEN='...'
export KUBE_NAMESPACE='default'

./deployment/kubernetes/create-family-growth-secrets.sh apply
kubectl apply -k deployment/kubernetes
```

Use a secret manager to inject the environment variables in CI/CD. The creation script sends the generated Secret to `kubectl apply` through standard input and does not write plaintext or rendered credentials to disk. Validate names and keys without changing the cluster with:

```bash
./deployment/kubernetes/create-family-growth-secrets.sh --dry-run
```
