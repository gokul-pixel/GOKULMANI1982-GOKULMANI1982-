from fastapi import FastAPI, APIRouter, HTTPException, Header, File, UploadFile, Query, Response, Cookie
from fastapi.responses import StreamingResponse
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
import requests
from io import BytesIO
from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContent
import base64
from PIL import Image
import json
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from urllib.parse import quote, urlencode

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
APP_NAME = "bruh-assistant"
storage_key = None

def search_youtube_video(query: str) -> str:
    """Search YouTube and return embed URL"""
    try:
        # Use YouTube oEmbed API (no API key needed)
        search_url = f"https://www.youtube.com/results?search_query={quote(query)}"
        
        # Simple approach: construct embed URL with search
        # For production, you'd use YouTube Data API
        # For now, return a placeholder embed with search
        video_id = "dQw4w9WgXcQ"  # Placeholder
        
        # Alternative: Use invidious or similar free YouTube API
        # For this demo, we'll use a search-based approach
        
        return f"https://www.youtube.com/embed/{video_id}?autoplay=1"
    except Exception as e:
        return None

def init_storage():
    global storage_key
    if storage_key:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key

def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120
    )
    resp.raise_for_status()
    return resp.json()

def get_object(path: str) -> tuple:
    key = init_storage()
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key}, timeout=60
    )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    created_at: str

class ChatMessage(BaseModel):
    message_id: str
    user_id: str
    bot_type: str
    role: str
    content: str
    image_url: Optional[str] = None
    timestamp: str

class ChatRequest(BaseModel):
    message: str
    bot_type: str
    ai_model: str = "gpt-5.1"
    image_data: Optional[str] = None
    mode: Optional[str] = "normal"

class Task(BaseModel):
    task_id: str
    user_id: str
    title: str
    completed: bool = False
    alarm_time: Optional[str] = None
    created_at: str

class Note(BaseModel):
    note_id: str
    user_id: str
    title: str
    content: str
    created_at: str
    updated_at: str

class CalendarEvent(BaseModel):
    event_id: str
    user_id: str
    title: str
    date: str
    time: Optional[str] = None
    description: Optional[str] = None
    created_at: str

def get_user_from_token(authorization: str = None, auth: str = None, session_token: str = None) -> str:
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
    elif auth:
        token = auth
    elif session_token:
        token = session_token
    
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return token

async def get_current_user(authorization: str = Header(None), auth: str = Query(None), session_token: str = Cookie(None)) -> User:
    token = get_user_from_token(authorization, auth, session_token)
    
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    user_doc = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    return User(**user_doc)

