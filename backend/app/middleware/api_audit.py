import time
import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from app.db.session import SessionLocal
from app.services.audit import write_api_audit


class ApiAuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        correlation_id = request.headers.get("X-Correlation-Id") or str(uuid.uuid4())
        request.state.correlation_id = correlation_id
        response = await call_next(request)
        latency = int((time.perf_counter() - start) * 1000)
        response.headers["X-Correlation-Id"] = correlation_id
        path = request.url.path
        if path.startswith("/api/") and path != "/api/v1/health":
            try:
                db = SessionLocal()
                write_api_audit(
                    db,
                    tenant_id=None,
                    actor_user_id=None,
                    method=request.method,
                    path=path,
                    status_code=response.status_code,
                    latency_ms=latency,
                    ip_address=request.client.host if request.client else None,
                    correlation_id=correlation_id,
                )
                db.commit()
                db.close()
            except Exception:
                pass
        return response
