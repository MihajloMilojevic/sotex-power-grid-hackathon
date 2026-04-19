import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, timer } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import {
  TransmissionStation, Substation, Feeder33, Feeder11,
  DistributionTransformer, Meter, MeterReadTfe, MeterRead,
  Feeder33Substation, Channel, GridNode, GridEdge,
  NetworkLoss, Alarm, GridStats, LiveMeterReading, NodeStatus
} from '../models/grid.models';

// ════════════════════════════════════════════════════════════════════
//  DATA RETRIEVAL SERVICE  —  v2.0  (Live MSSQL via backend)
//
//  All methods call the Node.js backend (localhost:3000).
//  The backend connects to MSSQL and returns camelCase JSON.
//
//  Public interface (method signatures) is UNCHANGED from v1.0.
//  No other file in the application was modified.
// ════════════════════════════════════════════════════════════════════

@Injectable({ providedIn: 'root' })
export class DataRetrievalService {

  private readonly http = inject(HttpClient);
  private readonly API_BASE = 'http://localhost:3000/api';

  // ── Raw Table Endpoints ───────────────────────────────────────────

  getTransmissionStations(): Observable<TransmissionStation[]> {
    return this.http.get<TransmissionStation[]>(`${this.API_BASE}/transmission-stations`);
  }

  getSubstations(): Observable<Substation[]> {
    return this.http.get<Substation[]>(`${this.API_BASE}/substations`);
  }

  getFeeders33(): Observable<Feeder33[]> {
    return this.http.get<Feeder33[]>(`${this.API_BASE}/feeders33`);
  }

  getFeeders11(): Observable<Feeder11[]> {
    return this.http.get<Feeder11[]>(`${this.API_BASE}/feeders11`);
  }

  getDistributionTransformers(): Observable<DistributionTransformer[]> {
    return this.http.get<DistributionTransformer[]>(`${this.API_BASE}/dt`);
  }

  getMeters(): Observable<Meter[]> {
    return this.http.get<Meter[]>(`${this.API_BASE}/meters`);
  }

  getFeeder33Substations(): Observable<Feeder33Substation[]> {
    return this.http.get<Feeder33Substation[]>(`${this.API_BASE}/feeder33-substations`);
  }

  getChannels(): Observable<Channel[]> {
    return this.http.get<Channel[]>(`${this.API_BASE}/channels`);
  }

  getLatestMeterReadings(): Observable<MeterReadTfe[]> {
    return this.http.get<MeterReadTfe[]>(`${this.API_BASE}/meter-reads/latest`);
  }

  getMeterReadingsForNode(meterId: number, from: Date, to: Date): Observable<MeterReadTfe[]> {
    return this.http.get<MeterReadTfe[]>(`${this.API_BASE}/meter-reads`, {
      params: {
        meterId: meterId.toString(),
        from:    from.toISOString(),
        to:      to.toISOString(),
      }
    });
  }

  // ── Computed / Aggregated Endpoints ──────────────────────────────

  getGridTopology(): Observable<{ nodes: GridNode[]; edges: GridEdge[] }> {
    return this.http.get<{ nodes: GridNode[]; edges: GridEdge[] }>(`${this.API_BASE}/grid/topology`);
  }

  getNetworkLoss(): Observable<NetworkLoss[]> {
    return this.http.get<NetworkLoss[]>(`${this.API_BASE}/analytics/network-loss`);
  }

  getGridStats(): Observable<GridStats> {
    return this.http.get<GridStats>(`${this.API_BASE}/grid/stats`);
  }

  getLiveMeterReadings(intervalMs = 4000): Observable<LiveMeterReading[]> {
    return timer(0, intervalMs).pipe(
      switchMap(() => this.http.get<MeterReadTfe[]>(`${this.API_BASE}/meter-reads/live`)),
      map(reads => reads.map(r => ({
        meterId:     r.mid,
        nodeId:      '',           // resolved by topology component
        nodeName:    '',
        kva:         r.val,
        loadPercent: 0,
        timestamp:   new Date(r.ts),
      })))
    );
  }

  getAlarms(): Observable<Alarm[]> {
    return this.http.get<Alarm[]>(`${this.API_BASE}/alarms`);
  }
}

// ════════════════════════════════════════════════════════════════════
//  MOCK DATA — Nigerian Power Grid (representative dataset)
//  Replace this entire section by integrating the real API.
// ════════════════════════════════════════════════════════════════════

