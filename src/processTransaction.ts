import type { SQSEvent } from "aws-lambda";

export async function handler(event: SQSEvent) {
  for (const record of event.Records) {
    console.log("Received message", record.messageId);
  }

  return;
}
