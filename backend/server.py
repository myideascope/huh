from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form, Request, Depends
from fastapi.responses import Response, JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import base64
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI(title="AudioForge API", version="1.0.0")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# =============== AUTH MODELS ===============

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# =============== AUTH HELPERS ===============

async def get_current_user(request: Request) -> Optional[User]:
    """Get current user from session token (cookie or header). Returns None for guests."""
    # Try cookie first
    session_token = request.cookies.get("session_token")
    
    # Fallback to Authorization header
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    
    if not session_token:
        return None
    
    # Find session
    session_doc = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    
    if not session_doc:
        return None
    
    # Check expiry with timezone awareness
    expires_at = session_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        return None
    
    # Get user
    user_doc = await db.users.find_one(
        {"user_id": session_doc["user_id"]},
        {"_id": 0}
    )
    
    if not user_doc:
        return None
    
    # Convert datetime if needed
    if isinstance(user_doc.get('created_at'), str):
        user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
    
    return User(**user_doc)

async def require_auth(request: Request) -> User:
    """Require authentication - raises 401 if not logged in."""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user

# =============== MODELS ===============

class EqualizerSettings(BaseModel):
    band_60hz: float = Field(default=0, ge=-12, le=12)
    band_230hz: float = Field(default=0, ge=-12, le=12)
    band_910hz: float = Field(default=0, ge=-12, le=12)
    band_3600hz: float = Field(default=0, ge=-12, le=12)
    band_14000hz: float = Field(default=0, ge=-12, le=12)

class AdvancedFilters(BaseModel):
    noise_reduction: float = Field(default=0, ge=0, le=100)
    voice_isolation: float = Field(default=0, ge=0, le=100)
    gain: float = Field(default=1, ge=0.1, le=5)
    highpass_enabled: bool = Field(default=False)
    highpass_frequency: float = Field(default=80, ge=20, le=500)
    lowpass_enabled: bool = Field(default=False)
    lowpass_frequency: float = Field(default=16000, ge=1000, le=20000)

class PresetCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(default="")
    equalizer: EqualizerSettings = Field(default_factory=EqualizerSettings)
    advanced: AdvancedFilters = Field(default_factory=AdvancedFilters)

