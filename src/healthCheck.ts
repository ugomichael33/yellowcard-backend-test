import type { APIGatewayProxyEvent } from "aws-lambda";
import { json } from "./shared";


export async function handler(event: APIGatewayProxyEvent | any) {
    try {
        const path =
            event?.path ??
            event?.rawPath ??
            event?.requestContext?.http?.path ??
            "";

        const resource = event?.resource ?? "";

        console.log(resource);


        if (path.endsWith("/health") || resource === "/health") {
            return json(200, { ok: true });
        }

    } catch (err: any) {
        console.error("Health check error", err);
        return json(500, { error: "InternalError" });
    }
}
