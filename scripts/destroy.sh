#!/usr/bin/env sh
set -eu

export AWS_PAGER=""
ENDPOINT="${AWS_ENDPOINT_URL:-http://localstack:4566}"

echo "==> Deleting stack"
aws --endpoint-url="$ENDPOINT" cloudformation delete-stack --stack-name yellowcard-tx-svc || true
echo "==> Done (deletion is async; LocalStack usually completes quickly)"
