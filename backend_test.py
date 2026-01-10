#!/usr/bin/env python3
"""
AudioForge Backend API Test Suite
Tests all CRUD operations for presets, logs, and recordings endpoints
"""

import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, List

class AudioForgeAPITester:
    def __init__(self, base_url="https://frequency-tuner-2.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name: str, success: bool, details: Dict[str, Any] = None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
        
        result = {
            "test_name": name,
            "success": success,
            "details": details or {}
        }
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {name}")
        if details and not success:
            print(f"    Details: {details}")

    def run_test(self, name: str, method: str, endpoint: str, expected_status: int, 
                 data: Dict = None, headers: Dict = None) -> tuple:
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = headers or {'Content-Type': 'application/json'}
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)
            else:
                raise ValueError(f"Unsupported method: {method}")

            success = response.status_code == expected_status
            response_data = {}
            
            try:
                response_data = response.json()
            except:
                response_data = {"raw_response": response.text}

            details = {
                "method": method,
                "url": url,
                "expected_status": expected_status,
                "actual_status": response.status_code,
                "response": response_data
            }
            
            self.log_test(name, success, details)
            return success, response_data, response.status_code

        except Exception as e:
            details = {
                "method": method,
                "url": url,
                "error": str(e)
            }
            self.log_test(name, False, details)
            return False, {}, 0

    def test_health_endpoints(self):
        """Test basic health and root endpoints"""
        print("\n🔍 Testing Health Endpoints...")
        
        # Test root endpoint
        self.run_test("Root Endpoint", "GET", "", 200)
        
        # Test health check
        self.run_test("Health Check", "GET", "health", 200)

    def test_presets_crud(self):
        """Test complete CRUD operations for presets"""
        print("\n🔍 Testing Presets CRUD Operations...")
        
        # Test GET empty presets
        success, presets, _ = self.run_test("Get Empty Presets", "GET", "presets", 200)
        
        # Test CREATE preset
        test_preset = {
            "name": "Test Preset",
            "description": "Test preset for API testing",
            "equalizer": {
                "band_60hz": 2.5,
                "band_230hz": -1.0,
                "band_910hz": 3.0,
                "band_3600hz": -2.0,
                "band_14000hz": 1.5
            },
            "advanced": {
                "noise_reduction": 25.0,
                "voice_isolation": 50.0,
                "gain": 2.0,
                "highpass_enabled": True,
                "highpass_frequency": 100.0,
                "lowpass_enabled": False,
                "lowpass_frequency": 15000.0
            }
        }
        
        success, created_preset, _ = self.run_test("Create Preset", "POST", "presets", 200, test_preset)
        
        if success and 'id' in created_preset:
            preset_id = created_preset['id']
            
            # Test GET specific preset
            self.run_test("Get Specific Preset", "GET", f"presets/{preset_id}", 200)
            
            # Test UPDATE preset
            updated_preset = test_preset.copy()
            updated_preset['name'] = "Updated Test Preset"
            updated_preset['equalizer']['band_60hz'] = 5.0
            
            self.run_test("Update Preset", "PUT", f"presets/{preset_id}", 200, updated_preset)
            
            # Test GET all presets (should have our preset)
            self.run_test("Get All Presets", "GET", "presets", 200)
            
            # Test DELETE preset
            self.run_test("Delete Preset", "DELETE", f"presets/{preset_id}", 200)
            
            # Test GET deleted preset (should fail)
            self.run_test("Get Deleted Preset", "GET", f"presets/{preset_id}", 404)
        else:
            print("❌ Skipping preset-dependent tests due to creation failure")

    def test_logs_operations(self):
        """Test logs endpoints"""
        print("\n🔍 Testing Logs Operations...")
        
        # Test CREATE log entry
        test_log = {
            "level": "info",
            "message": "Test log entry from API test",
            "details": {
                "test_run": True,
                "timestamp": datetime.now().isoformat()
            }
        }
        
        self.run_test("Create Log Entry", "POST", "logs", 200, test_log)
        
        # Test GET logs
        self.run_test("Get Logs", "GET", "logs", 200)
        
        # Test GET logs with limit
        self.run_test("Get Logs with Limit", "GET", "logs?limit=10", 200)
        
        # Test CLEAR logs
        self.run_test("Clear Logs", "DELETE", "logs", 200)

    def test_recordings_operations(self):
        """Test recordings metadata endpoints"""
        print("\n🔍 Testing Recordings Operations...")
        
        # Test CREATE recording metadata
        test_recording = {
            "filename": "test-recording-001.wav",
            "format": "wav",
            "duration_seconds": 45.5,
            "file_size_bytes": 1024000,
            "preset_used": "Test Preset"
        }
        
        self.run_test("Create Recording Metadata", "POST", "recordings", 200, test_recording)
        
        # Test GET recordings
        self.run_test("Get Recordings", "GET", "recordings", 200)
        
        # Test GET recordings with limit
        self.run_test("Get Recordings with Limit", "GET", "recordings?limit=5", 200)

    def test_auth_endpoints(self):
        """Test authentication endpoints"""
        print("\n🔍 Testing Authentication Endpoints...")
        
        # Test GET /api/auth/me without authentication (should return 401)
        self.run_test("Auth Me - Unauthenticated", "GET", "auth/me", 401)
        
        # Test POST /api/auth/logout without session (should still work)
        self.run_test("Logout - No Session", "POST", "auth/logout", 200)
        
        # Test POST /api/auth/session with invalid session_id
        invalid_session_data = {"session_id": "invalid-session-id"}
        self.run_test("Auth Session - Invalid ID", "POST", "auth/session", 401, invalid_session_data)
        
        # Test POST /api/auth/session without session_id
        empty_session_data = {}
        self.run_test("Auth Session - Missing ID", "POST", "auth/session", 400, empty_session_data)

    def test_recordings_guest_mode(self):
        """Test recordings work for guest users (no authentication)"""
        print("\n🔍 Testing Recordings in Guest Mode...")
        
        # Test CREATE recording metadata as guest
        test_recording = {
            "filename": "guest-recording-001.wav",
            "format": "wav", 
            "duration_seconds": 30.0,
            "file_size_bytes": 512000,
            "preset_used": "Guest Preset",
            "notes": "Test recording from guest user"
        }
        
        success, created_recording, _ = self.run_test("Create Guest Recording", "POST", "recordings", 200, test_recording)
        
        # Test GET recordings as guest (should return guest recordings)
        self.run_test("Get Guest Recordings", "GET", "recordings", 200)
        
        # Verify the recording was created without user_id (guest mode)
        if success and 'user_id' in created_recording:
            if created_recording['user_id'] is None:
                print("✅ Recording correctly created without user_id (guest mode)")
            else:
                print(f"⚠️ Recording has user_id: {created_recording['user_id']} (unexpected for guest)")

    def test_error_cases(self):
        """Test error handling"""
        print("\n🔍 Testing Error Cases...")
        
        # Test invalid preset creation (missing required fields)
        invalid_preset = {"description": "Missing name field"}
        self.run_test("Invalid Preset Creation", "POST", "presets", 422, invalid_preset)
        
        # Test non-existent preset
        self.run_test("Non-existent Preset", "GET", "presets/non-existent-id", 404)
        
        # Test invalid EQ values (out of range)
        invalid_eq_preset = {
            "name": "Invalid EQ",
            "equalizer": {
                "band_60hz": 50.0  # Should be between -12 and 12
            }
        }
        self.run_test("Invalid EQ Values", "POST", "presets", 422, invalid_eq_preset)

    def run_all_tests(self):
        """Run complete test suite"""
        print("🚀 Starting AudioForge Backend API Tests")
        print(f"📡 Testing against: {self.base_url}")
        print("=" * 60)
        
        try:
            self.test_health_endpoints()
            self.test_presets_crud()
            self.test_logs_operations()
            self.test_recordings_operations()
            self.test_error_cases()
            
        except KeyboardInterrupt:
            print("\n⚠️ Tests interrupted by user")
        except Exception as e:
            print(f"\n💥 Unexpected error during testing: {e}")
        
        # Print summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%" if self.tests_run > 0 else "0%")
        
        # Show failed tests
        failed_tests = [t for t in self.test_results if not t['success']]
        if failed_tests:
            print(f"\n❌ Failed Tests ({len(failed_tests)}):")
            for test in failed_tests:
                print(f"  - {test['test_name']}")
                if 'error' in test['details']:
                    print(f"    Error: {test['details']['error']}")
                elif 'actual_status' in test['details']:
                    print(f"    Expected: {test['details']['expected_status']}, Got: {test['details']['actual_status']}")
        
        return self.tests_passed == self.tests_run

def main():
    """Main test runner"""
    tester = AudioForgeAPITester()
    success = tester.run_all_tests()
    
    # Save detailed results
    results_file = "/app/test_reports/backend_api_results.json"
    with open(results_file, 'w') as f:
        json.dump({
            "timestamp": datetime.now().isoformat(),
            "total_tests": tester.tests_run,
            "passed_tests": tester.tests_passed,
            "success_rate": (tester.tests_passed/tester.tests_run*100) if tester.tests_run > 0 else 0,
            "test_results": tester.test_results
        }, f, indent=2)
    
    print(f"\n📄 Detailed results saved to: {results_file}")
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())