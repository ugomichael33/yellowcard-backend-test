import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { SendMessageCommand } from "@aws-sdk/client-sqs";
import { QUEUE_URL, json, sqs } from "./shared";
import { createTransaction } from "./service/transactionService";

export async function handler(event: APIGatewayProxyEventV2) {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const idempotencyKey =
      event.headers?.["x-idempotency-key"] ??
      event.headers?.["X-Idempotency-Key"] ??
      event.headers?.["idempotency-key"] ??
      event.headers?.["Idempotency-Key"];

    const { transaction, created } = await createTransaction({
      amount: body.amount,
      currency: body.currency,
      reference: body.reference,
      idempotencyKey: typeof idempotencyKey === "string" ? idempotencyKey : undefined,
    });

    if (created) {
      await sqs.send(
        new SendMessageCommand({
          QueueUrl: QUEUE_URL,
          MessageBody: JSON.stringify({ transactionId: transaction.id }),
        })
      );
      console.log(
        "TransactionCreated",
        JSON.stringify({ transactionId: transaction.id, status: transaction.status })
      );
    } else {
      console.log(
        "TransactionIdempotentReplay",
        JSON.stringify({ transactionId: transaction.id, status: transaction.status })
      );
    }

    return json(created ? 201 : 200, transaction);
  } catch (err: any) {
    console.error("createTransaction error", err);
    const statusCode = err?.statusCode ?? 500;
    const message = statusCode === 400 ? err.message : "InternalError";
    return json(statusCode, { error: message });
  }
}
