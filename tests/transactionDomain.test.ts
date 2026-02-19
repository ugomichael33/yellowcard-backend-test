import { canTransition, normalizeCurrency, validateCreateInput } from "../src/domain/transaction";

describe("transaction domain", () => {
  test("validateCreateInput rejects invalid payloads", () => {
    expect(
      validateCreateInput({ amount: -10, currency: "USD", reference: "ref" })
    ).toBe("amount must be greater than 0");
    expect(
      validateCreateInput({ amount: 10, currency: "US", reference: "ref" })
    ).toBe("currency must be a 3-letter code");
    expect(
      validateCreateInput({ amount: 10, currency: "USD", reference: "" })
    ).toBe("reference is required");
  });

  test("validateCreateInput accepts valid payloads", () => {
    expect(
      validateCreateInput({ amount: 10, currency: "USD", reference: "ref" })
    ).toBeNull();
  });

  test("normalizeCurrency trims and uppercases", () => {
    expect(normalizeCurrency(" usd ")).toBe("USD");
  });

  test("canTransition enforces lifecycle", () => {
    expect(canTransition("PENDING", "PROCESSING")).toBe(true);
    expect(canTransition("PROCESSING", "COMPLETED")).toBe(true);
    expect(canTransition("PROCESSING", "FAILED")).toBe(true);
    expect(canTransition("COMPLETED", "PROCESSING")).toBe(false);
  });
});
