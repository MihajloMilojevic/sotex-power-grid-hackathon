#!/usr/bin/env python3
"""
Power Grid Data Exporter
========================
Exports MSSQL power grid data to a JSON format consumable by grid_viewer.html.

Feeder lines are ordered as *convex chains*, not star patterns.
  Instead of  SS -> A, SS -> B, SS -> C
  You get     SS -> A -> B -> C  (ordered so the path is convex/non-crossing)

Hierarchy handled:
  TS  --(F33)--> SS  --(F11)--> DT        (standard path)
  TS  --(F33)--> DT                        (direct F33 to DT, no SS)
  TS  --(F11)--> DT                        ("Trade" feeder, bypasses SS)

Output detail levels:
  1 — TS nodes only                        (country/overview zoom)
  2 — TS + SS + 33 kV feeder chains        (regional zoom)
  3 — Full detail, all DTs, 11 kV chains   (street zoom)

Usage:
  pip install pymssql scipy numpy

  python export_grid.py \
      --server localhost --port 1433 \
      --database SotexHackathon \
      --username sa --password SotexSolutions123! \
      --output grid_export.json --pretty

  # Test without a DB:
  python export_grid.py --mock --output grid_export.json --pretty
"""

import json, math, argparse, sys
from collections import defaultdict
from typing import Optional

try:
    import pymssql
    HAS_DB = True
except ImportError:
    HAS_DB = False
    print("[WARN] pymssql not installed. Run: pip install pymssql", file=sys.stderr)

try:
    from scipy.spatial import ConvexHull
    import numpy as np
    HAS_SCIPY = True
except ImportError:
    HAS_SCIPY = False
    print("[WARN] scipy/numpy not installed — using angle-sort fallback.", file=sys.stderr)


# ── DB helpers ─────────────────────────────────────────────────────────────────

def get_connection(server, port, database, username, password):
    if not HAS_DB:
        raise RuntimeError("pymssql is not installed. Run: pip install pymssql")
    return pymssql.connect(
        server=server, port=port,
        user=username, password=password,
        database=database, tds_version='7.4',
    )

def fetchall(conn, sql):
    cur = conn.cursor(as_dict=True)
    cur.execute(sql)
    return list(cur.fetchall())

def load_all(conn):
    print("  Loading TransmissionStations …")
    d = {}
    d['transmission_stations']    = fetchall(conn, "SELECT * FROM dbo.TransmissionStations")
    print("  Loading Substations …")
    d['substations']               = fetchall(conn, "SELECT * FROM dbo.Substations")
    print("  Loading DistributionSubstation …")
    d['distribution_substations']  = fetchall(conn, "SELECT * FROM dbo.DistributionSubstation")
    print("  Loading Feeders33 (active) …")
    d['feeders33']                 = fetchall(conn, "SELECT * FROM dbo.Feeders33 WHERE IsDeleted = 0")
    print("  Loading Feeders11 …")
    d['feeders11']                 = fetchall(conn, "SELECT * FROM dbo.Feeders11")
    print("  Loading Feeder33Substation …")
    d['feeder33_substation']       = fetchall(conn, "SELECT * FROM dbo.Feeder33Substation")
    print("  Loading Meters …")
    d['meters']                    = fetchall(conn, "SELECT * FROM dbo.Meters")
    print("  Loading Channels …")
    d['channels']                  = fetchall(conn, "SELECT * FROM dbo.Channels")
    return d


# ── Convex chain ordering ──────────────────────────────────────────────────────

def _to_xy(lon, lat):
    R = 6_371_000
    x = math.radians(lon) * R * math.cos(math.radians(lat))
    y = math.radians(lat) * R
    return x, y

def _best_insert(parent_lon, parent_lat, chain, node):
    nx, ny = _to_xy(node['Longitude'], node['Latitude'])
    waypoints = [(parent_lon, parent_lat)] + [(c['Longitude'], c['Latitude']) for c in chain]
    best_cost, best_pos = float('inf'), len(chain)
    for i, (ax, ay) in enumerate((_to_xy(*p) for p in waypoints)):
        din = math.hypot(nx-ax, ny-ay)
        if i+1 < len(waypoints):
            bx, by = _to_xy(*waypoints[i+1])
            cost = din + math.hypot(nx-bx, ny-by) - math.hypot(bx-ax, by-ay)
        else:
            cost = din
        if cost < best_cost:
            best_cost, best_pos = cost, i
    return best_pos

