import { CloudFormationClient, DescribeStacksCommand } from "@aws-sdk/client-cloudformation";
import { describe, expect, jest, test } from "@jest/globals";
import { existsSync } from "node:fs";

const runIntegration = process.env.RUN_INTEGRATION_TESTS === "1";

const endpoint = process.env.AWS_ENDPOINT_URL ?? "http://localhost:4566";
const region = process.env.AWS_DEFAULT_REGION ?? "us-east-1";
const credentials = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "test",
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "test",
};

async function getApiBaseUrl(): Promise<string> {
  if (process.env.API_BASE) {
    return normalizeApiBase(process.env.API_BASE);
  }
  const client = new CloudFormationClient({ endpoint, region, credentials });
  const response = await client.send(
    new DescribeStacksCommand({ StackName: "yellowcard-tx-svc" })
  );
  const outputs = response.Stacks?.[0]?.Outputs ?? [];
  const apiBase = outputs.find((output) => output.OutputKey === "ApiBaseUrl")?.OutputValue;
  if (!apiBase) {
    throw new Error("ApiBaseUrl output not found. Ensure stack is deployed.");
  }
  return normalizeApiBase(apiBase);
}

function normalizeApiBase(apiBase: string) {
  let normalized = apiBase.replace(/\/$/, "");
  if (isRunningInDocker()) {
    const localstackHost = resolveLocalstackHost();
    if (localstackHost) {
      normalized = normalized.replace(
        "http://localhost:",
        `http://${localstackHost}:`
      );
      normalized = normalized.replace(
        "http://127.0.0.1:",
        `http://${localstackHost}:`
      );
    } else {
      normalized = normalized.replace(
        "http://localhost:",
        "http://host.docker.internal:"
      );
      normalized = normalized.replace(
        "http://127.0.0.1:",
        "http://host.docker.internal:"
      );
    }
  }
  return normalized;
}

function isRunningInDocker() {
  return existsSync("/.dockerenv");
}

function resolveLocalstackHost() {
  if (process.env.LOCALSTACK_HOSTNAME) {
    return process.env.LOCALSTACK_HOSTNAME;
  }
  if (process.env.AWS_ENDPOINT_URL) {
    try {
      return new URL(process.env.AWS_ENDPOINT_URL).hostname;
    } catch {
      return null;
    }
  }
  return null;
}

async function postJson(url: string, payload: unknown, headers?: Record<string, string>) {
  return fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(headers ?? {}),
    },
    body: JSON.stringify(payload),
  });
}

async function getJson(url: string) {
  return fetch(url, { method: "GET" });
}

async function pollTransaction(apiBase: string, id: string, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const res = await getJson(`${apiBase}/transactions/${id}`);
    const body = await res.json();
    if (body?.status && body.status !== "PENDING" && body.status !== "PROCESSING") {
      return body;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Timed out waiting for transaction to complete");
}

(runIntegration ? describe : describe.skip)("transaction integration", () => {
  jest.setTimeout(30000);

  test("POST creates transaction and async worker completes it", async () => {
    const apiBase = await getApiBaseUrl();
    const reference = `INV-${Date.now()}`;
    const createRes = await postJson(`${apiBase}/transactions`, {
      amount: 100,
      currency: "USD",
      reference,
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created).toMatchObject({
      amount: 100,
      currency: "USD",
      reference,
      status: "PENDING",
    });
    expect(created.id).toBeTruthy();

    const final = await pollTransaction(apiBase, created.id);
    expect(["COMPLETED", "FAILED"]).toContain(final.status);
  });

  test("Idempotency key returns same transaction", async () => {
    const apiBase = await getApiBaseUrl();
    const idempotencyKey = `idem-${Date.now()}`;
    const payload = {
      amount: 42,
      currency: "USD",
      reference: `INV-${Date.now()}`,
    };

    const firstRes = await postJson(`${apiBase}/transactions`, payload, {
      "Idempotency-Key": idempotencyKey,
    });
    expect(firstRes.status).toBe(201);
    const first = await firstRes.json();

    const secondRes = await postJson(`${apiBase}/transactions`, payload, {
      "Idempotency-Key": idempotencyKey,
    });
    expect(secondRes.status).toBe(200);
    const second = await secondRes.json();

    expect(first.id).toBe(second.id);
  });

  test("Forced failure results in FAILED and increments attempts", async () => {
    const apiBase = await getApiBaseUrl();
    const reference = `FAIL-${Date.now()}`;
    const createRes = await postJson(`${apiBase}/transactions`, {
      amount: 10,
      currency: "USD",
      reference,
      simulateFailure: true,
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    const final = await pollTransaction(apiBase, created.id);
    expect(final.status).toBe("FAILED");
    expect(final.processingAttempts).toBeGreaterThanOrEqual(1);
  });
});
