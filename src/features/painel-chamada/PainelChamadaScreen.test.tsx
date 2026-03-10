import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PainelChamadaScreen } from "./PainelChamadaScreen";
import { loadPanelSnapshot } from "./api";

vi.mock("./api", () => ({
  loadPanelSnapshot: vi.fn()
}));

const mockedLoadPanelSnapshot = vi.mocked(loadPanelSnapshot);

describe("PainelChamadaScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders now calling, recent calls and waiting tickets", async () => {
    mockedLoadPanelSnapshot.mockResolvedValue({
      ok: true,
      data: {
        nowCalling: {
          id: 10,
          prefix: "CG",
          ticketNumber: 12,
          stage: "called_attendant",
          calledAt: "2026-03-10T10:30:00.000Z",
          createdAt: "2026-03-10T10:00:00.000Z",
          consultingRoom: null
        },
        recentCalls: [
          {
            id: 1,
            ticketId: 10,
            stage: "called_attendant",
            destinationType: "attendant",
            destinationLabel: "Mesa 1",
            calledAt: "2026-03-10T10:30:00.000Z",
            ticketPrefix: "CG",
            ticketNumber: 12
          }
        ],
        waitingTickets: [
          {
            id: 2,
            prefix: "PD",
            ticketNumber: 8,
            stage: "waiting_attendant",
            createdAt: "2026-03-10T10:31:00.000Z"
          }
        ]
      }
    });

    render(<PainelChamadaScreen />);

    expect((await screen.findAllByText("CG-012")).length).toBeGreaterThan(0);
    expect(screen.getByText("PD-008")).toBeInTheDocument();
    expect(screen.getByText(/Mesa 1/i)).toBeInTheDocument();
  });

  it("renders empty states when there is no data", async () => {
    mockedLoadPanelSnapshot.mockResolvedValue({
      ok: true,
      data: {
        nowCalling: null,
        recentCalls: [],
        waitingTickets: []
      }
    });

    render(<PainelChamadaScreen />);

    expect(await screen.findByText(/Nenhuma senha em chamada no momento/i)).toBeInTheDocument();
    expect(screen.getByText(/Ainda nao ha chamadas registradas/i)).toBeInTheDocument();
    expect(screen.getByText(/Nao ha senhas aguardando no momento/i)).toBeInTheDocument();
  });

  it("shows error feedback and allows retry", async () => {
    mockedLoadPanelSnapshot
      .mockResolvedValueOnce({
        ok: false,
        error: "Falha ao carregar painel."
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          nowCalling: null,
          recentCalls: [],
          waitingTickets: []
        }
      });

    render(<PainelChamadaScreen />);
    const user = userEvent.setup();

    expect(await screen.findByRole("alert")).toHaveTextContent("Falha ao carregar painel.");
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(mockedLoadPanelSnapshot).toHaveBeenCalledTimes(2);
  });
});
