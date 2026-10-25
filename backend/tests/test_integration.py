"""
Automated Integration Tests for API Endpoints against Local Supabase Environment.
Verifies:
1. Success cases: Valid GET and POST return 200/201 and correct JSON structure.
2. Auth boundaries: Requests missing an auth token return 401 Unauthorized.
3. RLS enforcement: Attempting to modify another user's data returns 403 Forbidden.
"""

import os
import sys
import pytest
from pathlib import Path
from dotenv import load_dotenv

# Ensure workspace root is always in sys.path
root_dir = Path(__file__).resolve().parent.parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

# 1. Strictly load variables from .env.local
env_file = root_dir / ".env.local"
if env_file.exists():
    load_dotenv(dotenv_path=env_file, override=True)
else:
    load_dotenv(".env.local", override=True)

from fastapi.testclient import TestClient

# Import application components
from backend.app.main import app
from backend.app.database import get_db, init_db
from backend.app.auth import generate_test_user_token, SUPABASE_URL, SUPABASE_JWT_SECRET

client = TestClient(app)

# ============================================================================
# Auth & State: Programmatic User Registration & Database Seeding
# ============================================================================

@pytest.fixture(scope="module", autouse=True)
def setup_database_and_auth():
    """
    Setup / Teardown fixture:
    1. Initializes database schema (including posts table).
    2. Programmatically registers two test users (User A and User B) and retrieves their Supabase JWTs.
    3. Seeds mock records with distinct user ownership.
    4. Cleans up test data on teardown.
    """
    init_db()

    # Programmatically create two distinct user identities and valid Supabase JWTs
    user_a_id, user_a_token = generate_test_user_token(
        user_id="usr_supabase_local_alice_001",
        email="alice@supabase.local"
    )
    user_b_id, user_b_token = generate_test_user_token(
        user_id="usr_supabase_local_bob_002",
        email="bob@supabase.local"
    )

    # Seed mock records for both users
    with get_db() as conn:
        cursor = conn.cursor()
        # Seed Post A owned by User A
        cursor.execute(
            """
            INSERT INTO posts (user_id, title, content, created_at, updated_at)
            VALUES (?, ?, ?, datetime('now'), datetime('now'))
            """,
            (user_a_id, "Alice's Grocery Budget Post", "Organizing household pantry spend.")
        )
        post_a_id = cursor.lastrowid

        # Seed Post B owned by User B
        cursor.execute(
            """
            INSERT INTO posts (user_id, title, content, created_at, updated_at)
            VALUES (?, ?, ?, datetime('now'), datetime('now'))
            """,
            (user_b_id, "Bob's Weekly Meal Prep Post", "Cooking batch meals for the week.")
        )
        post_b_id = cursor.lastrowid

    context = {
        "user_a_id": user_a_id,
        "user_a_token": user_a_token,
        "user_b_id": user_b_id,
        "user_b_token": user_b_token,
        "post_a_id": post_a_id,
        "post_b_id": post_b_id,
        "headers_a": {"Authorization": f"Bearer {user_a_token}"},
        "headers_b": {"Authorization": f"Bearer {user_b_token}"},
    }

    yield context

    # Teardown: Clean up test records
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM posts WHERE user_id IN (?, ?)", (user_a_id, user_b_id))


# ============================================================================
# 1. SUCCESS CASES (Valid GET and POST return 200/201 and correct JSON)
# ============================================================================

def test_get_posts_success(setup_database_and_auth):
    """
    Verify valid GET /api/posts returns 200 OK and expected array of posts.
    """
    ctx = setup_database_and_auth
    response = client.get("/api/posts", headers=ctx["headers_a"])
    
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    
    # Check structure of returned post
    first_post = data[0]
    assert "id" in first_post
    assert "user_id" in first_post
    assert "title" in first_post
    assert "content" in first_post
    assert "created_at" in first_post


