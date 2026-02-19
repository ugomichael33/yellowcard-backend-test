import type { SQSEvent } from "aws-lambda";
import { processTransaction } from "./service/transactionService";

type MessageBody = {
  transactionId?: string;
};

export async function handler(event: SQSEvent) {
  for (const record of event.Records) {
    try {
      const body = JSON.parse(record.body ?? "{}") as MessageBody;
      const transactionId = body.transactionId;
      if (!transactionId) {
        console.warn("Skipping message without transactionId", record.messageId);
        continue;
      }
      const result = await processTransaction(transactionId);
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
