"""
generate_dss.py
---------------
Generates OpenDSS-compatible files from the power network database.

Output files:
  Master.dss
  LineCodes.dss
  Feeders33.dss
  Feeders11.dss  (if data exists)
  Substations.dss
  LV_Transformers.dss
  BusCoords.dat

Usage:
  pip install pyodbc
  python generate_dss.py --server MY_SERVER --database MyDB --output ./dss_output

  # or with SQL auth:
  python generate_dss.py --server MY_SERVER --database MyDB --user sa --password secret
"""

import argparse
import os
import re
import sys
from collections import Counter
from pathlib import Path

try:
    import pyodbc
except ImportError:
    sys.exit("pyodbc not installed. Run: pip install pyodbc")


# ---------------------------------------------------------------------------
# Connection
# ---------------------------------------------------------------------------

def connect(server: str, database: str, user: str | None, password: str | None) -> pyodbc.Connection:
    if user and password:
        conn_str = (
            f"DRIVER={{ODBC Driver 17 for SQL Server}};"
            f"SERVER={server};DATABASE={database};"
            f"UID={user};PWD={password}"
        )
    else:
        conn_str = (
            f"DRIVER={{ODBC Driver 17 for SQL Server}};"
            f"SERVER={server};DATABASE={database};"
            "Trusted_Connection=yes"
        )
    return pyodbc.connect(conn_str)


def query(conn: pyodbc.Connection, sql: str) -> list[dict]:
    cur = conn.cursor()
    cur.execute(sql)
    cols = [c[0] for c in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]


# ---------------------------------------------------------------------------
# Name sanitisation  (OpenDSS: no spaces, no , ( ) / \ . & ' " %)
# ---------------------------------------------------------------------------

def sanitise(name: str) -> str:
    """Make a string safe to use as an OpenDSS element/bus name."""
    if not name:
        return "UNNAMED"
    s = str(name).strip()
    s = s.replace(",", "").replace("(", "").replace(")", "")
    s = s.replace("/", "_").replace("\\", "_").replace(".", "_")
    s = s.replace("&", "and").replace("'", "").replace('"', "").replace("%", "pct")
    s = s.replace(" ", "_")
    s = re.sub(r"_+", "_", s).strip("_")
    return s or "UNNAMED"


def unique_names(items: list[dict], key: str) -> list[dict]:
    """Append _2, _3 … to duplicate sanitised names within a list."""
    seen: Counter = Counter()
    result = []
    for row in items:
        base = sanitise(row[key])
        seen[base] += 1
        row["_dss_name"] = base if seen[base] == 1 else f"{base}_{seen[base]}"
        result.append(row)
    return result


# ---------------------------------------------------------------------------
# LineCodes.dss  (standard codes – not stored in the DB schema shown)
# ---------------------------------------------------------------------------

LINECODES = """\
! Standard line codes (R/X in ohm/km, C in nF/km)
New LineCode.33kV_Standard  nphases=3 r1=0.1  x1=0.30 r0=0.30 x0=0.90 c1=3.4 c0=1.6 units=km
New LineCode.11kV_Standard  nphases=3 r1=0.2  x1=0.35 r0=0.50 x0=1.00 c1=3.0 c0=1.2 units=km
New LineCode.LV_Standard    nphases=3 r1=0.5  x1=0.10 r0=1.50 x0=0.30 c1=1.0 c0=0.5 units=km
"""


# ---------------------------------------------------------------------------
# Queries
# ---------------------------------------------------------------------------

SQL_TS = """
SELECT ts.Id, ts.Name, ts.Latitude, ts.Longitude
FROM   dbo.TransmissionStations ts
ORDER  BY ts.Id
"""

SQL_SS = """
SELECT ss.Id, ss.Name, ss.Latitude, ss.Longitude
FROM   dbo.Substations ss
ORDER  BY ss.Id
"""

