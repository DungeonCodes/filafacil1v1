import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadDoctorSnapshot } from "./api";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: vi.fn()
}));

const mockedGetSupabaseBrowserClient = vi.mocked(getSupabaseBrowserClient);

describe("medico api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("orders the medical waiting queue by priority first and created_at second", async () => {
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
    const callsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null })
    };
    const from = vi
      .fn()
      .mockReturnValueOnce(currentQuery)
      .mockReturnValueOnce(waitingQuery)
      .mockReturnValueOnce(callsQuery);

    mockedGetSupabaseBrowserClient.mockReturnValue({
      from
    } as never);

    const result = await loadDoctorSnapshot("CG", "Consultorio 001");

    expect(result).toEqual({
      ok: true,
      data: {
        currentTicket: null,
        waitingTickets: [],
        recentCalls: []
      }
    });
    expect(waitingQuery.eq).toHaveBeenCalledWith("ticket_date", expect.any(String));
    expect(waitingQuery.eq).toHaveBeenCalledWith("current_stage", "waiting_doctor");
    expect(waitingQuery.eq).toHaveBeenCalledWith("prefix", "CG");
    expect(waitingQuery.order).toHaveBeenNthCalledWith(1, "is_priority", { ascending: false });
    expect(waitingQuery.order).toHaveBeenNthCalledWith(2, "created_at", { ascending: true });
  });
});
