from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.opportunities import router as opportunities_router
from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # Accessing settings here fails startup loudly on invalid config,
    # instead of the API silently coming up misconfigured.
    _ = settings.DATABASE_URL
    yield


app = FastAPI(
    title="QuoteDrive API",
    description="QuoteDrive backend API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(opportunities_router)


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "quotedrive-api"}
