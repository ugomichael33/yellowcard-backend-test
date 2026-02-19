import type { SQSEvent } from "aws-lambda";
import { processTransaction } from "./service/transactionService";

type MessageBody = {
  transactionId?: string;
};

export async function handler(event: SQSEvent) {
  const delayMsRaw = Number(process.env.PROCESSING_DELAY_MS ?? "500");
  const delayMs =
    Number.isFinite(delayMsRaw) && delayMsRaw > 0 ? delayMsRaw : 0;

  for (const record of event.Records) {
    try {
      const body = JSON.parse(record.body ?? "{}") as MessageBody;
      const transactionId = body.transactionId;
      if (!transactionId) {
        console.warn("Skipping message without transactionId", record.messageId);
        continue;
      }
      const result = await processTransaction(transactionId, undefined, delayMs);
      console.log(
        "TransactionProcessed",
        JSON.stringify({ transactionId, ...result })
      );
    } catch (err: any) {
      console.error("processTransaction error", err);
      throw err;
    }
  }
}
