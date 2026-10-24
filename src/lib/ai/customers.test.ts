import { describe, expect, it } from "vitest";
import { findDuplicateCustomer, normalizePhone } from "./customers";

describe("phone matching", () => {
  it.each([
    ["+91 98765-43210", "9876543210"],
    ["098765 43210", "9876543210"],
    ["(987) 654-3210", "9876543210"],
  ])("normalizes %s", (phone, expected) => {
    expect(normalizePhone(phone)).toBe(expected);
  });

  it("matches an existing customer after phone normalization", () => {
    const customers = [
      { id: "1", name: "Asha Rao", phone: "+91 98765 43210" },
      { id: "2", name: "Ravi", phone: "9123456789" },
    ];

    expect(findDuplicateCustomer("09876543210", customers)).toEqual(customers[0]);
    expect(findDuplicateCustomer("", customers)).toBeNull();
    expect(findDuplicateCustomer("9999999999", customers)).toBeNull();
  });
});
