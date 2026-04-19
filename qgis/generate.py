"""
export_to_qgis.py
Exports power grid data from SotexHackathon MSSQL database to GeoJSON files
for direct use in QGIS.

Outputs:
  - transmission_stations.geojson   (points)
  - substations.geojson             (points)
  - distribution_substations.geojson(points)
  - feeders33_lines.geojson         (lines: TransmissionStation → Substation)
  - feeders11_lines.geojson         (lines: Substation → DistributionSubstation)

Requirements:
  pip install pyodbc
  ODBC Driver 17 or 18 for SQL Server must be installed on your machine.
  Download: https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server
"""

import pyodbc
import json
import sys

# ── Connection ────────────────────────────────────────────────────────────────
CONN_STR = (
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=localhost,1433;"
    "DATABASE=SotexHackathon;"
    "UID=sa;"
    "PWD=SotexSolutions123!;"
    "TrustServerCertificate=yes;"
)

def get_connection():
    try:
        return pyodbc.connect(CONN_STR)
    except pyodbc.Error as e:
        # Try fallback to Driver 18 if 17 is not installed
        try:
            return pyodbc.connect(CONN_STR.replace("Driver 17", "Driver 18"))
        except pyodbc.Error:
            print(f"❌ Connection failed: {e}")
            print("Make sure ODBC Driver 17 or 18 for SQL Server is installed.")
            sys.exit(1)

def save_geojson(filename, features):
    fc = {"type": "FeatureCollection", "features": features}
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(fc, f, indent=2, default=str)
    print(f"  ✅ {filename}  ({len(features)} features)")

# ── 1. Transmission Stations (points) ─────────────────────────────────────────
def export_transmission_stations(cur):
    cur.execute("""
        SELECT
            ts.Id,
            ts.Name,
            CAST(ts.Latitude  AS float) AS Latitude,
            CAST(ts.Longitude AS float) AS Longitude
        FROM dbo.TransmissionStations ts
        WHERE ts.Latitude  IS NOT NULL
          AND ts.Longitude IS NOT NULL
    """)
    features = []
    for row in cur.fetchall():
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [row.Longitude, row.Latitude]
            },
            "properties": {
                "id":   row.Id,
                "name": row.Name,
                "type": "TransmissionStation",
                "level_kv": "400/110"
            }
        })
    save_geojson("transmission_stations.geojson", features)

# ── 2. Substations (points) ───────────────────────────────────────────────────
def export_substations(cur):
    cur.execute("""
        SELECT
            s.Id,
            s.Name,
            CAST(s.Latitude  AS float) AS Latitude,
            CAST(s.Longitude AS float) AS Longitude
        FROM dbo.Substations s
        WHERE s.Latitude  IS NOT NULL
          AND s.Longitude IS NOT NULL
    """)
    features = []
    for row in cur.fetchall():
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [row.Longitude, row.Latitude]
            },
            "properties": {
                "id":   row.Id,
                "name": row.Name,
                "type": "Substation",
                "level_kv": "110/35"
            }
        })
    save_geojson("substations.geojson", features)

# ── 3. Distribution Substations (points) ──────────────────────────────────────
def export_distribution_substations(cur):
    cur.execute("""
        SELECT
            ds.Id,
            ds.Name,
            ds.NameplateRating,
            ds.Feeder11Id,
            ds.Feeder33Id,
            CAST(ds.Latitude  AS float) AS Latitude,
            CAST(ds.Longitude AS float) AS Longitude,
            f11.Name AS Feeder11Name,
            f33.Name AS Feeder33Name
        FROM dbo.DistributionSubstation ds
        LEFT JOIN dbo.Feeders11 f11 ON ds.Feeder11Id = f11.Id
        LEFT JOIN dbo.Feeders33 f33 ON ds.Feeder33Id = f33.Id
        WHERE ds.Latitude  IS NOT NULL
          AND ds.Longitude IS NOT NULL
    """)
    features = []
    for row in cur.fetchall():
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [row.Longitude, row.Latitude]
            },
            "properties": {
                "id":               row.Id,
                "name":             row.Name,
                "type":             "DistributionSubstation",
                "level_kv":         "LV",
                "nameplate_kva":    row.NameplateRating,
                "feeder11_id":      row.Feeder11Id,
                "feeder11_name":    row.Feeder11Name,
                "feeder33_id":      row.Feeder33Id,
                "feeder33_name":    row.Feeder33Name,
            }
        })
    save_geojson("distribution_substations.geojson", features)

