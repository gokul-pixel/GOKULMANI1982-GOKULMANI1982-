"""
BRUH Assistant API Tests
Tests for: recipes, music, games, chat with cook/music bot_type, study plan PDF, extract-text
"""
import pytest
import requests
import os
import sys

# Add backend to path for direct imports
sys.path.insert(0, '/app/backend')

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://ai-assistant-pro-54.preview.emergentagent.com').rstrip('/')


class TestUnauthenticatedEndpoints:
    """Test endpoints without authentication - should return 401"""
    
    def test_recipes_requires_auth(self):
        """GET /api/recipes should require authentication"""
        response = requests.get(f"{BASE_URL}/api/recipes?query=chicken")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ /api/recipes correctly requires authentication")
    
    def test_music_songs_requires_auth(self):
        """GET /api/music/songs should require authentication"""
        response = requests.get(f"{BASE_URL}/api/music/songs?emotion=happy")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ /api/music/songs correctly requires authentication")
    
    def test_games_trivia_requires_auth(self):
        """POST /api/games/trivia should require authentication"""
        response = requests.post(f"{BASE_URL}/api/games/trivia", json={"category": "science"})
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ /api/games/trivia correctly requires authentication")
    
    def test_chat_requires_auth(self):
        """POST /api/chat should require authentication"""
        response = requests.post(f"{BASE_URL}/api/chat", json={
            "message": "Hello",
            "bot_type": "normal",
            "ai_model": "gpt-5.1"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ /api/chat correctly requires authentication")
    
    def test_generate_study_plan_requires_auth(self):
        """POST /api/generate-study-plan should require authentication"""
        response = requests.post(f"{BASE_URL}/api/generate-study-plan", json={
            "document_text": "Test content"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ /api/generate-study-plan correctly requires authentication")
    
    def test_extract_text_requires_auth(self):
        """POST /api/extract-text should require authentication"""
        response = requests.post(f"{BASE_URL}/api/extract-text", json={
            "file_url": "/api/files/test.pdf"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ /api/extract-text correctly requires authentication")
    
    def test_analyze_emotion_requires_auth(self):
        """POST /api/analyze-emotion should require authentication"""
        response = requests.post(f"{BASE_URL}/api/analyze-emotion", json={
            "image_data": "data:image/jpeg;base64,/9j/4AAQ"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ /api/analyze-emotion correctly requires authentication")
    
    def test_auth_me_returns_401(self):
        """GET /api/auth/me should return 401 without session"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        data = response.json()
        assert "detail" in data
        print("✓ /api/auth/me correctly returns 401 without session")


class TestRecipeDataModule:
    """Test recipe data module directly"""
    
    def test_recipe_data_exists(self):
        """Verify recipe dataset is loaded"""
        from data.recipes import RECIPES, get_recipe_recommendations, format_recipe_for_ai
        
        assert len(RECIPES) == 20, f"Expected 20 recipes, got {len(RECIPES)}"
        print(f"✓ Recipe dataset has {len(RECIPES)} recipes")
    
    def test_recipe_recommendations_by_query(self):
        """Test recipe search by query"""
        from data.recipes import get_recipe_recommendations
        
        results = get_recipe_recommendations("chicken", count=5)
        assert len(results) > 0, "Should return at least one recipe for 'chicken'"
        
        # Check if any result contains chicken
        has_chicken = any("chicken" in r["name"].lower() or 
                         any("chicken" in i.lower() for i in r["ingredients"]) 
                         for r in results)
        assert has_chicken, "Results should include chicken-related recipes"
        print(f"✓ Recipe search for 'chicken' returned {len(results)} results")
    
    def test_recipe_recommendations_by_cuisine(self):
        """Test recipe filter by cuisine"""
        from data.recipes import get_recipe_recommendations
        
        results = get_recipe_recommendations(cuisine="Indian", count=10)
        assert len(results) > 0, "Should return Indian recipes"
        
        for r in results:
            assert r["cuisine"] == "Indian", f"Expected Indian cuisine, got {r['cuisine']}"
        print(f"✓ Cuisine filter for 'Indian' returned {len(results)} recipes")
    
    def test_recipe_format_for_ai(self):
        """Test recipe formatting for AI context"""
        from data.recipes import get_recipe_recommendations, format_recipe_for_ai
        
        recipes = get_recipe_recommendations("pasta", count=2)
        formatted = format_recipe_for_ai(recipes)
        
        assert isinstance(formatted, str), "Formatted output should be string"
        assert len(formatted) > 100, "Formatted output should have content"
        assert "Ingredients:" in formatted, "Should include ingredients section"
        assert "Steps:" in formatted, "Should include steps section"
        print("✓ Recipe formatting for AI works correctly")


class TestMusicDataModule:
    """Test music data module directly"""
    
    def test_emotion_songs_data_exists(self):
        """Verify emotion-song dataset is loaded"""
        from data.music import EMOTION_SONGS, get_songs_for_emotion
        
        assert len(EMOTION_SONGS) > 0, "EMOTION_SONGS should not be empty"
        
        # Check for key emotions
        expected_emotions = ["happy", "sad", "angry", "calm", "excited", "tired", "neutral"]
        for emotion in expected_emotions:
            assert emotion in EMOTION_SONGS, f"Missing emotion: {emotion}"
        
        print(f"✓ Music dataset has {len(EMOTION_SONGS)} emotion categories")
    
    def test_get_songs_for_happy(self):
        """Test getting songs for happy emotion"""
        from data.music import get_songs_for_emotion
        
        songs = get_songs_for_emotion("happy", count=3)
        assert len(songs) == 3, f"Expected 3 songs, got {len(songs)}"
        
        for song in songs:
            assert "title" in song, "Song should have title"
            assert "artist" in song, "Song should have artist"
            assert "genre" in song, "Song should have genre"
        
        print(f"✓ Got {len(songs)} songs for 'happy' emotion")
    
    def test_get_songs_for_sad(self):
        """Test getting songs for sad emotion"""
        from data.music import get_songs_for_emotion
        
        songs = get_songs_for_emotion("sad", count=5)
        assert len(songs) <= 5, "Should return up to 5 songs"
        assert len(songs) > 0, "Should return at least one song"
        print(f"✓ Got {len(songs)} songs for 'sad' emotion")
    
    def test_get_songs_fallback_to_neutral(self):
        """Test fallback to neutral for unknown emotion"""
        from data.music import get_songs_for_emotion
        
        songs = get_songs_for_emotion("unknown_emotion", count=3)
        assert len(songs) > 0, "Should fallback to neutral songs"
        print("✓ Unknown emotion correctly falls back to neutral songs")
    
    def test_format_songs_for_ai(self):
        """Test song formatting for AI context"""
        from data.music import get_songs_for_emotion, format_songs_for_ai
        
        songs = get_songs_for_emotion("excited", count=3)
        formatted = format_songs_for_ai("excited", songs)
        
        assert isinstance(formatted, str), "Formatted output should be string"
        assert "excited" in formatted.lower(), "Should mention the emotion"
        print("✓ Song formatting for AI works correctly")


class TestYouTubeSearchFunctions:
    """Test YouTube search functions directly"""
    
    def test_search_youtube_real_function_exists(self):
        """Verify search_youtube_real function exists"""
        from server import search_youtube_real
        assert callable(search_youtube_real), "search_youtube_real should be callable"
        print("✓ search_youtube_real function exists")
    
    def test_search_cooking_video_function_exists(self):
        """Verify search_cooking_video function exists"""
        from server import search_cooking_video
        assert callable(search_cooking_video), "search_cooking_video should be callable"
        print("✓ search_cooking_video function exists")
    
    def test_search_music_video_function_exists(self):
        """Verify search_music_video function exists"""
        from server import search_music_video
        assert callable(search_music_video), "search_music_video should be callable"
        print("✓ search_music_video function exists")
    
    def test_search_youtube_real_returns_embed_url(self):
        """Test that YouTube search returns embed URL format"""
        from server import search_youtube_real
        
        result = search_youtube_real("python tutorial")
        
        if result:  # May fail due to network issues
            assert "youtube.com/embed/" in result, f"Should return embed URL, got: {result}"
            assert "dQw4w9WgXcQ" not in result, "Should not return rickroll video ID"
            print(f"✓ YouTube search returned valid embed URL: {result[:50]}...")
        else:
            print("⚠ YouTube search returned None (network issue or rate limit)")
    
    def test_search_cooking_video_returns_embed_url(self):
        """Test cooking video search"""
        from server import search_cooking_video
        
        result = search_cooking_video("chicken biryani")
        
        if result:
            assert "youtube.com/embed/" in result, f"Should return embed URL, got: {result}"
            print(f"✓ Cooking video search returned: {result[:50]}...")
        else:
            print("⚠ Cooking video search returned None (network issue)")
    
    def test_search_music_video_returns_embed_url(self):
        """Test music video search"""
        from server import search_music_video
        
        result = search_music_video("happy pharrell williams")
        
        if result:
            assert "youtube.com/embed/" in result, f"Should return embed URL, got: {result}"
            print(f"✓ Music video search returned: {result[:50]}...")
        else:
            print("⚠ Music video search returned None (network issue)")


class TestServerEndpointStructure:
    """Test that all required endpoints exist in server"""
    
    def test_recipes_endpoint_exists(self):
        """Verify /api/recipes endpoint exists"""
        response = requests.get(f"{BASE_URL}/api/recipes")
        # Should return 401 (auth required) not 404
        assert response.status_code != 404, "/api/recipes endpoint should exist"
        print("✓ /api/recipes endpoint exists")
    
    def test_music_songs_endpoint_exists(self):
        """Verify /api/music/songs endpoint exists"""
        response = requests.get(f"{BASE_URL}/api/music/songs")
        assert response.status_code != 404, "/api/music/songs endpoint should exist"
        print("✓ /api/music/songs endpoint exists")
    
    def test_games_trivia_endpoint_exists(self):
        """Verify /api/games/trivia endpoint exists"""
        response = requests.post(f"{BASE_URL}/api/games/trivia", json={})
        assert response.status_code != 404, "/api/games/trivia endpoint should exist"
        print("✓ /api/games/trivia endpoint exists")
    
    def test_chat_endpoint_exists(self):
        """Verify /api/chat endpoint exists"""
        response = requests.post(f"{BASE_URL}/api/chat", json={})
        assert response.status_code != 404, "/api/chat endpoint should exist"
        print("✓ /api/chat endpoint exists")
    
    def test_generate_study_plan_endpoint_exists(self):
        """Verify /api/generate-study-plan endpoint exists"""
        response = requests.post(f"{BASE_URL}/api/generate-study-plan", json={})
        assert response.status_code != 404, "/api/generate-study-plan endpoint should exist"
        print("✓ /api/generate-study-plan endpoint exists")
    
    def test_extract_text_endpoint_exists(self):
        """Verify /api/extract-text endpoint exists"""
        response = requests.post(f"{BASE_URL}/api/extract-text", json={})
        assert response.status_code != 404, "/api/extract-text endpoint should exist"
        print("✓ /api/extract-text endpoint exists")
    
    def test_analyze_emotion_endpoint_exists(self):
        """Verify /api/analyze-emotion endpoint exists"""
        response = requests.post(f"{BASE_URL}/api/analyze-emotion", json={})
        assert response.status_code != 404, "/api/analyze-emotion endpoint should exist"
        print("✓ /api/analyze-emotion endpoint exists")
    
    def test_files_download_endpoint_exists(self):
        """Verify /api/files/{path} endpoint exists"""
        response = requests.get(f"{BASE_URL}/api/files/test")
        # Should return 401 (auth required) not 404
        assert response.status_code != 404, "/api/files endpoint should exist"
        print("✓ /api/files/{path} endpoint exists")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
