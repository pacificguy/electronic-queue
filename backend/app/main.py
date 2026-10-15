from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .routers import auth, services, stats, tickets, users

app = FastAPI(
    title="Electronic Queue API",
    description="REST API системы электронной очереди (Client / Admin).",
    version="1.0.0",
)

origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(services.router)
app.include_router(tickets.router)
app.include_router(users.router)
app.include_router(stats.router)


@app.get("/api/health", tags=["health"])
def health():
    return {"status": "ok"}
