from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from pydantic_settings import BaseSettings
from urllib.parse import quote_plus


class Settings(BaseSettings):
    DB_SERVER: str = "localhost"
    DB_NAME: str = "griddb"
    DB_USER: str = "sa"
    DB_PASSWORD: str = ""
    DB_DRIVER: str = "ODBC Driver 17 for SQL Server"

    class Config:
        env_file = ".env"


settings = Settings()


def _build_connection_string() -> str:
    driver = quote_plus(settings.DB_DRIVER)
    return (
        f"mssql+pyodbc://{settings.DB_USER}:{settings.DB_PASSWORD}"
        f"@{settings.DB_SERVER}/{settings.DB_NAME}"
        f"?driver={driver}&TrustServerCertificate=yes&timeout=30"
    )


engine = create_engine(
    _build_connection_string(),
    echo=False,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
