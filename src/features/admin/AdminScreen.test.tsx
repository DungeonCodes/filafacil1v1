import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminScreen } from "./AdminScreen";
import { loadAdminDashboardSnapshot } from "./api";
import { resetOperationalPanels } from "./operationsApi";

vi.mock("./api", () => ({
  loadAdminDashboardSnapshot: vi.fn()
}));

vi.mock("./operationsApi", () => ({
  resetOperationalPanels: vi.fn()
}));

vi.mock("./UserManagementSection", () => ({
  UserManagementSection: () => <div>Gestao de usuarios</div>
}));

vi.mock("recharts", () => {
  const MockComponent = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;

  return {
    ResponsiveContainer: MockComponent,
    PieChart: MockComponent,
    Pie: MockComponent,
    Cell: MockComponent,
    Tooltip: MockComponent,
    Legend: MockComponent,
    BarChart: MockComponent,
    Bar: MockComponent,
    XAxis: MockComponent,
    YAxis: MockComponent,
    CartesianGrid: MockComponent
  };
});

const mockedLoadAdminDashboardSnapshot = vi.mocked(loadAdminDashboardSnapshot);
const mockedResetOperationalPanels = vi.mocked(resetOperationalPanels);

function getDashboardSnapshot() {
  return {
    ok: true as const,
    data: {
      kpis: {
        totalGeneratedToday: 10,
        totalFinishedToday: 4,
        totalWaiting: 3,
        averageWaitMinutes: 12.5
      },
      queueDistribution: [
        { label: "Clinico Geral", total: 6 },
        { label: "Pediatria", total: 4 }
      ],
      hourlyVolume: [
        { hour: "08h", total: 3 },
        { hour: "09h", total: 7 }
      ],
      stageFlow: [
        { stage: "waiting_attendant", total: 3 },
        { stage: "finished", total: 4 }
      ]
    }
  };
}

describe("AdminScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedResetOperationalPanels.mockResolvedValue({
      ok: true,
      data: {
        clearedOperationalTickets: 3,
        clearedRecentCalls: true
      }
    });
  });

  it("renders kpis and chart sections when data exists", async () => {
    mockedLoadAdminDashboardSnapshot.mockResolvedValue(getDashboardSnapshot());

    render(<AdminScreen />);

    expect(await screen.findByText("10")).toBeInTheDocument();
    expect(screen.getByText(/Distribuicao por tipo de atendimento/i)).toBeInTheDocument();
    expect(screen.getByText(/Volume por faixa de horario/i)).toBeInTheDocument();
    expect(screen.getByText(/Evolucao do fluxo por status atual/i)).toBeInTheDocument();
  });

  it("shows empty-state message when dashboard has no chart data", async () => {
    mockedLoadAdminDashboardSnapshot.mockResolvedValue({
      ok: true,
      data: {
        kpis: {
          totalGeneratedToday: 0,
          totalFinishedToday: 0,
          totalWaiting: 0,
          averageWaitMinutes: null
        },
        queueDistribution: [],
        hourlyVolume: [],
        stageFlow: []
      }
    });

    render(<AdminScreen />);

    expect(await screen.findByText(/Ainda nao ha dados suficientes para exibicao dos graficos/i)).toBeInTheDocument();
  });

  it("shows error and allows retry", async () => {
    mockedLoadAdminDashboardSnapshot
      .mockResolvedValueOnce({
        ok: false,
        error: "Falha ao carregar dashboard."
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          kpis: {
            totalGeneratedToday: 1,
            totalFinishedToday: 1,
            totalWaiting: 0,
            averageWaitMinutes: 5
          },
          queueDistribution: [{ label: "Clinico Geral", total: 1 }],
          hourlyVolume: [{ hour: "10h", total: 1 }],
          stageFlow: [{ stage: "finished", total: 1 }]
        }
      });

    render(<AdminScreen />);
    const user = userEvent.setup();

    expect(await screen.findByRole("alert")).toHaveTextContent("Falha ao carregar dashboard.");
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(mockedLoadAdminDashboardSnapshot).toHaveBeenCalledTimes(2);
  });

  it("requires double check before clearing the operational panels", async () => {
    mockedLoadAdminDashboardSnapshot
      .mockResolvedValueOnce(getDashboardSnapshot())
      .mockResolvedValueOnce(getDashboardSnapshot());

    render(<AdminScreen />);
    const user = userEvent.setup();

    expect(await screen.findByRole("heading", { name: "Limpar painis de atendimento" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Limpar painis de atendimento" }));

    expect(mockedResetOperationalPanels).not.toHaveBeenCalled();
    expect(screen.getByText(/Confirmacao obrigatoria/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Confirmar limpeza" }));

    expect(mockedResetOperationalPanels).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Paineis operacionais limpos com sucesso. Os tickets visiveis da operacao atual foram encerrados e as chamadas visuais do dia foram removidas."
    );
    expect(mockedLoadAdminDashboardSnapshot).toHaveBeenCalledTimes(2);
  });
});
