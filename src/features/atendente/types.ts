export interface AttendantTicket {
  id: number;
  prefix: string;
  ticketNumber: number;
  stage: string;
  createdAt: string;
  calledAt: string | null;
  consultingRoom: string | null;
  isPriority?: boolean;
}

export interface AttendantSnapshot {
  currentTicket: AttendantTicket | null;
  waitingTickets: AttendantTicket[];
}

export interface CallNextAttendantInput {
  queuePrefix: string;
  destinationLabel: string;
  calledBy: string;
}

export interface FinishInitialAttendanceInput {
  ticketId: number;
  calledBy: string;
}

export interface RecallTicketInput {
  ticketId: number;
  destinationLabel: string;
  calledBy: string;
}

export type AsyncResult<T> = { ok: true; data: T } | { ok: false; error: string };
