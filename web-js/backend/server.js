// ════════════════════════════════════════════════════════════════════
//  POWER GRID SCADA — Backend API Bridge
//  Table names and columns verified against db.sql schema.
//
//  Start:  node server.js   (or: npm run dev)
//  Serves: http://localhost:3000/api/...
// ════════════════════════════════════════════════════════════════════

const express = require('express');
const sql     = require('mssql');
const cors    = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ── Database config ───────────────────────────────────────────────
const DB_CONFIG = {
  server:   'localhost',
  port:     1433,
  user:     'sa',
  password: 'SotexSolutions123!',
  database: 'SotexHackathon',
  options: {
    encrypt:                false,
    trustServerCertificate: true,
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
};

let pool;
async function getPool() {
  if (!pool) {
    pool = await sql.connect(DB_CONFIG);
    console.log('✓ Connected to SotexHackathon');
  }
  return pool;
}

async function query(sqlText, params = {}) {
  const p   = await getPool();
  const req = p.request();
  Object.entries(params).forEach(([k, v]) => req.input(k, v));
  return (await req.query(sqlText)).recordset;
}

function handle(fn) {
  return async (req, res) => {
    try { await fn(req, res); }
    catch (err) {
      console.error('DB error:', err.message);
      res.status(500).json({ error: err.message });
    }
  };
}

// ════════════════════════════════════════════════════════════════════
//  RAW TABLE ENDPOINTS
// ════════════════════════════════════════════════════════════════════

// GET /api/transmission-stations
// Table: TransmissionStations
app.get('/api/transmission-stations', handle(async (_req, res) => {
  res.json(await query(`
    SELECT Id AS id, Name AS name, Latitude AS latitude, Longitude AS longitude
    FROM   TransmissionStations
  `));
}));

// GET /api/substations
// Table: Substations  (injection substations / SS nodes)
app.get('/api/substations', handle(async (_req, res) => {
  res.json(await query(`
    SELECT Id AS id, Name AS name, Latitude AS latitude, Longitude AS longitude
    FROM   Substations
  `));
}));

// GET /api/feeders33
// Table: Feeders33  — IsDeleted flag must be filtered
app.get('/api/feeders33', handle(async (_req, res) => {
  res.json(await query(`
    SELECT Id              AS id,
           Name            AS name,
           TsId            AS tsId,
           MeterId         AS meterId,
           NameplateRating AS nameplateRating
    FROM   Feeders33
    WHERE  IsDeleted = 0
  `));
}));

// GET /api/feeders11
// Table: Feeders11
//   SsId      — parent injection substation (regular F11)
//   TsId      — parent transmission station  (Trade F11, goes TS→DT directly)
//   Feeder33Id — the parent F33 this feeder belongs to
app.get('/api/feeders11', handle(async (_req, res) => {
  res.json(await query(`
    SELECT Id              AS id,
           Name            AS name,
           SsId            AS ssId,
           TsId            AS tsId,
           Feeder33Id      AS feeder33Id,
           MeterId         AS meterId,
           NameplateRating AS nameplateRating
    FROM   Feeders11
  `));
}));

// GET /api/dt
// Table: DistributionSubstation  (distribution transformers / DT nodes)
//   Feeder11Id — which F11 feeds this DT  (null if fed directly by F33)
//   Feeder33Id — which F33 feeds this DT  (null if fed via F11)
app.get('/api/dt', handle(async (_req, res) => {
  res.json(await query(`
    SELECT Id              AS id,
           Name            AS name,
           MeterId         AS meterId,
           Feeder11Id      AS feeder11Id,
           Feeder33Id      AS feeder33Id,
           NameplateRating AS nameplateRating,
           Latitude        AS latitude,
           Longitude       AS longitude
    FROM   DistributionSubstation
  `));
}));

// GET /api/meters
// Table: Meters
app.get('/api/meters', handle(async (_req, res) => {
  res.json(await query(`
    SELECT Id AS id, MSN AS msn, MultiplierFactor AS multiplierFactor
    FROM   Meters
  `));
}));

// GET /api/feeder33-substations
// Table: Feeder33Substation  (junction: Feeders33 ↔ Substations)
app.get('/api/feeder33-substations', handle(async (_req, res) => {
  res.json(await query(`
    SELECT Feeders33Id AS feeders33Id, SubstationsId AS substationsId
    FROM   Feeder33Substation
  `));
}));

// GET /api/channels
// Table: Channels
app.get('/api/channels', handle(async (_req, res) => {
  res.json(await query(`
    SELECT Id AS id, Name AS name, Unit AS unit
    FROM   Channels
  `));
}));

// ════════════════════════════════════════════════════════════════════
//  METER READINGS
//  MeterReadTfes has composite PK (Id, Ts) — partitioned table.
//  Use subquery MAX(Ts) per Mid to get latest reading.
// ════════════════════════════════════════════════════════════════════

// GET /api/meter-reads/latest
// Most recent reading for every meter
app.get('/api/meter-reads/latest', handle(async (_req, res) => {
  res.json(await query(`
    SELECT r.Id  AS id,
           r.Mid AS mid,
           r.Val AS val,
           r.Ts  AS ts
    FROM   MeterReadTfes r
    WHERE  r.Ts = (
             SELECT MAX(i.Ts)
             FROM   MeterReadTfes i
             WHERE  i.Mid = r.Mid
           )
  `));
}));

// GET /api/meter-reads/live  (alias — used by Angular polling)
app.get('/api/meter-reads/live', handle(async (_req, res) => {
  res.json(await query(`
    SELECT r.Id  AS id,
           r.Mid AS mid,
           r.Val AS val,
           r.Ts  AS ts
    FROM   MeterReadTfes r
    WHERE  r.Ts = (
             SELECT MAX(i.Ts)
             FROM   MeterReadTfes i
             WHERE  i.Mid = r.Mid
           )
  `));
}));

// GET /api/meter-reads?meterId=X&from=ISO&to=ISO
// Historical series for one meter
app.get('/api/meter-reads', handle(async (req, res) => {
  const { meterId, from, to } = req.query;
  if (!meterId) return res.status(400).json({ error: 'meterId is required' });

  let q = `
    SELECT Id AS id, Mid AS mid, Val AS val, Ts AS ts
    FROM   MeterReadTfes
    WHERE  Mid = @meterId
  `;
  const params = { meterId: Number(meterId) };
  if (from) { q += ` AND Ts >= @from`; params.from = new Date(from); }
  if (to)   { q += ` AND Ts <= @to`;   params.to   = new Date(to);   }
  q += ` ORDER BY Ts ASC`;

  res.json(await query(q, params));
}));

// ════════════════════════════════════════════════════════════════════
//  COMPUTED ENDPOINTS
// ════════════════════════════════════════════════════════════════════

// GET /api/analytics/network-loss
//
// F11 loss: feeder meter vs the single downstream DT meter (1:1)
//
// F33 loss: feeder meter vs sum of all downstream DT meters reached via:
//   Path A — DistributionSubstation.Feeder33Id (direct TS→DT)
//   Path B — Feeder33Substation → Substations → Feeders11 → DistributionSubstation
app.get('/api/analytics/network-loss', handle(async (_req, res) => {

  const f11 = await query(`
    SELECT
      f.Id              AS feederId,
      f.Name            AS feederName,
      11                AS voltage,
      ISNULL((
        SELECT TOP 1 r.Val * m.MultiplierFactor
        FROM   MeterReadTfes r
        JOIN   Meters m ON m.Id = r.Mid
        WHERE  r.Mid = f.MeterId
        ORDER  BY r.Ts DESC
      ), 0) AS inputKwh,
      ISNULL((
        SELECT TOP 1 r.Val * m.MultiplierFactor
        FROM   MeterReadTfes r
        JOIN   Meters m ON m.Id = r.Mid
        WHERE  r.Mid = ds.MeterId
        ORDER  BY r.Ts DESC
      ), 0) AS outputKwh
    FROM  Feeders11 f
    JOIN  DistributionSubstation ds ON ds.Feeder11Id = f.Id
  `);

  const f33 = await query(`
    SELECT
      f.Id              AS feederId,
      f.Name            AS feederName,
      33                AS voltage,
      ISNULL((
        SELECT TOP 1 r.Val * m.MultiplierFactor
        FROM   MeterReadTfes r
        JOIN   Meters m ON m.Id = r.Mid
        WHERE  r.Mid = f.MeterId
        ORDER  BY r.Ts DESC
      ), 0) AS inputKwh,
      ISNULL((
        SELECT SUM(dtKva)
        FROM (
          -- Path A: F33 feeds DT directly
          SELECT ISNULL((
            SELECT TOP 1 r.Val * m.MultiplierFactor
            FROM   MeterReadTfes r
            JOIN   Meters m ON m.Id = r.Mid
            WHERE  r.Mid = ds.MeterId
            ORDER  BY r.Ts DESC
          ), 0) AS dtKva
          FROM DistributionSubstation ds
          WHERE ds.Feeder33Id = f.Id

          UNION ALL

          -- Path B: F33 → SS (junction) → F11 → DT
          SELECT ISNULL((
            SELECT TOP 1 r.Val * m.MultiplierFactor
            FROM   MeterReadTfes r
            JOIN   Meters m ON m.Id = r.Mid
            WHERE  r.Mid = ds.MeterId
            ORDER  BY r.Ts DESC
          ), 0) AS dtKva
          FROM   Feeder33Substation fss
          JOIN   Feeders11 f11             ON f11.SsId = fss.SubstationsId
          JOIN   DistributionSubstation ds ON ds.Feeder11Id = f11.Id
          WHERE  fss.Feeders33Id = f.Id
        ) paths
      ), 0) AS outputKwh
    FROM  Feeders33 f
    WHERE f.IsDeleted = 0
  `);

  const all = [...f11, ...f33].map(row => ({
    ...row,
    lossKwh:     Math.max(0, row.inputKwh - row.outputKwh),
    lossPercent: row.inputKwh > 0
        ? parseFloat(((row.inputKwh - row.outputKwh) / row.inputKwh * 100).toFixed(1))
        : 0,
  }));

  res.json(all);
}));

// GET /api/grid/stats
app.get('/api/grid/stats', handle(async (_req, res) => {
  const [[cap], [load]] = await Promise.all([
    query(`SELECT ISNULL(SUM(NameplateRating), 0) AS v FROM DistributionSubstation`),
    query(`
      SELECT ISNULL(SUM(latest.Val * m.MultiplierFactor), 0) AS v
      FROM   DistributionSubstation ds
      JOIN   Meters m ON m.Id = ds.MeterId
      CROSS  APPLY (
        SELECT TOP 1 Val FROM MeterReadTfes WHERE Mid = ds.MeterId ORDER BY Ts DESC
      ) latest
    `),
  ]);

  const totalCap  = cap.v  ?? 0;
  const totalLoad = load.v ?? 0;

  res.json({
    totalLoadKva:       Math.round(totalLoad),
    totalCapacityKva:   totalCap,
    loadPercent:        totalCap > 0 ? parseFloat((totalLoad / totalCap * 100).toFixed(1)) : 0,
    networkLossPercent: 0,
    activeAlarms:       0,
    criticalAlarms:     0,
    offlineNodes:       0,
    timestamp:          new Date(),
  });
}));

// GET /api/grid/topology
//
// Builds the full node+edge graph from real DB data.
//
// Edge types:
//   F33  TS → SS   via Feeder33Substation junction
//   F33  TS → DT   DistributionSubstation.Feeder33Id set (direct)
//   F11  SS → DT   Feeders11.SsId set  (regular feeder)
//   F11  TS → DT   Feeders11.TsId set  (Trade F11, bypasses SS)
app.get('/api/grid/topology', handle(async (_req, res) => {

  const [tsList, ssList, dtList, f33List, f11List, f33ssList, latestReads] =
      await Promise.all([
        query(`SELECT Id AS id, Name AS name, Latitude AS latitude, Longitude AS longitude FROM TransmissionStations`),
        query(`SELECT Id AS id, Name AS name, Latitude AS latitude, Longitude AS longitude FROM Substations`),
        query(`
        SELECT Id AS id, Name AS name, MeterId AS meterId,
               Feeder11Id AS feeder11Id, Feeder33Id AS feeder33Id,
               NameplateRating AS nameplateRating,
               Latitude AS latitude, Longitude AS longitude
        FROM   DistributionSubstation
      `),
        query(`
        SELECT Id AS id, Name AS name, TsId AS tsId,
               MeterId AS meterId, NameplateRating AS nameplateRating
        FROM   Feeders33
        WHERE  IsDeleted = 0
      `),
        query(`
        SELECT Id AS id, Name AS name,
               SsId AS ssId, TsId AS tsId, Feeder33Id AS feeder33Id,
               MeterId AS meterId, NameplateRating AS nameplateRating
        FROM   Feeders11
      `),
        query(`SELECT Feeders33Id AS feeders33Id, SubstationsId AS substationsId FROM Feeder33Substation`),
        query(`
        SELECT r.Mid AS mid, r.Val AS val, m.MultiplierFactor AS multiplierFactor
        FROM   MeterReadTfes r
        JOIN   Meters m ON m.Id = r.Mid
        WHERE  r.Ts = (SELECT MAX(i.Ts) FROM MeterReadTfes i WHERE i.Mid = r.Mid)
      `),
      ]);

  // meterId → latest kVA
  const meterKva = {};
  latestReads.forEach(r => { meterKva[r.mid] = (r.val ?? 0) * (r.multiplierFactor ?? 1); });

  function nodeStatus(pct) {
    return pct >= 90 ? 'critical' : pct >= 75 ? 'warning' : 'normal';
  }

  const W = 1200, TS_Y = 90, SS_Y = 300, DT_Y = 520;
  function spread(items, y) {
    return items.map((item, i, arr) => ({
      ...item,
      x: ((i + 1) / (arr.length + 1)) * W,
      y,
    }));
  }

  // ── Nodes ────────────────────────────────────────────────────────

  const tsNodes = spread(tsList, TS_Y).map(ts => {
    const kva  = meterKva[f33List.find(f => f.tsId === ts.id)?.meterId] ?? 0;
    const cap  = 30000;
    const load = Math.min(100, kva / cap * 100);
    return {
      id: `ts-${ts.id}`, dbId: ts.id, type: 'ts',
      name: ts.name, status: nodeStatus(load),
      loadPercent: +load.toFixed(1),
      nameplateRating: cap, currentKva: Math.round(kva),
      meterId: f33List.find(f => f.tsId === ts.id)?.meterId ?? 0,
      latitude: ts.latitude, longitude: ts.longitude,
      x: ts.x, y: ts.y,
    };
  });

  const ssNodes = spread(ssList, SS_Y).map(ss => {
    const kva  = f11List
        .filter(f => f.ssId === ss.id)
        .reduce((s, f) => s + (meterKva[f.meterId] ?? 0), 0);
    const cap  = 20000;
    const load = Math.min(100, kva / cap * 100);
    return {
      id: `ss-${ss.id}`, dbId: ss.id, type: 'ss',
      name: ss.name, status: nodeStatus(load),
      loadPercent: +load.toFixed(1),
      nameplateRating: cap, currentKva: Math.round(kva),
      meterId: f11List.find(f => f.ssId === ss.id)?.meterId ?? 0,
      latitude: ss.latitude, longitude: ss.longitude,
      x: ss.x, y: ss.y,
    };
  });

  const dtNodes = spread(dtList, DT_Y).map(dt => {
    const kva  = meterKva[dt.meterId] ?? 0;
    const load = dt.nameplateRating > 0 ? Math.min(100, kva / dt.nameplateRating * 100) : 0;
    return {
      id: `dt-${dt.id}`, dbId: dt.id, type: 'dt',
      name: dt.name, status: nodeStatus(load),
      loadPercent: +load.toFixed(1),
      nameplateRating: dt.nameplateRating, currentKva: Math.round(kva),
      meterId: dt.meterId,
      latitude: dt.latitude, longitude: dt.longitude,
      x: dt.x, y: dt.y,
    };
  });

  // ── Edges ────────────────────────────────────────────────────────
  const edges = [];

  // 1. F33 TS → SS  (via Feeder33Substation junction)
  f33ssList.forEach(link => {
    const f    = f33List.find(x => x.id === link.feeders33Id);
    if (!f) return;
    const kva  = meterKva[f.meterId] ?? 0;
    const load = f.nameplateRating > 0 ? Math.min(100, kva / f.nameplateRating * 100) : 0;
    edges.push({
      id: `f33-${f.id}-ss${link.substationsId}`,
      sourceId: `ts-${f.tsId}`, targetId: `ss-${link.substationsId}`,
      voltage: 33, name: f.name,
      loadPercent: +load.toFixed(1), nameplateRating: f.nameplateRating,
    });
  });

  // 2. F33 TS → DT  (direct — DistributionSubstation.Feeder33Id set)
  dtList.filter(dt => dt.feeder33Id !== null).forEach(dt => {
    const f = f33List.find(x => x.id === dt.feeder33Id);
    if (!f) return;
    const kva  = meterKva[f.meterId] ?? 0;
    const load = f.nameplateRating > 0 ? Math.min(100, kva / f.nameplateRating * 100) : 0;
    edges.push({
      id: `f33-direct-${f.id}-dt${dt.id}`,
      sourceId: `ts-${f.tsId}`, targetId: `dt-${dt.id}`,
      voltage: 33, name: `${f.name} (direct)`,
      loadPercent: +load.toFixed(1), nameplateRating: f.nameplateRating,
    });
  });

  // 3. F11 SS → DT  (regular — Feeders11.SsId set)
  f11List.filter(f => f.ssId !== null).forEach(f => {
    dtList.filter(dt => dt.feeder11Id === f.id).forEach(dt => {
      const kva  = meterKva[f.meterId] ?? 0;
      const load = f.nameplateRating > 0 ? Math.min(100, kva / f.nameplateRating * 100) : 0;
      edges.push({
        id: `f11-${f.id}-dt${dt.id}`,
        sourceId: `ss-${f.ssId}`, targetId: `dt-${dt.id}`,
        voltage: 11, name: f.name,
        loadPercent: +load.toFixed(1), nameplateRating: f.nameplateRating,
      });
    });
  });

  // 4. Trade F11 TS → DT  (Feeders11.TsId set, SsId null — bypasses SS)
  f11List.filter(f => f.tsId !== null && f.ssId === null).forEach(f => {
    dtList.filter(dt => dt.feeder11Id === f.id).forEach(dt => {
      const kva  = meterKva[f.meterId] ?? 0;
      const load = f.nameplateRating > 0 ? Math.min(100, kva / f.nameplateRating * 100) : 0;
      edges.push({
        id: `f11-trade-${f.id}-dt${dt.id}`,
        sourceId: `ts-${f.tsId}`, targetId: `dt-${dt.id}`,
        voltage: 11, name: `${f.name} (Trade F11)`,
        loadPercent: +load.toFixed(1), nameplateRating: f.nameplateRating,
      });
    });
  });

  res.json({ nodes: [...tsNodes, ...ssNodes, ...dtNodes], edges });
}));

// GET /api/alarms
// Derives alarms from DTs running above 75% of nameplate capacity
app.get('/api/alarms', handle(async (_req, res) => {
  const rows = await query(`
    SELECT
      ds.Id              AS dtId,
      ds.Name            AS dtName,
      ds.NameplateRating AS nameplateRating,
      latest.Val         AS val,
      m.MultiplierFactor AS multiplier
    FROM  DistributionSubstation ds
    JOIN  Meters m ON m.Id = ds.MeterId
    CROSS APPLY (
      SELECT TOP 1 Val FROM MeterReadTfes WHERE Mid = ds.MeterId ORDER BY Ts DESC
    ) latest
    WHERE latest.Val * m.MultiplierFactor > ds.NameplateRating * 0.75
  `);

  res.json(rows.map(row => {
    const kva      = row.val * row.multiplier;
    const loadPct  = (kva / row.nameplateRating * 100).toFixed(1);
    const severity = kva >= row.nameplateRating * 0.9 ? 'critical' : 'warning';
    return {
      id:           `alm-dt-${row.dtId}`,
      nodeId:       `dt-${row.dtId}`,
      nodeName:     row.dtName,
      nodeType:     'dt',
      severity,
      message:      `Load at ${loadPct}% of ${row.nameplateRating} kVA nameplate`,
      timestamp:    new Date(),
      acknowledged: false,
    };
  }));
}));

// ── Health check ──────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date() }));

// ── Start ─────────────────────────────────────────────────────────
const PORT = 3000;
app.listen(PORT, async () => {
  console.log(`\n⚡ SCADA Backend  →  http://localhost:${PORT}`);
  try { await getPool(); }
  catch (err) { console.error('✗ DB connection failed:', err.message); }
});