import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadQueues } from "@/features/totem/api";
import { callNextDoctor, finishDoctorTicket, loadDoctorSnapshot } from "./api";
import { MedicoScreen } from "./MedicoScreen";

vi.mock("@/features/totem/api", () => ({
  loadQueues: vi.fn()
}));

vi.mock("./api", () => ({
  loadDoctorSnapshot: vi.fn(),
  callNextDoctor: vi.fn(),
  finishDoctorTicket: vi.fn()
}));

const mockedLoadQueues = vi.mocked(loadQueues);
const mockedLoadDoctorSnapshot = vi.mocked(loadDoctorSnapshot);
const mockedCallNextDoctor = vi.mocked(callNextDoctor);
const mockedFinishDoctorTicket = vi.mocked(finishDoctorTicket);

function setupDefaultMocks() {
  mockedLoadQueues.mockResolvedValue({
    ok: true,
    data: [{ id: 1, name: "Clinico Geral", prefix: "CG" }]
  });

  mockedLoadDoctorSnapshot.mockResolvedValue({
    ok: true,
    data: {
      currentTicket: {
        id: 21,
        prefix: "CG",
        ticketNumber: 7,
        stage: "called_doctor",
        createdAt: "2026-03-10T10:10:00.000Z",
        calledAt: "2026-03-10T10:20:00.000Z",
        consultingRoom: "Consultorio 001"
      },
      waitingTickets: [
        {
          id: 22,
          prefix: "CG",
          ticketNumber: 8,
          stage: "waiting_doctor",
          createdAt: "2026-03-10T10:21:00.000Z",
          calledAt: null,
          consultingRoom: null
        }
      ],
      recentCalls: [
        {
          id: 101,
          ticketId: 21,
          stage: "called_doctor",
          destinationLabel: "Consultorio 001",
          calledAt: "2026-03-10T10:20:00.000Z",
          ticketPrefix: "CG",
          ticketNumber: 7,
          calledBy: "Medico"
        }
      ]
    }
  });

  mockedCallNextDoctor.mockResolvedValue({ ok: true, data: null });
  mockedFinishDoctorTicket.mockResolvedValue({ ok: true, data: null });
}

describe("MedicoScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it("renders current medical ticket, waiting queue and recent calls", async () => {
    render(<MedicoScreen />);

    expect((await screen.findAllByText("CG-007")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("CG-008")).length).toBeGreaterThan(0);
    expect(screen.getByText(/Ultimas chamadas do consultorio/i)).toBeInTheDocument();
  });

  it("calls next doctor ticket with selected options", async () => {
    render(<MedicoScreen />);
    const user = userEvent.setup();

    await screen.findAllByText("CG-008");
    await user.click(screen.getByRole("button", { name: "Chamar proxima senha" }));

    expect(mockedCallNextDoctor).toHaveBeenCalledWith({
      queuePrefix: "CG",
      consultingRoom: "Consultorio 001",
      calledBy: "Medico"
    });
  });

  it("finishes the current medical ticket", async () => {
    render(<MedicoScreen />);
    const user = userEvent.setup();

    await screen.findAllByText("CG-008");
    await user.click(screen.getByRole("button", { name: "Finalizar atendimento" }));

    expect(mockedFinishDoctorTicket).toHaveBeenCalledWith({
      ticketId: 21
    });
  });
});
