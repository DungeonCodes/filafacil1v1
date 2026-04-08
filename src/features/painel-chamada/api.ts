import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getCurrentBusinessDate } from "@/lib/tickets/businessDate";
import type { AsyncResult, NowCallingTicket, PanelSnapshot, RecentCallItem, WaitingTicketItem } from "./types";

type TicketRow = {
  id?: unknown;
  prefix?: unknown;
  ticket_number?: unknown;
  ticket_date?: unknown;
  current_stage?: unknown;
  called_at?: unknown;
  created_at?: unknown;
  current_consulting_room?: unknown;
};

type CallRow = {
  id?: unknown;
  ticket_id?: unknown;
  stage?: unknown;
  destination_type?: unknown;
  destination_label?: unknown;
  called_at?: unknown;
};

const CALLED_STAGES = ["called_attendant", "called_doctor"];
const WAITING_STAGES = ["waiting_attendant", "waiting_doctor"];

function toNumber(value: unknown): number | null {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) {
    return null;
  }
  return normalized;
}

function toRequiredString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function toNullableString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return toRequiredString(value);
}

function normalizeNowCallingTicket(row: unknown): NowCallingTicket | null {
  if (!row || typeof row !== "object") {
    return null;
  }

  const candidate = row as TicketRow;
  const id = toNumber(candidate.id);
  const prefix = toRequiredString(candidate.prefix);
  const ticketNumber = toNumber(candidate.ticket_number);
  const stage = toRequiredString(candidate.current_stage);
  const createdAt = toRequiredString(candidate.created_at);

  if (id === null || prefix === null || ticketNumber === null || stage === null || createdAt === null) {
    return null;
  }

  return {
    id,
    prefix,
    ticketNumber,
    stage,
    calledAt: toNullableString(candidate.called_at),
    createdAt,
    consultingRoom: toNullableString(candidate.current_consulting_room)
  };
}

function normalizeWaitingTicket(row: unknown): WaitingTicketItem | null {
  if (!row || typeof row !== "object") {
    return null;
  }

  const candidate = row as TicketRow;
  const id = toNumber(candidate.id);
  const prefix = toRequiredString(candidate.prefix);
  const ticketNumber = toNumber(candidate.ticket_number);
  const stage = toRequiredString(candidate.current_stage);
  const createdAt = toRequiredString(candidate.created_at);

  if (id === null || prefix === null || ticketNumber === null || stage === null || createdAt === null) {
    return null;
  }

  return {
    id,
    prefix,
    ticketNumber,
    stage,
    createdAt
  };
}

function normalizeCall(row: unknown): Omit<RecentCallItem, "ticketPrefix" | "ticketNumber"> | null {
  if (!row || typeof row !== "object") {
    return null;
  }

  const candidate = row as CallRow;
  const id = toNumber(candidate.id);
  const ticketId = toNumber(candidate.ticket_id);
  const stage = toRequiredString(candidate.stage);
  const destinationType = toRequiredString(candidate.destination_type);
  const calledAt = toRequiredString(candidate.called_at);

  if (id === null || ticketId === null || stage === null || destinationType === null || calledAt === null) {
    return null;
  }

  return {
    id,
    ticketId,
    stage,
    destinationType,
    destinationLabel: toNullableString(candidate.destination_label),
    calledAt
  };
}

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  return fallbackMessage;
}

async function fetchNowCalling(): Promise<AsyncResult<NowCallingTicket | null>> {
  const supabase = getSupabaseBrowserClient();
  const businessDate = getCurrentBusinessDate();
  const { data, error } = await supabase
    .from("tickets")
    .select("id, prefix, ticket_number, current_stage, called_at, created_at, current_consulting_room")
    .eq("ticket_date", businessDate)
    .in("current_stage", CALLED_STAGES)
    .order("called_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    return { ok: false, error: getErrorMessage(error, "Nao foi possivel carregar o ticket atual.") };
  }

  const firstRow = Array.isArray(data) ? data[0] : null;
  if (!firstRow) {
    return { ok: true, data: null };
  }

  const ticket = normalizeNowCallingTicket(firstRow);
  if (!ticket) {
    return { ok: true, data: null };
  }

  return { ok: true, data: ticket };
}

