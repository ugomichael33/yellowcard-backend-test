import { GetCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEvent } from "aws-lambda";
import { ddbDoc, TABLE_NAME, json } from "./shared";


export async function handler(event: APIGatewayProxyEvent | any) {
  try {
    const path =
        event?.path ??
        event?.rawPath ??
        event?.requestContext?.http?.path ??
        "";

    const id =
        event?.pathParameters?.id ??
        event?.pathParameters?.["id"];

    const result = await ddbDoc.send(
        new GetCommand({ TableName: TABLE_NAME, Key: { id } })
    );

    return json(200, result.Item);
  } catch (err: any) {
    console.error("getTransaction error", err);
    return json(500, { error: "InternalError" });
  }
}