SQL_F33 = """
SELECT f.Id, f.Name, f.TsId, f.MeterId, f.NameplateRating
FROM   dbo.Feeders33 f
WHERE  f.IsDeleted = 0
ORDER  BY f.Id
"""

SQL_F11 = """
SELECT f.Id, f.Name, f.SsId, f.TsId, f.MeterId, f.Feeder33Id, f.NameplateRating
FROM   dbo.Feeders11 f
ORDER  BY f.Id
"""

SQL_DS = """
SELECT ds.Id, ds.Name, ds.MeterId, ds.Feeder11Id, ds.Feeder33Id,
       ds.NameplateRating, ds.Latitude, ds.Longitude
FROM   dbo.DistributionSubstation ds
ORDER  BY ds.Id
"""


# ---------------------------------------------------------------------------
# Writers
# ---------------------------------------------------------------------------

def write_linecodes(out: Path) -> None:
    (out / "LineCodes.dss").write_text(LINECODES, encoding="utf-8")
    print("  LineCodes.dss")


def write_master(out: Path, ts_rows: list[dict]) -> None:
    lines = ["clear", ""]

    # One Vsource per transmission station (110 kV slack buses)
    for ts in ts_rows:
        bus = f"Bus_TS_{sanitise(ts['Name'])}"
        lines.append(
            f"New Vsource.Src_{sanitise(ts['Name'])} "
            f"Bus1={bus} BasekV=110 pu=1.0 phases=3"
        )

    lines += [
        "",
        "Redirect LineCodes.dss",
        "Redirect Feeders33.dss",
        "Redirect Substations.dss",
        "Redirect Feeders11.dss",
        "Redirect LV_Transformers.dss",
        "",
        "Set VoltageBases=[110, 33, 11, 0.4]",
        "CalcVoltageBases",
        "",
        "BusCoords BusCoords.dat",
        "",
        "Set MaxIter=100",
        "Set Tolerance=0.0001",
        "Solve",
    ]

    (out / "Master.dss").write_text("\n".join(lines), encoding="utf-8")
    print("  Master.dss")


def write_feeders33(out: Path, f33_rows: list[dict]) -> None:
    """
    Each 33 kV feeder is a Line from the TS bus to a feeder-end bus.
    Bus1 = Bus_TS_<tsname>  (the slack source)
    Bus2 = Bus_F33_<feeder_dss_name>_End
    """
    lines = ["! 33 kV feeders (one Line per feeder)"]
    f33_rows = unique_names(f33_rows, "Name")

    for f in f33_rows:
        name   = f["_dss_name"]
        ts_id  = f["TsId"] or 0
        rating = f["NameplateRating"] or 1000   # kVA → used only as reference
        bus1   = f"Bus_TS_ID{ts_id}"            # resolved to real name in Master
        bus2   = f"Bus_F33_{name}_End"

        lines.append(
            f"New Line.L33_{name} "
            f"Bus1={bus1} Bus2={bus2} "
            f"Length=1 Units=km LineCode=33kV_Standard"
        )

    (out / "Feeders33.dss").write_text("\n".join(lines), encoding="utf-8")
    print(f"  Feeders33.dss  ({len(f33_rows)} feeders)")


def write_substations(out: Path, ss_rows: list[dict], f33_rows: list[dict]) -> None:
    """
    MV transformers: each 33/11 kV substation is a Transformer
    connecting a Feeders33 end-bus to a substation LV bus.
    """
    f33_by_id = {r["Id"]: sanitise(r["Name"]) for r in f33_rows}

    lines = ["! MV substations – 33/11 kV transformers"]
    ss_rows = unique_names(ss_rows, "Name")

    for ss in ss_rows:
        name    = ss["_dss_name"]
        # Try to match to a feeder33 if the junction table data is available
        # Fallback: use Bus_SS_<id>_HV as floating HV bus
        hv_bus  = f"Bus_SS_{ss['Id']}_HV"
        lv_bus  = f"Bus_SS_{name}_LV"

        lines += [
            f"New Transformer.TrMV_{name} Phases=3 Windings=2",
            f"~ Buses=[{hv_bus}, {lv_bus}] kVA=10000 kV=[33, 11]",
        ]

    (out / "Substations.dss").write_text("\n".join(lines), encoding="utf-8")
    print(f"  Substations.dss  ({len(ss_rows)} substations)")


