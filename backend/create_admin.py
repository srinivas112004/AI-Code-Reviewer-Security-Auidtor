"""
Script to create an admin user for the AI Code Reviewer and Security Auditor.
Run this script to create the initial admin account.

Usage:
    python create_admin.py

This will prompt for username, email, and password, then create an admin user.
"""

import sys
import os

# Add the backend directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import app, db, User

def create_admin_user():
    print("\n=== AI Code Auditor - Admin User Creation ===\n")
    
    with app.app_context():
        # Check if any admin exists
        existing_admin = User.query.filter_by(is_admin=True).first()
        if existing_admin:
            print(f"An admin user already exists: {existing_admin.username}")
            response = input("Do you want to create another admin? (y/n): ").lower()
            if response != 'y':
                print("Operation cancelled.")
                return
        
        # Get user input
        username = input("Enter admin username: ").strip()
        if not username:
            print("Error: Username cannot be empty.")
            return
        
        # Check if username exists
        if User.query.filter_by(username=username).first():
            print(f"Error: Username '{username}' already exists.")
            return
        
        email = input("Enter admin email: ").strip()
        if not email or '@' not in email:
            print("Error: Please enter a valid email address.")
            return
        
        # Check if email exists
        if User.query.filter_by(email=email).first():
            print(f"Error: Email '{email}' already exists.")
            return
        
        password = input("Enter admin password (min 8 characters): ").strip()
        if len(password) < 8:
            print("Error: Password must be at least 8 characters long.")
            return
        
        confirm_password = input("Confirm password: ").strip()
        if password != confirm_password:
            print("Error: Passwords do not match.")
            return
        
        # Create admin user
        try:
            admin_user = User(
                username=username,
                email=email,
                is_admin=True,
                is_active=True
            )
            admin_user.set_password(password)
            
            db.session.add(admin_user)
            db.session.commit()
            
            print(f"\n✓ Admin user '{username}' created successfully!")
            print(f"  - Email: {email}")
            print(f"  - Admin: Yes")
            print("\nYou can now login to the application with these credentials.")
            
        except Exception as e:
            db.session.rollback()
            print(f"Error creating admin user: {e}")

def list_users():
    """List all users in the database"""
    with app.app_context():
        users = User.query.all()
        if not users:
            print("No users found in the database.")
            return
        
        print("\n=== User List ===")
        print(f"{'ID':<5} {'Username':<20} {'Email':<30} {'Admin':<8} {'Active':<8}")
        print("-" * 75)
        for user in users:
            print(f"{user.id:<5} {user.username:<20} {user.email:<30} {'Yes' if user.is_admin else 'No':<8} {'Yes' if user.is_active else 'No':<8}")
        print()

def make_admin(username):
    """Promote an existing user to admin"""
    with app.app_context():
        user = User.query.filter_by(username=username).first()
        if not user:
            print(f"User '{username}' not found.")
            return
        
        if user.is_admin:
            print(f"User '{username}' is already an admin.")
            return
        
        user.is_admin = True
        db.session.commit()
        print(f"User '{username}' has been promoted to admin.")

if __name__ == '__main__':
    if len(sys.argv) > 1:
        command = sys.argv[1].lower()
        if command == 'list':
            list_users()
        elif command == 'promote' and len(sys.argv) > 2:
            make_admin(sys.argv[2])
        else:
            print("Usage:")
            print("  python create_admin.py          - Create a new admin user")
            print("  python create_admin.py list     - List all users")
            print("  python create_admin.py promote <username> - Promote user to admin")
    else:
        create_admin_user()