def test_create_post_success(setup_database_and_auth):
    """
    Verify valid POST /api/posts returns 201 Created, sets user_id, and returns correct JSON.
    """
    ctx = setup_database_and_auth
    new_post_payload = {
        "title": "Alice's Fresh Produce Haul",
        "content": "Bought avocados, spinach, and sourdough bread today."
    }
    
    response = client.post(
        "/api/posts",
        json=new_post_payload,
        headers=ctx["headers_a"]
    )
    
    assert response.status_code == 201
    created_post = response.json()
    assert created_post["title"] == new_post_payload["title"]
    assert created_post["content"] == new_post_payload["content"]
    assert created_post["user_id"] == ctx["user_a_id"]
    assert isinstance(created_post["id"], int)


def test_get_single_post_success(setup_database_and_auth):
    """
    Verify valid GET /api/posts/{id} returns 200 OK.
    """
    ctx = setup_database_and_auth
    response = client.get(
        f"/api/posts/{ctx['post_a_id']}",
        headers=ctx["headers_a"]
    )
    assert response.status_code == 200
    post = response.json()
    assert post["id"] == ctx["post_a_id"]
    assert post["user_id"] == ctx["user_a_id"]


# ============================================================================
# 2. AUTH BOUNDARIES (Requests missing/invalid auth return 401 Unauthorized)
# ============================================================================

def test_get_posts_missing_token_returns_401():
    """
    Verify request missing Authorization header returns 401 Unauthorized.
    """
    response = client.get("/api/posts")
    assert response.status_code == 401
    assert "Missing authentication token" in response.json()["detail"]


def test_post_missing_token_returns_401():
    """
    Verify POST request missing Authorization header returns 401 Unauthorized.
    """
    response = client.post(
        "/api/posts",
        json={"title": "Unauthorized Post", "content": "Should not be created."}
    )
    assert response.status_code == 401
    assert "Missing authentication token" in response.json()["detail"]


def test_request_invalid_token_returns_401():
    """
    Verify request with malformed or tampered token returns 401 Unauthorized.
    """
    bad_headers = {"Authorization": "Bearer bogus-invalid-jwt-signature-token"}
    response = client.get("/api/posts", headers=bad_headers)
    assert response.status_code == 401
    assert "Invalid authentication token" in response.json()["detail"]


# ============================================================================
# 3. RLS ENFORCEMENT (Modifying another user's data returns 403 Forbidden)
# ============================================================================

def test_rls_modify_other_user_post_returns_403(setup_database_and_auth):
    """
    Verify Row-Level Security: User B attempting to modify User A's post returns 403 Forbidden.
    """
    ctx = setup_database_and_auth
    malicious_update = {
        "title": "Hacked Title by Bob",
        "content": "Trying to overwrite Alice's post."
    }

    # User B targets Post A (owned by User A)
    response = client.put(
        f"/api/posts/{ctx['post_a_id']}",
        json=malicious_update,
        headers=ctx["headers_b"]
    )

    assert response.status_code == 403
    error_detail = response.json()["detail"]
    assert "Forbidden" in error_detail
    assert "RLS policy violation" in error_detail


def test_rls_delete_other_user_post_returns_403(setup_database_and_auth):
    """
    Verify Row-Level Security: User B attempting to delete User A's post returns 403 Forbidden.
    """
    ctx = setup_database_and_auth

    # User B targets Post A (owned by User A)
    response = client.delete(
        f"/api/posts/{ctx['post_a_id']}",
        headers=ctx["headers_b"]
    )

    assert response.status_code == 403
    error_detail = response.json()["detail"]
    assert "Forbidden" in error_detail
    assert "RLS policy violation" in error_detail


def test_modify_own_post_succeeds(setup_database_and_auth):
    """
    Verify owner (User A) CAN successfully modify their own post (returns 200 OK).
    """
    ctx = setup_database_and_auth
    legitimate_update = {
        "title": "Alice's Updated Grocery Budget",
        "content": "Saved ₹420 this month using GrocIQ recommendations!"
    }

    response = client.put(
        f"/api/posts/{ctx['post_a_id']}",
        json=legitimate_update,
        headers=ctx["headers_a"]
    )

    assert response.status_code == 200
    updated_post = response.json()
    assert updated_post["title"] == legitimate_update["title"]
    assert updated_post["content"] == legitimate_update["content"]
    assert updated_post["user_id"] == ctx["user_a_id"]


if __name__ == "__main__":
    import pytest
    import sys
    sys.exit(pytest.main(["-v", __file__]))
