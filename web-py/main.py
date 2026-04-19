from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

import topology

app = FastAPI(
    title="Grid Digital Twin API",
    description="SCADA backend for Nigerian power grid digital twin",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(topology.router, prefix="/api/v1", tags=["Topology"])


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "service": "grid-digital-twin"}


# ── Dev entry point ───────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