def order_as_convex_chain(parent_lon, parent_lat, children):
    """
    Order children so parent→c[0]→c[1]→…→c[n] forms a convex (non-crossing) chain.
    Uses convex hull traversal when scipy is available, angle-sort fallback otherwise.
    """
    if not children: return []
    if len(children) == 1: return children[:]

    if HAS_SCIPY and len(children) >= 2:
        all_pts = [(parent_lon, parent_lat)] + [(c['Longitude'], c['Latitude']) for c in children]
        pts = np.array(all_pts, dtype=float)
        try:
            hull = ConvexHull(pts)
            hi = list(hull.vertices)
            if 0 in hi:
                start = hi.index(0)
                ordered_hi = [i for i in (hi[start:] + hi[:start]) if i != 0]
                hull_set = set(hull.vertices)
                interior = [i for i in range(1, len(all_pts)) if i not in hull_set]
                chain = [children[i-1] for i in ordered_hi if 0 < i <= len(children)]
                for i in interior:
                    if 0 < i <= len(children):
                        node = children[i-1]
                        chain.insert(_best_insert(parent_lon, parent_lat, chain, node), node)
                return chain
        except Exception:
            pass

    # Fallback: polar angle from parent
    px, py = _to_xy(parent_lon, parent_lat)
    return sorted(children, key=lambda c: math.atan2(
        _to_xy(c['Longitude'], c['Latitude'])[1] - py,
        _to_xy(c['Longitude'], c['Latitude'])[0] - px,
    ))


# ── Graph construction ─────────────────────────────────────────────────────────

def _sf(v):
    try: return float(v) if v is not None else None
    except: return None

def _has_coords(r):
    return _sf(r.get('Latitude')) is not None and _sf(r.get('Longitude')) is not None