const MOCK_TRANSMISSION_STATIONS: TransmissionStation[] = [
  { id: 1, name: 'Lekki Grid Station',           latitude: 6.4281,  longitude: 3.5081 },
  { id: 2, name: 'Victoria Island Grid Station', latitude: 6.4281,  longitude: 3.4119 },
];

const MOCK_SUBSTATIONS: Substation[] = [
  { id: 1, name: 'Ikeja Injection SS',    latitude: 6.5944,  longitude: 3.3380 },
  { id: 2, name: 'Apapa Injection SS',    latitude: 6.4490,  longitude: 3.3645 },
  { id: 3, name: 'Surulere Injection SS', latitude: 6.5000,  longitude: 3.3600 },
];

const MOCK_FEEDERS_33: Feeder33[] = [
  { id: 1, name: 'F33-LGS-IKJ',  tsId: 1, meterId: 101, nameplateRating: 10000 },
  { id: 2, name: 'F33-LGS-APA',  tsId: 1, meterId: 102, nameplateRating: 10000 },
  { id: 3, name: 'F33-VIG-APA',  tsId: 2, meterId: 103, nameplateRating: 10000 },
  { id: 4, name: 'F33-VIG-SUR',  tsId: 2, meterId: 104, nameplateRating: 10000 },
  { id: 5, name: 'F33-VIG-IKY',  tsId: 2, meterId: 105, nameplateRating: 5000  }, // Trade F11 — direct to DT
];

const MOCK_FEEDERS_11: Feeder11[] = [
  { id: 1, name: 'F11-IKJ-LKI1', ssId: 1, meterId: 201, nameplateRating: 1000 },
  { id: 2, name: 'F11-IKJ-LKI2', ssId: 1, meterId: 202, nameplateRating: 1000 },
  { id: 3, name: 'F11-APA-MRY',  ssId: 2, meterId: 203, nameplateRating: 630  },
  { id: 4, name: 'F11-APA-OSH',  ssId: 2, meterId: 204, nameplateRating: 1000 },
  { id: 5, name: 'F11-APA-MRN',  ssId: 2, meterId: 205, nameplateRating: 630  },
  { id: 6, name: 'F11-SUR-BGI',  ssId: 3, meterId: 206, nameplateRating: 1000 },
  { id: 7, name: 'F11-SUR-AGG',  ssId: 3, meterId: 207, nameplateRating: 630  },
];

const MOCK_DT: DistributionTransformer[] = [
  { id: 1,  name: 'Lekki Phase 1 DT',  meterId: 301, feeder11Id: 1, feeder33Id: null, nameplateRating: 500,  latitude: 6.4290, longitude: 3.5100 },
  { id: 2,  name: 'Lekki Phase 2 DT',  meterId: 302, feeder11Id: 2, feeder33Id: null, nameplateRating: 500,  latitude: 6.4310, longitude: 3.5150 },
  { id: 3,  name: 'Maryland DT',        meterId: 303, feeder11Id: 3, feeder33Id: null, nameplateRating: 315,  latitude: 6.5700, longitude: 3.3530 },
  { id: 4,  name: 'Oshodi DT',          meterId: 304, feeder11Id: 4, feeder33Id: null, nameplateRating: 500,  latitude: 6.5560, longitude: 3.3420 },
  { id: 5,  name: 'Marina DT',          meterId: 305, feeder11Id: 5, feeder33Id: null, nameplateRating: 315,  latitude: 6.4530, longitude: 3.3820 },
  { id: 6,  name: 'Ikoyi DT',           meterId: 306, feeder11Id: null, feeder33Id: 5, nameplateRating: 200,  latitude: 6.4550, longitude: 3.4360 },
  { id: 7,  name: 'Badia DT',           meterId: 307, feeder11Id: 6, feeder33Id: null, nameplateRating: 500,  latitude: 6.4670, longitude: 3.3460 },
  { id: 8,  name: 'Agege DT',           meterId: 308, feeder11Id: 7, feeder33Id: null, nameplateRating: 315,  latitude: 6.6230, longitude: 3.3230 },
];

const MOCK_FEEDER33_SUBSTATIONS: Feeder33Substation[] = [
  { feeders33Id: 1, substationsId: 1 },
  { feeders33Id: 2, substationsId: 2 },
  { feeders33Id: 3, substationsId: 2 }, // TS2 also connects to Apapa SS (grid interconnect)
  { feeders33Id: 4, substationsId: 3 },
];

