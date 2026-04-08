import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { requireApiAuthenticatedUser } from "@/lib/auth/api-guards";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { getCurrentBusinessDate } from "@/lib/tickets/businessDate";

vi.mock("@/lib/auth/api-guards", () => ({
  requireApiAuthenticatedUser: vi.fn()
}));

vi.mock("@/lib/supabase/service", () => ({
  getSupabaseServiceClient: vi.fn()
}));

vi.mock("@/lib/tickets/businessDate", () => ({
  getCurrentBusinessDate: vi.fn()
}));

const mockedRequireApiAuthenticatedUser = vi.mocked(requireApiAuthenticatedUser);
const mockedGetSupabaseServiceClient = vi.mocked(getSupabaseServiceClient);
const mockedGetCurrentBusinessDate = vi.mocked(getCurrentBusinessDate);

describe("POST /api/admin/panels/reset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequireApiAuthenticatedUser.mockResolvedValue({
      ok: true,
      user: {
        id: 1,
        authUserId: "auth-admin",
        username: "ADM",
        role: "admin",
        isActive: true
      }
    });
    mockedGetCurrentBusinessDate.mockReturnValue("2026-04-08");
  });

  it("finishes all operational tickets of the current business day and clears current-day calls", async () => {
    const selectEq = vi.fn().mockResolvedValue({
      data: [
        { id: 10, current_stage: "waiting_attendant" },
        { id: 11, current_stage: "called_attendant" },
        { id: 12, current_stage: "waiting_doctor" },
        { id: 13, current_stage: "called_doctor" },
        { id: 14, current_stage: "finished" }
      ],
      error: null
    });
    const selectQuery = {
      select: vi.fn().mockReturnThis(),
      eq: selectEq
    };

    const updateIn = vi.fn().mockResolvedValue({ error: null });
    const updateQuery = {
      update: vi.fn().mockReturnValue({
        in: updateIn
      })
    };

    const deleteIn = vi.fn().mockResolvedValue({ error: null });
    const deleteQuery = {
      delete: vi.fn().mockReturnValue({
        in: deleteIn
      })
    };

    const from = vi.fn()
      .mockReturnValueOnce(selectQuery)
      .mockReturnValueOnce(updateQuery)
      .mockReturnValueOnce(deleteQuery);

    mockedGetSupabaseServiceClient.mockReturnValue({
      from
    } as never);

    const response = await POST();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mockedRequireApiAuthenticatedUser).toHaveBeenCalledWith(["admin"]);
    expect(from).toHaveBeenNthCalledWith(1, "tickets");
    expect(selectQuery.select).toHaveBeenCalledWith("id, current_stage");
    expect(selectEq).toHaveBeenCalledWith("ticket_date", "2026-04-08");

    expect(from).toHaveBeenNthCalledWith(2, "tickets");
    expect(updateQuery.update).toHaveBeenCalledWith({
      current_stage: "finished",
      finished_at: expect.any(String),
      called_at: null,
      current_consulting_room: null
    });
    expect(updateIn).toHaveBeenCalledWith("id", [10, 11, 12, 13]);

    expect(from).toHaveBeenNthCalledWith(3, "calls");
    expect(deleteQuery.delete).toHaveBeenCalledTimes(1);
    expect(deleteIn).toHaveBeenCalledWith("ticket_id", [10, 11, 12, 13, 14]);

    expect(payload).toEqual({
      data: {
        clearedOperationalTickets: 4,
        clearedRecentCalls: true
      }
    });
  });
});