def build_graph(data):
    nodes, edges, feeder_chains = [], [], []

    ts_map  = {r['Id']: r for r in data['transmission_stations']}
    ss_map  = {r['Id']: r for r in data['substations']}
    dt_map  = {r['Id']: r for r in data['distribution_substations']}

    f33_to_ss  = defaultdict(list)
    for lnk in data['feeder33_substation']:
        f33_to_ss[lnk['Feeders33Id']].append(lnk['SubstationsId'])

    f11_to_dt  = defaultdict(list)
    for dt in data['distribution_substations']:
        if dt.get('Feeder11Id'):
            f11_to_dt[dt['Feeder11Id']].append(dt['Id'])

    f33_to_dt_direct = defaultdict(list)
    for dt in data['distribution_substations']:
        if dt.get('Feeder33Id') and not dt.get('Feeder11Id'):
            f33_to_dt_direct[dt['Feeder33Id']].append(dt['Id'])

    # ── Nodes ──────────────────────────────────────────────────────────────────
    for r in data['transmission_stations']:
        nodes.append({'id': f"ts_{r['Id']}", 'type': 'ts', 'db_id': r['Id'],
                      'label': r['Name'], 'lat': _sf(r.get('Latitude')), 'lon': _sf(r.get('Longitude')),
                      'detail_level': 1})

    for r in data['substations']:
        nodes.append({'id': f"ss_{r['Id']}", 'type': 'ss', 'db_id': r['Id'],
                      'label': r['Name'], 'lat': _sf(r.get('Latitude')), 'lon': _sf(r.get('Longitude')),
                      'detail_level': 2})

    for r in data['distribution_substations']:
        nodes.append({'id': f"dt_{r['Id']}", 'type': 'dt', 'db_id': r['Id'],
                      'label': r['Name'], 'lat': _sf(r.get('Latitude')), 'lon': _sf(r.get('Longitude')),
                      'nameplate_kva': r.get('NameplateRating'), 'meter_id': r.get('MeterId'),
                      'detail_level': 3})

    # ── F33 feeder chains: TS → SS (+ direct DT) ──────────────────────────────
    for f33 in data['feeders33']:
        fid, ts_id = f33['Id'], f33.get('TsId')
        if not ts_id or ts_id not in ts_map or not _has_coords(ts_map[ts_id]):
            continue
        ts = ts_map[ts_id]
        plon, plat = float(ts['Longitude']), float(ts['Latitude'])

        children = [
            {'Longitude': float(ss_map[sid]['Longitude']), 'Latitude': float(ss_map[sid]['Latitude']),
             'node_id': f"ss_{sid}", 'node_type': 'ss'}
            for sid in f33_to_ss.get(fid, []) if sid in ss_map and _has_coords(ss_map[sid])
        ] + [
            {'Longitude': float(dt_map[did]['Longitude']), 'Latitude': float(dt_map[did]['Latitude']),
             'node_id': f"dt_{did}", 'node_type': 'dt'}
            for did in f33_to_dt_direct.get(fid, []) if did in dt_map and _has_coords(dt_map[did])
        ]
        if not children: continue

        ordered = order_as_convex_chain(plon, plat, children)
        chain = [f"ts_{ts_id}"] + [c['node_id'] for c in ordered]
        feeder_chains.append({'feeder_id': f"f33_{fid}", 'feeder_type': 'f33',
                               'feeder_name': f33.get('Name',''), 'nameplate_kva': f33.get('NameplateRating'),
                               'meter_id': f33.get('MeterId'), 'chain': chain})
        for i in range(len(chain)-1):
            st = chain[i].split('_')[0]; tt = chain[i+1].split('_')[0]
            edges.append({'id': f"e_f33_{fid}_{i}", 'source': chain[i], 'target': chain[i+1],
                          'feeder_id': f"f33_{fid}", 'feeder_type': 'f33',
                          'feeder_name': f33.get('Name',''),
                          'detail_level': 3 if 'dt' in (st,tt) else 2})

    # ── F11 feeder chains: SS (or TS trade) → DT ──────────────────────────────
    for f11 in data['feeders11']:
        fid, ss_id, ts_id = f11['Id'], f11.get('SsId'), f11.get('TsId')
        dt_ids = f11_to_dt.get(fid, [])
        children = [
            {'Longitude': float(dt_map[did]['Longitude']), 'Latitude': float(dt_map[did]['Latitude']),
             'node_id': f"dt_{did}", 'node_type': 'dt'}
            for did in dt_ids if did in dt_map and _has_coords(dt_map[did])
        ]
        if not children: continue

        if ss_id and ss_id in ss_map and _has_coords(ss_map[ss_id]):
            p = ss_map[ss_id]; pnid = f"ss_{ss_id}"
        elif ts_id and ts_id in ts_map and _has_coords(ts_map[ts_id]):
            p = ts_map[ts_id]; pnid = f"ts_{ts_id}"
        else:
            continue

        plon, plat = float(p['Longitude']), float(p['Latitude'])
        ordered = order_as_convex_chain(plon, plat, children)
        chain = [pnid] + [c['node_id'] for c in ordered]
        is_trade = pnid.startswith('ts_')
        ftype = 'f11_trade' if is_trade else 'f11'
        feeder_chains.append({'feeder_id': f"f11_{fid}", 'feeder_type': ftype,
                               'feeder_name': f11.get('Name',''), 'nameplate_kva': f11.get('NameplateRating'),
                               'meter_id': f11.get('MeterId'), 'chain': chain})
        for i in range(len(chain)-1):
            edges.append({'id': f"e_f11_{fid}_{i}", 'source': chain[i], 'target': chain[i+1],
                          'feeder_id': f"f11_{fid}", 'feeder_type': ftype,
                          'feeder_name': f11.get('Name',''), 'detail_level': 3})

    return nodes, edges, feeder_chains


# ── Output assembly ────────────────────────────────────────────────────────────

def build_output(nodes, edges, feeder_chains, data):
    lats = [n['lat'] for n in nodes if n['lat'] is not None]
    lons = [n['lon'] for n in nodes if n['lon'] is not None]
    bbox = ({'min_lat': min(lats), 'max_lat': max(lats),
             'min_lon': min(lons), 'max_lon': max(lons)} if lats else None)
    total_kva = sum(r['NameplateRating'] or 0 for r in data['distribution_substations'])

    def view(lvl):
        return {
            'nodes':  [n for n in nodes if n['detail_level'] <= lvl],
            'edges':  [e for e in edges if e['detail_level'] <= lvl],
            'feeder_chains': [f for f in feeder_chains if
                              (lvl >= 2 and f['feeder_type'] == 'f33') or
                              (lvl >= 3 and f['feeder_type'] in ('f11','f11_trade'))],
        }

    return {
        'meta': {
            'schema_version': '1.0',
            'detail_levels': {
                '1': 'Transmission stations only',
                '2': 'TS + injection substations + 33 kV feeders',
                '3': 'Full detail — all distribution transformers + 11 kV feeders',
            },
            'chain_note': (
                'Edges within a feeder form a sequential chain — render as '
                'chain[0]→chain[1]→… NOT as a star from the parent station.'
            ),
        },
        'summary': {
            'transmission_stations':     len(data['transmission_stations']),
            'substations':               len(data['substations']),
            'distribution_transformers': len(data['distribution_substations']),
            'feeders_33kv':              len(data['feeders33']),
            'feeders_11kv':              len(data['feeders11']),
            'total_nodes':               len(nodes),
            'total_edges':               len(edges),
            'total_nameplate_kva':       total_kva,
            'bounding_box':              bbox,
        },
        'nodes':         nodes,
        'edges':         edges,
        'feeder_chains': feeder_chains,
        'views':         {'level_1': view(1), 'level_2': view(2), 'level_3': view(3)},
    }