const MOCK_METERS: Meter[] = [
  { id: 101, msn: 'TS-LGS-001', multiplierFactor: 100 },
  { id: 102, msn: 'TS-LGS-002', multiplierFactor: 100 },
  { id: 103, msn: 'TS-VIG-001', multiplierFactor: 100 },
  { id: 104, msn: 'TS-VIG-002', multiplierFactor: 100 },
  { id: 105, msn: 'TS-VIG-003', multiplierFactor: 100 },
  { id: 201, msn: 'SS-IKJ-F01', multiplierFactor: 10 },
  { id: 202, msn: 'SS-IKJ-F02', multiplierFactor: 10 },
  { id: 203, msn: 'SS-APA-F01', multiplierFactor: 10 },
  { id: 204, msn: 'SS-APA-F02', multiplierFactor: 10 },
  { id: 205, msn: 'SS-APA-F03', multiplierFactor: 10 },
  { id: 206, msn: 'SS-SUR-F01', multiplierFactor: 10 },
  { id: 207, msn: 'SS-SUR-F02', multiplierFactor: 10 },
  { id: 301, msn: 'DT-LKI-001', multiplierFactor: 1 },
  { id: 302, msn: 'DT-LKI-002', multiplierFactor: 1 },
  { id: 303, msn: 'DT-MRY-001', multiplierFactor: 1 },
  { id: 304, msn: 'DT-OSH-001', multiplierFactor: 1 },
  { id: 305, msn: 'DT-MRN-001', multiplierFactor: 1 },
  { id: 306, msn: 'DT-IKY-001', multiplierFactor: 1 },
  { id: 307, msn: 'DT-BGI-001', multiplierFactor: 1 },
  { id: 308, msn: 'DT-AGG-001', multiplierFactor: 1 },
];

const MOCK_CHANNELS: Channel[] = [
  { id: 1, name: 'Active Power',    unit: 'kW'   },
  { id: 2, name: 'Reactive Power',  unit: 'kVAr' },
  { id: 3, name: 'Voltage Phase A', unit: 'V'    },
  { id: 4, name: 'Current Phase A', unit: 'A'    },
  { id: 5, name: 'Power Factor',    unit: 'PF'   },
];

// ── Mock Load Profiles (base load %, 0–100) ───────────────────────
const BASE_LOADS: Record<string, number> = {
  'ts-1': 62, 'ts-2': 71,
  'ss-1': 55, 'ss-2': 78, 'ss-3': 47,
  'dt-1': 68, 'dt-2': 82, 'dt-3': 91,
  'dt-4': 45, 'dt-5': 58, 'dt-6': 33,
  'dt-7': 74, 'dt-8': 61,
};

function getRandomVariation(base: number, spread = 5): number {
  return Math.min(100, Math.max(0, base + (Math.random() - 0.5) * spread * 2));
}

function getStatus(loadPercent: number): NodeStatus {
  if (loadPercent >= 90) return 'critical';
  if (loadPercent >= 75) return 'warning';
  return 'normal';
}

// ── Build Grid Topology ───────────────────────────────────────────

