export interface QueueOption {
  id: number;
  name: string;
  prefix: string;
}

export interface TicketPayload {
  prefix: string;
  ticketNumber: number;
  ticketDate?: string;
  currentStage?: string;
  isPriority?: boolean;
}

export type AsyncResult<T> = { ok: true; data: T } | { ok: false; error: string };