async function fetchRecentCalls(limit = 8): Promise<AsyncResult<RecentCallItem[]>> {
  const supabase = getSupabaseBrowserClient();
  const businessDate = getCurrentBusinessDate();
  const { data, error } = await supabase
    .from("calls")
    .select("id, ticket_id, stage, destination_type, destination_label, called_at")
    .order("called_at", { ascending: false })
    .limit(30);

  if (error) {
    return { ok: false, error: getErrorMessage(error, "Nao foi possivel carregar as ultimas chamadas.") };
  }

  const normalizedCalls = (Array.isArray(data) ? data : []).flatMap((row) => {
    const normalized = normalizeCall(row);
    return normalized ? [normalized] : [];
  });

  if (normalizedCalls.length === 0) {
    return { ok: true, data: [] };
  }

  const uniqueTicketIds = [...new Set(normalizedCalls.map((call) => call.ticketId))];
  const { data: ticketsData, error: ticketsError } = await supabase
    .from("tickets")
    .select("id, prefix, ticket_number, ticket_date")
    .eq("ticket_date", businessDate)
    .in("id", uniqueTicketIds);

  if (ticketsError) {
    return { ok: false, error: getErrorMessage(ticketsError, "Nao foi possivel cruzar dados das chamadas.") };
  }

  const ticketLookup = new Map<number, { prefix: string; ticketNumber: number }>();
  for (const row of Array.isArray(ticketsData) ? ticketsData : []) {
    if (!row || typeof row !== "object") {
      continue;
    }

    const candidate = row as TicketRow;
    const id = toNumber(candidate.id);
    const prefix = toRequiredString(candidate.prefix);
    const ticketNumber = toNumber(candidate.ticket_number);

    if (id === null || prefix === null || ticketNumber === null) {
      continue;
    }

    ticketLookup.set(id, { prefix, ticketNumber });
  }

  const hydratedCalls = normalizedCalls.flatMap((call) => {
    const ticket = ticketLookup.get(call.ticketId);
    if (!ticket) {
      return [];
    }

    return [
      {
        ...call,
        ticketPrefix: ticket.prefix,
        ticketNumber: ticket.ticketNumber
      }
    ];
  }).slice(0, limit);

  return { ok: true, data: hydratedCalls };
}

async function fetchWaitingTickets(limit = 12): Promise<AsyncResult<WaitingTicketItem[]>> {
  const supabase = getSupabaseBrowserClient();
  const businessDate = getCurrentBusinessDate();
  const { data, error } = await supabase
    .from("tickets")
    .select("id, prefix, ticket_number, current_stage, created_at")
    .eq("ticket_date", businessDate)
    .in("current_stage", WAITING_STAGES)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    return { ok: false, error: getErrorMessage(error, "Nao foi possivel carregar as proximas senhas.") };
  }

  const waitingTickets = (Array.isArray(data) ? data : []).flatMap((row) => {
    const normalized = normalizeWaitingTicket(row);
    return normalized ? [normalized] : [];
  });

  return { ok: true, data: waitingTickets };
}

export async function loadPanelSnapshot(): Promise<AsyncResult<PanelSnapshot>> {
  try {
    const [nowCallingResult, recentCallsResult, waitingResult] = await Promise.all([
      fetchNowCalling(),
      fetchRecentCalls(),
      fetchWaitingTickets()
    ]);

    if (!nowCallingResult.ok) {
      return { ok: false, error: nowCallingResult.error };
    }
    if (!recentCallsResult.ok) {
      return { ok: false, error: recentCallsResult.error };
    }
    if (!waitingResult.ok) {
      return { ok: false, error: waitingResult.error };
    }

    return {
      ok: true,
      data: {
        nowCalling: nowCallingResult.data,
        recentCalls: recentCallsResult.data,
        waitingTickets: waitingResult.data
      }
    };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error, "Falha ao carregar dados do painel publico.") };
  }
}
