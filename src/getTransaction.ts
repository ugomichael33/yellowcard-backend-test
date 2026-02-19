import type { APIGatewayProxyEvent } from "aws-lambda";
import { json } from "./shared";
import { getTransactionById } from "./service/transactionService";


export async function handler(event: APIGatewayProxyEvent | any) {
  const correlationId =
    event?.headers?.["x-correlation-id"] ??
    event?.headers?.["X-Correlation-Id"] ??
    event?.headers?.["x-request-id"] ??
    event?.headers?.["X-Request-Id"] ??
    event?.requestContext?.requestId ??
    event?.requestContext?.http?.requestId ??
    "unknown";
  try {
    const id =
        event?.pathParameters?.id ??
        event?.pathParameters?.["id"];

    if (!id) {
      return json(400, { error: "id is required" }, {
        "x-correlation-id": correlationId,
      });
    }

    const result = await getTransactionById(id);
    if (!result) {
      return json(404, { error: "NotFound" }, {
        "x-correlation-id": correlationId,
      });
    }

    return json(200, result, { "x-correlation-id": correlationId });
  } catch (err: any) {
    console.error("getTransaction error", JSON.stringify({ correlationId }), err);
    return json(500, { error: "InternalError" }, {
      "x-correlation-id": correlationId,
    });
  }
}
