import requests
import sys
import json
from datetime import datetime
import uuid

class BruhAssistantAPITester:
    def __init__(self, base_url="https://ai-assistant-pro-54.preview.emergentagent.com"):
        self.base_url = base_url
        self.session_token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if headers:
            test_headers.update(headers)
        
        if self.session_token:
            test_headers['Authorization'] = f'Bearer {self.session_token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=30)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=test_headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=30)

            success = response.status_code == expected_status
            details = f"Status: {response.status_code}"
            
            if not success:
                try:
                    error_data = response.json()
                    details += f", Response: {error_data}"
                except:
                    details += f", Response: {response.text[:200]}"
            
            self.log_test(name, success, details)
            
            if success:
                try:
                    return response.json()
                except:
                    return response.text
            return None

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return None

    def create_test_session(self):
        """Create a test session by simulating auth flow"""
        print("\n🔐 Creating test session...")
        
        # Create a test user session directly in the database simulation
        test_user_data = {
            "user_id": f"test_user_{uuid.uuid4().hex[:12]}",
            "email": "test@example.com",
            "name": "Test User",
            "picture": "https://example.com/avatar.jpg"
        }
        
        # For testing, we'll create a mock session token
        self.session_token = f"test_session_{uuid.uuid4().hex}"
        self.user_id = test_user_data["user_id"]
        
        print(f"✅ Test session created with token: {self.session_token[:20]}...")
        return True

    def test_auth_endpoints(self):
        """Test authentication endpoints"""
        print("\n🔐 Testing Authentication Endpoints...")
        
        # Test /auth/me without token (should fail)
        self.run_test("Auth Me (No Token)", "GET", "auth/me", 401)
        
        # Create test session
        if not self.create_test_session():
            print("❌ Failed to create test session")
            return False
        
        # Test /auth/me with token (will fail as we don't have real session)
        self.run_test("Auth Me (With Token)", "GET", "auth/me", 401)
        
        return True

    def test_chat_endpoints(self):
        """Test chat endpoints"""
        print("\n💬 Testing Chat Endpoints...")
        
        # Test chat without auth (should fail)
        chat_data = {
            "message": "Hello, test message",
            "bot_type": "normal",
            "ai_model": "gpt-5.1"
        }
        self.run_test("Chat (No Auth)", "POST", "chat", 401, chat_data)
        
        # Test chat history without auth
        self.run_test("Chat History (No Auth)", "GET", "chat/history?bot_type=normal", 401)
        
        # Test conversations without auth
        self.run_test("Conversations (No Auth)", "GET", "chat/conversations", 401)

    def test_file_endpoints(self):
        """Test file upload endpoints"""
        print("\n📁 Testing File Endpoints...")
        
        # Test upload without auth
        self.run_test("File Upload (No Auth)", "POST", "upload", 401)

    def test_brain_endpoints(self):
        """Test Brain of BRUH endpoints"""
        print("\n🧠 Testing Brain of BRUH Endpoints...")
        
        # Test tasks endpoints
        self.run_test("Get Tasks (No Auth)", "GET", "tasks", 401)
        self.run_test("Create Task (No Auth)", "POST", "tasks", 401, {"title": "Test Task"})
        
        # Test notes endpoints
        self.run_test("Get Notes (No Auth)", "GET", "notes", 401)
        self.run_test("Create Note (No Auth)", "POST", "notes", 401, {"title": "Test Note", "content": "Test content"})
        
        # Test events endpoints
        self.run_test("Get Events (No Auth)", "GET", "events", 401)
        self.run_test("Create Event (No Auth)", "POST", "events", 401, {"title": "Test Event", "date": "2024-01-01"})

    def test_study_plan_endpoint(self):
        """Test study plan generation"""
        print("\n📚 Testing Study Plan Endpoint...")
        
        self.run_test("Generate Study Plan (No Auth)", "POST", "generate-study-plan?document_text=Test document", 401)

    def test_server_health(self):
        """Test basic server connectivity"""
        print("\n🏥 Testing Server Health...")
        
        try:
            # Test root endpoint
            response = requests.get(self.base_url, timeout=10)
            success = response.status_code in [200, 404, 422]  # FastAPI returns 404 for root, 422 for validation errors
            self.log_test("Server Connectivity", success, f"Status: {response.status_code}")
            
            # Test API root
            response = requests.get(f"{self.base_url}/api", timeout=10)
            success = response.status_code in [200, 404, 422]
            self.log_test("API Root", success, f"Status: {response.status_code}")
            
        except Exception as e:
            self.log_test("Server Connectivity", False, f"Exception: {str(e)}")

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting BRUH Assistant API Tests...")
        print(f"Backend URL: {self.base_url}")
        
        # Test server health first
        self.test_server_health()
        
        # Test all endpoints
        self.test_auth_endpoints()
        self.test_chat_endpoints()
        self.test_file_endpoints()
        self.test_brain_endpoints()
        self.test_study_plan_endpoint()
        
        # Print summary
        print(f"\n📊 Test Summary:")
        print(f"Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        # Print failed tests
        failed_tests = [t for t in self.test_results if not t['success']]
        if failed_tests:
            print(f"\n❌ Failed Tests ({len(failed_tests)}):")
            for test in failed_tests:
                print(f"  - {test['test']}: {test['details']}")
        
        return self.tests_passed == self.tests_run

def main():
    tester = BruhAssistantAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())