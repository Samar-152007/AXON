from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Request
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, model_validator
import re
from datetime import date
from ..database import get_db
from ..duplicate_engine import normalize_grocery_name
from ..models import ItemCreate

router = APIRouter(tags=["Receipt Import"])

class ExtractedCandidate(BaseModel):
    name: str
    quantity: float = 1.0
    unit: str = "units"
    category: str = "Other"
    unit_price: Optional[float] = None
    price: Optional[float] = None
    confidence: str = "High"

    @model_validator(mode="after")
    def sync_prices(self):
        if self.unit_price is None and self.price is not None:
            self.unit_price = self.price
        elif self.price is None and self.unit_price is not None:
            self.price = self.unit_price
        return self

class ReceiptConfirmRequest(BaseModel):
    items: List[ItemCreate]

def parse_receipt_lines(text: str) -> Dict[str, Any]:
    """
    Parses receipt text without hallucinating fake data.
    Explicitly flags missing fields (e.g. missing prices, unconfirmed categories)
    and extracts receipt dates if present.
    """
    candidates = []
    lines = text.strip().split("\n")
    detected_receipt_date = None
    
    # 1. Check for printed receipt date (e.g. "Date: 2026-10-25" or "10/25/2026")
    date_match = re.search(r"\b(20\d{2})[\/\-\.](0[1-9]|1[0-2])[\/\-\.](0[1-9]|[12]\d|3[01])\b", text)
    if date_match:
        detected_receipt_date = f"{date_match.group(1)}-{date_match.group(2)}-{date_match.group(3)}"
    else:
        date_alt_match = re.search(r"\b(0?[1-9]|1[0-2])[\/\-\.](0?[1-9]|[12]\d|3[01])[\/\-\.](20\d{2})\b", text)
        if date_alt_match:
            detected_receipt_date = f"{date_alt_match.group(3)}-{date_alt_match.group(1).zfill(2)}-{date_alt_match.group(2).zfill(2)}"

    # Common categories dictionary for auto-tagging
    cat_hints = {
        "milk": "Dairy", "cheese": "Dairy", "yogurt": "Dairy", "butter": "Dairy", "cream": "Dairy",
        "spinach": "Vegetables", "tomato": "Vegetables", "potato": "Vegetables", "onion": "Vegetables", "carrot": "Vegetables",
        "apple": "Fruits", "banana": "Fruits", "berry": "Fruits", "orange": "Fruits", "lemon": "Fruits",
        "bread": "Bakery", "croissant": "Bakery", "bagel": "Bakery", "bun": "Bakery",
        "rice": "Grains", "pasta": "Grains", "oats": "Grains", "flour": "Grains",
        "oil": "Pantry", "salt": "Pantry", "pepper": "Pantry", "sugar": "Pantry", "sauce": "Pantry",
        "chicken": "Meat & Seafood", "beef": "Meat & Seafood", "salmon": "Meat & Seafood", "egg": "Dairy",
    }

    # Noise keywords to ignore (store headers, totals, card info)
    ignore_keywords = [
        "subtotal", "total", "tax", "cash", "credit", "visa", "mastercard", "change",
        "balance", "receipt", "welcome", "store", "market", "grocer", "thank you",
        "tel:", "date:", "time:", "card", "approved", "terminal", "invoice"
    ]

    for line in lines:
        line_clean = line.strip()
        if not line_clean or len(line_clean) < 3:
            continue

        lower_line = line_clean.lower()
        if any(ign in lower_line for ign in ignore_keywords):
            continue

        # Look for price at the end: e.g. $4.99 or 4.99
        price_match = re.search(r"[\$]?\s*(\d+\.\d{2})\b", line_clean)
        price = float(price_match.group(1)) if price_match else None

        # Clean line of price
        name_part = re.sub(r"[\$]?\s*\d+\.\d{2}", "", line_clean).strip()
        
        # Look for leading quantity: e.g. "2x ", "2 ", "3 @ "
        qty = 1.0
        unit = "units"
        qty_inferred = True
        qty_match = re.match(r"^(\d+(?:\.\d+)?)\s*(?:x|@|\*|-)?\s+(.*)", name_part, re.IGNORECASE)
        if qty_match:
            try:
                qty = float(qty_match.group(1))
                name_part = qty_match.group(2).strip()
                qty_inferred = False
            except ValueError:
                pass

        # Cleanup trailing codes or random symbols
        name_part = re.sub(r"[#*@]", "", name_part).strip()

        if len(name_part) < 2:
            continue

        # Detect category hint
        detected_category = "Other"
        category_matched = False
        for hint, cat in cat_hints.items():
            if hint in name_part.lower():
                detected_category = cat
                category_matched = True
                break

        # Check for missing/incomplete fields
        missing_fields = []
        if price is None:
            missing_fields.append("unit_price")
        if qty_inferred:
            missing_fields.append("quantity")
        if not category_matched:
            missing_fields.append("category")
        missing_fields.append("expiry_date")  # Expiry date is always unconfirmed on standard receipts

        is_incomplete = bool(price is None or len(name_part) < 3)
        confidence = "Complete" if (price is not None and not is_incomplete and category_matched) else ("Incomplete" if price is None else "Moderate")

        candidates.append({
            "name": name_part.title(),
            "quantity": qty,
            "unit": unit,
            "category": detected_category,
            "unit_price": price,
            "price": price,
            "expiry_date": None,
            "is_incomplete": is_incomplete,
            "missing_fields": missing_fields,
            "confidence": confidence
        })

    return {
        "candidates": candidates,
        "detected_receipt_date": detected_receipt_date,
        "has_incomplete_items": any(c["is_incomplete"] for c in candidates)
    }

MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB maximum
ALLOWED_IMAGE_MIMETYPES = {
    "image/jpeg", "image/png", "image/webp", "image/bmp", "image/tiff"
}
MAX_RAW_TEXT_LENGTH = 50000  # 50k chars limit to prevent ReDoS / CPU exhaustion

@router.post("/extract")
@router.post("/parse")
async def extract_receipt(request: Request):
    """
    Extracts grocery items from receipt image or raw text.
    Supports multipart/form-data (file upload or form text) and application/json (raw_text).
    """
    extracted_text = ""
    source = "text"
    content_type = request.headers.get("content-type", "").lower()

    if "application/json" in content_type:
        try:
            body = await request.json()
            if isinstance(body, dict):
                extracted_text = body.get("raw_text") or body.get("receipt_text") or body.get("text") or ""
            elif isinstance(body, str):
                extracted_text = body
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid JSON body: {str(e)}")
    elif "multipart/form-data" in content_type or "application/x-www-form-urlencoded" in content_type:
        form = await request.form()
        uploaded_file = form.get("file")
        form_raw_text = form.get("raw_text")

        if uploaded_file and hasattr(uploaded_file, "filename") and uploaded_file.filename:
            file_mime = getattr(uploaded_file, "content_type", "")
            if file_mime and file_mime.lower() not in ALLOWED_IMAGE_MIMETYPES:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unsupported file type '{file_mime}'. Please upload an image (JPEG, PNG, WebP)."
                )

            source = f"image ({uploaded_file.filename})"
            try:
                image_data = await uploaded_file.read()
                if len(image_data) > MAX_IMAGE_UPLOAD_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail=f"Uploaded file exceeds maximum allowed size of {MAX_IMAGE_UPLOAD_BYTES // (1024*1024)}MB."
                    )

                import pytesseract
                from PIL import Image
                import io
                image = Image.open(io.BytesIO(image_data))
                extracted_text = pytesseract.image_to_string(image)
            except HTTPException:
                raise
            except Exception:
                return {
                    "success": False,
                    "error": "Local OCR engine (Tesseract) is not configured on this machine.",
                    "ocr_available": False,
                    "fallback_available": True,
                    "message": "You can paste the receipt text or enter receipt items manually into the review screen."
                }
        elif form_raw_text and str(form_raw_text).strip():
            extracted_text = str(form_raw_text)
    else:
        # Fallback to reading raw body as text if given
        try:
            raw_bytes = await request.body()
            if raw_bytes:
                extracted_text = raw_bytes.decode("utf-8", errors="ignore")
        except Exception:
            pass

    if not extracted_text or not extracted_text.strip():
        raise HTTPException(
            status_code=400,
            detail="Please provide either a receipt image or receipt text to extract."
        )

    if len(extracted_text) > MAX_RAW_TEXT_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Receipt text is too long (maximum {MAX_RAW_TEXT_LENGTH} characters allowed)."
        )

    parsed_res = parse_receipt_lines(extracted_text)
    candidates = parsed_res["candidates"]
    detected_date = parsed_res["detected_receipt_date"]
    has_incomplete = parsed_res["has_incomplete_items"]

    incomplete_count = sum(1 for c in candidates if c.get("is_incomplete"))
    msg = f"Parsed {len(candidates)} candidate item(s)."
    if incomplete_count > 0:
        msg += f" Notice: {incomplete_count} item(s) contain incomplete information (missing price or details). Review highlighted fields before saving."
    else:
        msg += " Please review and confirm before adding to inventory."

    return {
        "success": True,
        "source": source,
        "extracted_text_preview": extracted_text[:300] if extracted_text else "",
        "candidates": candidates,
        "items": candidates,
        "count": len(candidates),
        "detected_receipt_date": detected_date,
        "has_incomplete_items": has_incomplete,
        "incomplete_count": incomplete_count,
        "message": msg
    }

@router.post("/confirm")
def confirm_receipt_items(payload: ReceiptConfirmRequest):
    """
    Saves confirmed receipt items into inventory.
    Requires validated, non-empty grocery names.
    """
    if not payload.items:
        raise HTTPException(status_code=400, detail="No items to confirm")

    saved_items = []
    with get_db() as conn:
        cursor = conn.cursor()
        for item in payload.items:
            clean_name = (item.name or "").strip()
            if not clean_name:
                raise HTTPException(
                    status_code=400,
                    detail="Incomplete information: Every item must have a valid grocery name before saving."
                )

            norm = normalize_grocery_name(clean_name)
            u_price = item.unit_price if item.unit_price is not None else item.price
            cursor.execute("""
                INSERT INTO items (name, normalized_name, quantity, unit, category, unit_price, price, purchase_date, expiry_date, notes, status, is_sample)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 0)
            """, (
                clean_name,
                norm,
                item.quantity if item.quantity and item.quantity > 0 else 1.0,
                item.unit or "units",
                item.category or "Other",
                u_price,
                u_price,
                item.purchase_date or date.today().isoformat(),
                item.expiry_date,
                item.notes or "Imported from receipt scan.",
            ))
            new_id = cursor.lastrowid
            cursor.execute("SELECT * FROM items WHERE id = ?", (new_id,))
            saved_items.append(dict(cursor.fetchone()))

    return {
        "success": True,
        "saved_count": len(saved_items),
        "items": saved_items,
        "message": f"Successfully imported {len(saved_items)} item(s) into active inventory."
    }
