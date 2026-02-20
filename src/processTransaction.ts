import type { SQSEvent } from "aws-lambda";
import { logMetric } from "./shared";
import { processTransaction } from "./service/transactionService";

type MessageBody = {
  transactionId?: string;
  correlationId?: string;
  forceOutcome?: "COMPLETED" | "FAILED";
};

export async function handler(event: SQSEvent) {
  const delayMsRaw = Number(process.env.PROCESSING_DELAY_MS ?? "500");
  const delayMs =
    Number.isFinite(delayMsRaw) && delayMsRaw > 0 ? delayMsRaw : 0;

  for (const record of event.Records) {
    let correlationId = record.messageId;
    try {
      const body = JSON.parse(record.body ?? "{}") as MessageBody;
      const transactionId = body.transactionId;
      correlationId = body.correlationId ?? record.messageId;
      if (!transactionId) {
        console.warn("Skipping message without transactionId", record.messageId);
        continue;
      }
      const allowTestOutcomes = process.env.ALLOW_TEST_OUTCOMES === "1";
      const forcedOutcome =
        allowTestOutcomes && body.forceOutcome ? body.forceOutcome : undefined;
      const outcomeDecider = forcedOutcome
        ? () =>
            forcedOutcome === "FAILED"
              ? { status: "FAILED", errorReason: "FORCED_FAILURE" }
              : { status: "COMPLETED" }
        : undefined;
      const result = await processTransaction(transactionId, outcomeDecider, delayMs);
      console.log(
        "TransactionProcessed",
        JSON.stringify({ transactionId, correlationId, ...result })
      );
      if (result.processed && result.status) {
        logMetric({
          namespace: "TransactionService",
          name: "TransactionProcessed",
          value: 1,
          dimensions: { Status: result.status },
          context: { correlationId },
        });
      }
    } catch (err: any) {
      console.error(
        "processTransaction error",
        JSON.stringify({ correlationId }),
        err
      );
      throw err;
    }
  }
}
