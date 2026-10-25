import re
from typing import Dict, Any, List, Optional
try:
    from rapidfuzz import fuzz
except ImportError:
    # Lightweight fallback if rapidfuzz is somehow unavailable
    class fuzz:
        @staticmethod
        def token_set_ratio(s1: str, s2: str) -> float:
            w1 = set(s1.lower().split())
            w2 = set(s2.lower().split())
            if not w1 or not w2:
                return 0.0
            intersection = len(w1.intersection(w2))
            union = len(w1.union(w2))
            return (intersection / union) * 100

def normalize_grocery_name(name: str) -> str:
    """
    Normalizes grocery names:
    - Lowercase
    - Strip symbols/punctuation
    - Basic plural normalization (tomatoes -> tomato, berries -> berry, apples -> apple)
    - Collapse redundant spaces
    """
    if not name:
        return ""
    text = name.lower()
    text = re.sub(r"[^\w\s]", " ", text)
    tokens = text.split()
    
    normalized_tokens = []
    for t in tokens:
        if t.endswith("berries") and len(t) > 7:
            t = t[:-3] + "y"
        elif t.endswith("ies") and len(t) > 4:
            t = t[:-3] + "y"
        elif t.endswith("oes") and len(t) > 4:
            t = t[:-2]
        elif t.endswith("sses"):
            t = t[:-2]
        elif t.endswith("s") and not t.endswith("ss") and len(t) > 3:
            t = t[:-1]
        normalized_tokens.append(t)
        
    return " ".join(normalized_tokens)

def check_duplicate(target_name: str, active_inventory: List[Dict[str, Any]], threshold: float = 80.0) -> Dict[str, Any]:
    """
    Compares a candidate item against active inventory items.
    Returns details of the highest confidence match if above threshold.
    """
    if not target_name or not target_name.strip():
        return {
            "is_duplicate": False,
            "matched_item_id": None,
            "matched_item_name": None,
            "existing_quantity": None,
            "existing_unit": None,
            "similarity_score": 0.0,
            "message": "No query provided."
        }

    norm_target = normalize_grocery_name(target_name)
    best_match = None
    highest_score = 0.0

    for item in active_inventory:
        item_name = item.get("name", "")
        norm_item = normalize_grocery_name(item_name)

        # 1. Exact normalized match
        if norm_target == norm_item:
            score = 100.0
        # 2. Complete containment of primary word (e.g. "baby spinach" contains "spinach")
        elif norm_target in norm_item or norm_item in norm_target:
            score = 92.0
        else:
            # 3. Fuzzy similarity
            score = float(fuzz.token_set_ratio(norm_target, norm_item))

        if score > highest_score:
            highest_score = score
            best_match = item

    if best_match and highest_score >= threshold:
        qty = best_match.get("quantity", 0)
        unit = best_match.get("unit", "units")
        matched_name = best_match.get("name")
        return {
            "is_duplicate": True,
            "matched_item_id": best_match.get("id"),
            "matched_item_name": matched_name,
            "existing_quantity": qty,
            "existing_unit": unit,
            "similarity_score": round(highest_score, 1),
            "message": f"Review before buying: You currently have {qty} {unit} of '{matched_name}' in your active inventory."
        }

    return {
        "is_duplicate": False,
        "matched_item_id": None,
        "matched_item_name": None,
        "existing_quantity": None,
        "existing_unit": None,
        "similarity_score": round(highest_score, 1),
        "message": "No likely duplicates found in active inventory."
    }
