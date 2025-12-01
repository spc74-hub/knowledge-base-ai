#!/usr/bin/env python3
"""
Test Supabase connection.
"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv(Path(__file__).parent.parent / "backend" / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: SUPABASE_URL or SUPABASE_KEY not found in environment")
    sys.exit(1)


def test_connection():
    """Test basic Supabase connection."""
    from supabase import create_client

    print("Testing Supabase connection...")
    print(f"URL: {SUPABASE_URL}")

    try:
        client = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("Supabase client created successfully!")
        return True, client
    except Exception as e:
        print(f"Error creating client: {e}")
        return False, None


def test_tables(client):
    """Test that tables exist."""
    print("\nTesting table access...")

    tables = ['contents', 'chat_sessions', 'chat_messages', 'processing_queue', 'user_preferences', 'saved_searches']
    results = []

    for table in tables:
        try:
            # Try to select from table (will return empty if no data, error if table doesn't exist)
            response = client.table(table).select("*").limit(1).execute()
            print(f"  ✓ Table '{table}' exists")
            results.append(True)
        except Exception as e:
            print(f"  ✗ Table '{table}' error: {e}")
            results.append(False)

    return all(results)


def main():
    print("=" * 60)
    print("Supabase Connection Test")
    print("=" * 60 + "\n")

    success, client = test_connection()
    if not success:
        return 1

    tables_ok = test_tables(client)

    print("\n" + "=" * 60)
    print("Test Results:")
    print("=" * 60)
    print(f"Connection: {'PASS' if success else 'FAIL'}")
    print(f"Tables: {'PASS' if tables_ok else 'FAIL'}")

    if success and tables_ok:
        print("\nSupabase is configured correctly!")
        return 0
    else:
        print("\nSome tests failed. Check your Supabase configuration.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
