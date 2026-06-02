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
}

export interface Settings {
  fastDownload: boolean;
  morrenusApiKey: string;
}

export type RestartState = "idle" | "confirming" | "restarting";
