import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

type TicketRpcRow = {
  prefix?: unknown;
  ticket_number?: unknown;
  ticket_date?: unknown;
  current_stage?: unknown;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  if (isObject(error) && typeof error.message === "string" && error.message.trim().length > 0) {
    return error.message;
  }

  return fallbackMessage;
}

function normalizeTicketPayload(data: unknown) {
  const row = Array.isArray(data) ? data[0] : data;
  if (!isObject(row)) {
    return null;
  }

  const candidate = row as TicketRpcRow;
  const prefix = typeof candidate.prefix === "string" ? candidate.prefix : null;
  const ticketNumber = Number(candidate.ticket_number);
  const ticketDate = typeof candidate.ticket_date === "string" ? candidate.ticket_date : null;
  const currentStage = typeof candidate.current_stage === "string" ? candidate.current_stage : undefined;

  if (!prefix || !Number.isFinite(ticketNumber) || !ticketDate) {
    return null;
  }

  return {
    prefix,
    ticketNumber,
    ticketDate,
    currentStage
  };
}

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as unknown;
  if (!isObject(payload)) {
    return NextResponse.json({ error: "Requisicao invalida ao gerar a senha." }, { status: 400 });
  }

  const queuePrefix = typeof payload.queuePrefix === "string" ? payload.queuePrefix.trim().toUpperCase() : "";
  if (!queuePrefix) {
    return NextResponse.json({ error: "Fila invalida para emissao de senha." }, { status: 400 });
  }

  const isPriority = payload.isPriority === true;
  const supabase = getSupabaseServiceClient();

  const { data, error } = await supabase.rpc("create_next_ticket", {
    p_queue_prefix: queuePrefix
  });

  if (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Nao foi possivel gerar a senha.") }, { status: 500 });
  }

  const ticket = normalizeTicketPayload(data);
  if (!ticket) {
    return NextResponse.json({ error: "Resposta invalida ao gerar a senha." }, { status: 500 });
  }

  const { error: updateError } = await supabase
    .from("tickets")
    .update({
      is_priority: isPriority
    })
    .eq("prefix", ticket.prefix)
    .eq("ticket_number", ticket.ticketNumber)
    .eq("ticket_date", ticket.ticketDate);

  if (updateError) {
    return NextResponse.json(
      { error: getErrorMessage(updateError, "Nao foi possivel registrar a prioridade da senha.") },
      { status: 500 }
    );
  }

  return NextResponse.json({
    data: {
      ...ticket,
      isPriority
    }
  });
}
