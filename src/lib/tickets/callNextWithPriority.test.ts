import { beforeEach, describe, expect, it, vi } from "vitest";
import { callNextWithPriority } from "./callNextWithPriority";

describe("callNextWithPriority", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-08T13:45:00.000Z"));
  });

  it("calls the next attendant ticket prioritizing is_priority and preserving FIFO ordering", async () => {
    const currentCalledQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null })
    };
    const nextWaitingQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [{ id: 22 }], error: null })
    };
    const updateLimit = vi.fn().mockResolvedValue({ data: [{ id: 22 }], error: null });
    const updateSelect = vi.fn().mockReturnValue({ limit: updateLimit });
    const updateEqStage = vi.fn().mockReturnValue({ select: updateSelect });
    const updateEqId = vi.fn().mockReturnValue({ eq: updateEqStage });
    const updateQuery = {
      update: vi.fn().mockReturnValue({ eq: updateEqId })
    };
    const callsInsert = vi.fn().mockResolvedValue({ error: null });
    const callsQuery = {
      insert: callsInsert
    };
    const from = vi
      .fn()
      .mockReturnValueOnce(currentCalledQuery)
      .mockReturnValueOnce(nextWaitingQuery)
      .mockReturnValueOnce(updateQuery)
      .mockReturnValueOnce(callsQuery);

    const result = await callNextWithPriority({
      supabase: { from },
      queuePrefix: "CG",
      waitingStage: "waiting_attendant",
      calledStage: "called_attendant",
      destinationType: "attendant",
      destinationLabel: "Mesa 1",
      calledBy: "Atendente",
      currentConsultingRoom: null
    });

    expect(result).toEqual({ ok: true, data: null });
    expect(nextWaitingQuery.order).toHaveBeenNthCalledWith(1, "is_priority", { ascending: false });
    expect(nextWaitingQuery.order).toHaveBeenNthCalledWith(2, "created_at", { ascending: true });
    expect(updateQuery.update).toHaveBeenCalledWith({
      current_stage: "called_attendant",
      called_at: "2026-04-08T13:45:00.000Z",
      current_consulting_room: null
    });
    expect(updateEqId).toHaveBeenCalledWith("id", 22);
    expect(updateEqStage).toHaveBeenCalledWith("current_stage", "waiting_attendant");
    expect(callsInsert).toHaveBeenCalledWith({
      ticket_id: 22,
      stage: "called_attendant",
      destination_type: "attendant",
      destination_label: "Mesa 1",
      called_by: "Atendente",
      called_at: "2026-04-08T13:45:00.000Z"
    });
  });

  it("calls the next doctor ticket with the same priority ordering and keeps the consulting room attached", async () => {
    const currentLimit = vi.fn().mockResolvedValue({ data: [], error: null });
    const currentEqRoom = vi.fn().mockReturnValue({ limit: currentLimit });
    const currentQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis()
    };
    currentQuery.eq
      .mockReturnValueOnce(currentQuery)
      .mockReturnValueOnce(currentQuery)
      .mockReturnValueOnce(currentQuery)
      .mockReturnValueOnce({ limit: currentLimit });

    const nextWaitingQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [{ id: 44 }], error: null })
    };
    const updateLimit = vi.fn().mockResolvedValue({ data: [{ id: 44 }], error: null });
    const updateSelect = vi.fn().mockReturnValue({ limit: updateLimit });
    const updateEqStage = vi.fn().mockReturnValue({ select: updateSelect });
    const updateEqId = vi.fn().mockReturnValue({ eq: updateEqStage });
    const updateQuery = {
      update: vi.fn().mockReturnValue({ eq: updateEqId })
    };
    const callsInsert = vi.fn().mockResolvedValue({ error: null });
    const callsQuery = {
      insert: callsInsert
    };
    const from = vi
      .fn()
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi
          .fn()
          .mockReturnValueOnce({
            eq: vi
              .fn()
              .mockReturnValueOnce({
                eq: vi
                  .fn()
                  .mockReturnValueOnce({
                    eq: vi.fn().mockReturnValue({ limit: currentLimit })
                  })
              })
          })
      })
      .mockReturnValueOnce(nextWaitingQuery)
      .mockReturnValueOnce(updateQuery)
      .mockReturnValueOnce(callsQuery);

    const result = await callNextWithPriority({
      supabase: { from },
      queuePrefix: "CG",
      waitingStage: "waiting_doctor",
      calledStage: "called_doctor",
      destinationType: "doctor",
      destinationLabel: "Consultorio 001",
      calledBy: "Medico",
      currentConsultingRoom: "Consultorio 001"
    });

    expect(result).toEqual({ ok: true, data: null });
    expect(nextWaitingQuery.order).toHaveBeenNthCalledWith(1, "is_priority", { ascending: false });
    expect(nextWaitingQuery.order).toHaveBeenNthCalledWith(2, "created_at", { ascending: true });
    expect(updateQuery.update).toHaveBeenCalledWith({
      current_stage: "called_doctor",
      called_at: "2026-04-08T13:45:00.000Z",
      current_consulting_room: "Consultorio 001"
    });
    expect(callsInsert).toHaveBeenCalledWith({
      ticket_id: 44,
      stage: "called_doctor",
      destination_type: "doctor",
      destination_label: "Consultorio 001",
      called_by: "Medico",
      called_at: "2026-04-08T13:45:00.000Z"
    });
  });
});
