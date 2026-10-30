"""Assembles the /api/v1 routers. Each module router is included here as it is built."""

from fastapi import APIRouter

from app.modules.auth.router import router as auth_router
from app.modules.calls.router import me_router as call_me_router
from app.modules.calls.router import router as calls_router
from app.modules.calls.router import webhooks as exotel_webhooks
from app.modules.notifications.router import router as devices_router
from app.modules.seniors.router import router as seniors_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(devices_router)
api_router.include_router(__import__('app.modules.family.router', fromlist=['router']).router)  # family summaries
api_router.include_router(calls_router)
api_router.include_router(call_me_router)
api_router.include_router(exotel_webhooks)
api_router.include_router(seniors_router)
api_router.include_router(__import__('app.modules.messages.router', fromlist=['router']).router)  # messages
api_router.include_router(__import__('app.modules.me.router', fromlist=['router']).router)  # senior app
api_router.include_router(__import__('app.modules.voice.router', fromlist=['router']).router)  # voice agent websocket
api_router.include_router(__import__('app.modules.alerts.router', fromlist=['router']).router)  # alerts
api_router.include_router(__import__('app.modules.coordinators.router', fromlist=['router']).router)  # coordinators/me/today
api_router.include_router(__import__('app.modules.ops.router', fromlist=['router']).router)  # ops dashboard + admin jobs
