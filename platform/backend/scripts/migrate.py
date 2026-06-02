#!/usr/bin/env python3
"""
DataSphere Innovation — Database Migration Manager
Usage:
  python scripts/migrate.py upgrade        Apply all pending migrations
  python scripts/migrate.py downgrade -1   Rollback last migration
  python scripts/migrate.py status         Show current migration state
  python scripts/migrate.py check          Check for pending migrations (CI use)
  python scripts/migrate.py create "name"  Create a new empty migration
"""

import subprocess
import sys
import os

# Ensure we run from the backend directory
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(BACKEND_DIR)


def run(cmd: list[str]) -> int:
    result = subprocess.run(cmd, capture_output=False)
    return result.returncode


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(0)

    action = sys.argv[1].lower()

    if action == "upgrade":
        revision = sys.argv[2] if len(sys.argv) > 2 else "head"
        print(f"▶ Applying migrations up to: {revision}")
        code = run(["alembic", "upgrade", revision])
        sys.exit(code)

    elif action == "downgrade":
        revision = sys.argv[2] if len(sys.argv) > 2 else "-1"
        print(f"⚠  Rolling back to: {revision}")
        confirm = input("Confirm rollback? (yes/no): ")
        if confirm.strip().lower() != "yes":
            print("Aborted.")
            sys.exit(0)
        code = run(["alembic", "downgrade", revision])
        sys.exit(code)

    elif action == "status":
        print("── Current migration state ──")
        run(["alembic", "current"])
        print("\n── Migration history ──")
        run(["alembic", "history", "--verbose"])

    elif action == "check":
        # Returns exit code 1 if there are pending migrations (useful in CI)
        result = subprocess.run(
            ["alembic", "check"],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            print("❌ Pending migrations detected!")
            print(result.stdout)
            sys.exit(1)
        print("✅ Database is up to date.")
        sys.exit(0)

    elif action == "create":
        if len(sys.argv) < 3:
            print("Usage: migrate.py create <migration_name>")
            sys.exit(1)
        name = "_".join(sys.argv[2:]).lower().replace(" ", "_")
        print(f"Creating migration: {name}")
        code = run(["alembic", "revision", "--autogenerate", "-m", name])
        sys.exit(code)

    else:
        print(f"Unknown action: {action}")
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
