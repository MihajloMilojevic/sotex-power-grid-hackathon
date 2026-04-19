from nessie_api.models import Action, GraphType, Node, plugin, SetupRequirementType, Graph, Edge, Attribute
from nessie_api.protocols import Context
import pyodbc
from typing import Optional, Dict, Any

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

def build_power_grid_graph() -> Graph:
    """
    Connect to MSSQL, read the power grid schema, and return a populated Graph.
    """
    graph = Graph(name="Sotex Power Grid", graph_type=GraphType.UNDIRECTED)
    conn = get_connection()
    cursor = conn.cursor()

    try:
        # ---- 1. Add Transmission Stations as nodes ----
        cursor.execute("SELECT Id, Name, Latitude, Longitude FROM dbo.TransmissionStations")
        for row in cursor.fetchall():
            node = Node(
                f"TS_{row.Id}",
            )
            graph.add_node(node)

        # ---- 2. Add Substations as nodes ----
        cursor.execute("SELECT Id, Name, Latitude, Longitude FROM dbo.Substations")
        for row in cursor.fetchall():
            node = Node(
                f"SS_{row.Id}"
            )
            graph.add_node(node)

        # ---- 4. Add Feeders33 edges ----

        cursor.execute("""
            SELECT Id, Name, TsId, MeterId, NameplateRating
            FROM dbo.Feeders33
            WHERE IsDeleted = 0
        """)
        feeders33 = cursor.fetchall()

        for f33 in feeders33:
            ts_node_id = f"TS_{f33.TsId}"
            ts_node = graph.get_node(ts_node_id)
            if ts_node is None:
                continue  # Skip if referenced TS doesn't exist

            # a) TS -> SS edges (via Feeder33Substation)
            cursor.execute("""
                SELECT SubstationsId FROM dbo.Feeder33Substation WHERE Feeders33Id = ?
            """, f33.Id)
            ss_ids = [row.SubstationsId for row in cursor.fetchall()]

            for ss_id in ss_ids:
                ss_node_id = f"SS_{ss_id}"
                ss_node = graph.get_node(ss_node_id)
                if ss_node is None:
                    continue
                edge = Edge(
                    edge_id=f"F33_{f33.Id}_to_SS_{ss_id}",
                    source=ts_node,
                    target=ss_node,
                    attributes={
                        "label": Attribute("label", f33.Name or f"Feeder33 {f33.Id}"),
                        "meter_id": Attribute("meter_id", f33.MeterId or "None"),
                        "nameplate_rating": Attribute("nameplate_rating", f33.NameplateRating or "None")
                    }
                )
                graph.add_edge(edge)

            

        

    finally:
        cursor.close()
        conn.close()

    return graph


def load_graph(action: Action, context: Context) -> Graph:
    """
    Plugin handler that builds a power grid graph from a MSSQL database.
    Expects a 'Connection String' in the action payload.
    """
    
    graph = build_power_grid_graph()
    graph.name = "Sotex Power Grid"
    return graph


@plugin("sotex")
def sotex_plugin():
    handlers = {
        "load_graph": load_graph,
    }
    requires = []
    setup_requires = {
    }

    return {
        "handlers": handlers,
        "requires": requires,
        "setup_requires": setup_requires,
    }