class Preset(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = ""
    equalizer: EqualizerSettings
    advanced: AdvancedFilters
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class LogEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    level: str = Field(default="info")  # info, warning, error, success
    message: str
    details: Optional[Dict[str, Any]] = None

class LogEntryCreate(BaseModel):
    level: str = Field(default="info")
    message: str
    details: Optional[Dict[str, Any]] = None

class RecordingMetadata(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    filename: str
    format: str  # wav or webm
    duration_seconds: float
    file_size_bytes: int
    preset_used: Optional[str] = None
    has_audio_data: bool = Field(default=False)
    notes: Optional[str] = None
    user_id: Optional[str] = None  # For cross-device sync
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RecordingMetadataCreate(BaseModel):
    filename: str
    format: str
    duration_seconds: float
    file_size_bytes: int
    preset_used: Optional[str] = None
    notes: Optional[str] = None

class RecordingWithAudio(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    filename: str
    format: str
    duration_seconds: float
    file_size_bytes: int
    preset_used: Optional[str] = None
    notes: Optional[str] = None
    audio_data: str  # Base64 encoded audio
    user_id: Optional[str] = None  # For cross-device sync
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# =============== AUTH ROUTES ===============

@api_router.post("/auth/session")
async def create_session(request: Request):
    """Exchange session_id from Emergent Auth for a session token"""
    try:
        body = await request.json()
        session_id = body.get("session_id")
        
        if not session_id:
            raise HTTPException(status_code=400, detail="session_id required")
        
        # Call Emergent Auth to get user data
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id}
            )
            
            if response.status_code != 200:
                logger.error(f"Emergent Auth error: {response.status_code} - {response.text}")
                raise HTTPException(status_code=401, detail="Invalid session")
            
            auth_data = response.json()
        
        email = auth_data.get("email")
        name = auth_data.get("name")
        picture = auth_data.get("picture")
        session_token = auth_data.get("session_token")
        
        if not email or not session_token:
            raise HTTPException(status_code=401, detail="Invalid auth response")
        
        # Check if user exists
        existing_user = await db.users.find_one({"email": email}, {"_id": 0})
        
        if existing_user:
            user_id = existing_user["user_id"]
            # Update user info if changed
            await db.users.update_one(
                {"user_id": user_id},
                {"$set": {"name": name, "picture": picture}}
            )
        else:
            # Create new user
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            user_doc = {
                "user_id": user_id,
                "email": email,
                "name": name,
                "picture": picture,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.users.insert_one(user_doc)
            logger.info(f"Created new user: {email} ({user_id})")
        
        # Create session
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        session_doc = {
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": expires_at.isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Remove old sessions for this user
        await db.user_sessions.delete_many({"user_id": user_id})
        await db.user_sessions.insert_one(session_doc)
        
        # Create response with cookie
        response = JSONResponse(content={
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture
        })
        
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            path="/",
            max_age=7 * 24 * 60 * 60  # 7 days
        )
        
        logger.info(f"User logged in: {email}")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Session creation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/auth/me")
async def get_current_user_info(request: Request):
    """Get current authenticated user info"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    return {
        "user_id": user.user_id,
        "email": user.email,
        "name": user.name,
        "picture": user.picture
    }

@api_router.post("/auth/logout")
async def logout(request: Request):
    """Logout and clear session"""
    session_token = request.cookies.get("session_token")
    
    if session_token:
        await db.user_sessions.delete_many({"session_token": session_token})
    
    response = JSONResponse(content={"message": "Logged out successfully"})
    response.delete_cookie(
        key="session_token",
        path="/",
        secure=True,
        samesite="none"
    )
    
    logger.info("User logged out")
    return response

# =============== ROUTES ===============

@api_router.get("/")
async def root():
    return {"message": "AudioForge API v1.0.0", "status": "operational"}

@api_router.get("/health")
async def health_check():
    try:
        await db.command("ping")
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {"status": "unhealthy", "database": "disconnected", "error": str(e)}

# =============== PRESETS ===============

@api_router.post("/presets", response_model=Preset)
async def create_preset(preset_data: PresetCreate):
    try:
        preset = Preset(
            name=preset_data.name,
            description=preset_data.description,
            equalizer=preset_data.equalizer,
            advanced=preset_data.advanced
        )
        
        doc = preset.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        doc['updated_at'] = doc['updated_at'].isoformat()
        
        await db.presets.insert_one(doc)
        logger.info(f"Created preset: {preset.name} (id: {preset.id})")
        return preset
    except Exception as e:
        logger.error(f"Failed to create preset: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/presets", response_model=List[Preset])
async def get_presets():
    try:
        presets = await db.presets.find({}, {"_id": 0}).to_list(100)
        for preset in presets:
            if isinstance(preset.get('created_at'), str):
                preset['created_at'] = datetime.fromisoformat(preset['created_at'])
            if isinstance(preset.get('updated_at'), str):
                preset['updated_at'] = datetime.fromisoformat(preset['updated_at'])
        return presets
    except Exception as e:
        logger.error(f"Failed to fetch presets: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/presets/{preset_id}", response_model=Preset)
async def get_preset(preset_id: str):
    try:
        preset = await db.presets.find_one({"id": preset_id}, {"_id": 0})
        if not preset:
            raise HTTPException(status_code=404, detail="Preset not found")
        if isinstance(preset.get('created_at'), str):
            preset['created_at'] = datetime.fromisoformat(preset['created_at'])
        if isinstance(preset.get('updated_at'), str):
            preset['updated_at'] = datetime.fromisoformat(preset['updated_at'])
        return preset
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch preset {preset_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/presets/{preset_id}", response_model=Preset)
async def update_preset(preset_id: str, preset_data: PresetCreate):
    try:
        existing = await db.presets.find_one({"id": preset_id}, {"_id": 0})
        if not existing:
            raise HTTPException(status_code=404, detail="Preset not found")
        
        update_data = preset_data.model_dump()
        update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
        
        await db.presets.update_one({"id": preset_id}, {"$set": update_data})
        
        updated = await db.presets.find_one({"id": preset_id}, {"_id": 0})
        if isinstance(updated.get('created_at'), str):
            updated['created_at'] = datetime.fromisoformat(updated['created_at'])
        if isinstance(updated.get('updated_at'), str):
            updated['updated_at'] = datetime.fromisoformat(updated['updated_at'])
        
        logger.info(f"Updated preset: {preset_id}")
        return updated
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update preset {preset_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/presets/{preset_id}")
async def delete_preset(preset_id: str):
    try:
        result = await db.presets.delete_one({"id": preset_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Preset not found")
        logger.info(f"Deleted preset: {preset_id}")
        return {"message": "Preset deleted successfully", "id": preset_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete preset {preset_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# =============== LOGS ===============

@api_router.post("/logs", response_model=LogEntry)
async def create_log_entry(log_data: LogEntryCreate):
    try:
        log_entry = LogEntry(
            level=log_data.level,
            message=log_data.message,
            details=log_data.details
        )
        
        doc = log_entry.model_dump()
        doc['timestamp'] = doc['timestamp'].isoformat()
        
        await db.logs.insert_one(doc)
        return log_entry
    except Exception as e:
        logger.error(f"Failed to create log entry: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/logs", response_model=List[LogEntry])
async def get_logs(limit: int = 50):
    try:
        logs = await db.logs.find({}, {"_id": 0}).sort("timestamp", -1).to_list(limit)
        for log in logs:
            if isinstance(log.get('timestamp'), str):
                log['timestamp'] = datetime.fromisoformat(log['timestamp'])
        return logs
    except Exception as e:
        logger.error(f"Failed to fetch logs: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/logs")
async def clear_logs():
    try:
        result = await db.logs.delete_many({})
        logger.info(f"Cleared {result.deleted_count} log entries")
        return {"message": f"Cleared {result.deleted_count} log entries"}
    except Exception as e:
        logger.error(f"Failed to clear logs: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# =============== RECORDINGS ===============

@api_router.post("/recordings", response_model=RecordingMetadata)
async def save_recording_metadata(recording_data: RecordingMetadataCreate):
    try:
        recording = RecordingMetadata(
            filename=recording_data.filename,
            format=recording_data.format,
            duration_seconds=recording_data.duration_seconds,
            file_size_bytes=recording_data.file_size_bytes,
            preset_used=recording_data.preset_used,
            notes=recording_data.notes,
            has_audio_data=False
        )
        
        doc = recording.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        
        await db.recordings.insert_one(doc)
        logger.info(f"Saved recording metadata: {recording.filename}")
        return recording
    except Exception as e:
        logger.error(f"Failed to save recording metadata: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/recordings/upload")
async def upload_recording(
    audio_data: str = Form(...),  # Base64 encoded audio
    filename: str = Form(...),
    format: str = Form(...),
    duration_seconds: float = Form(...),
    file_size_bytes: int = Form(...),
    preset_used: Optional[str] = Form(None),
    notes: Optional[str] = Form(None)
):
    """Upload a recording with audio data to cloud storage"""
    try:
        # Validate base64 data
        try:
            # Just verify it's valid base64
            base64.b64decode(audio_data.split(',')[-1] if ',' in audio_data else audio_data)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid base64 audio data")
        
        recording_id = str(uuid.uuid4())
        created_at = datetime.now(timezone.utc)
        
        # Store recording with audio data
        doc = {
            "id": recording_id,
            "filename": filename,
            "format": format,
            "duration_seconds": duration_seconds,
            "file_size_bytes": file_size_bytes,
            "preset_used": preset_used,
            "notes": notes,
            "audio_data": audio_data,
            "has_audio_data": True,
            "created_at": created_at.isoformat()
        }
        
        await db.recordings.insert_one(doc)
        logger.info(f"Uploaded recording with audio: {filename} (ID: {recording_id})")
        
        return {
            "id": recording_id,
            "filename": filename,
            "format": format,
            "duration_seconds": duration_seconds,
            "file_size_bytes": file_size_bytes,
            "preset_used": preset_used,
            "notes": notes,
            "has_audio_data": True,
            "created_at": created_at
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to upload recording: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/recordings", response_model=List[RecordingMetadata])
async def get_recordings(limit: int = 50):
    """Get list of recordings (without audio data for performance)"""
    try:
        # Exclude audio_data from list query for performance
        recordings = await db.recordings.find(
            {}, 
            {"_id": 0, "audio_data": 0}
        ).sort("created_at", -1).to_list(limit)
        
        for rec in recordings:
            if isinstance(rec.get('created_at'), str):
                rec['created_at'] = datetime.fromisoformat(rec['created_at'])
            # Ensure has_audio_data field exists
            if 'has_audio_data' not in rec:
                rec['has_audio_data'] = False
        return recordings
    except Exception as e:
        logger.error(f"Failed to fetch recordings: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/recordings/{recording_id}")
async def get_recording(recording_id: str):
    """Get a single recording with metadata (without audio for initial load)"""
    try:
        recording = await db.recordings.find_one(
            {"id": recording_id}, 
            {"_id": 0, "audio_data": 0}
        )
        if not recording:
            raise HTTPException(status_code=404, detail="Recording not found")
        
        if isinstance(recording.get('created_at'), str):
            recording['created_at'] = datetime.fromisoformat(recording['created_at'])
        
        return recording
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch recording {recording_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/recordings/{recording_id}/download")
async def download_recording(recording_id: str):
    """Download recording audio data"""
    try:
        recording = await db.recordings.find_one({"id": recording_id}, {"_id": 0})
        if not recording:
            raise HTTPException(status_code=404, detail="Recording not found")
        
        if not recording.get('audio_data'):
            raise HTTPException(status_code=404, detail="No audio data available for this recording")
        
        # Decode base64 audio data
        audio_base64 = recording['audio_data']
        # Handle data URL format
        if ',' in audio_base64:
            audio_base64 = audio_base64.split(',')[1]
        
        audio_bytes = base64.b64decode(audio_base64)
        
        # Determine content type
        format_type = recording.get('format', 'webm')
        content_type = 'audio/webm' if format_type == 'webm' else 'audio/wav'
        
        return Response(
            content=audio_bytes,
            media_type=content_type,
            headers={
                "Content-Disposition": f"attachment; filename={recording['filename']}"
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to download recording {recording_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/recordings/{recording_id}")
async def update_recording(recording_id: str, notes: Optional[str] = None):
    """Update recording notes"""
    try:
        existing = await db.recordings.find_one({"id": recording_id}, {"_id": 0})
        if not existing:
            raise HTTPException(status_code=404, detail="Recording not found")
        
        update_data = {}
        if notes is not None:
            update_data['notes'] = notes
        
        if update_data:
            await db.recordings.update_one({"id": recording_id}, {"$set": update_data})
        
        logger.info(f"Updated recording: {recording_id}")
        return {"message": "Recording updated successfully", "id": recording_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update recording {recording_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/recordings/{recording_id}")
async def delete_recording(recording_id: str):
    """Delete a recording"""
    try:
        result = await db.recordings.delete_one({"id": recording_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Recording not found")
        logger.info(f"Deleted recording: {recording_id}")
        return {"message": "Recording deleted successfully", "id": recording_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete recording {recording_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
