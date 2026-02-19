import type { APIGatewayProxyEvent } from "aws-lambda";
import { json } from "./shared";
import { getTransactionById } from "./service/transactionService";


export async function handler(event: APIGatewayProxyEvent | any) {
  try {
    const id =
        event?.pathParameters?.id ??
        event?.pathParameters?.["id"];

    if (!id) {
      return json(400, { error: "id is required" });
    }

    const result = await getTransactionById(id);
    if (!result) {
      return json(404, { error: "NotFound" });
    }

    return json(200, result);
  } catch (err: any) {
    console.error("getTransaction error", err);
    return json(500, { error: "InternalError" });
  }
}
