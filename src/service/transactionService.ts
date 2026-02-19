import { v4 as uuidv4 } from "uuid";
import type {
  CreateTransactionInput,
  Transaction,
  TransactionStatus,
} from "../domain/transaction";
import {
  canTransition,
  nowIso,
  normalizeCurrency,
  validateCreateInput,
} from "../domain/transaction";
import {
  createTransaction as repoCreate,
  getTransaction,
  updateStatus,
} from "../repository/transactionRepository";

export type CreateTransactionResult = {
  transaction: Transaction;
  created: boolean;
};

export function buildTransaction(input: CreateTransactionInput): Transaction {
  const now = nowIso();
  return {
    id: uuidv4(),
    amount: input.amount,
    currency: normalizeCurrency(input.currency),
    reference: input.reference.trim(),
    status: "PENDING",
    createdAt: now,
    updatedAt: now,
    processingAttempts: 0,
    idempotencyKey: input.idempotencyKey,
  };
}

export async function createTransaction(
  input: CreateTransactionInput
): Promise<CreateTransactionResult> {
  const validationError = validateCreateInput(input);
  if (validationError) {
    const error = new Error(validationError);
    (error as any).statusCode = 400;
    throw error;
  }
  const tx = buildTransaction(input);
  return repoCreate(tx, input.idempotencyKey);
}

export async function getTransactionById(id: string) {
  return getTransaction(id);
}

type ProcessOutcome =
  | { status: "COMPLETED" }
  | { status: "FAILED"; errorReason: string };

export function decideOutcome(): ProcessOutcome {
  const roll = Math.random();
  if (roll < 0.85) {
    return { status: "COMPLETED" };
  }
  return { status: "FAILED", errorReason: "PROCESSING_ERROR" };
}

export async function processTransaction(
  id: string,
  outcomeDecider: () => ProcessOutcome = decideOutcome
) {
  if (!canTransition("PENDING", "PROCESSING")) {
    throw new Error("Invalid transition");
  }

  const started = await updateStatus({
    id,
    from: "PENDING",
    to: "PROCESSING",
    updatedAt: nowIso(),
    incrementAttempts: true,
  });

  if (!started) {
    return { processed: false };
  }

  const outcome = outcomeDecider();
  const nextStatus: TransactionStatus = outcome.status;
  if (!canTransition("PROCESSING", nextStatus)) {
    throw new Error("Invalid transition");
  }

  await updateStatus({
    id,
    from: "PROCESSING",
    to: nextStatus,
    updatedAt: nowIso(),
    errorReason: "errorReason" in outcome ? outcome.errorReason : undefined,
  });

  return { processed: true, status: nextStatus };
}
