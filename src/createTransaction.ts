import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { ddbDoc, TABLE_NAME, json } from "./shared";


export async function handler(event: APIGatewayProxyEventV2) {
  try {
    const body = event.body ? JSON.parse(event.body) : {};

    const tx = {
      id: uuidv4(),
      amount: body.data.amount,
      currency: body.data.currency,
      reference: body.data.reference,
      createdAt: new Date().toISOString(),
    };

    await ddbDoc.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: tx,
      ConditionExpression: "attribute_not_exists(id)",
    }));

    console.log("Transaction Created", JSON.stringify({ type: "TransactionCreated", payload: tx }));

    return json(201, tx);
  } catch (err: any) {
    console.error("createTransaction error", err);
    return json(500, { error: "InternalError" });
  }
}
