"""
Day 2: Automated Database Backup Script
Backs up the SQLite database to a timestamped file.
Can be run manually or scheduled via cron/Task Scheduler.

Usage:
    python backup_db.py
    python backup_db.py --max-backups 10
"""

import os
import sys
import shutil
import sqlite3
import argparse
from datetime import datetime


# Paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = SCRIPT_DIR  # backup_db.py lives in backend/
INSTANCE_DIR = os.path.join(BACKEND_DIR, 'instance')
DB_PATH = os.path.join(INSTANCE_DIR, 'code_auditor.db')
BACKUP_DIR = os.path.join(BACKEND_DIR, 'backups')


def ensure_backup_dir():
    """Create backup directory if it doesn't exist."""
    os.makedirs(BACKUP_DIR, exist_ok=True)
    print(f"Backup directory: {BACKUP_DIR}")


def create_backup(db_path=DB_PATH, backup_dir=BACKUP_DIR):
    """
    Create a hot backup of the SQLite database using the SQLite backup API.
    Returns the path to the backup file.
    """
    if not os.path.exists(db_path):
        print(f"ERROR: Database not found at {db_path}")
        sys.exit(1)

    ensure_backup_dir()

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_filename = f"code_auditor_{timestamp}.db"
    backup_path = os.path.join(backup_dir, backup_filename)

    try:
        # Use SQLite online backup API (safe even if server is running)
        source = sqlite3.connect(db_path)
        dest = sqlite3.connect(backup_path)
        source.backup(dest)
        dest.close()
        source.close()

        backup_size = os.path.getsize(backup_path)
        print(f"SUCCESS: Backup created at {backup_path}")
        print(f"  Size: {backup_size / 1024:.1f} KB")
        return backup_path

    except Exception as e:
        print(f"ERROR: Backup failed: {e}")
        # Fallback to simple file copy
        try:
            shutil.copy2(db_path, backup_path)
            print(f"SUCCESS (fallback copy): {backup_path}")
            return backup_path
        except Exception as copy_err:
            print(f"ERROR: Fallback copy also failed: {copy_err}")
            sys.exit(1)


def cleanup_old_backups(backup_dir=BACKUP_DIR, max_backups=30):
    """Remove old backups, keeping only the most recent `max_backups`."""
    if not os.path.exists(backup_dir):
        return

    backups = sorted([
        f for f in os.listdir(backup_dir)
        if f.startswith('code_auditor_') and f.endswith('.db')
    ])

    if len(backups) <= max_backups:
        print(f"Backups count ({len(backups)}) within limit ({max_backups}). No cleanup needed.")
        return

    to_remove = backups[:len(backups) - max_backups]
    for filename in to_remove:
        filepath = os.path.join(backup_dir, filename)
        os.remove(filepath)
        print(f"  Removed old backup: {filename}")

    print(f"Cleaned up {len(to_remove)} old backup(s). {max_backups} remaining.")


def list_backups(backup_dir=BACKUP_DIR):
    """List all existing backups."""
    if not os.path.exists(backup_dir):
        print("No backups directory found.")
        return []

    backups = sorted([
        f for f in os.listdir(backup_dir)
        if f.startswith('code_auditor_') and f.endswith('.db')
    ])

    if not backups:
        print("No backups found.")
        return []

    print(f"\nExisting backups ({len(backups)}):")
    total_size = 0
    for filename in backups:
        filepath = os.path.join(backup_dir, filename)
        size = os.path.getsize(filepath)
        total_size += size
        print(f"  {filename}  ({size / 1024:.1f} KB)")

    print(f"\nTotal backup storage: {total_size / 1024 / 1024:.2f} MB")
    return backups


def restore_backup(backup_filename, db_path=DB_PATH, backup_dir=BACKUP_DIR):
    """Restore a database from a backup file."""
    backup_path = os.path.join(backup_dir, backup_filename)
    if not os.path.exists(backup_path):
        print(f"ERROR: Backup file not found: {backup_path}")
        sys.exit(1)

    # Create a safety backup of current DB first
    if os.path.exists(db_path):
        safety_path = db_path + '.pre_restore'
        shutil.copy2(db_path, safety_path)
        print(f"Safety backup of current DB: {safety_path}")

    try:
        source = sqlite3.connect(backup_path)
        dest = sqlite3.connect(db_path)
        source.backup(dest)
        dest.close()
        source.close()
        print(f"SUCCESS: Database restored from {backup_filename}")
    except Exception as e:
        print(f"ERROR: Restore failed: {e}")
        sys.exit(1)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Database Backup Utility for AI Code Auditor')
    parser.add_argument('--action', choices=['backup', 'list', 'restore', 'cleanup'],
                        default='backup', help='Action to perform (default: backup)')
    parser.add_argument('--max-backups', type=int, default=30,
                        help='Maximum number of backups to keep (default: 30)')
    parser.add_argument('--restore-file', type=str,
                        help='Backup filename to restore from (for --action restore)')

    args = parser.parse_args()

    print(f"=== AI Code Auditor - Database {'Backup' if args.action == 'backup' else args.action.title()} ===")
    print(f"Database: {DB_PATH}")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print()

    if args.action == 'backup':
        create_backup()
        cleanup_old_backups(max_backups=args.max_backups)
    elif args.action == 'list':
        list_backups()
    elif args.action == 'cleanup':
        cleanup_old_backups(max_backups=args.max_backups)
    elif args.action == 'restore':
        if not args.restore_file:
            print("ERROR: --restore-file is required for restore action")
            list_backups()
            sys.exit(1)
        restore_backup(args.restore_file)