# ── 4. Feeders33 as lines (TransmissionStation → Substation) ──────────────────
def export_feeders33_lines(cur):
    """
    Uses Feeder33Substation junction table to draw a line from the
    TransmissionStation to each connected Substation via Feeders33.
    """
    cur.execute("""
        SELECT
            f33.Id          AS Feeder33Id,
            f33.Name        AS Feeder33Name,
            f33.NameplateRating,
            ts.Id           AS TsId,
            ts.Name         AS TsName,
            CAST(ts.Latitude  AS float) AS TsLat,
            CAST(ts.Longitude AS float) AS TsLon,
            s.Id            AS SubId,
            s.Name          AS SubName,
            CAST(s.Latitude  AS float) AS SubLat,
            CAST(s.Longitude AS float) AS SubLon
        FROM dbo.Feeders33 f33
        JOIN dbo.TransmissionStations ts   ON f33.TsId       = ts.Id
        JOIN dbo.Feeder33Substation    fs  ON f33.Id         = fs.Feeders33Id
        JOIN dbo.Substations           s   ON fs.SubstationsId = s.Id
        WHERE ts.Latitude  IS NOT NULL AND ts.Longitude IS NOT NULL
          AND s.Latitude   IS NOT NULL AND s.Longitude  IS NOT NULL
          AND f33.IsDeleted = 0
    """)
    features = []
    for row in cur.fetchall():
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    [row.TsLon,  row.TsLat],
                    [row.SubLon, row.SubLat]
                ]
            },
            "properties": {
                "id":              row.Feeder33Id,
                "name":            row.Feeder33Name,
                "type":            "Feeder33",
                "level_kv":        "33",
                "nameplate_rating": row.NameplateRating,
                "from_name":       row.TsName,
                "to_name":         row.SubName,
            }
        })
    save_geojson("feeders33_lines.geojson", features)

# ── 5. Feeders11 as lines (Substation → DistributionSubstation) ───────────────
def export_feeders11_lines(cur):
    """
    Draws a line from the parent Substation to each DistributionSubstation
    served by a Feeder11.
    """
    cur.execute("""
        SELECT
            f11.Id          AS Feeder11Id,
            f11.Name        AS Feeder11Name,
            f11.NameplateRating,
            s.Id            AS SubId,
            s.Name          AS SubName,
            CAST(s.Latitude  AS float) AS SubLat,
            CAST(s.Longitude AS float) AS SubLon,
            ds.Id           AS DsId,
            ds.Name         AS DsName,
            CAST(ds.Latitude  AS float) AS DsLat,
            CAST(ds.Longitude AS float) AS DsLon
        FROM dbo.Feeders11 f11
        JOIN dbo.Substations             s  ON f11.SsId       = s.Id
        JOIN dbo.DistributionSubstation  ds ON ds.Feeder11Id  = f11.Id
        WHERE s.Latitude   IS NOT NULL AND s.Longitude  IS NOT NULL
          AND ds.Latitude  IS NOT NULL AND ds.Longitude IS NOT NULL
    """)
    features = []
    for row in cur.fetchall():
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    [row.SubLon, row.SubLat],
                    [row.DsLon,  row.DsLat]
                ]
            },
            "properties": {
                "id":               row.Feeder11Id,
                "name":             row.Feeder11Name,
                "type":             "Feeder11",
                "level_kv":         "11",
                "nameplate_rating": row.NameplateRating,
                "from_name":        row.SubName,
                "to_name":          row.DsName,
            }
        })
    save_geojson("feeders11_lines.geojson", features)

# ── Main ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("🔌 Connecting to SotexHackathon...")
    conn = get_connection()
    cur = conn.cursor()
    print("✅ Connected!\n📦 Exporting layers...\n")

    export_transmission_stations(cur)
    export_substations(cur)
    export_distribution_substations(cur)
    export_feeders33_lines(cur)
    export_feeders11_lines(cur)

    cur.close()
    conn.close()
    print("\n🎉 All done! Load the .geojson files into QGIS:")
    print("   Layer → Add Layer → Add Vector Layer → browse to each file")
    print("   Set CRS to EPSG:4326 (WGS84) when prompted.")