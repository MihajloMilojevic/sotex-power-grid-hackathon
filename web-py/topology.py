"""
GET /api/v1/topology/geo

Returns:
  nodes         — TS, SS, DT with real coordinates from DB
  feeder_groups — one entry per feeder (F33 / F11 / Trade_F11).
                  node_coords includes the PARENT node first, then all
                  children, so the frontend can compute a convex hull
                  polygon that spans the full connection geometry.

Feeder load is a seeded mock — replace _mock_load() with a real
MeterReadTfes query when ready.
"""

import random
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text

from database import get_db
from schemas import GeoNode, FeederGroup, GridStats, TopologyResponse

router = APIRouter()


def _mock_load(seed: int, lo: int = 25, hi: int = 95) -> int:
    return random.Random(seed).randint(lo, hi)


@router.get("/topology/geo", response_model=TopologyResponse)
def get_topology_geo(db: Session = Depends(get_db)):
    try:
        return _build_topology(db)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


def _build_topology(db: Session) -> TopologyResponse:
    nodes: list[GeoNode] = []
    feeder_groups: list[FeederGroup] = []

    # ── 1. Transmission Stations ──────────────────────────────────────────────
    ts_rows = db.execute(text("""
        SELECT Id, Name, Latitude, Longitude
        FROM dbo.TransmissionStations
        WHERE Latitude IS NOT NULL AND Longitude IS NOT NULL
          AND Latitude <> 0 AND Longitude <> 0
    """)).fetchall()

    ts_index: dict[int, GeoNode] = {}
    for row in ts_rows:
        n = GeoNode(id=f"TS-{row.Id}", type="TS", name=row.Name or f"TS-{row.Id}",
                    lat=float(row.Latitude), lon=float(row.Longitude),
                    load=_mock_load(row.Id * 11, 30, 80))
        ts_index[row.Id] = n
        nodes.append(n)

    # ── 2. Injection Substations ──────────────────────────────────────────────
    ss_rows = db.execute(text("""
        SELECT Id, Name, Latitude, Longitude
        FROM dbo.Substations
        WHERE Latitude IS NOT NULL AND Longitude IS NOT NULL
          AND Latitude <> 0 AND Longitude <> 0
    """)).fetchall()

    ss_index: dict[int, GeoNode] = {}
    for row in ss_rows:
        n = GeoNode(id=f"SS-{row.Id}", type="SS", name=row.Name or f"SS-{row.Id}",
                    lat=float(row.Latitude), lon=float(row.Longitude),
                    load=_mock_load(row.Id * 17, 30, 90))
        ss_index[row.Id] = n
        nodes.append(n)

    # ── 3. Distribution Transformers ──────────────────────────────────────────
    dt_rows = db.execute(text("""
        SELECT Id, Name, Latitude, Longitude, NameplateRating, Feeder11Id
        FROM dbo.DistributionSubstation
        WHERE Latitude IS NOT NULL AND Longitude IS NOT NULL
          AND Latitude <> 0 AND Longitude <> 0
    """)).fetchall()

    dt_index: dict[int, GeoNode] = {}
    dt_by_f11: dict[int, list[int]] = {}

    for row in dt_rows:
        n = GeoNode(id=f"DT-{row.Id}", type="DT", name=row.Name or f"DT-{row.Id}",
                    lat=float(row.Latitude), lon=float(row.Longitude),
                    load=_mock_load(row.Id * 7, 25, 95),
                    kva=row.NameplateRating)
        dt_index[row.Id] = n
        nodes.append(n)
        if row.Feeder11Id:
            dt_by_f11.setdefault(row.Feeder11Id, []).append(row.Id)

    # ── 4. F33 feeder groups: TS + all its SS ─────────────────────────────────
    f33_rows = db.execute(text("""
        SELECT Id, Name, TsId FROM dbo.Feeders33 WHERE IsDeleted = 0
    """)).fetchall()

    f33_meta = {row.Id: row for row in f33_rows}

    # group SS ids by F33 feeder id
    ss_by_f33: dict[int, list[int]] = {}
    for row in db.execute(text("SELECT Feeders33Id, SubstationsId FROM dbo.Feeder33Substation")).fetchall():
        ss_by_f33.setdefault(row.Feeders33Id, []).append(row.SubstationsId)

    for f33_id, row in f33_meta.items():
        ts_node = ts_index.get(row.TsId)
        if not ts_node:
            continue
        ss_ids = ss_by_f33.get(f33_id, [])
        ss_nodes = [ss_index[sid] for sid in ss_ids if sid in ss_index]
        if not ss_nodes:
            continue

        # parent (TS) first, then all SS on this feeder
        all_nodes = [ts_node] + ss_nodes
        feeder_groups.append(FeederGroup(
            feeder_id=f33_id,
            feeder_name=row.Name or f"F33-{f33_id}",
            feeder_type="F33",
            parent_id=ts_node.id,
            node_ids=[n.id for n in all_nodes],
            node_coords=[[n.lat, n.lon] for n in all_nodes],
            load=_mock_load(f33_id * 13, 30, 92),
            node_count=len(all_nodes),
        ))

    # ── 5. F11 / Trade-F11 feeder groups: parent + all DTs ───────────────────
    f11_rows = db.execute(text("""
        SELECT Id, Name, SsId, TsId FROM dbo.Feeders11
    """)).fetchall()

    for row in f11_rows:
        dt_ids = dt_by_f11.get(row.Id)
        if not dt_ids:
            continue
        dt_nodes = [dt_index[did] for did in dt_ids if did in dt_index]
        if not dt_nodes:
            continue

        if row.SsId and row.SsId in ss_index:
            parent_node = ss_index[row.SsId]
            ftype = "F11"
        elif row.TsId and row.TsId in ts_index:
            parent_node = ts_index[row.TsId]
            ftype = "Trade_F11"
        else:
            continue

        all_nodes = [parent_node] + dt_nodes
        feeder_groups.append(FeederGroup(
            feeder_id=row.Id,
            feeder_name=row.Name or f"F11-{row.Id}",
            feeder_type=ftype,
            parent_id=parent_node.id,
            node_ids=[n.id for n in all_nodes],
            node_coords=[[n.lat, n.lon] for n in all_nodes],
            load=_mock_load(row.Id * 19, 25, 90),
            node_count=len(all_nodes),
        ))

    # ── 6. Stats ──────────────────────────────────────────────────────────────
    all_loads = [n.load for n in nodes if n.load is not None]
    f33_count = sum(1 for g in feeder_groups if g.feeder_type == "F33")
    f11_count = sum(1 for g in feeder_groups if g.feeder_type != "F33")

    return TopologyResponse(
        nodes=nodes,
        feeder_groups=feeder_groups,
        stats=GridStats(
            ts_count=len([n for n in nodes if n.type == "TS"]),
            ss_count=len([n for n in nodes if n.type == "SS"]),
            dt_count=len([n for n in nodes if n.type == "DT"]),
            f33_group_count=f33_count,
            f11_group_count=f11_count,
            critical_count=sum(1 for l in all_loads if l > 90),
            avg_load=round(sum(all_loads) / len(all_loads)) if all_loads else 0,
        ),
    )
