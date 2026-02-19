import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { SQSClient } from "@aws-sdk/client-sqs";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

export const TABLE_NAME = process.env.TABLE_NAME ?? "transactions";
export const QUEUE_URL = process.env.QUEUE_URL ?? "";

/**
 * LocalStack endpoint support:
 * We rely on AWS_ENDPOINT_URL when present.
 */
function resolveEndpoint() {
  if (process.env.AWS_ENDPOINT_URL) {
    return process.env.AWS_ENDPOINT_URL;
  }
  if (process.env.LOCALSTACK_HOSTNAME) {
    return `http://${process.env.LOCALSTACK_HOSTNAME}:4566`;
  }
  return undefined;
}

function getDdbClient(): DynamoDBDocumentClient {
  const endpoint = resolveEndpoint();
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
  const endpoint = resolveEndpoint();
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

export function json(
  statusCode: number,
  body: unknown,
  extraHeaders?: Record<string, string>
) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-headers":
        "content-type,x-idempotency-key,idempotency-key",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      ...(extraHeaders ?? {}),
    },
    body: JSON.stringify(body),
  };
}

type MetricDimension = Record<string, string>;

export function logMetric(params: {
  namespace: string;
  name: string;
  value: number;
  unit?: "Count" | "Milliseconds";
  dimensions?: MetricDimension;
  context?: Record<string, string>;
}) {
  const { namespace, name, value, unit = "Count", dimensions, context } = params;
  const dimensionsKeys = dimensions ? Object.keys(dimensions) : [];

  const emfPayload = {
    ...(context ?? {}),
    ...(dimensions ?? {}),
    [name]: value,
    _aws: {
      Timestamp: Date.now(),
      CloudWatchMetrics: [
        {
          Namespace: namespace,
          Dimensions: dimensionsKeys.length ? [dimensionsKeys] : [],
          Metrics: [{ Name: name, Unit: unit }],
        },
      ],
    },
  };

  console.log(JSON.stringify(emfPayload));
}
