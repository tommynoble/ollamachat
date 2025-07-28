"""
Production-ready FastAPI backend for Ollama Chat
"""

import os
import time
import logging
from contextlib import asynccontextmanager
from typing import Dict, List, Optional
import uvicorn
from fastapi import FastAPI, HTTPException, Depends, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import JSONResponse
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
from pydantic import BaseSettings, BaseModel
import structlog
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ollama_chat import OllamaChat

# Metrics
REQUEST_COUNT = Counter('requests_total', 'Total requests', ['method', 'endpoint'])
REQUEST_DURATION = Histogram('request_duration_seconds', 'Request duration')
CHAT_REQUESTS = Counter('chat_requests_total', 'Total chat requests')
CHAT_ERRORS = Counter('chat_errors_total', 'Chat errors', ['error_type'])

# Settings
class Settings(BaseSettings):
    environment: str = "development"
    log_level: str = "info"
    debug: bool = False
    
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_workers: int = 4
    
    ollama_url: str = "http://localhost:11434"
    ollama_timeout: int = 300
    default_model: str = "llama2"
    
    secret_key: str = "dev-secret-key"
    jwt_secret_key: str = "dev-jwt-key"
    
    cors_origins: List[str] = ["http://localhost:3000", "http://localhost:8080"]
    
    rate_limit_requests: int = 100
    rate_limit_window: int = 60
    
    prometheus_enabled: bool = True
    
    class Config:
        env_file = ".env"

settings = Settings()

# Setup structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

# Rate limiting
limiter = Limiter(key_func=get_remote_address)

# Security
security = HTTPBearer(auto_error=False)

# Global chat instance
chat_app: Optional[OllamaChat] = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    global chat_app
    
    # Startup
    logger.info("Starting Ollama Chat API", environment=settings.environment)
    try:
        chat_app = OllamaChat()
        logger.info("Ollama Chat initialized successfully")
    except Exception as e:
        logger.error("Failed to initialize Ollama Chat", error=str(e))
        raise
    
    yield
    
    # Shutdown
    logger.info("Shutting down Ollama Chat API")

# FastAPI app
app = FastAPI(
    title="Ollama Chat API",
    description="Production-ready API for Ollama Chat Application",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
)

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["localhost", "127.0.0.1", "0.0.0.0"] + settings.cors_origins
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Models
class ChatRequest(BaseModel):
    message: str
    model: Optional[str] = None
    temperature: Optional[float] = None
    system_prompt: Optional[str] = None

class ChatResponse(BaseModel):
    success: bool
    response: Optional[str] = None
    error: Optional[str] = None
    model: Optional[str] = None
    timestamp: float

class HealthResponse(BaseModel):
    status: str
    timestamp: float
    version: str
    ollama_status: Dict[str, bool]

class ModelsResponse(BaseModel):
    success: bool
    models: List[str]
    error: Optional[str] = None

# Middleware for metrics and logging
@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    start_time = time.time()
    
    # Log request
    logger.info(
        "Request started",
        method=request.method,
        url=str(request.url),
        client_ip=get_remote_address(request)
    )
    
    response = await call_next(request)
    
    # Record metrics
    duration = time.time() - start_time
    REQUEST_COUNT.labels(method=request.method, endpoint=request.url.path).inc()
    REQUEST_DURATION.observe(duration)
    
    # Log response
    logger.info(
        "Request completed",
        method=request.method,
        url=str(request.url),
        status_code=response.status_code,
        duration=duration
    )
    
    return response

# Authentication dependency (optional)
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Optional authentication - implement as needed"""
    # For now, just pass through
    # In production, implement JWT validation here
    return {"user_id": "anonymous"}

# Health check endpoint
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint for load balancers"""
    ollama_status = {
        "installed": False,
        "running": False
    }
    
    if chat_app:
        try:
            ollama_status["installed"] = chat_app.check_ollama_installation()
            ollama_status["running"] = chat_app.check_ollama_server()
        except Exception as e:
            logger.error("Health check failed", error=str(e))
    
    return HealthResponse(
        status="healthy" if ollama_status["running"] else "degraded",
        timestamp=time.time(),
        version="1.0.0",
        ollama_status=ollama_status
    )

# Metrics endpoint
@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    if not settings.prometheus_enabled:
        raise HTTPException(status_code=404, detail="Metrics disabled")
    
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

# Chat endpoint
@app.post("/api/chat", response_model=ChatResponse)
@limiter.limit(f"{settings.rate_limit_requests}/{settings.rate_limit_window}minute")
async def chat(
    request: Request,
    chat_request: ChatRequest,
    user: dict = Depends(get_current_user)
):
    """Send message to Ollama and get response"""
    CHAT_REQUESTS.inc()
    
    if not chat_app:
        CHAT_ERRORS.labels(error_type="service_unavailable").inc()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Chat service not available"
        )
    
    try:
        # Override model if specified
        if chat_request.model:
            chat_app.config["model"] = chat_request.model
        
        # Override temperature if specified
        if chat_request.temperature is not None:
            chat_app.config["temperature"] = chat_request.temperature
        
        # Send message
        response = chat_app.send_message(
            chat_request.message,
            chat_request.system_prompt
        )
        
        logger.info(
            "Chat request processed",
            user_id=user.get("user_id"),
            model=chat_app.config.get("model"),
            message_length=len(chat_request.message),
            response_length=len(response) if response else 0
        )
        
        return ChatResponse(
            success=True,
            response=response,
            model=chat_app.config.get("model"),
            timestamp=time.time()
        )
        
    except Exception as e:
        CHAT_ERRORS.labels(error_type="processing_error").inc()
        logger.error("Chat request failed", error=str(e), user_id=user.get("user_id"))
        
        return ChatResponse(
            success=False,
            error=str(e),
            timestamp=time.time()
        )

# Models endpoint
@app.get("/api/models", response_model=ModelsResponse)
@limiter.limit("10/minute")
async def get_models(request: Request):
    """Get available Ollama models"""
    if not chat_app:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Chat service not available"
        )
    
    try:
        models = chat_app.get_available_models()
        return ModelsResponse(success=True, models=models)
    except Exception as e:
        logger.error("Failed to get models", error=str(e))
        return ModelsResponse(success=False, models=[], error=str(e))

# Status endpoint
@app.get("/api/status")
@limiter.limit("30/minute")
async def get_status(request: Request):
    """Get Ollama status"""
    if not chat_app:
        return {"installed": False, "running": False}
    
    try:
        return {
            "installed": chat_app.check_ollama_installation(),
            "running": chat_app.check_ollama_server()
        }
    except Exception as e:
        logger.error("Status check failed", error=str(e))
        return {"installed": False, "running": False}

# Error handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    logger.error(
        "HTTP exception",
        status_code=exc.status_code,
        detail=exc.detail,
        url=str(request.url)
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail, "timestamp": time.time()}
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error(
        "Unhandled exception",
        error=str(exc),
        url=str(request.url),
        exc_info=True
    )
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "timestamp": time.time()}
    )

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.api_host,
        port=settings.api_port,
        workers=settings.api_workers if settings.environment == "production" else 1,
        log_level=settings.log_level.lower(),
        reload=settings.debug,
        access_log=True
    ) 