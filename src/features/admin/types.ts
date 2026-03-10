export interface AdminKpis {
  totalGeneratedToday: number;
  totalFinishedToday: number;
  totalWaiting: number;
  averageWaitMinutes: number | null;
}

export interface QueueDistributionItem {
  label: string;
  total: number;
}

export interface HourlyVolumeItem {
  hour: string;
  total: number;
}

export interface StageFlowItem {
  stage: string;
  total: number;
}

export interface AdminDashboardSnapshot {
  kpis: AdminKpis;
  queueDistribution: QueueDistributionItem[];
  hourlyVolume: HourlyVolumeItem[];
  stageFlow: StageFlowItem[];
}

export type AsyncResult<T> = { ok: true; data: T } | { ok: false; error: string };

export type AccessProfile = "attendant" | "doctor" | "admin";

export interface ManagedUserView {
  id: number;
  username: string;
  role: AccessProfile;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
