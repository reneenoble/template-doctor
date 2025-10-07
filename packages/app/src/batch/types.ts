// Basic shared types for batch scanning (initial extraction).
export interface BatchScanItem {
  url: string;
  originalUrl: string;
  status: 'pending' | 'forking' | 'analyzing' | 'error' | 'done';
  message?: string;
  forkUrl?: string;
  error?: string;
}

export interface BatchScanOptions {
  requireFork?: boolean;
  concurrent?: number; // future: concurrency control
}

export interface BatchScanResultSummary {
  total: number;
  succeeded: number;
  failed: number;
  forked: number;
  startedAt: string;
  endedAt: string;
}
