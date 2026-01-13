#!/usr/bin/env python3

import requests
import sys
import json
import os
from datetime import datetime

class SwapFlowAPITester:
    def __init__(self, base_url=None):
        # Update this with your backend URL or set via environment variable
        if base_url is None:
            base_url = os.environ.get("BACKEND_URL", "http://localhost:8000/api")
        self.base_url = base_url
        self.session_token1 = "test_session_1768106897885"  # Test User 1
        self.user_id1 = "test-user-1768106897885"
        self.session_token2 = "test_session2_1768106897885"  # Test User 2
        self.user_id2 = "test-user2-1768106897885"
        self.tests_run = 0
        self.tests_passed = 0
        self.created_item_id = None
        self.created_trade_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, token=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json()
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    print(f"   Response: {response.json()}")
                except:
                    print(f"   Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_auth_endpoints(self):
        """Test authentication endpoints"""
        print("\n=== TESTING AUTHENTICATION ===")
        
        # Test /auth/me with valid token
        success, response = self.run_test(
            "Get current user (User 1)",
            "GET",
            "auth/me",
            200,
            token=self.session_token1
        )
        if success:
            print(f"   User: {response.get('name')} ({response.get('user_id')})")
        
        # Test /auth/me with second user
        success, response = self.run_test(
            "Get current user (User 2)",
            "GET",
            "auth/me",
            200,
            token=self.session_token2
        )
        if success:
            print(f"   User: {response.get('name')} ({response.get('user_id')})")
        
        # Test /auth/me without token
        self.run_test(
            "Get current user (no token)",
            "GET",
            "auth/me",
            401
        )

    def test_user_endpoints(self):
        """Test user management endpoints"""
        print("\n=== TESTING USER ENDPOINTS ===")
        
        # Get user by ID
        success, response = self.run_test(
            "Get user by ID",
            "GET",
            f"users/{self.user_id1}",
            200
        )
        if success:
            print(f"   User: {response.get('name')} - Trade Points: {response.get('trade_points')}")
        
        # Update profile
        success, response = self.run_test(
            "Update profile username",
            "PUT",
            "users/profile",
            200,
            data={"username": f"updated_user_{int(datetime.now().timestamp())}"},
            token=self.session_token1
        )
        if success:
            print(f"   Updated username: {response.get('username')}")

    def test_category_endpoints(self):
        """Test category endpoints"""
        print("\n=== TESTING CATEGORY ENDPOINTS ===")
        
        # Get categories
        success, response = self.run_test(
            "Get categories",
            "GET",
            "categories",
            200
        )
        if success:
            print(f"   Found {len(response)} categories")

    def test_item_endpoints(self):
        """Test item management endpoints"""
        print("\n=== TESTING ITEM ENDPOINTS ===")
        
        # Create an item
        item_data = {
            "title": f"Test Item {int(datetime.now().timestamp())}",
            "description": "This is a test item for trading",
            "category": "electronics",
            "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
        }
        
        success, response = self.run_test(
            "Create item",
            "POST",
            "items",
            200,
            data=item_data,
            token=self.session_token1
        )
        if success:
            self.created_item_id = response.get('item_id')
            print(f"   Created item: {response.get('title')} (ID: {self.created_item_id})")
        
        # Get all items
        success, response = self.run_test(
            "Get all items",
            "GET",
            "items",
            200
        )
        if success:
            print(f"   Found {len(response)} items")
        
        # Get items by category
        success, response = self.run_test(
            "Get items by category",
            "GET",
            "items?category=electronics",
            200
        )
        if success:
            print(f"   Found {len(response)} electronics items")
        
        # Get specific item
        if self.created_item_id:
            success, response = self.run_test(
                "Get item by ID",
                "GET",
                f"items/{self.created_item_id}",
                200
            )
            if success:
                print(f"   Item: {response.get('item', {}).get('title')}")
        
        # Get my items
        success, response = self.run_test(
            "Get my items",
            "GET",
            "my-items",
            200,
            token=self.session_token1
        )
        if success:
            print(f"   User has {len(response)} items")

    def test_message_endpoints(self):
        """Test messaging endpoints"""
        print("\n=== TESTING MESSAGE ENDPOINTS ===")
        
        # Send message from user1 to user2
        message_data = {
            "receiver_id": self.user_id2,
            "content": f"Test message at {datetime.now()}",
            "item_id": self.created_item_id
        }
        
        success, response = self.run_test(
            "Send message",
            "POST",
            "messages",
            200,
            data=message_data,
            token=self.session_token1
        )
        if success:
            print(f"   Message sent: {response.get('content')}")
        
        # Get conversations for user2
        success, response = self.run_test(
            "Get conversations",
            "GET",
            "conversations",
            200,
            token=self.session_token2
        )
        if success:
            print(f"   User2 has {len(response)} conversations")
        
        # Get messages between users
        success, response = self.run_test(
            "Get messages with user",
            "GET",
            f"messages/{self.user_id1}",
            200,
            token=self.session_token2
        )
        if success:
            print(f"   Found {len(response)} messages between users")

    def test_trade_endpoints(self):
        """Test trade management endpoints"""
        print("\n=== TESTING TRADE ENDPOINTS ===")
        
        if not self.created_item_id:
            print("❌ No item available for trade testing")
            return
        
        # Create trade (user2 wants to trade for user1's item)
        trade_data = {
            "item_id": self.created_item_id,
            "owner_id": self.user_id1
        }
        
        success, response = self.run_test(
            "Create trade",
            "POST",
            "trades",
            200,
            data=trade_data,
            token=self.session_token2
        )
        if success:
            self.created_trade_id = response.get('trade_id')
            print(f"   Trade created: {self.created_trade_id}")
        
        # Get my trades (user2)
        success, response = self.run_test(
            "Get my trades (trader)",
            "GET",
            "trades",
            200,
            token=self.session_token2
        )
        if success:
            print(f"   User2 has {len(response)} trades")
        
        # Get my trades (user1 - owner)
        success, response = self.run_test(
            "Get my trades (owner)",
            "GET",
            "trades",
            200,
            token=self.session_token1
        )
        if success:
            print(f"   User1 has {len(response)} trades")
        
        if self.created_trade_id:
            # Get specific trade
            success, response = self.run_test(
                "Get trade by ID",
                "GET",
                f"trades/{self.created_trade_id}",
                200,
                token=self.session_token1
            )
            if success:
                print(f"   Trade status - Owner confirmed: {response.get('trade', {}).get('owner_confirmed')}")
            
            # Confirm trade (owner)
            success, response = self.run_test(
                "Confirm trade (owner)",
                "POST",
                f"trades/{self.created_trade_id}/confirm",
                200,
                token=self.session_token1
            )
            if success:
                print(f"   Owner confirmed trade")
            
            # Confirm trade (trader) - this should complete the trade
            success, response = self.run_test(
                "Confirm trade (trader)",
                "POST",
                f"trades/{self.created_trade_id}/confirm",
                200,
                token=self.session_token2
            )
            if success:
                print(f"   Trader confirmed - Trade completed: {response.get('is_completed')}")
            
            # Rate the trade (user1 rates user2)
            success, response = self.run_test(
                "Rate trade (owner rates trader)",
                "POST",
                f"trades/{self.created_trade_id}/rate",
                200,
                data={"rating": 5},
                token=self.session_token1
            )
            if success:
                print(f"   Owner rated trader: 5 stars")
            
            # Rate the trade (user2 rates user1)
            success, response = self.run_test(
                "Rate trade (trader rates owner)",
                "POST",
                f"trades/{self.created_trade_id}/rate",
                200,
                data={"rating": 4},
                token=self.session_token2
            )
            if success:
                print(f"   Trader rated owner: 4 stars")

    def test_file_upload(self):
        """Test file upload endpoint"""
        print("\n=== TESTING FILE UPLOAD ===")
        
        # Test upload endpoint (simplified - just test the endpoint exists)
        # Note: This would normally require multipart/form-data
        success, response = self.run_test(
            "Upload endpoint (without file)",
            "POST",
            "upload",
            400,  # Should fail without proper file
            token=self.session_token1
        )
        # This is expected to fail, just testing the endpoint exists

def main():
    print("🚀 Starting SwapFlow API Tests")
    print("=" * 50)
    
    tester = SwapFlowAPITester()
    
    # Run all test suites
    tester.test_auth_endpoints()
    tester.test_user_endpoints()
    tester.test_category_endpoints()
    tester.test_item_endpoints()
    tester.test_message_endpoints()
    tester.test_trade_endpoints()
    tester.test_file_upload()
    
    # Print final results
    print("\n" + "=" * 50)
    print(f"📊 FINAL RESULTS")
    print(f"Tests passed: {tester.tests_passed}/{tester.tests_run}")
    success_rate = (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0
    print(f"Success rate: {success_rate:.1f}%")
    
    if success_rate >= 80:
        print("🎉 Backend API tests mostly successful!")
        return 0
    else:
        print("⚠️  Backend API has significant issues")
        return 1

if __name__ == "__main__":
    sys.exit(main())