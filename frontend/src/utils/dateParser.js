/**
 * dateParser.js
 * 
 * Extracts common grocery product expiry date patterns from OCR raw text.
 * Distinguishes between complete dates, partial/incomplete detections, and unreadable text.
 * Never invents fake dates. Clearly flags missing components (e.g. missing day, partial year).
 */

const MONTH_MAP = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12
};

const MONTH_NAMES_PATTERN = Object.keys(MONTH_MAP).join('|');

/**
 * Normalizes 2-digit or 4-digit year to 4-digit number.
 * e.g. 26 -> 2026, 99 -> 1999
 */
function normalizeYear(yearStr) {
  const y = parseInt(yearStr, 10);
  if (y < 100) {
    return y < 50 ? 2000 + y : 1900 + y;
  }
  return y;
}

/**
 * Returns structured date result with explicit completeness and confidence metadata.
 */
function createDateResult(year, month, day = null, rawMatch = '', hasPrefix = false, options = {}) {
  const normYear = normalizeYear(year);
  const normMonth = Math.min(Math.max(parseInt(month, 10), 1), 12);
  const hasExactDay = day !== null && day !== undefined && String(day).trim() !== '';

  // If day is missing (e.g. "Oct 2026" or "02/26"), standard grocery/packaging rule is end of month.
  let normDay;
  if (hasExactDay) {
    normDay = Math.min(Math.max(parseInt(day, 10), 1), 31);
  } else {
    // End of month
    normDay = new Date(normYear, normMonth, 0).getDate();
  }

  // Handle shelf life addition (e.g. Mfg: 02/26 + 24 Months = 02/28)
  let expiryYear = normYear;
  let expiryMonth = normMonth;
  let expiryDay = normDay;
  let isShelfLifeCalculation = false;
  let mfgDateStr = null;

  if (options.shelfLifeMonths && options.shelfLifeMonths > 0) {
    isShelfLifeCalculation = true;
    mfgDateStr = `${normYear}-${String(normMonth).padStart(2, '0')}-${String(normDay).padStart(2, '0')}`;
    
    // Add months
    const totalMonths = normMonth - 1 + options.shelfLifeMonths;
    expiryYear = normYear + Math.floor(totalMonths / 12);
    expiryMonth = (totalMonths % 12) + 1;
    if (!hasExactDay) {
      expiryDay = new Date(expiryYear, expiryMonth, 0).getDate();
    } else {
      expiryDay = Math.min(normDay, new Date(expiryYear, expiryMonth, 0).getDate());
    }
  }

  const mm = String(expiryMonth).padStart(2, '0');
  const dd = String(expiryDay).padStart(2, '0');
  const formatted = `${expiryYear}-${mm}-${dd}`;
  const dateObj = new Date(expiryYear, expiryMonth - 1, expiryDay);

  // In packaged goods, MM/YY without day is complete package expiry (end-of-month)
  const isComplete = true;
  const confidence = hasPrefix || isShelfLifeCalculation ? 'HIGH' : (hasExactDay ? 'HIGH' : 'MEDIUM');

  let notice = null;
  if (isShelfLifeCalculation) {
    notice = `Mfg date (${String(normMonth).padStart(2, '0')}/${normYear}) + ${options.shelfLifeMonths} months shelf life detected → Expiry: ${formatted}.`;
  } else if (!hasExactDay) {
    notice = `Product expiry detected as ${mm}/${expiryYear}. End-of-month (${formatted}) applied.`;
  }

  return {
    formatted,
    date: dateObj,
    year: expiryYear,
    month: expiryMonth,
    day: expiryDay,
    hasExactDay,
    isComplete,
    isEndOfMonth: !hasExactDay,
    confidence,
    missingFields: hasExactDay ? [] : ['day'],
    rawMatch,
    hasPrefix,
    isShelfLifeCalculation,
    mfgDate: mfgDateStr,
    shelfLifeMonths: options.shelfLifeMonths || null,
    notice
  };
}

/**
 * Pre-processes OCR raw text to fix common inkjet/dot-matrix scan artifacts:
 * - 02/2¢, 02/2c, 02/2G -> 02/26 (cents symbol, 'c', 'G' for dot-matrix 6)
 * - 02/2S, 02/2s -> 02/25
 * - 02/2Z -> 02/22
 * - 02/2B -> 02/28
 * - O2/26 -> 02/26
 * - Spaces around slashes / separators
 */
