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
    expect(waitingQuery.order).toHaveBeenNthCalledWith(1, "is_priority", { ascending: false, nullsFirst: false });
    expect(waitingQuery.order).toHaveBeenNthCalledWith(2, "created_at", { ascending: true });
  });

  it("keeps reading the attendant queue when the priority column is unavailable", async () => {
    const currentPriorityQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Could not find the 'is_priority' column of 'tickets' in the schema cache" }
      })
    };
    const currentLegacyQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null })
    };
    const waitingPriorityQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "column tickets.is_priority does not exist" }
      })
    };
    const waitingLegacyQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            id: 11,
            prefix: "CG",
            ticket_number: 2,
            current_stage: "waiting_attendant",
            created_at: "2026-04-08T10:00:00.000Z",
            called_at: null,
            current_consulting_room: null
          }
        ],
        error: null
      })
    };
    const from = vi
      .fn()
      .mockReturnValueOnce(currentPriorityQuery)
      .mockReturnValueOnce(currentLegacyQuery)
      .mockReturnValueOnce(waitingPriorityQuery)
      .mockReturnValueOnce(waitingLegacyQuery);

    mockedGetSupabaseBrowserClient.mockReturnValue({
      from
    } as never);

    const result = await loadAttendantSnapshot("CG");

    expect(result).toEqual({
      ok: true,
      data: {
        currentTicket: null,
        waitingTickets: [
          {
            id: 11,
            prefix: "CG",
            ticketNumber: 2,
            stage: "waiting_attendant",
            createdAt: "2026-04-08T10:00:00.000Z",
            calledAt: null,
            consultingRoom: null,
            isPriority: false
          }
        ]
      }
    });
    expect(currentLegacyQuery.select).toHaveBeenCalledWith(
      "id, prefix, ticket_number, current_stage, created_at, called_at, current_consulting_room"
    );
    expect(waitingLegacyQuery.select).toHaveBeenCalledWith(
      "id, prefix, ticket_number, current_stage, created_at, called_at, current_consulting_room"
    );
    expect(waitingLegacyQuery.order).toHaveBeenCalledTimes(1);
    expect(waitingLegacyQuery.order).toHaveBeenCalledWith("created_at", { ascending: true });
  });

  it("reads priority and legacy tickets together, treating null priority as normal", async () => {
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
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            id: 21,
            prefix: "CG",
            ticket_number: 5,
            current_stage: "waiting_attendant",
            created_at: "2026-04-08T10:00:00.000Z",
            called_at: null,
            current_consulting_room: null,
            is_priority: true
          },
          {
            id: 22,
            prefix: "CG",
            ticket_number: 6,
            current_stage: "waiting_attendant",
            created_at: "2026-04-08T10:02:00.000Z",
            called_at: null,
            current_consulting_room: null,
            is_priority: null
          }
        ],
        error: null
      })
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
        waitingTickets: [
          {
            id: 21,
            prefix: "CG",
            ticketNumber: 5,
            stage: "waiting_attendant",
            createdAt: "2026-04-08T10:00:00.000Z",
            calledAt: null,
            consultingRoom: null,
            isPriority: true
          },
          {
            id: 22,
            prefix: "CG",
            ticketNumber: 6,
            stage: "waiting_attendant",
            createdAt: "2026-04-08T10:02:00.000Z",
            calledAt: null,
            consultingRoom: null,
            isPriority: false
          }
        ]
      }
    });
  });
});
