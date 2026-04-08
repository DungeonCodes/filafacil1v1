import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TotemScreen } from "./TotemScreen";
import { createNextTicket, loadQueues } from "./api";

vi.mock("./api", () => ({
  loadQueues: vi.fn(),
  createNextTicket: vi.fn()
}));

const mockedLoadQueues = vi.mocked(loadQueues);
const mockedCreateNextTicket = vi.mocked(createNextTicket);

describe("TotemScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders queues loaded from database", async () => {
    mockedLoadQueues.mockResolvedValue({
      ok: true,
      data: [
        { id: 1, name: "Clinico Geral", prefix: "CG" },
        { id: 2, name: "Pediatria", prefix: "PD" }
      ]
    });
    mockedCreateNextTicket.mockResolvedValue({
      ok: false,
      error: "Not used in this test."
    });

    render(<TotemScreen />);
    const user = userEvent.setup();

    expect(screen.getByText("Carregando opcoes de atendimento...")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Gerar senha para Clinico Geral" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Gerar senha para Pediatria" })).toBeInTheDocument();
    expect(screen.queryByText("Selecionar")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Mostrar informacoes sobre Clinico Geral" }));

    expect(await screen.findByText("Consultas e triagem inicial.")).toBeInTheDocument();
  });

  it("generates and displays formatted ticket", async () => {
    mockedLoadQueues.mockResolvedValue({
      ok: true,
      data: [{ id: 1, name: "Clinico Geral", prefix: "CG" }]
    });
    mockedCreateNextTicket.mockResolvedValue({
      ok: true,
      data: {
        prefix: "CG",
        ticketNumber: 1,
        currentStage: "waiting_attendant"
      }
    });

    render(<TotemScreen />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Gerar senha para Clinico Geral" }));

    expect(mockedCreateNextTicket).toHaveBeenCalledWith("CG");
    expect(await screen.findByRole("status")).toHaveTextContent("CG-001");
  });

  it("shows a friendly error when ticket generation fails", async () => {
    mockedLoadQueues.mockResolvedValue({
      ok: true,
      data: [{ id: 1, name: "Exames", prefix: "EX" }]
    });
    mockedCreateNextTicket.mockResolvedValue({
      ok: false,
      error: "Erro de comunicacao com o Supabase."
    });

    render(<TotemScreen />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Gerar senha para Exames" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Erro de comunicacao com o Supabase.");
  });
});
