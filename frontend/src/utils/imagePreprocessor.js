/**
 * imagePreprocessor.js
 * 
 * In-browser canvas image enhancement and ROI cropping for Tesseract.js OCR.
 * Optimizes packaging photos (inkjet / dot-matrix print, curved bottles, labels)
 * before passing them to the OCR engine.
 */

/**
 * Sharpen pixel data using a 3x3 Laplacian high-pass convolution kernel.
 * Effectively bridges small dot-matrix dots and sharpens fuzzy package printing.
 */
export function sharpenImageData(imageData) {
  const { width, height, data } = imageData;
  const copy = new Uint8ClampedArray(data);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        const center = copy[idx + c];
        const up = copy[((y - 1) * width + x) * 4 + c];
        const down = copy[((y + 1) * width + x) * 4 + c];
        const left = copy[(y * width + (x - 1)) * 4 + c];
        const right = copy[(y * width + (x + 1)) * 4 + c];

        // Laplacian kernel: 5 * center - (up + down + left + right)
        const val = center * 5 - (up + down + left + right);
        data[idx + c] = Math.min(255, Math.max(0, val));
      }
    }
  }
}

/**
 * Applies Otsu's optimal automatic global thresholding to binarize the image.
 * Separates ink from background for high-noise or glossy surfaces.
 */
export function otsuBinarizeImageData(imageData) {
  const { width, height, data } = imageData;
  const total = width * height;
  const hist = new Int32Array(256);

  // Convert to grayscale and build histogram
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
    hist[gray]++;
  }

  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];

  let sumB = 0;
  let wB = 0;
  let wF = 0;
  let maxVar = 0;
  let threshold = 128;

  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    wF = total - wB;
    if (wF === 0) break;

    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > maxVar) {
      maxVar = between;
      threshold = t;
    }
  }

  for (let i = 0; i < data.length; i += 4) {
    const val = data[i] > threshold ? 255 : 0;
    data[i] = val;
    data[i + 1] = val;
    data[i + 2] = val;
  }
}

/**
 * Crops a designated region of interest and enhances it onto an off-screen HTML5 Canvas.
 * 
 * @param {HTMLImageElement|HTMLVideoElement|HTMLCanvasElement} source - Visual source element
 * @param {object} [cropRect] - Normalized percentage bounds { x, y, width, height } from 0 to 100
 * @param {object} [options] - Preprocessing flags: { sharpen: true, binarize: false, contrast: 1.6 }
 * @returns {HTMLCanvasElement} Preprocessed offscreen canvas
 */
export function preprocessCropCanvas(source, cropRect = null, options = {}) {
  const sourceWidth = source.videoWidth || source.naturalWidth || source.width || 640;
  const sourceHeight = source.videoHeight || source.naturalHeight || source.height || 480;

  // Calculate pixel bounds
  let sx = 0;
  let sy = 0;
  let sw = sourceWidth;
  let sh = sourceHeight;

  if (cropRect) {
    // cropRect values are in percentages (0 to 100)
    sx = Math.max(0, Math.min(sourceWidth, (cropRect.x / 100) * sourceWidth));
    sy = Math.max(0, Math.min(sourceHeight, (cropRect.y / 100) * sourceHeight));
    sw = Math.max(20, Math.min(sourceWidth - sx, (cropRect.width / 100) * sourceWidth));
    sh = Math.max(20, Math.min(sourceHeight - sy, (cropRect.height / 100) * sourceHeight));
  }

  // Tesseract performs best when text characters have a height around 30-50 pixels.
  // Scale up small crops so width is at least 600px.
  const targetWidth = Math.max(600, Math.min(1200, Math.round(sw * 2)));
  const scale = targetWidth / sw;
  const targetHeight = Math.round(sh * scale);

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  // Draw with contrast, brightness, and grayscale filter
  const contrastVal = options.contrast !== undefined ? options.contrast : 160;
  const brightnessVal = options.brightness !== undefined ? options.brightness : 105;
  ctx.filter = `grayscale(100%) contrast(${contrastVal}%) brightness(${brightnessVal}%)`;
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);
  ctx.filter = 'none';

  // Apply pixel-level operations
  if (options.sharpen || options.binarize) {
    const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
    if (options.sharpen) {
      sharpenImageData(imgData);
    }
    if (options.binarize) {
      otsuBinarizeImageData(imgData);
    }
    ctx.putImageData(imgData, 0, 0);
  }

  return canvas;
}

/**
 * Automatically inspects the lower half of an image for bright rectangular label patches
 * (like white price/date stickers on colored bottles).
 * Returns percentage bounds { x, y, width, height } or null.
 */
export function detectBrightStickerRegion(source) {
  try {
    const sourceWidth = source.videoWidth || source.naturalWidth || source.width || 640;
    const sourceHeight = source.videoHeight || source.naturalHeight || source.height || 480;

    const sampleW = 160;
    const sampleH = 120;
    const canvas = document.createElement('canvas');
    canvas.width = sampleW;
    canvas.height = sampleH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(source, 0, 0, sampleW, sampleH);

    const imgData = ctx.getImageData(0, 0, sampleW, sampleH);
    const data = imgData.data;

    // Look in bottom 50% of the sample (y from sampleH/2 to sampleH)
    let minX = sampleW, maxX = 0, minY = sampleH, maxY = 0;
    let count = 0;

    for (let y = Math.floor(sampleH * 0.5); y < sampleH; y++) {
      for (let x = Math.floor(sampleW * 0.15); x < Math.floor(sampleW * 0.85); x++) {
        const idx = (y * sampleW + x) * 4;
        const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        if (lum > 165) {
          count++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    // If a cluster with sufficient bright pixels is found, return percentage box with margins
    if (count > 50 && maxX > minX && maxY > minY) {
      const margin = 5;
      const xPct = Math.max(0, (minX / sampleW) * 100 - margin);
      const yPct = Math.max(0, (minY / sampleH) * 100 - margin);
      const wPct = Math.min(100 - xPct, ((maxX - minX) / sampleW) * 100 + margin * 2);
      const hPct = Math.min(100 - yPct, ((maxY - minY) / sampleH) * 100 + margin * 2);

      if (wPct >= 20 && hPct >= 15) {
        return { x: xPct, y: yPct, width: wPct, height: hPct };
      }
    }
  } catch (err) {
    console.warn('Could not auto-detect sticker patch:', err);
  }
  return null;
}
