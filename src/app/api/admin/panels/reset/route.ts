import { NextResponse } from "next/server";
import { requireApiAuthenticatedUser } from "@/lib/auth/api-guards";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { getCurrentBusinessDate } from "@/lib/tickets/businessDate";

const OPERATIONAL_STAGES = ["waiting_attendant", "called_attendant", "waiting_doctor", "called_doctor"] as const;

type TicketStage = (typeof OPERATIONAL_STAGES)[number] | "finished" | string;

type TicketRow = {
  id?: unknown;
  current_stage?: unknown;
};

function toNumber(value: unknown): number | null {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) {
    return null;
  }
  return normalized;
}

function toStage(value: unknown): TicketStage | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export async function POST() {
  const authResult = await requireApiAuthenticatedUser(["admin"]);
  if (!authResult.ok) {
    return authResult.response;
  }

  const supabase = getSupabaseServiceClient();
  const businessDate = getCurrentBusinessDate();
  const finishedAt = new Date().toISOString();

  const { data: ticketsData, error: ticketsError } = await supabase
    .from("tickets")
    .select("id, current_stage")
    .eq("ticket_date", businessDate);

  if (ticketsError) {
    return NextResponse.json({ error: "Nao foi possivel localizar o estado operacional atual." }, { status: 500 });
  }

  const operationalTickets = (Array.isArray(ticketsData) ? ticketsData : []).flatMap((row) => {
    if (!row || typeof row !== "object") {
      return [];
    }

    const candidate = row as TicketRow;
    const id = toNumber(candidate.id);
    const stage = toStage(candidate.current_stage);
    if (id === null || stage === null) {
      return [];
    }

    return [{ id, stage }];
  });

  const businessDayTicketIds = operationalTickets.map((ticket) => ticket.id);
  const operationalTicketIds = operationalTickets
    .filter((ticket) => OPERATIONAL_STAGES.includes(ticket.stage as (typeof OPERATIONAL_STAGES)[number]))
    .map((ticket) => ticket.id);

  if (operationalTicketIds.length > 0) {
    const { error } = await supabase
      .from("tickets")
      .update({
        current_stage: "finished",
        finished_at: finishedAt,
        called_at: null,
        current_consulting_room: null
      })
      .in("id", operationalTicketIds);

    if (error) {
      return NextResponse.json({ error: "Nao foi possivel encerrar o estado operacional visivel dos painis." }, { status: 500 });
    }
  }

  if (businessDayTicketIds.length > 0) {
    const { error } = await supabase.from("calls").delete().in("ticket_id", businessDayTicketIds);

    if (error) {
      return NextResponse.json({ error: "Nao foi possivel limpar o historico visual atual dos painis." }, { status: 500 });
    }
  }

  return NextResponse.json({
    data: {
      clearedOperationalTickets: operationalTicketIds.length,
      clearedRecentCalls: businessDayTicketIds.length > 0
    }
  });
}