def write_feeders11(out: Path, f11_rows: list[dict], f33_by_id: dict[int, str]) -> None:
    """
    11 kV feeders: Line from substation LV bus to feeder-end bus.
    """
    lines = ["! 11 kV feeders"]
    f11_rows = unique_names(f11_rows, "Name")

    for f in f11_rows:
        name    = f["_dss_name"]
        ss_id   = f["SsId"] or 0
        bus1    = f"Bus_SS_ID{ss_id}_LV"
        bus2    = f"Bus_F11_{name}_End"

        lines.append(
            f"New Line.L11_{name} "
            f"Bus1={bus1} Bus2={bus2} "
            f"Length=1 Units=km LineCode=11kV_Standard"
        )

    (out / "Feeders11.dss").write_text("\n".join(lines), encoding="utf-8")
    print(f"  Feeders11.dss  ({len(f11_rows)} feeders)")


def write_lv_transformers(out: Path, ds_rows: list[dict], f11_by_id: dict[int, str]) -> None:
    """
    LV distribution substations: 11/0.4 kV transformers.
    HV bus  = feeder-11 end bus  (or FLOATING if no feeder11 assigned)
    LV bus  = Bus_DS_<name>_Consumer
    """
    lines = ["! LV distribution substations – 11/0.4 kV transformers"]
    ds_rows = unique_names(ds_rows, "Name")

    for ds in ds_rows:
        name    = ds["_dss_name"]
        f11_id  = ds["Feeder11Id"]
        kva     = ds["NameplateRating"] or 100

        if f11_id and f11_id in f11_by_id:
            hv_bus = f"Bus_F11_{f11_by_id[f11_id]}_End"
        else:
            hv_bus = "Bus_FLOATING"

        lv_bus = f"Bus_DS_{name}_Consumer"

        lines += [
            f"New Transformer.TrLV_{name} Phases=3 Windings=2",
            f"~ Buses=[{hv_bus}, {lv_bus}] kVA={kva} kV=[11, 0.4]",
        ]

    (out / "LV_Transformers.dss").write_text("\n".join(lines), encoding="utf-8")
    print(f"  LV_Transformers.dss  ({len(ds_rows)} transformers)")


def write_buscoords(
    out: Path,
    ts_rows: list[dict],
    ss_rows: list[dict],
    ds_rows: list[dict],
) -> None:
    """
    BusCoords.dat: one line per bus that has lat/lon.
    Format: BusName, Longitude, Latitude
    (OpenDSS uses X=lon, Y=lat by convention)
    """
    lines: list[str] = []

    def emit(bus: str, lat, lon) -> None:
        if lat is not None and lon is not None:
            try:
                lines.append(f"{bus}, {float(lon):.7f}, {float(lat):.7f}")
            except (TypeError, ValueError):
                pass

    for ts in ts_rows:
        bus = f"Bus_TS_{sanitise(ts['Name'])}"
        emit(bus, ts["Latitude"], ts["Longitude"])

    ss_rows_named = unique_names(ss_rows, "Name")
    for ss in ss_rows_named:
        bus = f"Bus_SS_{ss['_dss_name']}_LV"
        emit(bus, ss["Latitude"], ss["Longitude"])

    ds_rows_named = unique_names(ds_rows, "Name")
    for ds in ds_rows_named:
        bus = f"Bus_DS_{ds['_dss_name']}_Consumer"
        emit(bus, ds["Latitude"], ds["Longitude"])

    (out / "BusCoords.dat").write_text("\n".join(lines), encoding="utf-8")
    print(f"  BusCoords.dat  ({len(lines)} entries)")