function normalizeOcrArtifacts(text) {
  if (!text) return '';
  let s = text.replace(/[\r\n]+/g, ' ');

  // Fix spaces between numbers and date separators: "02 / 26" -> "02/26", "02 . 26" -> "02.26"
  s = s.replace(/(\d{1,2})\s*([\/.\-:])\s*(\d{2,4})/g, '$1$2$3');

  // Fix dot-matrix 6 recognized as ¢, c, C, G after 2-digit decade (e.g. '02/2¢' or '02/2c')
  // Note: ¢ is not a word char, so do not use \b after it. Use (?![0-9a-zA-Z])
  s = s.replace(/(\b[oO0]?[1-9]|1[0-2])[\s\/\.\-:']+(2[¢cCbBG])(?![0-9a-zA-Z])/g, '$1/26');

  // Fix dot-matrix 5 recognized as S/s (e.g. '02/2S' -> '02/25')
  s = s.replace(/(\b[oO0]?[1-9]|1[0-2])[\s\/\.\-:']+(2[sS])(?![0-9a-zA-Z])/g, '$1/25');

  // Fix dot-matrix 8 recognized as B (e.g. '02/2B' -> '02/28')
  s = s.replace(/(\b[oO0]?[1-9]|1[0-2])[\s\/\.\-:']+(2[B])(?![0-9a-zA-Z])/g, '$1/28');

  // Fix letter O in month: e.g. "O2/26" -> "02/26", "O8/25" -> "08/25"
  s = s.replace(/\b[oO]([1-9])[\s\/\.\-:']+(\d{2,4})(?![0-9a-zA-Z])/g, '0$1/$2');

  // Clean leading punctuation on dates: ": 02/26" -> "02/26"
  s = s.replace(/(?:^|\s)[:\-\.,|]\s*(0?[1-9]|1[0-2])[\/\.\-:'](\d{2,4})\b/g, ' $1/$2');

  return s;
}

/**
 * Main parsing helper function
 * Analyzes OCR text and returns detailed complete/incomplete evaluation.
 * 
 * @param {string} rawText - Unstructured text from Tesseract OCR
 * @returns {object|null} - Result object with completeness flags, or null if text is empty
 */
export function parseExpiryDate(rawText) {
  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) return null;

  const normalized = normalizeOcrArtifacts(rawText);
  const cleanText = normalized.trim();

  // Detect shelf-life indicator: e.g. "24 Months From Mfg", "12 Months from packaging", "Best before 6 months"
  const shelfLifeRegex = /(\d{1,2})\s*(?:months?|mths?|m)\s*(?:from\s*)?(?:mfg|mfd|date\s*of\s*mfg|pkd|packaging|pack|mfg\.)?/i;
  const shelfLifeMatch = cleanText.match(shelfLifeRegex);
  const shelfLifeMonths = shelfLifeMatch ? parseInt(shelfLifeMatch[1], 10) : null;

  // 1. Check explicitly prefixed expiry dates first (EXP, USE BY, BEST BEFORE, BB)
  // 1a. Text month with prefix: e.g. "Use By: 25 Oct 2026", "EXP Oct 2026", "BB 15-NOV-2026"
  const prefixedTextMonthRegex = new RegExp(
    `(?:EXP(?:IRY)?|USE\\s*BY|BEST\\s*(?:BEFORE|BY)|BB|BBD)[\\s:\\-\\/]+` +
    `(?:(\\d{1,2})[\\s\\.\\-\\/]+)?` +
    `(${MONTH_NAMES_PATTERN})` +
    `[\\s\\.\\-\\/,]+` +
    `(\\d{2,4})\\b`,
    'i'
  );
  const prefTextMatch = cleanText.match(prefixedTextMonthRegex);
  if (prefTextMatch) {
    const day = prefTextMatch[1] || null;
    const monthStr = prefTextMatch[2].toLowerCase();
    const year = prefTextMatch[3];
    const month = MONTH_MAP[monthStr];
    if (month && year) {
      return createDateResult(year, month, day, prefTextMatch[0], true);
    }
  }

  // 1b. Prefixed ISO date: e.g. "EXP 2026-12-31", "USE BY: 2026/10/25"
  const prefixedIsoRegex = /(?:EXP(?:IRY)?|USE\s*BY|BEST\s*(?:BEFORE|BY)|BB|BBD)[\s:\-\/]+(20\d{2})[\/\-\.](0[1-9]|1[0-2])[\/\-\.](0[1-9]|[12]\d|3[01])\b/i;
  const prefIsoMatch = cleanText.match(prefixedIsoRegex);
  if (prefIsoMatch) {
    return createDateResult(prefIsoMatch[1], prefIsoMatch[2], prefIsoMatch[3], prefIsoMatch[0], true);
  }

  // 1c. Prefixed numeric patterns: e.g. "EXP 12/25", "EXP. 12/2026", "USE BY: 25/10/2026", "BEST BEFORE 28.02.26"
  const prefixNumericRegex = /(?:EXP(?:IRY)?|USE\s*BY|BEST\s*(?:BEFORE|BY)|BB|BBD)[\s:\-\/]+(\d{1,2})[\/\.\-:'](\d{1,2})(?:[\/\.\-:'](\d{2,4}))?\b/i;
  const prefixMatch = cleanText.match(prefixNumericRegex);
  if (prefixMatch) {
    const part1 = prefixMatch[1];
    const part2 = prefixMatch[2];
    const part3 = prefixMatch[3];

    if (part3) {
      // Format: DD/MM/YYYY or MM/DD/YYYY
      if (parseInt(part1, 10) > 12) {
        return createDateResult(part3, part2, part1, prefixMatch[0], true);
      } else {
        return createDateResult(part3, part1, part2, prefixMatch[0], true);
      }
    } else {
      // Format: MM/YY or MM/YYYY
      return createDateResult(part2, part1, null, prefixMatch[0], true);
    }
  }

  // 2. Standalone Textual month format: e.g. "25 Oct 2026", "Oct 2026"
  const standaloneTextMonthRegex = new RegExp(
    `(?:(\\d{1,2})[\\s\\.\\-\\/]+)?` +
    `(${MONTH_NAMES_PATTERN})` +
    `[\\s\\.\\-\\/,]+` +
    `(\\d{2,4})\\b`,
    'i'
  );
  const textMatch = cleanText.match(standaloneTextMonthRegex);
  if (textMatch) {
    const day = textMatch[1] || null;
    const monthStr = textMatch[2].toLowerCase();
    const year = textMatch[3];
    const month = MONTH_MAP[monthStr];
    if (month && year) {
      return createDateResult(year, month, day, textMatch[0], false, { shelfLifeMonths });
    }
  }

  // 3. Standalone ISO Date: e.g. "2026-10-25" or "2026/10/25"
  const isoRegex = /\b(20\d{2})[\/\-\.](0[1-9]|1[0-2])[\/\-\.](0[1-9]|[12]\d|3[01])\b/;
  const isoMatch = cleanText.match(isoRegex);
  if (isoMatch) {
    return createDateResult(isoMatch[1], isoMatch[2], isoMatch[3], isoMatch[0], false, { shelfLifeMonths });
  }

  // 4. Standalone Full Date: DD/MM/YYYY or DD-MM-YYYY
  const fullDateRegex = /\b(0?[1-9]|[12]\d|3[01])[\/\.\-:'](0?[1-9]|1[0-2])[\/\.\-:'](20\d{2}|\d{2})\b/;
  const fullDateMatch = cleanText.match(fullDateRegex);
  if (fullDateMatch) {
    return createDateResult(fullDateMatch[3], fullDateMatch[2], fullDateMatch[1], fullDateMatch[0], false, { shelfLifeMonths });
  }

  // 5. Standalone MM/YY or MM/YYYY: e.g. "02/26", "12/25", "08/26", "11/2026"
  const shortDateRegex = /\b(0?[1-9]|1[0-2])[\/\.\-:'](20\d{2}|2\d|3\d)\b/;
  const shortDateMatch = cleanText.match(shortDateRegex);
  if (shortDateMatch) {
    return createDateResult(shortDateMatch[2], shortDateMatch[1], null, shortDateMatch[0], false, { shelfLifeMonths });
  }

  // 6. Partial Fragment Detection: Look for lone EXP header or Year only
  const partialYearRegex = /(?:EXP(?:IRY)?|USE\s*BY|BEST\s*(?:BEFORE|BY)|BB)\s*[:\-\/]?\s*(202\d|203\d)\b/i;
  const partialYearMatch = cleanText.match(partialYearRegex);
  if (partialYearMatch) {
    const y = parseInt(partialYearMatch[1], 10);
    return {
      formatted: `${y}-12-31`,
      year: y,
      month: null,
      day: null,
      hasExactDay: false,
      isComplete: false,
      isPartial: true,
      confidence: 'LOW',
      missingFields: ['month', 'day'],
      rawMatch: partialYearMatch[0],
      notice: `Incomplete date: Year ${y} found, but month and day are missing. Please complete below.`
    };
  }

  // 7. No recognizable date pattern found in raw text
  return {
    formatted: null,
    date: null,
    isComplete: false,
    confidence: 'NONE',
    missingFields: ['year', 'month', 'day'],
    rawMatch: '',
    rawSnippet: cleanText.length > 80 ? cleanText.slice(0, 80) + '...' : cleanText,
    notice: 'Insufficient date data: No legible expiry pattern found in scanned text.'
  };
}

export default parseExpiryDate;
