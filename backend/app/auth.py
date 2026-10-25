import os
import time
import uuid
import jwt
from pathlib import Path
from typing import Optional, Dict, Any, Tuple
from dotenv import load_dotenv
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# Strictly load configuration from .env.local
env_file = Path(__file__).resolve().parent.parent.parent / ".env.local"
if env_file.exists():
    load_dotenv(dotenv_path=env_file, override=True)
else:
    load_dotenv(".env.local", override=True)

SUPABASE_URL = os.getenv("SUPABASE_URL", "http://127.0.0.1:54321")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_JWT_SECRET = os.getenv(
    "SUPABASE_JWT_SECRET", 
    "super-secret-jwt-token-with-at-least-32-characters-long-for-supabase-local"
)

# FastAPI HTTPBearer scheme
security = HTTPBearer(auto_error=False)

def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Security(security)) -> Dict[str, Any]:
    """
    FastAPI dependency to validate incoming Supabase JWT tokens.
    Returns the authenticated user's profile dict: {'id', 'email', 'role'}.
    Raises 401 Unauthorized if missing, expired, or invalid.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=401,
            detail="Missing authentication token. Bearer JWT is required."
        )

    token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False}
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=401,
                detail="Invalid authentication token: missing subject (sub) claim."
            )

        return {
            "id": user_id,
            "email": payload.get("email", ""),
            "role": payload.get("role", "authenticated")
        }
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail="Authentication token has expired. Please log in again."
        )
    except jwt.PyJWTError as e:
        raise HTTPException(
            status_code=401,
            detail=f"Invalid authentication token: {str(e)}"
        )


def generate_test_user_token(
    user_id: Optional[str] = None, 
    email: Optional[str] = None, 
    role: str = "authenticated"
) -> Tuple[str, str]:
    """
    Helper function for integration tests.
    Programmatically creates a test user identity and signs a valid Supabase JWT auth token.
    Returns (user_id, token_string).
    """
    uid = user_id or f"usr_{uuid.uuid4().hex[:12]}"
    u_email = email or f"{uid}@example.test"
    now = int(time.time())

    payload = {
        "sub": uid,
        "email": u_email,
        "role": role,
        "aud": "authenticated",
        "iss": f"{SUPABASE_URL}/auth/v1",
        "iat": now,
        "exp": now + 7200  # 2 hours validity
    }

    token = jwt.encode(payload, SUPABASE_JWT_SECRET, algorithm="HS256")
    return uid, token
