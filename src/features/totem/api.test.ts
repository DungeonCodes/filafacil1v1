import { beforeEach, describe, expect, it, vi } from "vitest";
import { createNextTicket } from "./api";

describe("totem api", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("posts queue prefix and priority choice to the server route", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          prefix: "CG",
          ticketNumber: 3,
          ticketDate: "2026-04-08",
          currentStage: "waiting_attendant",
          isPriority: true
        }
      })
    } as Response);

    const result = await createNextTicket("CG", true);

    expect(fetchMock).toHaveBeenCalledWith("/api/totem/tickets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        queuePrefix: "CG",
        isPriority: true
      })
    });
    expect(result).toEqual({
      ok: true,
      data: {
        prefix: "CG",
        ticketNumber: 3,
        ticketDate: "2026-04-08",
        currentStage: "waiting_attendant",
        isPriority: true
      }
    });
  });

  it("returns the server error message when ticket creation fails", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({
        error: "Nao foi possivel registrar a prioridade da senha."
      })
    } as Response);

    const result = await createNextTicket("CG", true);

    expect(result).toEqual({
      ok: false,
      error: "Nao foi possivel registrar a prioridade da senha."
    });
  });
});
