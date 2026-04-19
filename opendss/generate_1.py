import pyodbc

DB_CONFIG = {
    "server":   "localhost",       # e.g. "localhost" or "192.168.1.10\SQLEXPRESS"
    "port":     1433,              # default SQL Server port
    "database": "SotexHackathon",
    "username": "sa",
    "password": "SotexSolutions123!",
    "driver":   "ODBC Driver 17 for SQL Server",  # adjust if needed
}

def get_connection():
    conn_str = (
        f"DRIVER={{{DB_CONFIG['driver']}}};"
        f"SERVER={DB_CONFIG['server']};"
        f"DATABASE={DB_CONFIG['database']};"
        f"UID={DB_CONFIG['username']};"
        f"PWD={DB_CONFIG['password']};"
        "Encrypt=yes;"
        "TrustServerCertificate=yes;"
    )
    return pyodbc.connect(conn_str)


def generate_dss_files():
    conn = get_connection()
    cursor = conn.cursor()

    # 1. GENERATE MASTER.DSS & VSOURCE (Transmission Stations)
    with open("Master.dss", "w") as f:
        f.write("clear\n")
        cursor.execute("SELECT Name FROM dbo.TransmissionStations")
        for (name,) in cursor.fetchall():
            f.write(
                f"New Vsource.Source_{name} Bus1=Bus_{name} BasekV=110 Units=kV\n"
            )
        f.write("Redirect Feeders33.dss\n")
        f.write("Redirect Substations.dss\n")
        f.write("Redirect Feeders11.dss\n")
        f.write("Redirect LV_Transformers.dss\n")
        f.write("Set VoltageBases=[110, 35, 10, 0.4]\n")
        f.write("CalcVoltageBases\n")

    # 2. GENERATE FEEDERS33.DSS (High-Voltage Lines)
    with open("Feeders33.dss", "w") as f:
        cursor.execute(
            "SELECT Name, TsId, NameplateRating FROM dbo.Feeders33 WHERE IsDeleted = 0"
        )
        for name, ts_id, rating in cursor.fetchall():
            f.write(
                f"New Line.Line33_{name} Bus1=Bus_{ts_id} Bus2=Bus_{name}_End "
                f"Length=1 Units=km LineCode=33kV_Standard\n"
            )

    # 3. GENERATE SUBSTATIONS.DSS (MV Transformers)
    with open("Substations.dss", "w") as f:
        query = """
            SELECT s.Name, f33.Name AS Feeder33Name
            FROM dbo.Substations        AS s
            JOIN dbo.Feeder33Substation AS fs  ON s.Id       = fs.SubstationsId
            JOIN dbo.Feeders33          AS f33 ON f33.Id     = fs.Feeders33Id
            WHERE f33.IsDeleted = 0
        """
        cursor.execute(query)
        for name, feeder_id in cursor.fetchall():
            f.write(f"New Transformer.TransMV_{name} Phases=3 Windings=2\n")
            f.write(
                f"~ Buses=[Bus_{feeder_id}_End, Bus_{name}_LV] kVA=1000 kV=[35, 10]\n"
            )

    # 4. GENERATE LV_TRANSFORMERS.DSS (Low-Voltage Podstanice)
    with open("LV_Transformers.dss", "w") as f:
        cursor.execute(
            "SELECT Name, Feeder11Id, NameplateRating FROM dbo.DistributionSubstation"
        )
        for name, feeder_id, rating in cursor.fetchall():
            f.write(f"New Transformer.TransLV_{name} Phases=3 Windings=2\n")
            f.write(
                f"~ Buses=[Bus_{feeder_id}, Bus_{name}_Consumer] kVA={rating} kV=[10, 0.4]\n"
            )

    # 5. GENERATE BUSCOORDS.DAT (Geospatial Data)
    with open("BusCoords.dat", "w") as f:
        query = """
            SELECT Name, Longitude, Latitude FROM dbo.DistributionSubstation
            UNION
            SELECT Name, Longitude, Latitude FROM dbo.Substations
            UNION
            SELECT Name, Longitude, Latitude FROM dbo.TransmissionStations
        """
        cursor.execute(query)
        for name, lon, lat in cursor.fetchall():
            f.write(f"{name}, {lon}, {lat}\n")

    cursor.close()
    conn.close()
    print("OpenDSS files generated successfully.")


if __name__ == "__main__":
    generate_dss_files()