# ---------------------------------------------------------------------------
# Resolve TS bus names after we have all data
# (Feeders33 references TsId; we need the actual TS name for the bus label)
# ---------------------------------------------------------------------------

def patch_feeder33_buses(out: Path, f33_rows: list[dict], ts_by_id: dict[int, str]) -> None:
    """Replace Bus_TS_ID<n> placeholders with real TS bus names."""
    path = out / "Feeders33.dss"
    content = path.read_text(encoding="utf-8")
    for ts_id, ts_name in ts_by_id.items():
        content = content.replace(
            f"Bus_TS_ID{ts_id}",
            f"Bus_TS_{ts_name}",
        )
    path.write_text(content, encoding="utf-8")


def patch_feeder11_buses(out: Path, f11_rows: list[dict], ss_by_id: dict[int, str]) -> None:
    """Replace Bus_SS_ID<n>_LV placeholders with real SS bus names."""
    path = out / "Feeders11.dss"
    content = path.read_text(encoding="utf-8")
    for ss_id, ss_name in ss_by_id.items():
        content = content.replace(
            f"Bus_SS_ID{ss_id}_LV",
            f"Bus_SS_{ss_name}_LV",
        )
    path.write_text(content, encoding="utf-8")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Generate OpenDSS files from SQL Server")
    parser.add_argument("--server",   required=True,  help="SQL Server host/instance")
    parser.add_argument("--database", required=True,  help="Database name")
    parser.add_argument("--user",     default=None,   help="SQL auth username (omit for Windows auth)")
    parser.add_argument("--password", default=None,   help="SQL auth password")
    parser.add_argument("--output",   default="./dss_output", help="Output directory")
    args = parser.parse_args()

    out = Path(args.output)
    out.mkdir(parents=True, exist_ok=True)

    print(f"Connecting to {args.server}/{args.database} …")
    conn = connect(args.server, args.database, args.user, args.password)
    print("Connected.\n")

    print("Fetching data …")
    ts_rows = query(conn, SQL_TS)
    ss_rows = query(conn, SQL_SS)
    f33_rows = query(conn, SQL_F33)
    f11_rows = query(conn, SQL_F11)
    ds_rows  = query(conn, SQL_DS)
    conn.close()

    print(
        f"  TransmissionStations : {len(ts_rows)}\n"
        f"  Substations          : {len(ss_rows)}\n"
        f"  Feeders33            : {len(f33_rows)}\n"
        f"  Feeders11            : {len(f11_rows)}\n"
        f"  DistributionSubs     : {len(ds_rows)}\n"
    )

    # Build lookup dicts  id -> sanitised name
    ts_by_id  = {r["Id"]: sanitise(r["Name"]) for r in ts_rows}
    ss_by_id  = {r["Id"]: sanitise(r["Name"]) for r in ss_rows}
    f33_by_id = {r["Id"]: sanitise(r["Name"]) for r in f33_rows}
    f11_by_id = {r["Id"]: sanitise(r["Name"]) for r in f11_rows}

    print(f"Writing DSS files to: {out.resolve()}\n")

    write_linecodes(out)
    write_master(out, ts_rows)
    write_feeders33(out, f33_rows)
    patch_feeder33_buses(out, f33_rows, ts_by_id)

    write_substations(out, ss_rows, f33_rows)
    write_feeders11(out, f11_rows, f33_by_id)
    patch_feeder11_buses(out, f11_rows, ss_by_id)

    write_lv_transformers(out, ds_rows, f11_by_id)
    write_buscoords(out, ts_rows, ss_rows, ds_rows)

    print("\nDone. Run with OpenDSS:")
    print(f"  import opendssdirect as dss")
    print(f"  dss.Text.Command('Redirect {out.resolve() / 'Master.dss'}')")


if __name__ == "__main__":
    main()