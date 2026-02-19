import { handler as getHandler } from "../src/healthCheck";

test("health endpoint returns ok", async () => {
  const res: any = await getHandler({ rawPath: "/health" } as any);
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body).ok).toBe(true);
});


