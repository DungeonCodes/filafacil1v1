import { NextResponse } from "next/server";
import { requireApiAuthenticatedUser } from "@/lib/auth/api-guards";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { getCurrentBusinessDate } from "@/lib/tickets/businessDate";

type TicketStage = "called_attendant" | "called_doctor" | "waiting_attendant" | "waiting_doctor" | string;

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
  const calledAttendantIds = operationalTickets
    .filter((ticket) => ticket.stage === "called_attendant")
    .map((ticket) => ticket.id);
  const calledDoctorIds = operationalTickets
    .filter((ticket) => ticket.stage === "called_doctor")
    .map((ticket) => ticket.id);

  if (calledAttendantIds.length > 0) {
    const { error } = await supabase
      .from("tickets")
      .update({
        current_stage: "waiting_attendant",
        called_at: null,
        current_consulting_room: null
      })
      .in("id", calledAttendantIds)
      .eq("current_stage", "called_attendant");

    if (error) {
      return NextResponse.json({ error: "Nao foi possivel limpar o atendimento inicial em andamento." }, { status: 500 });
    }
  }

  if (calledDoctorIds.length > 0) {
    const { error } = await supabase
      .from("tickets")
      .update({
        current_stage: "waiting_doctor",
        called_at: null,
        current_consulting_room: null
      })
      .in("id", calledDoctorIds)
      .eq("current_stage", "called_doctor");

    if (error) {
      return NextResponse.json({ error: "Nao foi possivel limpar o atendimento medico em andamento." }, { status: 500 });
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
      resetAttendantTickets: calledAttendantIds.length,
      resetDoctorTickets: calledDoctorIds.length,
      clearedRecentCalls: businessDayTicketIds.length > 0
    }
  });
}
