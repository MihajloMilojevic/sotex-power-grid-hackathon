from pydantic import BaseModel
from typing import List, Optional, Literal


class GeoNode(BaseModel):
    id: str
    type: Literal["TS", "SS", "DT"]
    name: str
    lat: float
    lon: float
    load: Optional[int] = None
    kva: Optional[int] = None


class FeederGroup(BaseModel):
    """
    One entry per feeder (F33, F11, or Trade_F11).
    node_coords includes the parent node (TS or SS) + all children,
    so the convex hull spans the full connection geometry.
    """
    feeder_id: int
    feeder_name: str
    feeder_type: Literal["F33", "F11", "Trade_F11"]
    parent_id: str
    node_ids: List[str]
    node_coords: List[List[float]]   # [[lat, lon], ...] — parent first
    load: int
    node_count: int


class GridStats(BaseModel):
    ts_count: int
    ss_count: int
    dt_count: int
    f33_group_count: int
    f11_group_count: int
    critical_count: int
    avg_load: int


class TopologyResponse(BaseModel):
    nodes: List[GeoNode]
    feeder_groups: List[FeederGroup]
    stats: GridStats
