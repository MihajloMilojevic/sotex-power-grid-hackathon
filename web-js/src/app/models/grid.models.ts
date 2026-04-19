// ═══════════════════════════════════════════════════════════════════
//  GRID DOMAIN MODELS
//  Mirrors the database schema from the Sotex hackathon brief.
//  These interfaces are shared across service, components, and views.
// ═══════════════════════════════════════════════════════════════════

// ── Raw DB Table Mirrors ──────────────────────────────────────────

export interface TransmissionStation {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
}

export interface Substation {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
}

export interface Feeder33 {
  id: number;
  name: string;
  tsId: number;
  meterId: number;
  nameplateRating: number; // kVA
}

export interface Feeder11 {
  id: number;
  name: string;
  ssId: number;
  meterId: number;
  nameplateRating: number; // kVA
}

export interface DistributionTransformer {
  id: number;
  name: string;
  meterId: number;
  feeder11Id: number | null;  // null if fed directly from TS (Trade F11)
  feeder33Id: number | null;  // set when fed directly from TS (Trade F11)
  nameplateRating: number;    // kVA
  latitude: number;
  longitude: number;
}

export interface Meter {
  id: number;
  msn: string;            // Meter Serial Number
  multiplierFactor: number;
}

export interface MeterReadTfe {
  id: number;
  mid: number;            // meter id
  val: number;            // raw reading value
  ts: Date;               // timestamp
}

export interface MeterRead {
  id: number;
  mid: number;
  val: number;
  ts: Date;
  cid: number;            // channel id
}

export interface Feeder33Substation {
  feeders33Id: number;
  substationsId: number;
}

export interface Channel {
  id: number;
  name: string;
  unit: string;
}

// ── View / Computed Models ────────────────────────────────────────

export type NodeStatus = 'normal' | 'warning' | 'critical' | 'offline';
export type NodeType = 'ts' | 'ss' | 'dt';

export interface GridNode {
  id: string;               // composite: "ts-1", "ss-2", "dt-5"
  dbId: number;
  type: NodeType;
  name: string;
  status: NodeStatus;
  loadPercent: number;      // 0–100
  nameplateRating: number;  // kVA
  currentKva: number;
  meterId: number;
  latitude?: number;
  longitude?: number;
  // Set by layout algorithm
  x: number;
  y: number;
}

export interface GridEdge {
  id: string;
  sourceId: string;
  targetId: string;
  voltage: number;
  name: string;
  loadPercent: number;
  nameplateRating: number;
}

export interface NetworkLoss {
  feederId: number;
  feederName: string;
  voltage: number;
  inputKwh: number;
  outputKwh: number;
  lossKwh: number;
  lossPercent: number;
}

export interface Alarm {
  id: string;
  nodeId: string;
  nodeName: string;
  nodeType: NodeType;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: Date;
  acknowledged: boolean;
}

export interface GridStats {
  totalLoadKva: number;
  totalCapacityKva: number;
  loadPercent: number;
  networkLossPercent: number;
  activeAlarms: number;
  criticalAlarms: number;
  offlineNodes: number;
  timestamp: Date;
}

export interface LiveMeterReading {
  meterId: number;
  nodeId: string;
  nodeName: string;
  kva: number;
  loadPercent: number;
  timestamp: Date;
}
