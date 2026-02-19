import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { SendMessageCommand } from "@aws-sdk/client-sqs";
import { QUEUE_URL, json, logMetric, sqs } from "./shared";
import { createTransaction } from "./service/transactionService";

export async function handler(event: APIGatewayProxyEventV2) {
  let correlationId = "unknown";
  try {
    correlationId =
      event.headers?.["x-correlation-id"] ??
      event.headers?.["X-Correlation-Id"] ??
      event.headers?.["x-request-id"] ??
      event.headers?.["X-Request-Id"] ??
      event.requestContext?.requestId ??
      event.requestContext?.http?.requestId ??
      "unknown";

    let body: any = {};
    if (event.body) {
      try {
        body = JSON.parse(event.body);
      } catch (err) {
        return json(400, { error: "InvalidJSON" }, {
          "x-correlation-id": correlationId,
        });
      }
    }

    const payload = body?.data ?? body ?? {};
    const idempotencyKey =
      event.headers?.["x-idempotency-key"] ??
      event.headers?.["X-Idempotency-Key"] ??
      event.headers?.["idempotency-key"] ??
      event.headers?.["Idempotency-Key"];
    const requestId =
      event.requestContext?.requestId ??
      event.requestContext?.http?.requestId ??
      "unknown";

    const { transaction, created } = await createTransaction({
      amount: payload.amount,
      currency: payload.currency,
      reference: payload.reference,
      idempotencyKey: typeof idempotencyKey === "string" ? idempotencyKey : undefined,
    });

    if (!QUEUE_URL) {
      throw new Error("QUEUE_URL is not configured");
    }

    const shouldEnqueue =
      created || (transaction.status === "PENDING" && typeof idempotencyKey === "string");

    if (shouldEnqueue) {
      await sqs.send(
        new SendMessageCommand({
          QueueUrl: QUEUE_URL,
          MessageBody: JSON.stringify({
            transactionId: transaction.id,
            correlationId,
          }),
        })
      );
      logMetric({
        namespace: "TransactionService",
        name: "TransactionCreated",
        value: 1,
        dimensions: { Status: transaction.status },
        context: { correlationId },
      });
      const logLabel = created ? "TransactionCreated" : "TransactionRequeued";
      console.log(
        logLabel,
        JSON.stringify({
          transactionId: transaction.id,
          status: transaction.status,
          requestId,
          correlationId,
        })
      );
    } else {
      console.log(
        "TransactionIdempotentReplay",
        JSON.stringify({
          transactionId: transaction.id,
          status: transaction.status,
          requestId,
          correlationId,
        })
      );
    }

    return json(created ? 201 : 200, transaction, {
      "x-correlation-id": correlationId,
    });
  } catch (err: any) {
    console.error(
      "createTransaction error",
      JSON.stringify({ correlationId }),
      err
    );
    const statusCode = err?.statusCode ?? 500;
    const message = statusCode === 400 ? err.message : "InternalError";
    return json(statusCode, { error: message }, { "x-correlation-id": correlationId });
  }
}
