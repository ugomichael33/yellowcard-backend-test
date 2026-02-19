#!/usr/bin/env sh
set -eu

echo "==> Installing npm dependencies (including esbuild)"
npm install

export PATH="$PWD/node_modules/.bin:$PATH"

echo "==> Waiting for LocalStack..."
ENDPOINT="${AWS_ENDPOINT_URL:-http://localstack:4566}"
until aws --endpoint-url="$ENDPOINT" sts get-caller-identity >/dev/null 2>&1; do
  sleep 2
done

export AWS_PAGER=""

echo "==> Creating S3 bucket for SAM artifacts"
aws --endpoint-url="$ENDPOINT" s3 mb s3://sam-artifacts --region "${AWS_DEFAULT_REGION:-us-east-1}" >/dev/null 2>&1 || true

echo "==> SAM build"
sam build

echo "==> SAM deploy (CloudFormation to LocalStack)"
sam deploy \
  --stack-name yellowcard-tx-svc \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset \
  --capabilities CAPABILITY_IAM \
  --s3-bucket sam-artifacts \
  --region "${AWS_DEFAULT_REGION:-us-east-1}"

echo "==> Stack outputs"
aws --endpoint-url="$ENDPOINT" cloudformation describe-stacks \
  --stack-name yellowcard-tx-svc \
  --query "Stacks[0].Outputs" \
  --output table || true

API_ID="$(aws --endpoint-url="$ENDPOINT" cloudformation describe-stack-resources \
  --stack-name yellowcard-tx-svc \
  --query "StackResources[?LogicalResourceId=='Api'].PhysicalResourceId" \
  --output text)"

API_BASE="http://localhost:4566/restapis/${API_ID}/local/_user_request_"

echo ""
echo "✅ API Base URL:"
echo "$API_BASE"
echo ""
echo "Try:"
echo "curl \"$API_BASE/health\""
