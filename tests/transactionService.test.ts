import { jest } from "@jest/globals";
import type {
  createTransaction as createTransactionFn,
  getTransaction as getTransactionFn,
  updateStatus as updateStatusFn,
} from "../src/repository/transactionRepository";

const repo = {
  createTransaction: jest.fn() as jest.MockedFunction<typeof createTransactionFn>,
  getTransaction: jest.fn() as jest.MockedFunction<typeof getTransactionFn>,
  updateStatus: jest.fn() as jest.MockedFunction<typeof updateStatusFn>,
};

jest.unstable_mockModule("../src/repository/transactionRepository", () => ({
  createTransaction: repo.createTransaction,
  getTransaction: repo.getTransaction,
  updateStatus: repo.updateStatus,
}));

const service = await import("../src/service/transactionService");

describe("transaction service", () => {
  beforeEach(() => {
    repo.createTransaction.mockReset();
    repo.getTransaction.mockReset();
    repo.updateStatus.mockReset();
  });

  test("createTransaction validates input", async () => {
    await expect(
      service.createTransaction({ amount: 0, currency: "USD", reference: "x" })
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(repo.createTransaction).not.toHaveBeenCalled();
  });

  test("processTransaction short-circuits when already processed", async () => {
    repo.updateStatus.mockResolvedValueOnce(false);
    const result = await service.processTransaction("txn-1", () => ({
      status: "COMPLETED",
    }));
    expect(result).toEqual({ processed: false });
    expect(repo.updateStatus).toHaveBeenCalledTimes(1);
  });

  test("processTransaction moves to failed when outcome fails", async () => {
    repo.updateStatus.mockResolvedValueOnce(true).mockResolvedValueOnce(true);
    const result = await service.processTransaction("txn-2", () => ({
      status: "FAILED",
      errorReason: "SIMULATED",
    }));
    expect(result).toEqual({ processed: true, status: "FAILED" });
    expect(repo.updateStatus).toHaveBeenCalledTimes(2);
    expect(repo.updateStatus.mock.calls[1]?.[0]).toMatchObject({
      id: "txn-2",
      from: "PROCESSING",
      to: "FAILED",
      errorReason: "SIMULATED",
    });
  });
});
