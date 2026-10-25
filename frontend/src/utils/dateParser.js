/**
 * dateParser.js
 * 
 * Extracts common grocery product expiry date patterns from OCR raw text.
 * Supports formats like:
 * - MM/YY, MM/YYYY (e.g. "12/25", "08/2026")
 * - DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY (e.g. "25/10/2026", "15-11-2025")
 * - Prefixed patterns: "EXP 12/25", "EXPIRY: 2026-11-30", "Use By: Oct 2026", "BB 15 NOV 26"
 * - Month name patterns: "25 Oct 2026", "Oct 2026", "Nov 25"
 * 
 * Returns standardized ISO formatted string 'YYYY-MM-DD' and Date object.
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
 * Returns formatted 'YYYY-MM-DD' and Date object from components.
 */
function createDateResult(year, month, day = null, rawMatch = '') {
  const normYear = normalizeYear(year);
  const normMonth = Math.min(Math.max(parseInt(month, 10), 1), 12);
  
  // If day is missing (e.g. "Oct 2026" or "12/25"), set to the last day of that month
  let normDay;
  if (day) {
    normDay = Math.min(Math.max(parseInt(day, 10), 1), 31);
  } else {
    // End of month
    normDay = new Date(normYear, normMonth, 0).getDate();
  }

  const mm = String(normMonth).padStart(2, '0');
  const dd = String(normDay).padStart(2, '0');
  const formatted = `${normYear}-${mm}-${dd}`;
  const dateObj = new Date(normYear, normMonth - 1, normDay);

  return {
    formatted,
    date: dateObj,
    year: normYear,
    month: normMonth,
    day: normDay,
    rawMatch
  };
}

/**
 * Main parsing helper function
 * Takes raw string from OCR and searches for expiry date expressions.
 * 
 * @param {string} rawText - Unstructured text from Tesseract OCR
 * @returns {object|null} - { formatted: 'YYYY-MM-DD', date: Date, rawMatch: string } or null
 */
export function parseExpiryDate(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;

  const cleanText = rawText.replace(/\r\n/g, ' ').replace(/\n/g, ' ');

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
      return createDateResult(year, month, day, prefTextMatch[0]);
    }
  }

  // 1b. Prefixed ISO date: e.g. "EXP 2026-12-31", "USE BY: 2026/10/25"
  const prefixedIsoRegex = /(?:EXP(?:IRY)?|USE\s*BY|BEST\s*(?:BEFORE|BY)|BB|BBD)[\s:\-\/]+(20\d{2})[\/\-\.](0[1-9]|1[0-2])[\/\-\.](0[1-9]|[12]\d|3[01])\b/i;
  const prefIsoMatch = cleanText.match(prefixedIsoRegex);
  if (prefIsoMatch) {
    return createDateResult(prefIsoMatch[1], prefIsoMatch[2], prefIsoMatch[3], prefIsoMatch[0]);
  }

  // 1c. Prefixed numeric patterns: e.g. "EXP 12/25", "EXP. 12/2026", "USE BY: 25/10/2026", "BEST BEFORE 28.02.26"
  const prefixNumericRegex = /(?:EXP(?:IRY)?|USE\s*BY|BEST\s*(?:BEFORE|BY)|BB|BBD)[\s:\-\/]+(\d{1,2})[\/\.\-](\d{1,2})(?:[\/\.\-](\d{2,4}))?\b/i;
  const prefixMatch = cleanText.match(prefixNumericRegex);
  if (prefixMatch) {
    const part1 = prefixMatch[1];
    const part2 = prefixMatch[2];
    const part3 = prefixMatch[3];

    if (part3) {
      // Format: DD/MM/YYYY or MM/DD/YYYY
      if (parseInt(part1, 10) > 12) {
        return createDateResult(part3, part2, part1, prefixMatch[0]);
      } else {
        return createDateResult(part3, part2, part1, prefixMatch[0]);
      }
    } else {
      // Format: MM/YY or MM/YYYY (e.g. 12/25)
      return createDateResult(part2, part1, null, prefixMatch[0]);
    }
  }

  // 2. Unprefixed dates fallback (in case label simply displays the date without prefix)
  // 2a. Standalone Textual month format: e.g. "25 Oct 2026", "Oct 2026"
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
      return createDateResult(year, month, day, textMatch[0]);
    }
  }

  // 2b. Standalone ISO Date format: e.g. "2026-10-25" or "2026/10/25"
  const isoRegex = /\b(20\d{2})[\/\-\.](0[1-9]|1[0-2])[\/\-\.](0[1-9]|[12]\d|3[01])\b/;
  const isoMatch = cleanText.match(isoRegex);
  if (isoMatch) {
    return createDateResult(isoMatch[1], isoMatch[2], isoMatch[3], isoMatch[0]);
  }

  // 2c. Standalone Full Date: DD/MM/YYYY or DD-MM-YYYY
  const fullDateRegex = /\b(0?[1-9]|[12]\d|3[01])[\/\.\-](0?[1-9]|1[0-2])[\/\.\-](20\d{2}|\d{2})\b/;
  const fullDateMatch = cleanText.match(fullDateRegex);
  if (fullDateMatch) {
    return createDateResult(fullDateMatch[3], fullDateMatch[2], fullDateMatch[1], fullDateMatch[0]);
  }

  // 2d. Standalone MM/YY or MM/YYYY: e.g. "12/25", "08/26", "11/2026"
  const shortDateRegex = /\b(0[1-9]|1[0-2])[\/\.\-](20\d{2}|2\d|3\d)\b/;
  const shortDateMatch = cleanText.match(shortDateRegex);
  if (shortDateMatch) {
    return createDateResult(shortDateMatch[2], shortDateMatch[1], null, shortDateMatch[0]);
  }

  return null;
}

export default parseExpiryDate;
