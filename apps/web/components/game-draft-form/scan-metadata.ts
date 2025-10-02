import { type GameDraft } from "../../lib/api";

export type ScanStatus = GameDraft["build_scan_status"];

export interface ScanStatusDisplay {
  label: string;
  badgeClass: string;
  helper: string;
}

const scanStatusMeta: Record<ScanStatus, ScanStatusDisplay> = {
  NOT_SCANNED: {
    label: "Not scanned",
    badgeClass: "bg-slate-500/30 text-slate-200",
    helper: "Save your build details to trigger a malware scan.",
  },
  PENDING: {
    label: "Scanning",
    badgeClass: "bg-amber-400/20 text-amber-200",
    helper: "Malware scan in progress. Refresh this page for updates.",
  },
  CLEAN: {
    label: "Clean",
    badgeClass: "bg-emerald-400/20 text-emerald-200",
    helper: "No issues detected in the latest malware scan.",
  },
  INFECTED: {
    label: "Malware detected",
    badgeClass: "bg-rose-500/20 text-rose-200",
    helper: "Upload a clean build to continue. The last scan flagged malware.",
  },
  FAILED: {
    label: "Scan failed",
    badgeClass: "bg-amber-500/20 text-amber-200",
    helper: "Resolve the scan error and save the build again.",
  },
};

export function getScanStatusDisplay(status: ScanStatus): ScanStatusDisplay {
  return scanStatusMeta[status];
}
