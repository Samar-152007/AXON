from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from ..database import get_db
from ..auth import get_current_user

router = APIRouter(prefix="/posts", tags=["Posts (RLS Protected)"])

class PostCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    content: str = Field(..., min_length=1)

class PostUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    content: Optional[str] = Field(None, min_length=1)

class PostResponse(BaseModel):
    id: int
    user_id: str
    title: str
    content: str
    created_at: str
    updated_at: Optional[str] = None

@router.get("", response_model=List[PostResponse])
@router.get("/", response_model=List[PostResponse])
def get_posts(current_user: dict = Depends(get_current_user)):
    """
    Returns posts visible to the authenticated user.
    Requires valid Supabase JWT Bearer token (401 if missing).
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, user_id, title, content, created_at, updated_at FROM posts ORDER BY id DESC"
        )
        rows = cursor.fetchall()
        return [dict(r) for r in rows]

@router.post("", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
def create_post(payload: PostCreate, current_user: dict = Depends(get_current_user)):
    """
    Creates a new post owned by the authenticated user (sub claim from JWT).
    Requires valid Supabase JWT Bearer token (401 if missing).
    """
    user_id = current_user["id"]
    now = datetime.now().isoformat()
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO posts (user_id, title, content, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (user_id, payload.title, payload.content, now, now)
        )
        post_id = cursor.lastrowid
        cursor.execute(
            "SELECT id, user_id, title, content, created_at, updated_at FROM posts WHERE id = ?",
            (post_id,)
        )
        row = cursor.fetchone()
        return dict(row)

@router.get("/{post_id}", response_model=PostResponse)
def get_single_post(post_id: int, current_user: dict = Depends(get_current_user)):
    """
    Retrieves a single post by ID.
    Requires valid Supabase JWT Bearer token (401 if missing).
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, user_id, title, content, created_at, updated_at FROM posts WHERE id = ?",
            (post_id,)
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"Post with ID {post_id} not found")
        return dict(row)

@router.put("/{post_id}", response_model=PostResponse)
def update_post(post_id: int, payload: PostUpdate, current_user: dict = Depends(get_current_user)):
    """
    Updates an existing post.
    Enforces Row-Level Security (RLS):
    - 401 Unauthorized if token is missing/invalid.
    - 403 Forbidden if attempting to modify a post owned by another user.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, user_id, title, content, created_at, updated_at FROM posts WHERE id = ?",
            (post_id,)
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"Post with ID {post_id} not found")

        # RLS Enforcement: Verify resource ownership
        if row["user_id"] != current_user["id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: RLS policy violation. You do not have permission to modify another user's resource."
            )

        new_title = payload.title if payload.title is not None else row["title"]
        new_content = payload.content if payload.content is not None else row["content"]
        now = datetime.now().isoformat()

        cursor.execute(
            """
            UPDATE posts 
            SET title = ?, content = ?, updated_at = ?
            WHERE id = ?
            """,
            (new_title, new_content, now, post_id)
        )
        cursor.execute(
            "SELECT id, user_id, title, content, created_at, updated_at FROM posts WHERE id = ?",
            (post_id,)
        )
        updated_row = cursor.fetchone()
        return dict(updated_row)

@router.delete("/{post_id}", status_code=status.HTTP_200_OK)
def delete_post(post_id: int, current_user: dict = Depends(get_current_user)):
    """
    Deletes an existing post.
    Enforces Row-Level Security (RLS):
    - 401 Unauthorized if token is missing/invalid.
    - 403 Forbidden if attempting to delete a post owned by another user.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, user_id FROM posts WHERE id = ?",
            (post_id,)
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"Post with ID {post_id} not found")

        # RLS Enforcement: Verify resource ownership
        if row["user_id"] != current_user["id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: RLS policy violation. You do not have permission to delete another user's resource."
            )

        cursor.execute("DELETE FROM posts WHERE id = ?", (post_id,))
        return {"success": True, "message": f"Post {post_id} deleted successfully"}
