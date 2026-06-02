#!/usr/bin/env python3
"""Test script to verify database integration"""

import requests
import json
import time

# Test the analytics endpoint
def test_analytics():
    try:
        response = requests.get('http://localhost:5000/api/analytics/overview')
        print(f"Analytics endpoint status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Analytics data: {json.dumps(data, indent=2)}")
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Error testing analytics: {e}")

# Test the scan history endpoint
def test_scan_history():
    try:
        response = requests.get('http://localhost:5000/api/scans')
        print(f"Scan history endpoint status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Scan history: {json.dumps(data, indent=2)}")
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Error testing scan history: {e}")

# Test a simple scan to see if it gets saved
def test_scan():
    try:
        # Test data
        test_code = """
def test_function():
    password = "123456"  # Hard-coded password
    return password
"""
        
        response = requests.post('http://localhost:5000/api/scan', 
                               json={'code': test_code, 'type': 'code'})
        print(f"Scan endpoint status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Scan completed. Score: {data.get('overall_score', 'N/A')}")
            print(f"Issues found: {len(data.get('issues', []))}")
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Error testing scan: {e}")

if __name__ == "__main__":
    print("Testing Database Integration...")
    print("=" * 50)
    
    print("\n1. Testing Analytics Endpoint:")
    test_analytics()
    
    print("\n2. Testing Scan History Endpoint:")
    test_scan_history()
    
    print("\n3. Testing Scan Endpoint:")
    test_scan()
    
    # Wait a moment then check if the scan was saved
    print("\n4. Checking if scan was saved:")
    time.sleep(2)
    test_scan_history()
    
    print("\n5. Final Analytics Check:")
    test_analytics()