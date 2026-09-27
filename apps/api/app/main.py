from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.ai import router as ai_router
from app.api.approval_requests import router as approval_requests_router
from app.api.auth import router as auth_router
from app.api.catalogue import router as catalogue_router
from app.api.customers import router as customers_router
from app.api.dashboard import router as dashboard_router
from app.api.estimates import router as estimates_router
from app.api.opportunities import router as opportunities_router
from app.api.organization import router as organization_router
from app.api.proposal_versions import router as proposal_versions_router
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
app.include_router(catalogue_router)
app.include_router(customers_router)
app.include_router(opportunities_router)
app.include_router(dashboard_router)
app.include_router(estimates_router)
app.include_router(proposal_versions_router)
app.include_router(approval_requests_router)
app.include_router(ai_router)
app.include_router(organization_router)


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "quotedrive-api"}
