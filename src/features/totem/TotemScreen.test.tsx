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
    window.localStorage.clear();
  });

  it("requires choosing normal or priority before showing queue cards", async () => {
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

    expect(await screen.findByRole("button", { name: "Selecionar atendimento normal" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Selecionar atendimento prioritario" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Gerar senha para Clinico Geral" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Selecionar atendimento normal" }));

    expect(await screen.findByRole("button", { name: "Gerar senha para Clinico Geral" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Gerar senha para Pediatria" })).toBeInTheDocument();
    expect(screen.queryByText("Selecionar")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Mostrar informacoes sobre Clinico Geral" }));

    expect(await screen.findByText("Consultas e triagem inicial.")).toBeInTheDocument();
  });

  it("generates and displays a priority-formatted ticket after choosing atendimento prioritario", async () => {
    mockedLoadQueues.mockResolvedValue({
      ok: true,
      data: [{ id: 1, name: "Clinico Geral", prefix: "CG" }]
    });
    mockedCreateNextTicket.mockResolvedValue({
      ok: true,
      data: {
        prefix: "CG",
        ticketNumber: 1,
        currentStage: "waiting_attendant",
        isPriority: true
      }
    });

    render(<TotemScreen />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Selecionar atendimento prioritario" }));
    await user.click(await screen.findByRole("button", { name: "Gerar senha prioritaria para Clinico Geral" }));

    expect(mockedCreateNextTicket).toHaveBeenCalledWith("CG", true);
    expect(await screen.findByRole("status")).toHaveTextContent("PCG-001");
  });

  it("stores the Modo TEA preference locally and keeps the visual journey summary visible", async () => {
    mockedLoadQueues.mockResolvedValue({
      ok: true,
      data: [{ id: 1, name: "Clinico Geral", prefix: "CG" }]
    });
    mockedCreateNextTicket.mockResolvedValue({
      ok: false,
      error: "Not used in this test."
    });

    render(<TotemScreen />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Ativar modo TEA" }));

    expect(await screen.findByRole("button", { name: "Desativar modo TEA" })).toBeInTheDocument();
    expect(screen.getByText("Passo atual")).toBeInTheDocument();
    expect(window.localStorage.getItem("filafacil:totem-tea-mode")).toBe("enabled");
  });

  it("keeps the ticket generation contract unchanged when Modo TEA is active", async () => {
    mockedLoadQueues.mockResolvedValue({
      ok: true,
      data: [{ id: 1, name: "Clinico Geral", prefix: "CG" }]
    });
    mockedCreateNextTicket.mockResolvedValue({
      ok: true,
      data: {
        prefix: "CG",
        ticketNumber: 1,
        currentStage: "waiting_attendant",
        isPriority: true
      }
    });

    render(<TotemScreen />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Ativar modo TEA" }));
    await user.click(await screen.findByRole("button", { name: "Selecionar atendimento prioritario" }));
    await user.click(await screen.findByRole("button", { name: "Gerar senha prioritaria para Clinico Geral" }));

    expect(mockedCreateNextTicket).toHaveBeenCalledWith("CG", true);
    expect(await screen.findByRole("status")).toHaveTextContent("PCG-001");
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

    await user.click(await screen.findByRole("button", { name: "Selecionar atendimento normal" }));
    await user.click(await screen.findByRole("button", { name: "Gerar senha para Exames" }));

    expect(mockedCreateNextTicket).toHaveBeenCalledWith("EX", false);
    expect(await screen.findByRole("alert")).toHaveTextContent("Erro de comunicacao com o Supabase.");
  });
});
