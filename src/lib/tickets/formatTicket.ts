export function formatTicket(prefix: string, ticketNumber: number, digits = 3): string {
  const normalizedNumber = Math.max(0, Math.floor(ticketNumber));
  return `${prefix}-${String(normalizedNumber).padStart(digits, "0")}`;
}
