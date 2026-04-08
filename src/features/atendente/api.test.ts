import { beforeEach, describe, expect, it, vi } from "vitest";
import { finishInitialAttendance, loadAttendantSnapshot } from "./api";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: vi.fn()
}));

const mockedGetSupabaseBrowserClient = vi.mocked(getSupabaseBrowserClient);

describe("atendente api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("moves the current attendant ticket into waiting_doctor without using the forwarding RPC", async () => {
    const eqCurrentStage = vi.fn().mockResolvedValue({ error: null });
    const eqId = vi.fn().mockReturnValue({ eq: eqCurrentStage });
    const update = vi.fn().mockReturnValue({ eq: eqId });
    const from = vi.fn().mockReturnValue({ update });
    const rpc = vi.fn();

    mockedGetSupabaseBrowserClient.mockReturnValue({
      from,
      rpc
    } as never);

    const result = await finishInitialAttendance({
      ticketId: 10,
      calledBy: "Atendente"
    });

    expect(result).toEqual({ ok: true, data: null });
    expect(from).toHaveBeenCalledWith("tickets");
    expect(update).toHaveBeenCalledWith({
      current_stage: "waiting_doctor",
      current_consulting_room: null,
      called_at: null
    });
    expect(eqId).toHaveBeenCalledWith("id", 10);
    expect(eqCurrentStage).toHaveBeenCalledWith("current_stage", "called_attendant");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns the update error when the transition cannot be completed", async () => {
    const eqCurrentStage = vi.fn().mockResolvedValue({ error: { message: "falha ao atualizar" } });
    const eqId = vi.fn().mockReturnValue({ eq: eqCurrentStage });
    const update = vi.fn().mockReturnValue({ eq: eqId });
    const from = vi.fn().mockReturnValue({ update });

    mockedGetSupabaseBrowserClient.mockReturnValue({
      from
    } as never);

    const result = await finishInitialAttendance({
      ticketId: 10,
      calledBy: "Atendente"
    });

    expect(result).toEqual({
      ok: false,
      error: "falha ao atualizar"
    });
  });

  it("filters the attendant snapshot by the current business date", async () => {
    const currentQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null })
    };
    const waitingQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null })
    };
    const from = vi
      .fn()
      .mockReturnValueOnce(currentQuery)
      .mockReturnValueOnce(waitingQuery);

    mockedGetSupabaseBrowserClient.mockReturnValue({
      from
    } as never);

    const result = await loadAttendantSnapshot("CG");

    expect(result).toEqual({
      ok: true,
      data: {
        currentTicket: null,
        waitingTickets: []
      }
    });
    expect(currentQuery.eq).toHaveBeenCalledWith("ticket_date", expect.any(String));
    expect(currentQuery.eq).toHaveBeenCalledWith("current_stage", "called_attendant");
    expect(currentQuery.eq).toHaveBeenCalledWith("prefix", "CG");
    expect(waitingQuery.eq).toHaveBeenCalledWith("ticket_date", expect.any(String));
    expect(waitingQuery.eq).toHaveBeenCalledWith("current_stage", "waiting_attendant");
    expect(waitingQuery.eq).toHaveBeenCalledWith("prefix", "CG");
  });
});