# ── Mock data ──────────────────────────────────────────────────────────────────

def mock_data():
    return {
        'transmission_stations': [
            {'Id':1,'Name':'TS-Abuja Main','Latitude':9.05,'Longitude':7.49},
            {'Id':2,'Name':'TS-Kuje','Latitude':8.88,'Longitude':7.02},
        ],
        'substations': [
            {'Id':1,'Name':'SS-Garki','Latitude':9.02,'Longitude':7.48},
            {'Id':2,'Name':'SS-Maitama','Latitude':9.08,'Longitude':7.50},
            {'Id':3,'Name':'SS-Wuse','Latitude':9.06,'Longitude':7.47},
            {'Id':4,'Name':'SS-Gwarinpa','Latitude':9.12,'Longitude':7.39},
            {'Id':5,'Name':'SS-Kuje-North','Latitude':8.93,'Longitude':7.01},
        ],
        'distribution_substations': [
            {'Id':1, 'Name':'DT-Garki-1',   'Latitude':9.020,'Longitude':7.475,'Feeder11Id':1,'Feeder33Id':None,'NameplateRating':500, 'MeterId':101},
            {'Id':2, 'Name':'DT-Garki-2',   'Latitude':9.015,'Longitude':7.485,'Feeder11Id':1,'Feeder33Id':None,'NameplateRating':315, 'MeterId':102},
            {'Id':3, 'Name':'DT-Garki-3',   'Latitude':9.010,'Longitude':7.470,'Feeder11Id':1,'Feeder33Id':None,'NameplateRating':200, 'MeterId':103},
            {'Id':4, 'Name':'DT-Maitama-1', 'Latitude':9.085,'Longitude':7.505,'Feeder11Id':2,'Feeder33Id':None,'NameplateRating':500, 'MeterId':104},
            {'Id':5, 'Name':'DT-Maitama-2', 'Latitude':9.090,'Longitude':7.515,'Feeder11Id':2,'Feeder33Id':None,'NameplateRating':315, 'MeterId':105},
            {'Id':6, 'Name':'DT-Maitama-3', 'Latitude':9.095,'Longitude':7.498,'Feeder11Id':2,'Feeder33Id':None,'NameplateRating':200, 'MeterId':106},
            {'Id':7, 'Name':'DT-Wuse-1',    'Latitude':9.065,'Longitude':7.465,'Feeder11Id':3,'Feeder33Id':None,'NameplateRating':500, 'MeterId':107},
            {'Id':8, 'Name':'DT-Wuse-2',    'Latitude':9.058,'Longitude':7.472,'Feeder11Id':3,'Feeder33Id':None,'NameplateRating':315, 'MeterId':108},
            {'Id':9, 'Name':'DT-Gwarinpa-1','Latitude':9.125,'Longitude':7.385,'Feeder11Id':4,'Feeder33Id':None,'NameplateRating':500, 'MeterId':109},
            {'Id':10,'Name':'DT-Gwarinpa-2','Latitude':9.130,'Longitude':7.395,'Feeder11Id':4,'Feeder33Id':None,'NameplateRating':315, 'MeterId':110},
            {'Id':11,'Name':'DT-Gwarinpa-3','Latitude':9.118,'Longitude':7.400,'Feeder11Id':4,'Feeder33Id':None,'NameplateRating':200, 'MeterId':111},
            {'Id':12,'Name':'DT-Direct-1',  'Latitude':9.040,'Longitude':7.520,'Feeder11Id':None,'Feeder33Id':1,'NameplateRating':100,'MeterId':112},
            {'Id':13,'Name':'DT-Direct-2',  'Latitude':9.030,'Longitude':7.530,'Feeder11Id':None,'Feeder33Id':1,'NameplateRating':100,'MeterId':113},
            {'Id':14,'Name':'DT-Trade-1',   'Latitude':9.050,'Longitude':7.430,'Feeder11Id':5,'Feeder33Id':None,'NameplateRating':200,'MeterId':114},
            {'Id':15,'Name':'DT-Trade-2',   'Latitude':9.045,'Longitude':7.420,'Feeder11Id':5,'Feeder33Id':None,'NameplateRating':200,'MeterId':115},
            {'Id':16,'Name':'DT-Kuje-1',    'Latitude':8.930,'Longitude':7.015,'Feeder11Id':6,'Feeder33Id':None,'NameplateRating':315,'MeterId':116},
            {'Id':17,'Name':'DT-Kuje-2',    'Latitude':8.920,'Longitude':7.010,'Feeder11Id':6,'Feeder33Id':None,'NameplateRating':315,'MeterId':117},
        ],
        'feeders33': [
            {'Id':1,'Name':'F33-Abuja-Main','TsId':1,'IsDeleted':False,'MeterId':201,'NameplateRating':20000},
            {'Id':2,'Name':'F33-Kuje-Line', 'TsId':2,'IsDeleted':False,'MeterId':202,'NameplateRating':10000},
        ],
        'feeders11': [
            {'Id':1,'Name':'F11-Garki',    'SsId':1,'TsId':None,'MeterId':211,'NameplateRating':5000},
            {'Id':2,'Name':'F11-Maitama',  'SsId':2,'TsId':None,'MeterId':212,'NameplateRating':5000},
            {'Id':3,'Name':'F11-Wuse',     'SsId':3,'TsId':None,'MeterId':213,'NameplateRating':5000},
            {'Id':4,'Name':'F11-Gwarinpa', 'SsId':4,'TsId':None,'MeterId':214,'NameplateRating':5000},
            {'Id':5,'Name':'F11-Trade',    'SsId':None,'TsId':1, 'MeterId':215,'NameplateRating':2000},
            {'Id':6,'Name':'F11-Kuje',     'SsId':5,'TsId':None,'MeterId':216,'NameplateRating':3000},
        ],
        'feeder33_substation': [
            {'Feeders33Id':1,'SubstationsId':1},
            {'Feeders33Id':1,'SubstationsId':2},
            {'Feeders33Id':1,'SubstationsId':3},
            {'Feeders33Id':1,'SubstationsId':4},
            {'Feeders33Id':2,'SubstationsId':5},
        ],
        'meters': [{'Id':i,'MSN':f'MSN-{i:04d}','MultiplierFactor':1.0} for i in range(100,220)],
        'channels': [
            {'Id':1,'Name':'Active Energy Taken','Unit':'kWh'},
            {'Id':2,'Name':'Reactive Energy','Unit':'kVArh'},
        ],
    }


