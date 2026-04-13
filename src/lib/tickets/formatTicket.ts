export function formatTicket(prefix: string, ticketNumber: number, digits = 3, isPriority = false): string {
  const normalizedNumber = Math.max(0, Math.floor(ticketNumber));
  const normalizedPrefix = `${isPriority ? "P" : ""}${prefix}`;
  return `${normalizedPrefix}-${String(normalizedNumber).padStart(digits, "0")}`;
}
