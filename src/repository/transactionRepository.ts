import {
  GetCommand,
  PutCommand,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { ddbDoc, TABLE_NAME } from "../shared";
import type { Transaction, TransactionStatus } from "../domain/transaction";
import {
  idempotencyPk,
  idempotencySk,
  transactionPk,
  transactionSk,
} from "../domain/transaction";

type CreateResult = {
  transaction: Transaction;
  created: boolean;
};

type IdempotencyRecord = {
  pk: string;
  sk: string;
  transactionId: string;
  createdAt: string;
  entityType: "IDEMPOTENCY";
};

function toItem(tx: Transaction) {
  return {
    pk: transactionPk(tx.id),
    sk: transactionSk(tx.id),
    entityType: "TRANSACTION",
    ...tx,
  };
}

function fromItem(item: Record<string, any>): Transaction {
  return {
    id: item.id,
    amount: item.amount,
    currency: item.currency,
    reference: item.reference,
    status: item.status,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    processingAttempts: item.processingAttempts ?? 0,
    errorReason: item.errorReason,
    idempotencyKey: item.idempotencyKey,
  };
}

export async function createTransaction(
  tx: Transaction,
  idempotencyKey?: string
): Promise<CreateResult> {
  if (idempotencyKey) {
    const lock: IdempotencyRecord = {
      pk: idempotencyPk(idempotencyKey),
      sk: idempotencySk(idempotencyKey),
      transactionId: tx.id,
      createdAt: tx.createdAt,
      entityType: "IDEMPOTENCY",
    };
    try {
      await ddbDoc.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: TABLE_NAME,
                Item: lock,
                ConditionExpression: "attribute_not_exists(pk)",
              },
            },
            {
              Put: {
                TableName: TABLE_NAME,
                Item: toItem(tx),
                ConditionExpression: "attribute_not_exists(pk)",
              },
            },
          ],
        })
      );
      return { transaction: tx, created: true };
    } catch (err: any) {
      if (err?.name !== "TransactionCanceledException") {
        throw err;
      }
      const existingLock = await getIdempotencyRecord(idempotencyKey);
      if (!existingLock) {
        throw err;
      }
      const existingTx = await getTransaction(existingLock.transactionId);
      if (!existingTx) {
        throw err;
      }
      return { transaction: existingTx, created: false };
    }
  }

  await ddbDoc.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: toItem(tx),
      ConditionExpression: "attribute_not_exists(pk)",
    })
  );
  return { transaction: tx, created: true };
}

export async function getIdempotencyRecord(
  idempotencyKey: string
): Promise<IdempotencyRecord | null> {
  const result = await ddbDoc.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { pk: idempotencyPk(idempotencyKey), sk: idempotencySk(idempotencyKey) },
    })
  );
  return (result.Item as IdempotencyRecord) ?? null;
}

export async function getTransaction(id: string): Promise<Transaction | null> {
  const result = await ddbDoc.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { pk: transactionPk(id), sk: transactionSk(id) },
    })
  );
  if (!result.Item) return null;
  return fromItem(result.Item as Record<string, any>);
}

export async function updateStatus(params: {
  id: string;
  from: TransactionStatus;
  to: TransactionStatus;
  updatedAt: string;
  errorReason?: string;
  incrementAttempts?: boolean;
}): Promise<boolean> {
  const { id, from, to, updatedAt, errorReason, incrementAttempts } = params;
  const updateExpressions: string[] = ["#status = :to", "updatedAt = :updatedAt"];
  const expressionNames: Record<string, string> = { "#status": "status" };
  const expressionValues: Record<string, any> = {
    ":to": to,
    ":updatedAt": updatedAt,
    ":from": from,
    ":zero": 0,
    ":inc": 1,
  };

  if (typeof errorReason === "string") {
    updateExpressions.push("errorReason = :errorReason");
    expressionValues[":errorReason"] = errorReason;
  }

  if (incrementAttempts) {
    updateExpressions.push(
      "processingAttempts = if_not_exists(processingAttempts, :zero) + :inc"
    );
  }

  try {
    await ddbDoc.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { pk: transactionPk(id), sk: transactionSk(id) },
        UpdateExpression: `SET ${updateExpressions.join(", ")}`,
        ConditionExpression: "#status = :from",
        ExpressionAttributeNames: expressionNames,
        ExpressionAttributeValues: expressionValues,
      })
    );
    return true;
  } catch (err: any) {
    if (err?.name === "ConditionalCheckFailedException") {
      return false;
    }
    throw err;
  }
}