# ── CLI ────────────────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser(description='Export power grid DB → JSON for grid_viewer.html')
    p.add_argument('--server',   default='localhost')
    p.add_argument('--port',     type=int, default=1433)
    p.add_argument('--database', default='SotexHackathon')
    p.add_argument('--username', default='sa')
    p.add_argument('--password')
    p.add_argument('--mock',     action='store_true', help='Use built-in mock data (no DB required)')
    p.add_argument('--output',   default='grid_export.json')
    p.add_argument('--pretty',   action='store_true')
    args = p.parse_args()

    if args.mock:
        print("Using mock data …")
        data = mock_data()
    else:
        if not args.password:
            p.error("--password required (or use --mock)")
        print(f"Connecting to {args.server}:{args.port}/{args.database} …")
        conn = get_connection(args.server, args.port, args.database, args.username, args.password)
        print("Loading tables …")
        data = load_all(conn)
        conn.close()

    print("Building graph …")
    nodes, edges, feeder_chains = build_graph(data)
    print("Assembling output …")
    out = build_output(nodes, edges, feeder_chains, data)

    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=2 if args.pretty else None, default=str, ensure_ascii=False)

    s = out['summary']
    print(f"\nExported → {args.output}")
    print(f"  TS:{s['transmission_stations']}  SS:{s['substations']}  DT:{s['distribution_transformers']}")
    print(f"  F33:{s['feeders_33kv']}  F11:{s['feeders_11kv']}")
    print(f"  Nodes:{s['total_nodes']}  Edges:{s['total_edges']}  kVA:{s['total_nameplate_kva']:,}")


if __name__ == '__main__':
    main()
