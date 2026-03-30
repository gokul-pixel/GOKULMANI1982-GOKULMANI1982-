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
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
import base64
import json
import re
import random
import tempfile
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from urllib.parse import quote
from PyPDF2 import PdfReader
from data.recipes import RECIPES, get_recipe_recommendations, format_recipe_for_ai
from data.music import EMOTION_SONGS, get_songs_for_emotion, format_songs_for_ai

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

def search_youtube_real(query: str) -> str:
    """Search YouTube by scraping search results and return embed URL for first result"""
    try:
        search_url = f"https://www.youtube.com/results?search_query={quote(query)}"
        resp = requests.get(search_url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9'
        }, timeout=10)
        video_ids = re.findall(r'watch\?v=([a-zA-Z0-9_-]{11})', resp.text)
        if video_ids:
            return f"https://www.youtube.com/embed/{video_ids[0]}?autoplay=0"
        return None
    except Exception:
        return None

def search_cooking_video(recipe_name: str) -> str:
    """Search specifically for cooking/recipe videos"""
    cooking_query = f"{recipe_name} recipe cooking tutorial how to make"
    return search_youtube_real(cooking_query)

def search_music_video(song_or_mood: str) -> str:
    """Search specifically for music/songs"""
    music_query = f"{song_or_mood} official audio song music"
    return search_youtube_real(music_query)

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
    file_context: Optional[str] = None
    language: Optional[str] = "en"

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
    
    # Language instruction map
    lang_instructions = {
        "en": "",
        "hi": " Always respond in Hindi (हिन्दी).",
        "ta": " Always respond in Tamil (தமிழ்).",
        "te": " Always respond in Telugu (తెలుగు).",
        "bn": " Always respond in Bengali (বাংলা).",
        "mr": " Always respond in Marathi (मराठी).",
        "gu": " Always respond in Gujarati (ગુજરાતી).",
        "kn": " Always respond in Kannada (ಕನ್ನಡ).",
        "ml": " Always respond in Malayalam (മലയാളം).",
        "pa": " Always respond in Punjabi (ਪੰਜਾਬੀ)."
    }
    
    system_messages = {
        "normal": "You are BRUH, a friendly and helpful AI assistant. Be conversational and supportive.",
        "student": "You are BRUH Student Partner, an AI tutor and study companion. Help students learn, create study plans, explain concepts clearly, and motivate them. Format responses with bullet points for clarity. When document content is provided, analyze it thoroughly and help the student understand it.",
        "crop": "You are BRUH Crop Assistant, an agricultural expert helping farmers identify plant diseases, provide growing instructions, and suggest treatments. When an image is provided, analyze it carefully for signs of disease, pest damage, nutrient deficiency, or other issues. Be practical and supportive.",
        "cook": "You are BRUH Cook, a culinary expert. Provide recipes, cooking tips, and techniques. Be enthusiastic and descriptive. Always suggest a specific dish name. Format responses with numbered steps for recipes. When asked for video recommendations, mention the specific dish name clearly.",
        "music": "You are BRUH Music Companion, an AI music curator. Based on the user's emotion or mood, recommend exactly 3 specific songs with artist names. Format each recommendation as: Song Title - Artist Name. Explain briefly why each song matches the mood. Be enthusiastic about music."
    }
    
    system_msg = system_messages.get(request.bot_type, system_messages["normal"])
    
    # Add language instruction
    lang_extra = lang_instructions.get(request.language, "")
    if lang_extra:
        system_msg += lang_extra
    
    if request.mode == "elaborate":
        system_msg += " Provide detailed, comprehensive explanations."
    elif request.mode == "short":
        system_msg += " Keep responses concise and to the point."
    
    # Add file context to the message if provided
    message_text = request.message
    if request.file_context:
        message_text = f"Document Context:\n---\n{request.file_context[:8000]}\n---\n\nUser Question: {request.message}"
    
    provider_model_map = {
        "gpt-5.1": ("openai", "gpt-5.1"),
        "gpt-4o": ("openai", "gpt-4o"),
        "claude-sonnet-4-5": ("anthropic", "claude-sonnet-4-5-20250929"),
        "gemini-3-flash": ("gemini", "gemini-3-flash-preview")
    }
    
    provider, model = provider_model_map.get(request.ai_model, ("openai", "gpt-5.1"))
    
    try:
        # For cook bot, inject recipe data into the AI prompt
        if request.bot_type == "cook":
            recipes = get_recipe_recommendations(request.message, count=3)
            recipe_context = format_recipe_for_ai(recipes)
            message_text = f"{message_text}\n\nHere are some relevant recipes from our database to reference:\n{recipe_context}\nPlease recommend from these or suggest your own. Always provide step-by-step instructions."
        
        # For music bot, inject song recommendations
        if request.bot_type == "music":
            # Extract emotion keywords from message
            emotion_keywords = ["happy", "sad", "angry", "calm", "excited", "tired", "neutral", "energetic", "relaxed", "romantic", "melancholic", "surprised", "anxious"]
            detected_mood = "neutral"
            msg_lower = request.message.lower()
            for emo in emotion_keywords:
                if emo in msg_lower:
                    detected_mood = emo
                    break
            songs = get_songs_for_emotion(detected_mood, count=5)
            songs_context = format_songs_for_ai(detected_mood, songs)
            message_text = f"{message_text}\n\nHere are songs from our music database for the '{detected_mood}' mood:\n{songs_context}\nRecommend 3 of these songs with brief explanations of why they match the mood."
        
        llm_chat = LlmChat(
            api_key=EMERGENT_KEY,
            session_id=f"{current_user.user_id}_{request.bot_type}_{uuid.uuid4().hex[:8]}",
            system_message=system_msg
        ).with_model(provider, model)
        
        # Build user message with optional image
        if request.image_data and request.image_data.startswith("data:image"):
            base64_data = request.image_data.split(",", 1)[1] if "," in request.image_data else request.image_data
            image_content = ImageContent(image_base64=base64_data)
            user_message = UserMessage(text=message_text, file_contents=[image_content])
        else:
            user_message = UserMessage(text=message_text)
        
        response = await llm_chat.send_message(user_message)
        
        # For cooking bot, search for COOKING/RECIPE video
        video_url = None
        recipe_cards = None
        if request.bot_type == "cook":
            recipe_query = request.message.replace("how to make", "").replace("recipe", "").strip()
            video_url = search_cooking_video(recipe_query)
            # Include recipe cards in response
            recipes = get_recipe_recommendations(request.message, count=3)
            recipe_cards = [{"name": r["name"], "cuisine": r["cuisine"], "time": r["time"], "difficulty": r["difficulty"], "ingredients": r["ingredients"][:6]} for r in recipes]
        
        # For music bot, get song URLs
        song_url = None
        song_cards = None
        if request.bot_type == "music":
            songs = get_songs_for_emotion(detected_mood, count=3)
            song_cards = songs
            # Search for first song on YouTube
            if songs:
                first_song = f"{songs[0]['title']} {songs[0]['artist']}"
                song_url = search_music_video(first_song)
        
        # Save messages to DB
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
        if recipe_cards:
            result["recipe_cards"] = recipe_cards
        if song_cards:
            result["song_cards"] = song_cards
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Chat error: {str(e)}")
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
        
        raw_image = image_data.get("image_data", "")
        
        # Use GPT vision to analyze facial emotion from the camera frame
        llm_chat = LlmChat(
            api_key=EMERGENT_KEY,
            session_id=f"{current_user.user_id}_emotion_{uuid.uuid4().hex[:6]}",
            system_message="You are an emotion detection AI. Analyze the facial expression in images and return ONLY ONE WORD describing the primary emotion. Choose from: happy, sad, angry, calm, excited, tired, neutral, surprised, anxious, energetic, relaxed, romantic, melancholic. Return ONLY the single emotion word, nothing else."
        ).with_model("openai", "gpt-5.1")
        
        # Extract base64 from data URL
        if raw_image.startswith("data:image"):
            base64_data = raw_image.split(",", 1)[1] if "," in raw_image else raw_image
        else:
            base64_data = raw_image
        
        if base64_data and len(base64_data) > 100:
            image_content = ImageContent(image_base64=base64_data)
            user_message = UserMessage(
                text="Look at this person's face carefully. What emotion are they expressing? Reply with ONLY ONE emotion word.",
                file_contents=[image_content]
            )
            response = await llm_chat.send_message(user_message)
            detected_emotion = response.strip().lower().split()[0] if response else "neutral"
        else:
            # Fallback if image data is too small/invalid
            detected_emotion = random.choice(["happy", "calm", "excited", "neutral", "energetic", "relaxed"])
        
        # Recommend songs based on detected emotion
        emotion_song_map = {
            "happy": "upbeat happy pop songs",
            "sad": "comforting emotional ballads",
            "angry": "intense rock metal songs",
            "calm": "peaceful ambient chill music",
            "excited": "high energy dance EDM songs",
            "tired": "gentle relaxing lo-fi music",
            "neutral": "popular trending songs",
            "surprised": "exciting dramatic orchestral music",
            "anxious": "calming meditation music",
            "energetic": "workout pump up songs",
            "relaxed": "smooth jazz chill beats",
            "romantic": "love songs romantic ballads",
            "melancholic": "sad beautiful piano music"
        }
        
        music_query = emotion_song_map.get(detected_emotion, "popular trending songs")
        song_url = search_music_video(music_query)
        
        return {
            "emotion": detected_emotion,
            "song_url": song_url,
            "music_query": music_query
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Emotion analysis error: {str(e)}")
        # Fallback to random on error
        fallback_emotion = random.choice(["happy", "calm", "excited", "neutral"])
        return {"emotion": fallback_emotion, "song_url": None, "music_query": None}

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
    
    llm_chat = LlmChat(
        api_key=EMERGENT_KEY,
        session_id=f"{current_user.user_id}_study_plan_{uuid.uuid4().hex[:6]}",
        system_message="You are a study planner. Create comprehensive study plans."
    ).with_model("openai", "gpt-5.1")
    
    prompt = f"""Create a detailed study plan based on this content:

{document_text}

Include:
- Main concepts and topics
- Study schedule recommendation  
- Key points to remember
- Practice questions"""
    
    response = await llm_chat.send_message(UserMessage(text=prompt))
    
    # Generate PDF
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
    
    story.append(Paragraph("BRUH Study Plan", title_style))
    story.append(Spacer(1, 0.2*inch))
    
    content_style = styles['BodyText']
    for line in response.split('\n'):
        if line.strip():
            # Escape XML special chars for reportlab
            safe_line = line.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
            try:
                story.append(Paragraph(safe_line, content_style))
                story.append(Spacer(1, 0.1*inch))
            except Exception:
                story.append(Paragraph(safe_line[:200], content_style))
    
    doc.build(story)
    buffer.seek(0)
    pdf_bytes = buffer.read()
    
    # Upload to storage
    storage_path = f"{APP_NAME}/study-plans/{current_user.user_id}/{uuid.uuid4()}.pdf"
    result = put_object(storage_path, pdf_bytes, "application/pdf")
    
    # Save to files collection so download endpoint works
    file_doc = {
        "file_id": str(uuid.uuid4()),
        "user_id": current_user.user_id,
        "storage_path": result["path"],
        "original_filename": "study_plan.pdf",
        "content_type": "application/pdf",
        "size": result.get("size", len(pdf_bytes)),
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.files.insert_one(file_doc)
    
    return {
        "study_plan": response,
        "pdf_url": f"/api/files/{result['path']}"
    }


@api_router.get("/recipes")
async def get_recipes(
    query: str = Query(""),
    cuisine: str = Query(None),
    category: str = Query(None),
    authorization: str = Header(None),
    session_token: str = Cookie(None)
):
    await get_current_user(authorization, None, session_token)
    recipes = get_recipe_recommendations(query, cuisine, category, count=10)
    return {"recipes": recipes}

@api_router.post("/games/trivia")
async def generate_trivia(
    game_data: dict,
    authorization: str = Header(None),
    auth: str = Query(None),
    session_token: str = Cookie(None)
):
    await get_current_user(authorization, auth, session_token)
    
    category = game_data.get("category", "general knowledge")
    difficulty = game_data.get("difficulty", "medium")
    
    llm_chat = LlmChat(
        api_key=EMERGENT_KEY,
        session_id=f"trivia_{uuid.uuid4().hex[:8]}",
        system_message="You are a trivia game master. Generate fun and educational trivia questions."
    ).with_model("openai", "gpt-5.1")
    
    prompt = f"""Generate 5 {difficulty} difficulty trivia questions about {category}.
Return ONLY a JSON array with this structure:
[{{"question": "question text", "options": ["A", "B", "C", "D"], "correct": 0, "explanation": "why this is correct"}}]
The "correct" field is the index (0-3) of the correct option.
Return ONLY the JSON array, nothing else."""
    
    try:
        response = await llm_chat.send_message(UserMessage(text=prompt))
        json_match = re.search(r'\[.*\]', response, re.DOTALL)
        if json_match:
            questions = json.loads(json_match.group())
        else:
            questions = [{"question": "What is the capital of France?", "options": ["London", "Paris", "Berlin", "Madrid"], "correct": 1, "explanation": "Paris is the capital of France"}]
        return {"questions": questions}
    except Exception:
        return {"questions": [{"question": "What is 2 + 2?", "options": ["3", "4", "5", "6"], "correct": 1, "explanation": "Basic math: 2 + 2 = 4"}]}

@api_router.get("/music/songs")
async def get_music_recommendations(
    emotion: str = Query("neutral"),
    authorization: str = Header(None),
    session_token: str = Cookie(None)
):
    await get_current_user(authorization, None, session_token)
    songs = get_songs_for_emotion(emotion, count=5)
    return {"songs": songs, "emotion": emotion}

@api_router.delete("/chat/delete/{bot_type}")
async def delete_chat_history(
    bot_type: str,
    authorization: str = Header(None),
    auth: str = Query(None),
    session_token: str = Cookie(None)
):
    current_user = await get_current_user(authorization, auth, session_token)
    await db.chat_messages.delete_many({
        "user_id": current_user.user_id,
        "bot_type": bot_type
    })
    return {"message": "Chat history deleted"}

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
        
        # Try to find record in files collection
        record = await db.files.find_one({"storage_path": path, "is_deleted": False}, {"_id": 0})
        
        data, content_type = get_object(path)
        
        # Use record content_type if available, otherwise use what storage returns
        final_content_type = record.get("content_type", content_type) if record else content_type
        filename = record.get("original_filename", "download") if record else "download"
        
        return Response(
            content=data, 
            media_type=final_content_type,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/extract-text")
async def extract_text(
    file_data: dict,
    authorization: str = Header(None),
    auth: str = Query(None),
    session_token: str = Cookie(None)
):
    """Extract text from uploaded PDF or document files"""
    await get_current_user(authorization, auth, session_token)
    
    file_url = file_data.get("file_url", "")
    
    try:
        # Get file from storage
        storage_path = file_url.replace("/api/files/", "")
        data, content_type = get_object(storage_path)
        
        extracted_text = ""
        
        if "pdf" in content_type.lower() or storage_path.endswith(".pdf"):
            # Extract text from PDF
            pdf_reader = PdfReader(BytesIO(data))
            for page in pdf_reader.pages:
                page_text = page.extract_text()
                if page_text:
                    extracted_text += page_text + "\n"
        elif "text" in content_type.lower() or storage_path.endswith(".txt"):
            extracted_text = data.decode("utf-8", errors="ignore")
        elif "word" in content_type.lower() or storage_path.endswith(".docx"):
            try:
                from docx import Document as DocxDocument
                doc = DocxDocument(BytesIO(data))
                extracted_text = "\n".join([p.text for p in doc.paragraphs if p.text.strip()])
            except Exception:
                extracted_text = "Could not extract text from this document format."
        else:
            extracted_text = data.decode("utf-8", errors="ignore")[:5000]
        
        if not extracted_text.strip():
            extracted_text = "No readable text found in this file."
        
        return {"text": extracted_text[:10000]}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Text extraction error: {str(e)}")
        return {"text": f"Could not extract text: {str(e)}"}

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
    # Remove MongoDB _id before returning
    task.pop("_id", None)
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
    # Remove MongoDB _id before returning
    note.pop("_id", None)
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
    # Remove MongoDB _id before returning
    event.pop("_id", None)
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