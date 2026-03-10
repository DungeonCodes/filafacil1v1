import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AtendenteScreen } from "./AtendenteScreen";
import { loadQueues } from "@/features/totem/api";
import { callNextAttendant, forwardTicketToDoctor, loadAttendantSnapshot, recallCurrentTicket } from "./api";

vi.mock("@/features/totem/api", () => ({
  loadQueues: vi.fn()
}));

vi.mock("./api", () => ({
  loadAttendantSnapshot: vi.fn(),
  callNextAttendant: vi.fn(),
  forwardTicketToDoctor: vi.fn(),
  recallCurrentTicket: vi.fn()
}));

const mockedLoadQueues = vi.mocked(loadQueues);
const mockedLoadAttendantSnapshot = vi.mocked(loadAttendantSnapshot);
const mockedCallNextAttendant = vi.mocked(callNextAttendant);
const mockedForwardTicketToDoctor = vi.mocked(forwardTicketToDoctor);
const mockedRecallCurrentTicket = vi.mocked(recallCurrentTicket);

function setupDefaultMocks() {
  mockedLoadQueues.mockResolvedValue({
    ok: true,
    data: [{ id: 1, name: "Clinico Geral", prefix: "CG" }]
  });

  mockedLoadAttendantSnapshot.mockResolvedValue({
    ok: true,
    data: {
      currentTicket: {
        id: 10,
        prefix: "CG",
        ticketNumber: 1,
        stage: "called_attendant",
        createdAt: "2026-03-10T10:00:00.000Z",
        calledAt: "2026-03-10T10:05:00.000Z",
        consultingRoom: null
      },
      waitingTickets: [
        {
          id: 11,
          prefix: "CG",
          ticketNumber: 2,
          stage: "waiting_attendant",
          createdAt: "2026-03-10T10:06:00.000Z",
          calledAt: null,
          consultingRoom: null
        }
      ]
    }
  });

  mockedCallNextAttendant.mockResolvedValue({ ok: true, data: null });
  mockedForwardTicketToDoctor.mockResolvedValue({ ok: true, data: null });
  mockedRecallCurrentTicket.mockResolvedValue({ ok: true, data: null });
}

describe("AtendenteScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it("renders current ticket and waiting queue", async () => {
    render(<AtendenteScreen />);

    expect(await screen.findByText("CG-001")).toBeInTheDocument();
    expect(screen.getByText("CG-002")).toBeInTheDocument();
  });

  it("calls next ticket using selected queue prefix", async () => {
    render(<AtendenteScreen />);
    const user = userEvent.setup();

    await screen.findByText("CG-001");
    await user.click(screen.getByRole("button", { name: "Chamar proximo" }));

    expect(mockedCallNextAttendant).toHaveBeenCalledWith({
      queuePrefix: "CG",
      destinationLabel: "Mesa 1",
      calledBy: "Atendente"
    });
  });

  it("forwards and recalls the current ticket", async () => {
    render(<AtendenteScreen />);
    const user = userEvent.setup();

    await screen.findByText("CG-001");
    await user.click(screen.getByRole("button", { name: "Rechamar" }));
    await user.click(screen.getByRole("button", { name: "Encaminhar" }));

    expect(mockedRecallCurrentTicket).toHaveBeenCalledWith({
      ticketId: 10,
      destinationLabel: "Mesa 1",
      calledBy: "Atendente"
    });

    expect(mockedForwardTicketToDoctor).toHaveBeenCalledWith({
      ticketId: 10,
      destinationLabel: "Consultorio 001",
      calledBy: "Atendente"
    });
  });
});
