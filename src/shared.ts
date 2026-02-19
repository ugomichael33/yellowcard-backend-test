import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { SQSClient } from "@aws-sdk/client-sqs";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

export const TABLE_NAME = process.env.TABLE_NAME ?? "transactions";
export const QUEUE_URL = process.env.QUEUE_URL ?? "";

/**
 * LocalStack endpoint support:
 * We rely on AWS_ENDPOINT_URL when present.
 */
function getDdbClient(): DynamoDBDocumentClient {
  const endpoint = process.env.AWS_ENDPOINT_URL;
  const ddb = new DynamoDBClient({
    endpoint,
    region: process.env.AWS_DEFAULT_REGION ?? "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "test",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "test",
    },
  });
  return DynamoDBDocumentClient.from(ddb);
}

function getSqsClient(): SQSClient {
  const endpoint = process.env.AWS_ENDPOINT_URL;
  return new SQSClient({
    endpoint,
    region: process.env.AWS_DEFAULT_REGION ?? "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "test",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "test",
    },
  });
}

export const ddbDoc = getDdbClient();
export const sqs = getSqsClient();

export function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type,x-idempotency-key",
      "access-control-allow-methods": "GET,POST,OPTIONS",
    },
    body: JSON.stringify(body),
  };
}