function buildGridTopology(): { nodes: GridNode[]; edges: GridEdge[] } {
  // Canvas dimensions for layout (virtual SVG units)
  const W = 1200;
  const TS_Y = 90;
  const SS_Y = 300;
  const DT_Y = 520;

  // ── Build Nodes ──
  const tsNodes: GridNode[] = MOCK_TRANSMISSION_STATIONS.map((ts, i, arr) => {
    const load = getRandomVariation(BASE_LOADS[`ts-${ts.id}`]);
    return {
      id: `ts-${ts.id}`, dbId: ts.id, type: 'ts',
      name: ts.name, status: getStatus(load),
      loadPercent: load,
      nameplateRating: 30000, currentKva: 30000 * load / 100,
      meterId: MOCK_FEEDERS_33.find(f => f.tsId === ts.id)?.meterId ?? 0,
      latitude: ts.latitude, longitude: ts.longitude,
      x: ((i + 1) / (arr.length + 1)) * W, y: TS_Y,
    };
  });

  const ssNodes: GridNode[] = MOCK_SUBSTATIONS.map((ss, i, arr) => {
    const load = getRandomVariation(BASE_LOADS[`ss-${ss.id}`]);
    return {
      id: `ss-${ss.id}`, dbId: ss.id, type: 'ss',
      name: ss.name, status: getStatus(load),
      loadPercent: load,
      nameplateRating: 20000, currentKva: 20000 * load / 100,
      meterId: MOCK_FEEDERS_11.find(f => f.ssId === ss.id)?.meterId ?? 0,
      latitude: ss.latitude, longitude: ss.longitude,
      x: ((i + 1) / (arr.length + 1)) * W, y: SS_Y,
    };
  });

  // DT positions: spread across width, SS-grouped
  const dtByFeeder11: Record<number, DistributionTransformer[]> = {};
  const dtByFeeder33: DistributionTransformer[] = [];
  MOCK_DT.forEach(dt => {
    if (dt.feeder11Id !== null) {
      dtByFeeder11[dt.feeder11Id] ??= [];
      dtByFeeder11[dt.feeder11Id].push(dt);
    } else {
      dtByFeeder33.push(dt);
    }
  });

  const dtXPositions: Record<number, number> = {};
  const step = W / (MOCK_DT.length + 1);
  MOCK_DT.forEach((dt, i) => { dtXPositions[dt.id] = (i + 1) * step; });

  const dtNodes: GridNode[] = MOCK_DT.map(dt => {
    const load = getRandomVariation(BASE_LOADS[`dt-${dt.id}`]);
    return {
      id: `dt-${dt.id}`, dbId: dt.id, type: 'dt',
      name: dt.name, status: getStatus(load),
      loadPercent: load,
      nameplateRating: dt.nameplateRating,
      currentKva: dt.nameplateRating * load / 100,
      meterId: dt.meterId,
      latitude: dt.latitude, longitude: dt.longitude,
      x: dtXPositions[dt.id], y: DT_Y,
    };
  });

  const nodes: GridNode[] = [...tsNodes, ...ssNodes, ...dtNodes];

  // ── Build Edges ──
  const edges: GridEdge[] = [];

  // F33 edges: TS → SS
  MOCK_FEEDER33_SUBSTATIONS.forEach(link => {
    const feeder = MOCK_FEEDERS_33.find(f => f.id === link.feeders33Id)!;
    const load = getRandomVariation(65);
    edges.push({
      id: `f33-${feeder.id}-ss${link.substationsId}`,
      sourceId: `ts-${feeder.tsId}`,
      targetId: `ss-${link.substationsId}`,
      voltage: 33, name: feeder.name,
      loadPercent: load, nameplateRating: feeder.nameplateRating,
    });
  });

  // Trade F11 edges: TS → DT (direct, no SS)
  MOCK_DT.filter(dt => dt.feeder33Id !== null).forEach(dt => {
    const feeder = MOCK_FEEDERS_33.find(f => f.id === dt.feeder33Id)!;
    if (!feeder) return;
    const load = getRandomVariation(55);
    edges.push({
      id: `f33-trade-${feeder.id}`,
      sourceId: `ts-${feeder.tsId}`,
      targetId: `dt-${dt.id}`,
      voltage: 33, name: `${feeder.name} (Trade)`,
      loadPercent: load, nameplateRating: feeder.nameplateRating,
    });
  });

  // F11 edges: SS → DT
  MOCK_FEEDERS_11.forEach(f11 => {
    const dts = MOCK_DT.filter(dt => dt.feeder11Id === f11.id);
    dts.forEach(dt => {
      const load = getRandomVariation(70);
      edges.push({
        id: `f11-${f11.id}-dt${dt.id}`,
        sourceId: `ss-${f11.ssId}`,
        targetId: `dt-${dt.id}`,
        voltage: 11, name: f11.name,
        loadPercent: load, nameplateRating: f11.nameplateRating,
      });
    });
  });

  return { nodes, edges };
}

// ── Network Loss Mock Data ────────────────────────────────────────

const MOCK_NETWORK_LOSSES: NetworkLoss[] = MOCK_FEEDERS_33.map(f => {
  const inputKwh = f.nameplateRating * 0.65 * 24;
  const lossPercent = 4 + Math.random() * 12;
  const lossKwh = inputKwh * lossPercent / 100;
  return {
    feederId: f.id, feederName: f.name, voltage: 33,
    inputKwh: Math.round(inputKwh), outputKwh: Math.round(inputKwh - lossKwh),
    lossKwh: Math.round(lossKwh), lossPercent: parseFloat(lossPercent.toFixed(1)),
  };
}).concat(MOCK_FEEDERS_11.map(f => {
  const inputKwh = f.nameplateRating * 0.70 * 24;
  const lossPercent = 2 + Math.random() * 8;
  const lossKwh = inputKwh * lossPercent / 100;
  return {
    feederId: f.id, feederName: f.name, voltage: 11,
    inputKwh: Math.round(inputKwh), outputKwh: Math.round(inputKwh - lossKwh),
    lossKwh: Math.round(lossKwh), lossPercent: parseFloat(lossPercent.toFixed(1)),
  };
}));

