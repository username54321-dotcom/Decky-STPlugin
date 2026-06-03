export interface GameSearchResult {
  id: number;
  name: string;
  img: string;
}

export interface ApiSource {
  name: string;
  url: string;
}

export interface DownloadProgress {
  task_id: string;
  phase: string;
  percent: number;
  message: string;
  appid?: number;
  error?: string;
}

export interface InstalledApp {
  appid: number;
  name: string;
  img_url?: string;
}

export interface DiscoverProgress {
  step: "scanning" | "processing" | "done" | "error";
  current: number;
  total: number;
  appid?: number;
  app_name?: string;
  img_url?: string;
  message: string;
  error?: string;
}

export interface Settings {
  fastDownload: boolean;
  morrenusApiKey: string;
}

// RestartState removed — useRestartSteam now uses boolean isRestarting internally.
// Kept as export for backwards-compat; consumers should migrate.
export type RestartState = "idle" | "restarting";
