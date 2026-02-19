export type TransactionStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export type Transaction = {
  id: string;
  amount: number;
  currency: string;
  reference: string;
  status: TransactionStatus;
  createdAt: string;
  updatedAt: string;
  processingAttempts: number;
  errorReason?: string;
  idempotencyKey?: string;
};

export type CreateTransactionInput = {
  amount: number;
  currency: string;
  reference: string;
  idempotencyKey?: string;
};

export const TRANSACTION_PK_PREFIX = "TXN#";
export const IDEMPOTENCY_PK_PREFIX = "IDEMPOTENCY#";

export function transactionPk(id: string) {
  return `${TRANSACTION_PK_PREFIX}${id}`;
}

export function transactionSk(id: string) {
  return `${TRANSACTION_PK_PREFIX}${id}`;
}

export function idempotencyPk(key: string) {
  return `${IDEMPOTENCY_PK_PREFIX}${key}`;
}

export function idempotencySk(key: string) {
  return `${IDEMPOTENCY_PK_PREFIX}${key}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function normalizeCurrency(input: string) {
  return input.trim().toUpperCase();
}

export function validateCreateInput(input: CreateTransactionInput) {
  if (typeof input.amount !== "number" || Number.isNaN(input.amount)) {
    return "amount must be a number";
  }
  if (input.amount <= 0) {
    return "amount must be greater than 0";
  }
  if (typeof input.currency !== "string") {
    return "currency must be a string";
  }
  const normalizedCurrency = normalizeCurrency(input.currency);
  if (!/^[A-Z]{3}$/.test(normalizedCurrency)) {
    return "currency must be a 3-letter code";
  }
  if (typeof input.reference !== "string" || input.reference.trim().length === 0) {
    return "reference is required";
  }
  return null;
}

export function canTransition(from: TransactionStatus, to: TransactionStatus) {
  if (from === "PENDING" && to === "PROCESSING") return true;
  if (from === "PROCESSING" && (to === "COMPLETED" || to === "FAILED")) return true;
  return false;
}
