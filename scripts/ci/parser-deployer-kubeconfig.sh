#!/usr/bin/env bash

# Prints a kubeconfig for the parser-deployer ServiceAccount, the value of the PARSER_DEPLOY_KUBECONFIG secret.
# Run it with the admin kubeconfig over the tunnel
# See "Deploy access" in infra/deploy/parser/README.md.

set -euo pipefail

# The token controller fills the Secret a moment after Parser Platform creates it.
token=$(kubectl -n parser get secret parser-deployer-token -o jsonpath='{.data.token}' | base64 -d)
[ -n "$token" ] || { echo "parser-deployer-token has no token yet" >&2; exit 1; }

# The CA of the admin kubeconfig, which already verifies the API server at 127.0.0.1.
ca=$(kubectl config view --raw --minify -o jsonpath='{.clusters[0].cluster.certificate-authority-data}')
[ -n "$ca" ] || { echo "the current kubeconfig has no certificate-authority-data" >&2; exit 1; }

cat <<EOF
apiVersion: v1
kind: Config
clusters:
  - name: parser
    cluster:
      # CI reaches the API server through the SSH tunnel.
      server: https://127.0.0.1:6443
      certificate-authority-data: $ca
users:
  - name: parser-deployer
    user:
      token: $token
contexts:
  - name: parser-deployer
    context:
      cluster: parser
      user: parser-deployer
      namespace: parser
current-context: parser-deployer
EOF
