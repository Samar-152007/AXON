/**
 * nameParser.js
 * 
 * Extracts product names and brand identifiers from OCR text on grocery,
 * food, beverage, and personal care packaging.
 * Provides clean name recommendations and alternative suggestion chips.
 */

const COMMON_BRANDS = [
  'Aqualogica', 'Amul', 'Nestle', 'Britannia', 'Mother Dairy', 'Dabur',
  'Himalaya', 'Tata', 'Patanjali', 'Kissan', 'Cadbury', 'Epigamia',
  'Kellogg', 'Kelloggs', 'Lays', 'Haldirams', 'Haldiram', 'Nivea', 'Dove', 
  'Ponds', 'Vaseline', 'Garnier', 'Colgate', 'Dettol', 'Saffola', 'Fortune', 
  'Aashirvaad', 'Mamaearth', 'Plum', 'Biotique', 'Minimalist', 'Derma Co', 
  'Cetaphil', 'Horlicks', 'Bournvita', 'Complan', 'Tropicana', 'Real',
  'Parle', 'Sunfeast', 'Bikaji', 'MDH', 'Everest', 'Catch', 'Lipton'
];

// Order from multi-word phrases to single words so longer matches take precedence
const COMMON_PRODUCTS = [
  { name: 'Sunscreen Gel', pattern: /\b(sunscree\w*\s*gel|sun\s*gel)\b/i },
  { name: 'Sunscreen', pattern: /\b(sunscree\w*|sunsce\w*|surisc\w*|sun\s*screen|sun\s*block|spf\s*\d*)\b/i },
  { name: 'Face Wash', pattern: /\b(face\s*wash|facewash|face\s*cleanser)\b/i },
  { name: 'Body Wash', pattern: /\b(body\s*wash|shower\s*gel)\b/i },
  { name: 'Moisturizer', pattern: /\b(moisturi\w*|hydrat\w*\s*lotion|skin\s*cream|cold\s*cream)\b/i },
  { name: 'Body Lotion', pattern: /\b(body\s*lotion|lotion)\b/i },
  { name: 'Serum', pattern: /\b(face\s*serum|serum)\b/i },
  { name: 'Shampoo', pattern: /\b(shampoo)\b/i },
  { name: 'Conditioner', pattern: /\b(hair\s*conditioner|conditioner)\b/i },
  { name: 'Peanut Butter', pattern: /\b(peanut\s*butter)\b/i },
  { name: 'Almond Butter', pattern: /\b(almond\s*butter)\b/i },
  { name: 'Toned Milk', pattern: /\b(toned\s*milk|double\s*toned\s*milk)\b/i },
  { name: 'Full Cream Milk', pattern: /\b(full\s*cream\s*milk)\b/i },
  { name: 'Milk', pattern: /\b(milk|cow\s*milk|dairy\s*milk)\b/i },
  { name: 'Greek Yogurt', pattern: /\b(greek\s*yogurt|greek\s*yoghurt)\b/i },
  { name: 'Yogurt', pattern: /\b(yogurt|yoghurt|curd|dahi)\b/i },
  { name: 'Butter', pattern: /\b(butter|makkhan)\b/i },
  { name: 'Cheese Slices', pattern: /\b(cheese\s*slices)\b/i },
  { name: 'Cheese', pattern: /\b(cheese|cheddar|mozzarella|paneer)\b/i },
  { name: 'Brown Bread', pattern: /\b(brown\s*bread|whole\s*wheat\s*bread)\b/i },
  { name: 'Bread', pattern: /\b(bread|white\s*bread|multigrain\s*bread|pav|bun)\b/i },
  { name: 'Eggs', pattern: /\b(farm\s*fresh\s*eggs|white\s*eggs|brown\s*eggs|eggs?)\b/i },
  { name: 'Orange Juice', pattern: /\b(orange\s*juice)\b/i },
  { name: 'Apple Juice', pattern: /\b(apple\s*juice)\b/i },
  { name: 'Juice', pattern: /\b(juice|fruit\s*juice)\b/i },
  { name: 'Tomato Ketchup', pattern: /\b(tomato\s*ketchup|ketchup|tomato\s*sauce)\b/i },
  { name: 'Mayonnaise', pattern: /\b(mayonnaise|mayo)\b/i },
  { name: 'Rolled Oats', pattern: /\b(rolled\s*oats|instant\s*oats)\b/i },
  { name: 'Oats', pattern: /\b(oats|oatmeal|muesli|granola)\b/i },
  { name: 'Corn Flakes', pattern: /\b(corn\s*flakes|cornflakes)\b/i },
  { name: 'Basmati Rice', pattern: /\b(basmati\s*rice|biryani\s*rice)\b/i },
  { name: 'Rice', pattern: /\b(rice|chawal)\b/i },
  { name: 'Wheat Flour', pattern: /\b(wheat\s*flour|chakki\s*atta|atta)\b/i },
  { name: 'Olive Oil', pattern: /\b(extra\s*virgin\s*olive\s*oil|olive\s*oil)\b/i },
  { name: 'Mustard Oil', pattern: /\b(mustard\s*oil|sarson\s*tel)\b/i },
  { name: 'Cooking Oil', pattern: /\b(cooking\s*oil|sunflower\s*oil|vegetable\s*oil)\b/i },
  { name: 'Green Tea', pattern: /\b(green\s*tea)\b/i },
  { name: 'Tea', pattern: /\b(tea|chai|black\s*tea)\b/i },
  { name: 'Coffee', pattern: /\b(coffee|instant\s*coffee|espresso|filter\s*coffee)\b/i },
  { name: 'Biscuits', pattern: /\b(biscuit\w*|cookie\w*|rusk)\b/i },
  { name: 'Pasta', pattern: /\b(pasta|macaroni|spaghetti|penne)\b/i },
  { name: 'Noodles', pattern: /\b(noodles|instant\s*noodles|maggi)\b/i },
  { name: 'Chocolate', pattern: /\b(dark\s*chocolate|chocolate|cocoa)\b/i },
  { name: 'Jam', pattern: /\b(mixed\s*fruit\s*jam|fruit\s*jam|jam)\b/i },
  { name: 'Honey', pattern: /\b(pure\s*honey|honey)\b/i }
];

