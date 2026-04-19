# Sotex Power Grid SCADA
## Angular 21 — Hackathon Edition

A real-time SCADA (Supervisory Control and Data Acquisition) system for
visualizing and monitoring the Nigerian power distribution grid.

---

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm start
# → Opens at http://localhost:4200
```

---

## Project Structure

```
src/app/
├── models/
│   └── grid.models.ts              # All domain interfaces (mirrors DB schema)
│
├── services/
│   └── data-retrieval.service.ts   # ← THE INTEGRATION POINT
│
└── components/
    ├── dashboard/                  # Root orchestrator component
    ├── header/                     # Status bar + KPI metrics
    ├── grid-topology/              # Interactive SVG network diagram
    ├── node-detail/                # Selected node inspector
    ├── alarm-panel/                # Active alarm list
    ├── network-loss/               # Per-feeder loss analysis
    └── stats-bar/                  # Bottom live ticker + stats
```

---

## Switching to a Real Backend

**Only one file changes: `data-retrieval.service.ts`**

Every method currently returns mock data via `of(MOCK_DATA).pipe(delay(n))`.
To connect to a real API, replace each method body with an HTTP call:

```typescript
// BEFORE (mock)
getTransmissionStations(): Observable<TransmissionStation[]> {
  return of(MOCK_TRANSMISSION_STATIONS).pipe(delay(80));
}

// AFTER (real backend)
getTransmissionStations(): Observable<TransmissionStation[]> {
  return this.http.get<TransmissionStation[]>(`${this.API_BASE}/transmission-stations`);
}
```

Also set the base URL at the top of the service:
```typescript
private readonly API_BASE = 'http://your-backend-url/api';
```

No other files need to change.

---

## Features

| Feature | Description |
|---|---|
| **Grid Topology** | Interactive SVG diagram — pan, zoom, click nodes |
| **Node Types** | TS (hexagon), SS (diamond), DT (rounded rect) |
| **Status Colors** | Green = normal, Amber = warning (>75%), Red = critical (>90%) |
| **Live Updates** | Meter readings refresh every 4 seconds |
| **Node Inspector** | Click any node to see load, kVA, meter readings |
| **Alarm Panel** | Active alarms with severity levels and acknowledgement |
| **Network Loss** | Per-feeder loss analysis (%) |
| **Stats Bar** | Live scrolling ticker + system-wide KPIs |

---

## Grid Topology

The diagram shows the full hierarchical power flow:

```
Transmission Station (TS)  [132kV input]
        │
        ├── F33 (33kV feeder) ──→ Injection Substation (SS)
        │                                  │
        │                         F11 (11kV feeder) ──→ Distribution Transformer (DT)
        │                                                        │
        └── F33 Trade (direct) ──→ DT                    Consumers (415V)
```

Meters (yellow dots) on every node record energy flow.
**Network Loss = TS meter output − sum of downstream DT meter inputs.**

---

## Tech Stack

- **Angular 21** — standalone components, signals, `@if`/`@for` control flow
- **RxJS** — Observable-based data streams, `forkJoin`, `timer` polling
- **Pure SVG** — topology rendered with Angular template bindings, no external chart library
- **SCSS** — industrial dark SCADA aesthetic with CSS variables
