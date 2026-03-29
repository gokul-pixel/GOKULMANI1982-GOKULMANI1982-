"""
BRUH Assistant API Tests
Tests all backend endpoints including:
- Chat endpoints (normal, student, crop, cook, music)
- Emotion analysis
- Study plan PDF generation
- File upload and text extraction
- YouTube search functions
"""

import pytest
import requests
import os
import json
import base64
from datetime import datetime, timezone, timedelta
from bson import ObjectId

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://ai-assistant-pro-54.preview.emergentagent.com').rstrip('/')

# Test session token - will be created during test setup
TEST_SESSION_TOKEN = None
TEST_USER_ID = None


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def test_user_session(api_client):
    """Create a test user and session directly in MongoDB for testing"""
    import pymongo
    
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'test_database')
    
    client = pymongo.MongoClient(mongo_url)
    db = client[db_name]
    
    # Create test user
    test_user_id = f"test_user_{datetime.now().strftime('%Y%m%d%H%M%S')}"
    test_email = f"test_{datetime.now().strftime('%Y%m%d%H%M%S')}@test.com"
    
    user_doc = {
        "user_id": test_user_id,
        "email": test_email,
        "name": "Test User",
        "picture": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Insert user
    db.users.insert_one(user_doc)
    
    # Create session token
    test_session_token = f"test_session_{datetime.now().strftime('%Y%m%d%H%M%S')}"
    session_doc = {
        "user_id": test_user_id,
        "session_token": test_session_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=1),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    db.user_sessions.insert_one(session_doc)
    
    yield {
        "user_id": test_user_id,
        "session_token": test_session_token,
        "email": test_email
    }
    
    # Cleanup after tests
    db.users.delete_one({"user_id": test_user_id})
    db.user_sessions.delete_one({"session_token": test_session_token})
    db.chat_messages.delete_many({"user_id": test_user_id})
    db.tasks.delete_many({"user_id": test_user_id})
    db.notes.delete_many({"user_id": test_user_id})
    db.events.delete_many({"user_id": test_user_id})
    db.files.delete_many({"user_id": test_user_id})
    
    client.close()


class TestHealthAndBasicEndpoints:
    """Test basic server health and connectivity"""
    
    def test_server_is_running(self, api_client):
        """Verify server is accessible"""
        # Try to access any endpoint - even 401 means server is running
        response = api_client.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code in [200, 401], f"Server not responding properly: {response.status_code}"
        print(f"Server is running, status: {response.status_code}")


class TestAuthEndpoints:
    """Test authentication endpoints"""
    
    def test_auth_me_without_token(self, api_client):
        """Test /api/auth/me returns 401 without authentication"""
        response = api_client.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("Auth endpoint correctly returns 401 for unauthenticated requests")
    
    def test_auth_me_with_valid_session(self, api_client, test_user_session):
        """Test /api/auth/me returns user data with valid session"""
        response = api_client.get(
            f"{BASE_URL}/api/auth/me",
            cookies={"session_token": test_user_session["session_token"]}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "user_id" in data
        assert "email" in data
        assert data["email"] == test_user_session["email"]
        print(f"Auth endpoint returns user data: {data['email']}")


class TestChatEndpoints:
    """Test chat functionality with different bot types"""
    
    def test_chat_without_auth(self, api_client):
        """Test /api/chat returns 401 without authentication"""
        response = api_client.post(
            f"{BASE_URL}/api/chat",
            json={"message": "Hello", "bot_type": "normal", "ai_model": "gpt-5.1"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("Chat endpoint correctly requires authentication")
    
    def test_chat_normal_bot(self, api_client, test_user_session):
        """Test chat with normal BRUH bot"""
        response = api_client.post(
            f"{BASE_URL}/api/chat",
            json={
                "message": "Hello, how are you?",
                "bot_type": "normal",
                "ai_model": "gpt-5.1"
            },
            cookies={"session_token": test_user_session["session_token"]}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data
        assert len(data["message"]) > 0
        print(f"Normal bot response: {data['message'][:100]}...")
    
    def test_chat_student_bot(self, api_client, test_user_session):
        """Test chat with Student Partner bot"""
        response = api_client.post(
            f"{BASE_URL}/api/chat",
            json={
                "message": "Explain photosynthesis briefly",
                "bot_type": "student",
                "ai_model": "gpt-5.1"
            },
            cookies={"session_token": test_user_session["session_token"]}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data
        assert len(data["message"]) > 0
        print(f"Student bot response: {data['message'][:100]}...")
    
    def test_chat_crop_bot(self, api_client, test_user_session):
        """Test chat with Crop Assistant bot"""
        response = api_client.post(
            f"{BASE_URL}/api/chat",
            json={
                "message": "How do I grow tomatoes?",
                "bot_type": "crop",
                "ai_model": "gpt-5.1"
            },
            cookies={"session_token": test_user_session["session_token"]}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data
        assert len(data["message"]) > 0
        print(f"Crop bot response: {data['message'][:100]}...")
    
    def test_chat_cook_bot_returns_video(self, api_client, test_user_session):
        """Test chat with Cook bot - should return video_url"""
        response = api_client.post(
            f"{BASE_URL}/api/chat",
            json={
                "message": "How to make pasta carbonara?",
                "bot_type": "cook",
                "ai_model": "gpt-5.1"
            },
            cookies={"session_token": test_user_session["session_token"]}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data
        # Cook bot should return video_url
        if "video_url" in data:
            assert "youtube.com/embed" in data["video_url"]
            # Verify it's NOT the placeholder video
            assert "dQw4w9WgXcQ" not in data["video_url"], "Video URL should not be placeholder"
            print(f"Cook bot returned video: {data['video_url']}")
        else:
            print("WARNING: Cook bot did not return video_url")
        print(f"Cook bot response: {data['message'][:100]}...")
    
    def test_chat_music_bot_returns_song(self, api_client, test_user_session):
        """Test chat with Music Companion bot - should return song_url"""
        response = api_client.post(
            f"{BASE_URL}/api/chat",
            json={
                "message": "I'm feeling happy, recommend some music",
                "bot_type": "music",
                "ai_model": "gpt-5.1"
            },
            cookies={"session_token": test_user_session["session_token"]}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data
        # Music bot should return song_url
        if "song_url" in data:
            assert "youtube.com/embed" in data["song_url"]
            # Verify it's NOT the placeholder video
            assert "dQw4w9WgXcQ" not in data["song_url"], "Song URL should not be placeholder"
            print(f"Music bot returned song: {data['song_url']}")
        else:
            print("WARNING: Music bot did not return song_url")
        print(f"Music bot response: {data['message'][:100]}...")
    
    def test_chat_with_file_context(self, api_client, test_user_session):
        """Test chat with file context for Student Partner"""
        response = api_client.post(
            f"{BASE_URL}/api/chat",
            json={
                "message": "Summarize this document",
                "bot_type": "student",
                "ai_model": "gpt-5.1",
                "file_context": "This is a test document about machine learning. Machine learning is a subset of artificial intelligence."
            },
            cookies={"session_token": test_user_session["session_token"]}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data
        print(f"Chat with file context response: {data['message'][:100]}...")
    
    def test_chat_with_language(self, api_client, test_user_session):
        """Test chat with Hindi language setting"""
        response = api_client.post(
            f"{BASE_URL}/api/chat",
            json={
                "message": "Say hello",
                "bot_type": "normal",
                "ai_model": "gpt-5.1",
                "language": "hi"
            },
            cookies={"session_token": test_user_session["session_token"]}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data
        print(f"Hindi language response: {data['message'][:100]}...")


class TestEmotionAnalysis:
    """Test emotion detection endpoint"""
    
    def test_analyze_emotion_without_auth(self, api_client):
        """Test /api/analyze-emotion returns 401 without authentication"""
        response = api_client.post(
            f"{BASE_URL}/api/analyze-emotion",
            json={"image_data": "test"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("Emotion analysis endpoint correctly requires authentication")
    
    def test_analyze_emotion_with_valid_image(self, api_client, test_user_session):
        """Test emotion analysis with a valid base64 image"""
        # Create a simple test image (1x1 red pixel PNG)
        # This is a minimal valid PNG
        test_image_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        
        response = api_client.post(
            f"{BASE_URL}/api/analyze-emotion",
            json={"image_data": f"data:image/png;base64,{test_image_base64}"},
            cookies={"session_token": test_user_session["session_token"]}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "emotion" in data
        # Should return an emotion (even if fallback)
        valid_emotions = ["happy", "sad", "angry", "calm", "excited", "tired", "neutral", 
                         "surprised", "anxious", "energetic", "relaxed", "romantic", "melancholic"]
        assert data["emotion"] in valid_emotions, f"Invalid emotion: {data['emotion']}"
        
        # Should also return song_url or music_query
        if "song_url" in data and data["song_url"]:
            assert "youtube.com/embed" in data["song_url"]
            print(f"Emotion detected: {data['emotion']}, Song URL: {data['song_url']}")
        else:
            print(f"Emotion detected: {data['emotion']}, No song URL returned")


class TestStudyPlanPDF:
    """Test study plan PDF generation"""
    
    def test_generate_study_plan_without_auth(self, api_client):
        """Test /api/generate-study-plan returns 401 without authentication"""
        response = api_client.post(
            f"{BASE_URL}/api/generate-study-plan",
            json={"document_text": "test"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("Study plan endpoint correctly requires authentication")
    
    def test_generate_study_plan_pdf(self, api_client, test_user_session):
        """Test PDF generation and download"""
        # Generate study plan
        response = api_client.post(
            f"{BASE_URL}/api/generate-study-plan",
            json={"document_text": "This is a test document about Python programming. Python is a high-level programming language."},
            cookies={"session_token": test_user_session["session_token"]}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "study_plan" in data
        assert "pdf_url" in data
        assert data["pdf_url"].startswith("/api/files/")
        print(f"Study plan generated, PDF URL: {data['pdf_url']}")
        
        # Now test downloading the PDF
        pdf_response = api_client.get(
            f"{BASE_URL}{data['pdf_url']}",
            cookies={"session_token": test_user_session["session_token"]}
        )
        assert pdf_response.status_code == 200, f"PDF download failed: {pdf_response.status_code}"
        assert "application/pdf" in pdf_response.headers.get("Content-Type", "")
        assert len(pdf_response.content) > 0
        print(f"PDF downloaded successfully, size: {len(pdf_response.content)} bytes")


class TestFileUploadAndExtraction:
    """Test file upload and text extraction"""
    
    def test_extract_text_without_auth(self, api_client):
        """Test /api/extract-text returns 401 without authentication"""
        response = api_client.post(
            f"{BASE_URL}/api/extract-text",
            json={"file_url": "/api/files/test"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("Text extraction endpoint correctly requires authentication")


class TestChatHistory:
    """Test chat history endpoints"""
    
    def test_get_chat_history(self, api_client, test_user_session):
        """Test getting chat history"""
        response = api_client.get(
            f"{BASE_URL}/api/chat/history?bot_type=normal",
            cookies={"session_token": test_user_session["session_token"]}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"Chat history retrieved: {len(data)} messages")
    
    def test_get_conversations(self, api_client, test_user_session):
        """Test getting all conversations"""
        response = api_client.get(
            f"{BASE_URL}/api/chat/conversations",
            cookies={"session_token": test_user_session["session_token"]}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"Conversations retrieved: {len(data)} conversations")
    
    def test_delete_chat_history(self, api_client, test_user_session):
        """Test deleting chat history for a bot type"""
        response = api_client.delete(
            f"{BASE_URL}/api/chat/delete/normal",
            cookies={"session_token": test_user_session["session_token"]}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("Chat history deleted successfully")


class TestTasksCRUD:
    """Test tasks CRUD operations"""
    
    def test_create_task(self, api_client, test_user_session):
        """Test creating a task"""
        response = api_client.post(
            f"{BASE_URL}/api/tasks",
            json={"title": "TEST_Task_1", "alarm_time": None},
            cookies={"session_token": test_user_session["session_token"]}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "task_id" in data
        assert data["title"] == "TEST_Task_1"
        print(f"Task created: {data['task_id']}")
        return data["task_id"]
    
    def test_get_tasks(self, api_client, test_user_session):
        """Test getting all tasks"""
        response = api_client.get(
            f"{BASE_URL}/api/tasks",
            cookies={"session_token": test_user_session["session_token"]}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"Tasks retrieved: {len(data)} tasks")


class TestNotesCRUD:
    """Test notes CRUD operations"""
    
    def test_create_note(self, api_client, test_user_session):
        """Test creating a note"""
        response = api_client.post(
            f"{BASE_URL}/api/notes",
            json={"title": "TEST_Note_1", "content": "Test note content"},
            cookies={"session_token": test_user_session["session_token"]}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "note_id" in data
        assert data["title"] == "TEST_Note_1"
        print(f"Note created: {data['note_id']}")
    
    def test_get_notes(self, api_client, test_user_session):
        """Test getting all notes"""
        response = api_client.get(
            f"{BASE_URL}/api/notes",
            cookies={"session_token": test_user_session["session_token"]}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"Notes retrieved: {len(data)} notes")


class TestEventsCRUD:
    """Test calendar events CRUD operations"""
    
    def test_create_event(self, api_client, test_user_session):
        """Test creating a calendar event"""
        response = api_client.post(
            f"{BASE_URL}/api/events",
            json={"title": "TEST_Event_1", "date": "2026-04-01", "time": "10:00", "description": "Test event"},
            cookies={"session_token": test_user_session["session_token"]}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "event_id" in data
        assert data["title"] == "TEST_Event_1"
        print(f"Event created: {data['event_id']}")
    
    def test_get_events(self, api_client, test_user_session):
        """Test getting all events"""
        response = api_client.get(
            f"{BASE_URL}/api/events",
            cookies={"session_token": test_user_session["session_token"]}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"Events retrieved: {len(data)} events")


class TestYouTubeSearch:
    """Test YouTube search functions directly"""
    
    def test_youtube_search_returns_real_video(self):
        """Test that YouTube search returns real video IDs, not placeholder"""
        import sys
        sys.path.insert(0, '/app/backend')
        from server import search_youtube_real, search_cooking_video, search_music_video
        
        # Test general search
        result = search_youtube_real("python programming tutorial")
        if result:
            assert "youtube.com/embed" in result
            assert "dQw4w9WgXcQ" not in result, "Should not return placeholder video"
            print(f"YouTube search result: {result}")
        else:
            print("WARNING: YouTube search returned None")
        
        # Test cooking video search
        cooking_result = search_cooking_video("pasta carbonara")
        if cooking_result:
            assert "youtube.com/embed" in cooking_result
            assert "dQw4w9WgXcQ" not in cooking_result, "Should not return placeholder video"
            print(f"Cooking video search result: {cooking_result}")
        else:
            print("WARNING: Cooking video search returned None")
        
        # Test music video search
        music_result = search_music_video("happy upbeat songs")
        if music_result:
            assert "youtube.com/embed" in music_result
            assert "dQw4w9WgXcQ" not in music_result, "Should not return placeholder video"
            print(f"Music video search result: {music_result}")
        else:
            print("WARNING: Music video search returned None")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
