import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

vi.mock("@/lib/supabase/service", () => ({
  getSupabaseServiceClient: vi.fn()
}));

const mockedGetSupabaseServiceClient = vi.mocked(getSupabaseServiceClient);

describe("POST /api/totem/tickets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates the next ticket and persists the priority flag on the generated ticket", async () => {
    const eqTicketDate = vi.fn().mockResolvedValue({ error: null });
    const eqTicketNumber = vi.fn().mockReturnValue({ eq: eqTicketDate });
    const eqPrefix = vi.fn().mockReturnValue({ eq: eqTicketNumber });
    const update = vi.fn().mockReturnValue({ eq: eqPrefix });
    const from = vi.fn().mockReturnValue({ update });
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          prefix: "CG",
          ticket_number: 3,
          ticket_date: "2026-04-08",
          current_stage: "waiting_attendant"
        }
      ],
      error: null
    });

    mockedGetSupabaseServiceClient.mockReturnValue({
      rpc,
      from
    } as never);

    const response = await POST(
      new Request("http://localhost/api/totem/tickets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          queuePrefix: "cg",
          isPriority: true
        })
      }) as NextRequest
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("create_next_ticket", {
      p_queue_prefix: "CG"
    });
    expect(from).toHaveBeenCalledWith("tickets");
    expect(update).toHaveBeenCalledWith({
      is_priority: true
    });
    expect(eqPrefix).toHaveBeenCalledWith("prefix", "CG");
    expect(eqTicketNumber).toHaveBeenCalledWith("ticket_number", 3);
    expect(eqTicketDate).toHaveBeenCalledWith("ticket_date", "2026-04-08");
    expect(payload).toEqual({
      data: {
        prefix: "CG",
        ticketNumber: 3,
        ticketDate: "2026-04-08",
        currentStage: "waiting_attendant",
        isPriority: true
      }
    });
  });
});
