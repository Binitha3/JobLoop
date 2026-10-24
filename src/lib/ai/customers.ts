export function normalizePhone(phone: string | null | undefined) {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

export function findDuplicateCustomer<T extends { id: string; name: string; phone: string | null }>(
  phone: string | null | undefined,
  customers: T[],
) {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return null;
  return customers.find(
    (customer) => normalizePhone(customer.phone) === normalizedPhone,
  ) ?? null;
}