/**
 * Parses OCR raw text and returns the best detected product name and suggestion chips.
 * 
 * @param {string} rawText - Unstructured text from Tesseract OCR
 * @returns {object} { bestName, brand, category, confidence, suggestions }
 */
export function parseProductName(rawText) {
  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
    return {
      bestName: '',
      brand: null,
      category: null,
      confidence: 'NONE',
      suggestions: []
    };
  }

  const suggestions = new Set();
  let detectedBrand = null;
  let detectedProduct = null;

  // 1. Check for website/domain pattern on packages: e.g. "aqualogica.in" -> "Aqualogica"
  const domainMatch = rawText.match(/(?:www\.)?([a-zA-Z0-9\-]{3,20})\.(?:in|com|org|co\.in|co|net)\b/i);
  if (domainMatch && domainMatch[1]) {
    const rawDomain = domainMatch[1].toLowerCase();
    // Exclude generic domains
    if (!['google', 'facebook', 'instagram', 'youtube', 'amazon'].includes(rawDomain)) {
      const brandName = rawDomain.charAt(0).toUpperCase() + rawDomain.slice(1);
      detectedBrand = brandName;
      suggestions.add(brandName);
    }
  }

  // 2. Check known brand dictionary
  for (const brand of COMMON_BRANDS) {
    const regex = new RegExp(`\\b${brand}\\b`, 'i');
    if (regex.test(rawText)) {
      detectedBrand = brand;
      suggestions.add(brand);
      break;
    }
  }

  // 3. Check known product categories (handling packaging misspellings/dot-matrix)
  for (const item of COMMON_PRODUCTS) {
    if (item.pattern.test(rawText)) {
      detectedProduct = item.name;
      suggestions.add(item.name);
      break;
    }
  }

  // 4. Look for clean heading / product title lines from packaging text
  // Rules for clean line: 1 to 4 words, no numbers, not ingredient/warning/legal
  const lines = rawText.split('\n')
    .map((l) => l.replace(/[^a-zA-Z0-9\s\+\-]/g, ' ').trim())
    .filter((l) => {
      const words = l.split(/\s+/).filter(Boolean);
      if (words.length < 1 || words.length > 5) return false;
      // Skip ingredients, directions, legal fine print
      if (/\b(mfg|exp|batch|usp|mrp|rs|inr|aqua|acid|water|extract|store|cool|dry|use|avoid|contact|unit|plot|dist|marketed|manufactured|tel|email|phone|ltd|pvt|net|wt|vol|gm|ml|g|kg)\b/i.test(l)) {
        return false;
      }
      // Skip lines with digits (dates, barcodes, prices)
      if (/\d/.test(l)) return false;
      // At least 3 letters
      if (l.replace(/[^a-zA-Z]/g, '').length < 3) return false;
      return true;
    });

  let bestTitleLine = null;
  if (lines.length > 0) {
    // Check if any line matches known products or brands before picking generic title
    for (const l of lines) {
      const isProductKeyword = COMMON_PRODUCTS.some((p) => p.pattern.test(l));
      if (!isProductKeyword && l.length >= 4) {
        bestTitleLine = l
          .split(/\s+/)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ');
        suggestions.add(bestTitleLine);
        break;
      }
    }
  }

  // 5. Build Best Product Name
  let bestName = '';
  let confidence = 'LOW';

  if (detectedBrand && detectedProduct) {
    bestName = `${detectedBrand} ${detectedProduct}`;
    suggestions.add(bestName);
    confidence = 'HIGH';
  } else if (detectedProduct) {
    bestName = detectedProduct;
    confidence = 'MEDIUM';
  } else if (detectedBrand && bestTitleLine) {
    bestName = `${detectedBrand} ${bestTitleLine}`;
    suggestions.add(bestName);
    confidence = 'MEDIUM';
  } else if (detectedBrand) {
    bestName = detectedBrand;
    confidence = 'LOW';
  } else if (bestTitleLine) {
    bestName = bestTitleLine;
    confidence = 'LOW';
  }

  return {
    bestName,
    brand: detectedBrand,
    category: detectedProduct,
    confidence,
    suggestions: Array.from(suggestions).filter(Boolean)
  };
}

export default parseProductName;