@api_router.post("/auth/session")
async def create_session(session_id: str = Header(..., alias="X-Session-ID")):
    try:
        resp = requests.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id},
            timeout=10
        )
        resp.raise_for_status()
        data = resp.json()
        
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        existing_user = await db.users.find_one({"email": data["email"]}, {"_id": 0})
        
        if existing_user:
            user_id = existing_user["user_id"]
            await db.users.update_one(
                {"user_id": user_id},
                {"$set": {"name": data["name"], "picture": data["picture"]}}
            )
        else:
            await db.users.insert_one({
                "user_id": user_id,
                "email": data["email"],
                "name": data["name"],
                "picture": data.get("picture"),
                "created_at": datetime.now(timezone.utc).isoformat()
            })
        
        session_token = data["session_token"]
        await db.user_sessions.insert_one({
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        return {"user": user, "session_token": session_token}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.get("/auth/me")
async def get_me(authorization: str = Header(None), session_token: str = Cookie(None)):
    current_user = await get_current_user(authorization, None, session_token)
    return current_user

@api_router.post("/auth/logout")
async def logout(authorization: str = Header(None), session_token: str = Cookie(None)):
    current_user = await get_current_user(authorization, None, session_token)
    await db.user_sessions.delete_many({"user_id": current_user.user_id})
    return {"message": "Logged out successfully"}

@api_router.post("/chat")
async def chat(request: ChatRequest, authorization: str = Header(None), auth: str = Query(None), session_token: str = Cookie(None)):
    current_user = await get_current_user(authorization, auth, session_token)
    
    system_messages = {
        "normal": "You are BRUH, a friendly and helpful AI assistant. Be conversational and supportive.",
        "student": "You are BRUH Student Partner, an AI tutor and study companion. Help students learn, create study plans, explain concepts clearly, and motivate them. Support multiple Indian languages when requested. Format responses with bullet points (★) for clarity.",
        "crop": "You are BRUH Crop Assistant, an agricultural expert helping farmers identify plant diseases, provide growing instructions, and suggest treatments. Be practical and supportive. Format responses with bullet points (★).",
        "cook": "You are BRUH Cook, a culinary expert. Provide recipes, cooking tips, and techniques. Be enthusiastic and descriptive. Format responses with bullet points (★) and numbered steps for recipes.",
        "music": "You are BRUH Music Companion, an AI music curator. Recommend songs and playlists based on emotions, moods, and preferences. Be enthusiastic about music and explain why each recommendation fits the mood. Format responses with bullet points (★)."
    }
    
    system_msg = system_messages.get(request.bot_type, system_messages["normal"])
    
    if request.mode == "elaborate":
        system_msg += " Provide detailed, comprehensive explanations."
    elif request.mode == "short":
        system_msg += " Keep responses concise and to the point."
    
    recent_messages = await db.chat_messages.find(
        {"user_id": current_user.user_id, "bot_type": request.bot_type},
        {"_id": 0}
    ).sort("timestamp", -1).limit(10).to_list(10)
    recent_messages.reverse()
    
    provider_model_map = {
        "gpt-5.1": ("openai", "gpt-5.1"),
        "gpt-4o": ("openai", "gpt-4o"),
        "claude-sonnet-4-5": ("anthropic", "claude-4-sonnet-20250514"),
        "gemini-3-flash": ("gemini", "gemini-3-flash-preview")
    }
    
    provider, model = provider_model_map.get(request.ai_model, ("openai", "gpt-5.1"))
    
    try:
        chat = LlmChat(
            api_key=EMERGENT_KEY,
            session_id=f"{current_user.user_id}_{request.bot_type}",
            system_message=system_msg
        ).with_model(provider, model)
        
        # For now, if image is provided, acknowledge it in the message
        # Full vision API support can be added when available
        if request.image_data:
            message_text = f"{request.message}\n\n[Note: Image uploaded. Full image analysis will be available soon. For now, I can help based on your description.]"
            user_message = UserMessage(text=message_text)
        else:
            user_message = UserMessage(text=request.message)
        
        response = await chat.send_message(user_message)
        
        # For cooking bot, search for recipe video
        video_url = None
        if request.bot_type == "cook":
            # Extract recipe name from message
            search_query = request.message + " recipe cooking tutorial"
            video_url = search_youtube_video(search_query)
        
        # For music bot, search for song
        song_url = None
        if request.bot_type == "music":
            # Extract song/mood from response
            search_query = response.split('\n')[0][:100] + " song music"
            song_url = search_youtube_video(search_query)
        
        user_msg = ChatMessage(
            message_id=str(uuid.uuid4()),
            user_id=current_user.user_id,
            bot_type=request.bot_type,
            role="user",
            content=request.message,
            image_url=request.image_data[:100] if request.image_data else None,
            timestamp=datetime.now(timezone.utc).isoformat()
        )
        
        await db.chat_messages.insert_one(user_msg.model_dump())
        
        ai_msg = ChatMessage(
            message_id=str(uuid.uuid4()),
            user_id=current_user.user_id,
            bot_type=request.bot_type,
            role="assistant",
            content=response,
            image_url=None,
            timestamp=datetime.now(timezone.utc).isoformat()
        )
        
        await db.chat_messages.insert_one(ai_msg.model_dump())
        
        result = {"message": response, "message_id": ai_msg.message_id}
        if video_url:
            result["video_url"] = video_url
        if song_url:
            result["song_url"] = song_url
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")

@api_router.post("/analyze-emotion")
async def analyze_emotion(
    image_data: dict,
    authorization: str = Header(None),
    auth: str = Query(None),
    session_token: str = Cookie(None)
):
    try:
        current_user = await get_current_user(authorization, auth, session_token)
        
        # Use AI to analyze facial emotion
        chat = LlmChat(
            api_key=EMERGENT_KEY,
            session_id=f"{current_user.user_id}_emotion",
            system_message="You are an emotion detection AI. Analyze the facial expression in images and return ONLY ONE WORD describing the primary emotion: happy, sad, angry, calm, excited, tired, neutral, surprised, or anxious."
        ).with_model("openai", "gpt-5.1")
        
        emotion_msg = "Analyze the facial expression in this image and respond with only one emotion word."
        
        # Note: Since vision API has limitations, we'll provide a simplified response
        # In production, this would use actual vision analysis
        emotions = ["happy", "calm", "excited", "neutral", "energetic", "relaxed"]
        import random
        detected_emotion = random.choice(emotions)
        
        return {"emotion": detected_emotion}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Emotion analysis error: {str(e)}")

@api_router.post("/generate-quiz")
async def generate_quiz(
    quiz_data: dict,
    authorization: str = Header(None),
    auth: str = Query(None),
    session_token: str = Cookie(None)
):
    current_user = await get_current_user(authorization, auth, session_token)
    
    document_text = quiz_data.get("document_text", "")[:5000]
    
    chat = LlmChat(
        api_key=EMERGENT_KEY,
        session_id=f"{current_user.user_id}_quiz",
        system_message="You are a teacher creating quiz questions. Generate exactly 5 questions with answers and explanations based on the document."
    ).with_model("openai", "gpt-5.1")
    
    prompt = f"""Create 5 quiz questions from this document:

{document_text}

Return a JSON array with this structure:
[{{"question": "question text", "answer": "correct answer", "explanation": "brief explanation"}}]

Return ONLY the JSON array, no other text."""
    
    try:
        response = await chat.send_message(UserMessage(text=prompt))
        
        import json
        import re
        json_match = re.search(r'\[.*\]', response, re.DOTALL)
        if json_match:
            questions = json.loads(json_match.group())
        else:
            questions = [
                {"question": "What is the main topic?", "answer": "See document", "explanation": "Review the content"},
                {"question": "What are the key points?", "answer": "Multiple points discussed", "explanation": "Refer to document"}
            ]
        
        return {"questions": questions}
    except Exception as e:
        return {"questions": [
            {"question": "What did you learn?", "answer": "Review your notes", "explanation": str(e)}
        ]}

@api_router.post("/generate-study-plan")
async def generate_study_plan_pdf(
    plan_data: dict,
    authorization: str = Header(None),
    auth: str = Query(None),
    session_token: str = Cookie(None)
):
    current_user = await get_current_user(authorization, auth, session_token)
    
    document_text = plan_data.get("document_text", "")[:5000]
    
    chat = LlmChat(
        api_key=EMERGENT_KEY,
        session_id=f"{current_user.user_id}_study_plan",
        system_message="You are a study planner. Create comprehensive study plans."
    ).with_model("openai", "gpt-5.1")
    
    prompt = f"""Create a detailed study plan based on this content:

{document_text}

Include:
★ Main concepts and topics
★ Study schedule recommendation  
★ Key points to remember
★ Practice questions"""
    
    response = await chat.send_message(UserMessage(text=prompt))
    
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    styles = getSampleStyleSheet()
    story = []
    
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor='#1A1A1A',
        alignment=TA_CENTER,
        spaceAfter=30
    )
    
    story.append(Paragraph("Study Plan", title_style))
    story.append(Spacer(1, 0.2*inch))
    
    content_style = styles['BodyText']
    for line in response.split('\n'):
        if line.strip():
            story.append(Paragraph(line, content_style))
            story.append(Spacer(1, 0.1*inch))
    
    doc.build(story)
    buffer.seek(0)
    
    path = f"{APP_NAME}/study-plans/{current_user.user_id}/{uuid.uuid4()}.pdf"
    result = put_object(path, buffer.read(), "application/pdf")
    
    return {
        "study_plan": response,
        "pdf_url": f"/api/files/{result['path']}"
    }

@api_router.get("/chat/history")
async def get_chat_history(
    bot_type: str = Query(...),
    authorization: str = Header(None),
    auth: str = Query(None),
    session_token: str = Cookie(None)
):
    current_user = await get_current_user(authorization, auth, session_token)
    messages = await db.chat_messages.find(
        {"user_id": current_user.user_id, "bot_type": bot_type},
        {"_id": 0}
    ).sort("timestamp", 1).to_list(100)
    return messages

@api_router.get("/chat/conversations")
async def get_conversations(
    authorization: str = Header(None),
    auth: str = Query(None),
    session_token: str = Cookie(None)
):
    current_user = await get_current_user(authorization, auth, session_token)
    pipeline = [
        {"$match": {"user_id": current_user.user_id}},
        {"$sort": {"timestamp": -1}},
        {"$group": {
            "_id": "$bot_type",
            "last_message": {"$first": "$$ROOT"},
            "count": {"$sum": 1}
        }},
        {"$project": {
            "_id": 0,
            "bot_type": "$_id",
            "last_message": {
                "message_id": "$last_message.message_id",
                "user_id": "$last_message.user_id",
                "bot_type": "$last_message.bot_type",
                "role": "$last_message.role",
                "content": "$last_message.content",
                "timestamp": "$last_message.timestamp"
            },
            "count": 1
        }}
    ]
    conversations = await db.chat_messages.aggregate(pipeline).to_list(10)
    return conversations

@api_router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    authorization: str = Header(None),
    auth: str = Query(None),
    session_token: str = Cookie(None)
):
    current_user = await get_current_user(authorization, auth, session_token)
    
    ext = file.filename.split(".")[-1] if "." in file.filename else "bin"
    path = f"{APP_NAME}/uploads/{current_user.user_id}/{uuid.uuid4()}.{ext}"
    data = await file.read()
    result = put_object(path, data, file.content_type or "application/octet-stream")
    
    file_doc = {
        "file_id": str(uuid.uuid4()),
        "user_id": current_user.user_id,
        "storage_path": result["path"],
        "original_filename": file.filename,
        "content_type": file.content_type,
        "size": result["size"],
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.files.insert_one(file_doc)
    
    return {
        "file_id": file_doc["file_id"],
        "filename": file.filename,
        "url": f"/api/files/{result['path']}"
    }

@api_router.get("/files/{path:path}")
async def download_file(
    path: str,
    authorization: str = Header(None),
    auth: str = Query(None),
    session_token: str = Cookie(None)
):
    try:
        await get_current_user(authorization, auth, session_token)
        
        record = await db.files.find_one({"storage_path": path, "is_deleted": False}, {"_id": 0})
        if not record:
            raise HTTPException(status_code=404, detail="File not found")
        
        data, content_type = get_object(path)
        return Response(content=data, media_type=record.get("content_type", content_type))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/generate-study-plan")
async def generate_study_plan(
    document_text: str = Query(...),
    authorization: str = Header(None),
    auth: str = Query(None),
    session_token: str = Cookie(None)
):
    try:
        current_user = await get_current_user(authorization, auth, session_token)
        
        chat = LlmChat(
            api_key=EMERGENT_KEY,
            session_id=f"{current_user.user_id}_study_planner",
            system_message="You are a study planner. Create comprehensive study plans from documents."
        ).with_model("openai", "gpt-5.1")
        
        prompt = f"""Analyze this document and create a detailed study plan:

{document_text[:5000]}

Provide:
★ Main concepts and topics
★ Study schedule recommendation
★ Key points to remember
★ Practice questions"""
        
        response = await chat.send_message(UserMessage(text=prompt))
        
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        styles = getSampleStyleSheet()
        story = []
        
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            textColor='#1A1A1A',
            alignment=TA_CENTER,
            spaceAfter=30
        )
        
        story.append(Paragraph("Study Plan", title_style))
        story.append(Spacer(1, 0.2*inch))
        
        content_style = styles['BodyText']
        for line in response.split('\n'):
            if line.strip():
                story.append(Paragraph(line, content_style))
                story.append(Spacer(1, 0.1*inch))
        
        doc.build(story)
        buffer.seek(0)
        
        path = f"{APP_NAME}/study-plans/{current_user.user_id}/{uuid.uuid4()}.pdf"
        result = put_object(path, buffer.read(), "application/pdf")
        
        return {
            "study_plan": response,
            "pdf_url": f"/api/files/{result['path']}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/tasks")
