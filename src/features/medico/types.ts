export interface DoctorTicket {
  id: number;
  prefix: string;
  ticketNumber: number;
  stage: string;
  createdAt: string;
  calledAt: string | null;
  consultingRoom: string | null;
}

export interface DoctorRecentCall {
  id: number;
  ticketId: number;
  stage: string;
  destinationLabel: string | null;
  calledAt: string;
  ticketPrefix: string;
  ticketNumber: number;
  calledBy: string | null;
}

export interface DoctorSnapshot {
  currentTicket: DoctorTicket | null;
  waitingTickets: DoctorTicket[];
  recentCalls: DoctorRecentCall[];
}

export interface CallNextDoctorInput {
  queuePrefix: string;
  consultingRoom: string;
  calledBy: string;
}

export interface FinishDoctorTicketInput {
  ticketId: number;
}

export type AsyncResult<T> = { ok: true; data: T } | { ok: false; error: string };
