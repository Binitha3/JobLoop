export const ORDER_STATUSES = [
  "enquiry",
  "quoted",
  "approved",
  "in_progress",
  "ready",
  "delivered",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export function isOrderStatus(value: string): value is OrderStatus {
  return ORDER_STATUSES.some((status) => status === value);
}

const allowedTransitions: Record<OrderStatus, readonly OrderStatus[]> = {
  enquiry: ["quoted", "cancelled"],
  quoted: ["approved", "enquiry", "cancelled"],
  approved: ["in_progress", "quoted", "cancelled"],
  in_progress: ["ready", "approved", "cancelled"],
  ready: ["delivered", "in_progress"],
  delivered: [],
  cancelled: ["enquiry"],
};

const forwardTransitions: Partial<Record<OrderStatus, OrderStatus>> = {
  enquiry: "quoted",
  quoted: "approved",
  approved: "in_progress",
  in_progress: "ready",
  ready: "delivered",
};

const lifecycleOrder: readonly OrderStatus[] = [
  "enquiry",
  "quoted",
  "approved",
  "in_progress",
  "ready",
  "delivered",
];

export function getAllowedOrderStatusTransitions(
  status: OrderStatus,
): readonly OrderStatus[] {
  return allowedTransitions[status];
}

export function isValidOrderStatusTransition(
  from: OrderStatus,
  to: OrderStatus,
): boolean {
  return allowedTransitions[from].includes(to);
}

export function getForwardOrderStatus(
  status: OrderStatus,
): OrderStatus | undefined {
  return forwardTransitions[status];
}

export function getOrderStatusActionLabel(status: OrderStatus): string {
  const labels: Partial<Record<OrderStatus, string>> = {
    quoted: "Mark as quoted",
    approved: "Mark as approved",
    in_progress: "Start production",
    ready: "Mark as ready",
    delivered: "Mark as delivered",
  };

  return labels[status] ?? "";
}

export function requiresOrderStatusConfirmation(
  from: OrderStatus,
  to: OrderStatus,
): boolean {
  if (to === "cancelled") return true;

  const fromIndex = lifecycleOrder.indexOf(from);
  const toIndex = lifecycleOrder.indexOf(to);
  return fromIndex >= 0 && toIndex >= 0 && toIndex < fromIndex;
}

export function getOrderStatusLabel(status: OrderStatus): string {
  const labels: Record<OrderStatus, string> = {
    enquiry: "Enquiry",
    quoted: "Quoted",
    approved: "Approved",
    in_progress: "In progress",
    ready: "Ready",
    delivered: "Delivered",
    cancelled: "Cancelled",
  };

  return labels[status];
}
