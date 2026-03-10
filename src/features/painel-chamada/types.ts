export type PanelStage = "called_attendant" | "called_doctor" | "waiting_attendant" | "waiting_doctor" | string;

export interface NowCallingTicket {
  id: number;
  prefix: string;
  ticketNumber: number;
  stage: PanelStage;
  calledAt: string | null;
  createdAt: string;
  consultingRoom: string | null;
}

export interface RecentCallItem {
  id: number;
  ticketId: number;
  stage: string;
  destinationType: string;
  destinationLabel: string | null;
  calledAt: string;
  ticketPrefix: string;
  ticketNumber: number;
}

export interface WaitingTicketItem {
  id: number;
  prefix: string;
  ticketNumber: number;
  stage: PanelStage;
  createdAt: string;
}

export interface PanelSnapshot {
  nowCalling: NowCallingTicket | null;
  recentCalls: RecentCallItem[];
  waitingTickets: WaitingTicketItem[];
}

export type AsyncResult<T> = { ok: true; data: T } | { ok: false; error: string };
