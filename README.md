# Yellow Card — Senior Backend Engineer (SAM + LocalStack Live Coding Kit)

This kit runs **AWS Serverless Application Model (SAM)** on **LocalStack** (CloudFormation in Docker).
It provisions:
- API Gateway
- 3 Lambdas (Create, Get, Worker) + Health check
- DynamoDB table
- SQS queue + DLQ

## Architecture
API Gateway
→ CreateTransaction Lambda
→ DynamoDB (source of truth)
→ SQS queue
→ ProcessTransaction Lambda
→ DynamoDB status update

Transaction lifecycle: `PENDING → PROCESSING → COMPLETED | FAILED`

Idempotency: Provide an `Idempotency-Key` header to ensure safe retries.

## Prereqs
- Docker + Docker Compose

## Quick start
```bash
docker compose up -d localstack
docker compose run --rm deploy
```

### Verify
After deploy, the script prints the API base URL.
```bash
curl "$API_BASE/health"
```

Create transaction example:
```bash
curl -X POST "$API_BASE/transactions"   -H "Content-Type: application/json"   -d '{"amount":100,"currency":"USD","reference":"INV-1"}'
```

Fetch transaction:
```bash
curl "$API_BASE/transactions/<id>"
```

## Run unit tests
```bash
docker compose run --rm deploy npm test
```

## Run integration tests (LocalStack)
Integration tests call the deployed API and wait for async processing.
```bash
docker compose run --rm deploy env RUN_INTEGRATION_TESTS=1 npm test
```
If you already have the API base URL, you can set `API_BASE` to skip stack lookup:
```bash
docker compose run --rm deploy env RUN_INTEGRATION_TESTS=1 API_BASE="$API_BASE" npm test
```

## Tear down
```bash
docker compose run --rm deploy ./scripts/destroy.sh
```

## Attempts the following tasks:
1. Implement the `POST /transactions` endpoint to create a new transaction in the DynamoDB table. The transaction should include the following fields: `id` (UUID), `amount`, `currency`, `reference`, and `createdAt` (timestamp). Extend the database schema and codebase to include the necessary Lambda function, and DynamoDB interactions to support this functionality. Ensure that the endpoint validates the input data and returns appropriate responses for success and error cases.
2. Implement the `GET /transactions/{id}` endpoint to retrieve a transaction by its `id` from the DynamoDB table.
3. A transaction is not immediately complete after creation. `PENDING → PROCESSING → COMPLETED | FAILED`
   - Implement a background process that simulates the processing of transactions. This process should update the transaction status from `PENDING` to `PROCESSING`, and then to either `COMPLETED` or `FAILED` after a certain delay.
   - Ensure that the transaction status is updated in the DynamoDB table, and that the `GET /transactions/{id}` endpoint reflects the current status of the transaction when retrieved.

## Notes for candidates
- Focus on correctness, clarity, and production thinking.
- Extend the codebase as you see fit.
- Feel free to ask questions or clarify requirements.
- The codebase is a starting point, and you can modify it as needed to demonstrate your skills and approach to problem-solving.
- The goal is to see how you approach the problem, structure your code, and implement the required functionality.
- Don't worry about making it perfect; we are more interested in your thought process and how you handle the task.
- Good luck, and we look forward to seeing your solution!
- Complete the task in not more than 24 hours you receive the kit. If you need more time, please let us know in advance.
