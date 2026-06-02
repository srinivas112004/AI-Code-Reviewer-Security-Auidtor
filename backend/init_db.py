#!/usr/bin/env python3
"""Database initialization script"""

from main import app, db

def init_database():
    """Initialize the database with all tables"""
    with app.app_context():
        db.create_all()
        print("Database initialized successfully!")
        print("Tables created:")
        print("- users")
        print("- scan_history")
        print("- scan_issues")

if __name__ == "__main__":
    init_database()