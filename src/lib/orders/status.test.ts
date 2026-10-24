import { describe, expect, it } from "vitest";
import {
  getAllowedOrderStatusTransitions,
  isValidOrderStatusTransition,
  type OrderStatus,
} from "./status";

const allowedTransitions: [OrderStatus, OrderStatus[]][] = [
  ["enquiry", ["quoted", "cancelled"]],
  ["quoted", ["approved", "enquiry", "cancelled"]],
  ["approved", ["in_progress", "quoted", "cancelled"]],
  ["in_progress", ["ready", "approved", "cancelled"]],
  ["ready", ["delivered", "in_progress"]],
  ["delivered", []],
  ["cancelled", ["enquiry"]],
];

describe("order status transitions", () => {
  it.each(allowedTransitions)(
    "%s allows exactly %j",
    (from, expectedTransitions) => {
      expect(getAllowedOrderStatusTransitions(from)).toEqual(expectedTransitions);
      for (const to of expectedTransitions) {
        expect(isValidOrderStatusTransition(from, to)).toBe(true);
      }
    },
  );

  it.each([
    ["enquiry", "approved"],
    ["enquiry", "delivered"],
    ["quoted", "in_progress"],
    ["approved", "ready"],
    ["in_progress", "delivered"],
    ["ready", "cancelled"],
    ["delivered", "enquiry"],
    ["delivered", "cancelled"],
    ["cancelled", "quoted"],
    ["cancelled", "delivered"],
  ] as [OrderStatus, OrderStatus][])(
    "rejects %s -> %s",
    (from, to) => {
      expect(isValidOrderStatusTransition(from, to)).toBe(false);
    },
  );
});