// ── Alarms ────────────────────────────────────────────────────────

const MOCK_ALARMS: Alarm[] = [
  {
    id: 'alm-001', nodeId: 'dt-3', nodeName: 'Maryland DT', nodeType: 'dt',
    severity: 'critical', message: 'Overload detected: 91% of nameplate capacity',
    timestamp: new Date(Date.now() - 4 * 60000), acknowledged: false,
  },
  {
    id: 'alm-002', nodeId: 'dt-2', nodeName: 'Lekki Phase 2 DT', nodeType: 'dt',
    severity: 'warning', message: 'High load: 82% of nameplate capacity',
    timestamp: new Date(Date.now() - 12 * 60000), acknowledged: false,
  },
  {
    id: 'alm-003', nodeId: 'ss-2', nodeName: 'Apapa Injection SS', nodeType: 'ss',
    severity: 'warning', message: 'High load on feeder F11-APA-OSH: 78%',
    timestamp: new Date(Date.now() - 28 * 60000), acknowledged: false,
  },
  {
    id: 'alm-004', nodeId: 'dt-7', nodeName: 'Badia DT', nodeType: 'dt',
    severity: 'info', message: 'Meter communication restored after 2h offline',
    timestamp: new Date(Date.now() - 45 * 60000), acknowledged: true,
  },
  {
    id: 'alm-005', nodeId: 'ts-2', nodeName: 'Victoria Island Grid Station', nodeType: 'ts',
    severity: 'info', message: 'Scheduled maintenance window starts in 4 hours',
    timestamp: new Date(Date.now() - 60 * 60000), acknowledged: true,
  },
];

// ── Live Readings Generator ───────────────────────────────────────

function generateLiveReadings(): LiveMeterReading[] {
  const topo = buildGridTopology();
  return topo.nodes.map(node => ({
    meterId: node.meterId,
    nodeId: node.id,
    nodeName: node.name,
    kva: Math.round(node.currentKva),
    loadPercent: parseFloat(node.loadPercent.toFixed(1)),
    timestamp: new Date(),
  }));
}

function generateMeterReadings(): MeterReadTfe[] {
  return MOCK_METERS.map(m => ({
    id: Math.floor(Math.random() * 100000),
    mid: m.id,
    val: parseFloat((Math.random() * 800 + 100).toFixed(2)),
    ts: new Date(),
  }));
}

function generateHistoricalReadings(meterId: number): MeterReadTfe[] {
  const readings: MeterReadTfe[] = [];
  const now = Date.now();
  for (let i = 48; i >= 0; i--) {
    readings.push({
      id: i,
      mid: meterId,
      val: parseFloat((400 + Math.sin(i / 4) * 150 + Math.random() * 50).toFixed(2)),
      ts: new Date(now - i * 30 * 60000),
    });
  }
  return readings;
}

function computeGridStats(): GridStats {
  const topo = buildGridTopology();
  const dtNodes = topo.nodes.filter(n => n.type === 'dt');
  const totalCapacity = dtNodes.reduce((s, n) => s + n.nameplateRating, 0);
  const totalLoad = dtNodes.reduce((s, n) => s + n.currentKva, 0);
  const avgLoss = MOCK_NETWORK_LOSSES.reduce((s, l) => s + l.lossPercent, 0) / MOCK_NETWORK_LOSSES.length;
  const criticalAlarms = MOCK_ALARMS.filter(a => a.severity === 'critical' && !a.acknowledged).length;
  const activeAlarms = MOCK_ALARMS.filter(a => !a.acknowledged).length;
  return {
    totalLoadKva: Math.round(totalLoad),
    totalCapacityKva: totalCapacity,
    loadPercent: parseFloat((totalLoad / totalCapacity * 100).toFixed(1)),
    networkLossPercent: parseFloat(avgLoss.toFixed(1)),
    activeAlarms, criticalAlarms,
    offlineNodes: 0,
    timestamp: new Date(),
  };
}
