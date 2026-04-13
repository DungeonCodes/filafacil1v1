const PRIORITY_COLUMN_NAME = "is_priority";

export function isPriorityColumnUnavailable(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();

  if (!message.includes(PRIORITY_COLUMN_NAME)) {
    return false;
  }

  return (
    message.includes("does not exist") ||
    message.includes("schema cache") ||
    message.includes("could not find") ||
    message.includes("column")
  );
}

export const PRIORITY_DESC_ORDER = {
  ascending: false as const,
  nullsFirst: false
};

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
  }

  return "";
}