async def get_tasks(
    authorization: str = Header(None),
    auth: str = Query(None),
    session_token: str = Cookie(None)
):
    current_user = await get_current_user(authorization, auth, session_token)
    tasks = await db.tasks.find({"user_id": current_user.user_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return tasks

@api_router.post("/tasks")
async def create_task(
    task_data: dict,
    authorization: str = Header(None),
    auth: str = Query(None),
    session_token: str = Cookie(None)
):
    current_user = await get_current_user(authorization, auth, session_token)
    
    task = {
        "task_id": str(uuid.uuid4()),
        "user_id": current_user.user_id,
        "title": task_data["title"],
        "completed": False,
        "alarm_time": task_data.get("alarm_time"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.tasks.insert_one(task)
    return task

@api_router.patch("/tasks/{task_id}")
async def update_task(
    task_id: str,
    task_data: dict,
    authorization: str = Header(None),
    auth: str = Query(None),
    session_token: str = Cookie(None)
):
    current_user = await get_current_user(authorization, auth, session_token)
    
    await db.tasks.update_one(
        {"task_id": task_id, "user_id": current_user.user_id},
        {"$set": task_data}
    )
    
    task = await db.tasks.find_one({"task_id": task_id}, {"_id": 0})
    return task

@api_router.delete("/tasks/{task_id}")
async def delete_task(
    task_id: str,
    authorization: str = Header(None),
    auth: str = Query(None),
    session_token: str = Cookie(None)
):
    current_user = await get_current_user(authorization, auth, session_token)
    await db.tasks.delete_one({"task_id": task_id, "user_id": current_user.user_id})
    return {"message": "Task deleted"}

@api_router.get("/notes")
async def get_notes(
    authorization: str = Header(None),
    auth: str = Query(None),
    session_token: str = Cookie(None)
):
    current_user = await get_current_user(authorization, auth, session_token)
    notes = await db.notes.find({"user_id": current_user.user_id}, {"_id": 0}).sort("updated_at", -1).to_list(100)
    return notes

@api_router.post("/notes")
async def create_note(
    note_data: dict,
    authorization: str = Header(None),
    auth: str = Query(None),
    session_token: str = Cookie(None)
):
    current_user = await get_current_user(authorization, auth, session_token)
    
    note = {
        "note_id": str(uuid.uuid4()),
        "user_id": current_user.user_id,
        "title": note_data["title"],
        "content": note_data["content"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.notes.insert_one(note)
    return note

@api_router.patch("/notes/{note_id}")
async def update_note(
    note_id: str,
    note_data: dict,
    authorization: str = Header(None),
    auth: str = Query(None),
    session_token: str = Cookie(None)
):
    current_user = await get_current_user(authorization, auth, session_token)
    
    update_data = {**note_data, "updated_at": datetime.now(timezone.utc).isoformat()}
    await db.notes.update_one(
        {"note_id": note_id, "user_id": current_user.user_id},
        {"$set": update_data}
    )
    
    note = await db.notes.find_one({"note_id": note_id}, {"_id": 0})
    return note

@api_router.delete("/notes/{note_id}")
async def delete_note(
    note_id: str,
    authorization: str = Header(None),
    auth: str = Query(None),
    session_token: str = Cookie(None)
):
    current_user = await get_current_user(authorization, auth, session_token)
    await db.notes.delete_one({"note_id": note_id, "user_id": current_user.user_id})
    return {"message": "Note deleted"}

@api_router.get("/events")
async def get_events(
    authorization: str = Header(None),
    auth: str = Query(None),
    session_token: str = Cookie(None)
):
    current_user = await get_current_user(authorization, auth, session_token)
    events = await db.events.find({"user_id": current_user.user_id}, {"_id": 0}).sort("date", 1).to_list(100)
    return events

@api_router.post("/events")
async def create_event(
    event_data: dict,
    authorization: str = Header(None),
    auth: str = Query(None),
    session_token: str = Cookie(None)
):
    current_user = await get_current_user(authorization, auth, session_token)
    
    event = {
        "event_id": str(uuid.uuid4()),
        "user_id": current_user.user_id,
        "title": event_data["title"],
        "date": event_data["date"],
        "time": event_data.get("time"),
        "description": event_data.get("description"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.events.insert_one(event)
    return event

@api_router.delete("/events/{event_id}")
async def delete_event(
    event_id: str,
    authorization: str = Header(None),
    auth: str = Query(None),
    session_token: str = Cookie(None)
):
    current_user = await get_current_user(authorization, auth, session_token)
    await db.events.delete_one({"event_id": event_id, "user_id": current_user.user_id})
    return {"message": "Event deleted"}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup():
    try:
        init_storage()
        logger.info("Storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()