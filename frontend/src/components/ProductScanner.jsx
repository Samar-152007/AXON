import React, { useState, useRef, useEffect } from 'react';
import Tesseract from 'tesseract.js';
import { 
  Camera, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle,
  X, 
  Scan, 
  Calendar, 
  Sparkles, 
  Upload,
  VideoOff,
  Edit3,
  Clock,
  Target,
  Tag,
  PackageCheck,
  Check
} from 'lucide-react';
import { parseExpiryDate } from '../utils/dateParser';
import { parseProductName } from '../utils/nameParser';
import { preprocessCropCanvas, detectBrightStickerRegion } from '../utils/imagePreprocessor';

/**
 * ProductScanner Component
 * 
 * Live video camera & photo scanner with client-side Tesseract.js OCR.
 * Scans BOTH Product Name and Expiry Date simultaneously.
 * Uses multi-pass preprocessing (grayscale, contrast, Laplacian sharpening,
 * Otsu binarization) on interactive target regions to decipher packaging text.
 * Never invents fake dates or fake names. Allows instant confirmation and edits.
 */
export default function ProductScanner({ 
  isOpen, 
  onClose, 
  onExpiryDetected, 
  onProductDetected,
  showToast 
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);
  const streamRef = useRef(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [isReadingText, setIsReadingText] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);

  // Interactive Target / Reticle Region (% of viewport)
  // Default centered on bottom half where product dates/stickers typically reside
  const [reticle, setReticle] = useState({ x: 20, y: 65, width: 60, height: 30 });

  // Scan results tracking
  const [detectedResult, setDetectedResult] = useState(null);
  const [detectedName, setDetectedName] = useState('');
  const [nameSuggestions, setNameSuggestions] = useState([]);
  const [rawOcrText, setRawOcrText] = useState('');
  const [scanStatus, setScanStatus] = useState('idle'); // 'idle' | 'complete' | 'incomplete' | 'insufficient'
  const [statusMessage, setStatusMessage] = useState('');
  const [capturedPreview, setCapturedPreview] = useState(null);

  // Manual completion state for name & date
  const [manualDate, setManualDate] = useState('');
  const [manualName, setManualName] = useState('');
  const [isEditingManually, setIsEditingManually] = useState(false);

  // Start camera stream when modal opens
  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
      resetState();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported by your browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().catch(console.warn);
        };
      }
      setCameraActive(true);
    } catch (err) {
      console.warn('Could not access live camera stream:', err);
      setCameraActive(false);
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera permissions or upload an image.'
          : 'Live camera is unavailable on this device. You can upload an image of the package.'
      );
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const resetState = () => {
    setIsReadingText(false);
    setOcrProgress(0);
    setDetectedResult(null);
    setDetectedName('');
    setNameSuggestions([]);
    setRawOcrText('');
    setScanStatus('idle');
    setStatusMessage('');
    setCapturedPreview(null);
    setManualDate('');
    setManualName('');
    setIsEditingManually(false);
    setReticle({ x: 20, y: 65, width: 60, height: 30 });
  };

  /**
   * Helper to compute future date strings in YYYY-MM-DD
   */
  const addDaysToToday = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  /**
   * Loads image data URL into an HTMLImageElement
   */
  const loadImageElement = (src) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  };

  /**
   * Tap / Click to reposition the scan reticle onto the date or title area
   */
  const handleViewportClick = (e) => {
    if (!containerRef.current || isReadingText) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 100;
    const clickY = ((e.clientY - rect.top) / rect.height) * 100;

    const newX = Math.max(0, Math.min(100 - reticle.width, clickX - reticle.width / 2));
    const newY = Math.max(0, Math.min(100 - reticle.height, clickY - reticle.height / 2));

    setReticle((prev) => ({
      ...prev,
      x: Math.round(newX),
      y: Math.round(newY)
    }));
  };

  /**
   * Multi-Pass OCR: Scans BOTH Expiry Date and Product Name
   */
  const handleScanPackage = async () => {
    if (isReadingText) return;

    setDetectedResult(null);
    setDetectedName('');
    setNameSuggestions([]);
    setScanStatus('idle');
    setStatusMessage('');
    setIsEditingManually(false);

    let source = null;

    if (videoRef.current && cameraActive) {
      source = videoRef.current;
      // Capture preview thumbnail from video
      if (canvasRef.current) {
        const c = canvasRef.current;
        c.width = videoRef.current.videoWidth || 640;
        c.height = videoRef.current.videoHeight || 480;
        const ctx = c.getContext('2d');
        ctx.drawImage(videoRef.current, 0, 0);
        setCapturedPreview(c.toDataURL('image/jpeg', 0.85));
      }
    } else if (capturedPreview) {
      try {
        source = await loadImageElement(capturedPreview);
      } catch (err) {
        console.error('Failed to load image preview element:', err);
      }
    }

    if (!source) {
      setScanStatus('insufficient');
      setStatusMessage('No camera frame or image to scan. Please adjust camera or upload a photo.');
      return;
    }

    try {
      setIsReadingText(true);
      setOcrProgress(10);
      setStatusMessage('Pass 1/3: Deciphering date stamp in target box...');

      let parsedDate = null;
      let parsedName = null;
      let combinedOcrText = '';

      // -----------------------------------------------------------------
      // PASS 1: Target Reticle Crop (Focused Date Stamp area)
      // -----------------------------------------------------------------
      const pass1Canvas = preprocessCropCanvas(source, reticle, {
        sharpen: true,
        contrast: 170,
        brightness: 105
      });

      const res1 = await Tesseract.recognize(pass1Canvas, 'eng', {
        tessedit_pageseg_mode: '6',
        logger: (m) => {
          if (m.status === 'recognizing text' && m.progress) {
            setOcrProgress(Math.round(m.progress * 35));
          }
        }
      });

      const text1 = (res1?.data?.text || '').trim();
      combinedOcrText = text1;
      parsedDate = parseExpiryDate(text1);

      // -----------------------------------------------------------------
      // PASS 2: Package Body / Branding Crop (Product Name & Brand detection)
      // -----------------------------------------------------------------
      setOcrProgress(40);
      setStatusMessage('Pass 2/3: Scanning brand and product name...');

      const nameCanvas = preprocessCropCanvas(
        source, 
        { x: 5, y: 5, width: 90, height: 70 }, 
        { sharpen: true, contrast: 145, brightness: 105 }
      );

      const resName = await Tesseract.recognize(nameCanvas, 'eng', {
        tessedit_pageseg_mode: '3',
        logger: (m) => {
          if (m.status === 'recognizing text' && m.progress) {
            setOcrProgress(40 + Math.round(m.progress * 30));
          }
        }
      });

      const textName = (resName?.data?.text || '').trim();
      if (textName) {
        combinedOcrText = (combinedOcrText + '\n' + textName).trim();
      }

      // Check if date was found in Pass 2 text if Pass 1 didn't find it
      if (!parsedDate || !parsedDate.formatted) {
        parsedDate = parseExpiryDate(textName) || parseExpiryDate(combinedOcrText);
      }

      // -----------------------------------------------------------------
      // PASS 3: Deep contrast / Binarization if date is still missing
      // -----------------------------------------------------------------
      if (!parsedDate || !parsedDate.formatted) {
        setOcrProgress(75);
        setStatusMessage('Pass 3/3: Applying binarized contrast filter...');

        const pass3Canvas = preprocessCropCanvas(source, reticle, {
          binarize: true,
          contrast: 180,
          brightness: 110
        });

        const res3 = await Tesseract.recognize(pass3Canvas, 'eng', {
          tessedit_pageseg_mode: '6',
          logger: (m) => {
            if (m.status === 'recognizing text' && m.progress) {
              setOcrProgress(75 + Math.round(m.progress * 25));
            }
          }
        });

        const text3 = (res3?.data?.text || '').trim();
        if (text3) {
          combinedOcrText = (combinedOcrText + '\n' + text3).trim();
        }
        parsedDate = parseExpiryDate(text3) || parseExpiryDate(combinedOcrText);
      }

      // Extract Product Name from all captured packaging text
      parsedName = parseProductName(combinedOcrText) || parseProductName(textName) || parseProductName(text1);

      setRawOcrText(combinedOcrText);

      // Populate Name Results
      if (parsedName && parsedName.bestName) {
        setDetectedName(parsedName.bestName);
        setManualName(parsedName.bestName);
        setNameSuggestions(parsedName.suggestions || []);
      }

      // Populate Date Results & Overall Status
      if (parsedDate && parsedDate.formatted) {
        setDetectedResult(parsedDate);
        setManualDate(parsedDate.formatted);

        if (parsedName && parsedName.bestName) {
          setScanStatus('complete');
          const msg = `Detected ${parsedName.bestName} (Expiry: ${parsedDate.formatted})`;
          setStatusMessage(msg);
          if (showToast) showToast(msg, 'success');
        } else {
          setScanStatus('complete');
          const msg = parsedDate.notice || `Expiry date detected: ${parsedDate.formatted}`;
          setStatusMessage(msg);
          if (showToast) showToast(msg, 'success');
        }
      } else if (parsedName && parsedName.bestName) {
        // Name found, but date incomplete
        setScanStatus('incomplete');
        setStatusMessage(`Detected product: "${parsedName.bestName}". Please confirm or select expiry date.`);
        setIsEditingManually(true);
        if (showToast) showToast(`Product found: ${parsedName.bestName}. Enter expiry below.`, 'info');
      } else {
        // Insufficient information - never show fake data
        setScanStatus('insufficient');
        setStatusMessage('Insufficient packaging data. You can complete the name and date manually below.');
        setIsEditingManually(true);
        if (showToast) showToast('Could not decipher label. Complete manually below.', 'info');
      }
    } catch (err) {
      console.error('OCR processing error:', err);
      setScanStatus('insufficient');
      setStatusMessage('OCR error: ' + (err.message || 'Unable to decipher image'));
      setIsEditingManually(true);
      if (showToast) showToast('OCR Error: ' + err.message, 'error');
    } finally {
      setIsReadingText(false);
      setOcrProgress(0);
    }
  };

  /**
   * Applies the scanned or edited name & date to the calling view
   */
  const handleApply = () => {
    const finalDate = manualDate || detectedResult?.formatted;
    const finalName = manualName.trim() || detectedName.trim();

    if (!finalDate && !finalName) {
      if (showToast) showToast('Please enter at least a product name or expiry date.', 'error');
      return;
    }

    if (onExpiryDetected) {
      onExpiryDetected(finalDate, {
        name: finalName,
        isComplete: scanStatus === 'complete' && Boolean(finalDate),
        rawOcrText,
        wasManuallyCompleted: isEditingManually || scanStatus !== 'complete',
        isShelfLifeCalculation: detectedResult?.isShelfLifeCalculation || false,
        mfgDate: detectedResult?.mfgDate || null
      });
    }

    if (onProductDetected) {
      onProductDetected({
        name: finalName,
        expiry_date: finalDate,
        isComplete: scanStatus === 'complete'
      });
    }

    onClose();
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setCapturedPreview(event.target?.result);
      setScanStatus('idle');
      setStatusMessage('');
      setReticle({ x: 20, y: 65, width: 60, height: 30 });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-2xl bg-[#171D2B] border border-[#D8B56D]/40 shadow-2xl overflow-hidden text-[#F3E8D0] my-4 max-h-[92vh] flex flex-col">
        {/* Hidden Canvas & File Picker */}
        <canvas ref={canvasRef} className="hidden" />
        <input 
          ref={fileInputRef} 
          type="file" 
          accept="image/*" 
          capture="environment" 
          className="hidden" 
          onChange={handleFileUpload} 
        />

        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#D8B56D]/20 bg-[#121720]/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#D8B56D]/15 border border-[#D8B56D]/30 text-[#D8B56D]">
              <Scan className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-enchanted font-bold text-base sm:text-lg text-[#F3E8D0]">
                Product & Expiry Scanner
              </h3>
              <p className="text-xs text-[#A8B9A5]">
                Captures product name & expiry date via packaging OCR.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#A8B9A5] hover:text-white hover:bg-[#111620] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1">
          {/* Viewport / Video Area */}
          <div 
            ref={containerRef}
            onClick={handleViewportClick}
            className="relative w-full h-56 sm:h-64 rounded-xl bg-black overflow-hidden border border-[#D8B56D]/30 flex items-center justify-center cursor-crosshair select-none"
            title="Tap anywhere on the packaging to center the target box"
          >
            {/* Live Stream */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${cameraActive && !capturedPreview ? 'block' : 'hidden'}`}
            />

            {/* Snapshot Preview */}
            {capturedPreview && (
              <img 
                src={capturedPreview} 
                alt="Captured product frame" 
                className="w-full h-full object-contain bg-black pointer-events-none" 
              />
            )}

            {/* Inactive Camera Fallback */}
            {!cameraActive && !capturedPreview && (
              <div className="p-6 text-center space-y-3">
                <VideoOff className="w-9 h-9 text-[#D8B56D]/40 mx-auto" />
                <p className="text-xs text-[#A8B9A5] max-w-xs mx-auto">
                  {cameraError || 'Camera inactive.'}
                </p>
                <div className="flex justify-center gap-2">
                  <button
                    onClick={startCamera}
                    className="px-3 py-1.5 rounded-lg bg-[#111620] border border-[#D8B56D]/30 text-xs text-[#D8B56D] hover:bg-[#17251F] cursor-pointer"
                  >
                    Retry Camera
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-[#17251F] border border-[#D8B56D]/40 text-xs text-[#F3E8D0] hover:bg-[#D8B56D] hover:text-[#171D2B] cursor-pointer"
                  >
                    Upload Photo
                  </button>
                </div>
              </div>
            )}

            {/* Interactive Viewfinder Target Reticle */}
            {(cameraActive || capturedPreview) && (
              <div 
                style={{
                  left: `${reticle.x}%`,
                  top: `${reticle.y}%`,
                  width: `${reticle.width}%`,
                  height: `${reticle.height}%`
                }}
                className="absolute pointer-events-none border-2 border-dashed border-[#D8B56D] bg-[#D8B56D]/15 rounded-xl flex flex-col items-center justify-center transition-all duration-200 shadow-[0_0_20px_rgba(216,181,109,0.35)] backdrop-brightness-110"
              >
                <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-[#171D2B] bg-gradient-to-r from-[#D8B56D] to-[#ECC880] px-2.5 py-0.5 rounded-full shadow-lg">
                  <Target className="w-3 h-3 text-[#171D2B]" />
                  <span>Target Area</span>
                </div>
              </div>
            )}

            {/* OCR Processing Overlay */}
            {isReadingText && (
              <div className="absolute inset-0 z-20 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center space-y-3 text-[#F3E8D0]">
                <div className="relative">
                  <RefreshCw className="w-9 h-9 text-[#D8B56D] animate-spin" />
                  <Sparkles className="w-4 h-4 text-emerald-400 absolute -top-1 -right-1 animate-pulse" />
                </div>
                <div className="text-center space-y-1">
                  <p className="font-enchanted font-bold text-sm text-[#F3E8D0]">
                    Scanning Packaging...
                  </p>
                  <p className="text-xs text-[#A8B9A5]">
                    {statusMessage || `Multi-pass OCR (${ocrProgress}%)`}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Reticle Guidance & Placement Presets */}
          {(cameraActive || capturedPreview) && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#A8B9A5] bg-[#111620]/60 p-2 rounded-lg border border-[#D8B56D]/20">
              <span className="flex items-center gap-1.5 text-[#F3E8D0]">
                <Target className="w-3.5 h-3.5 text-[#D8B56D]" />
                <span>Tap photo to place target box</span>
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[#A8B9A5]">Presets:</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setReticle({ x: 20, y: 65, width: 60, height: 30 }); }}
                  className="px-2 py-0.5 rounded bg-[#17251F] border border-[#D8B56D]/30 text-[10px] text-[#D8B56D] hover:bg-[#D8B56D] hover:text-black cursor-pointer transition-colors"
                >
                  Date Stamp
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setReticle({ x: 10, y: 15, width: 80, height: 40 }); }}
                  className="px-2 py-0.5 rounded bg-[#17251F] border border-[#D8B56D]/30 text-[10px] text-[#D8B56D] hover:bg-[#D8B56D] hover:text-black cursor-pointer transition-colors"
                >
                  Product Name
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setReticle({ x: 0, y: 0, width: 100, height: 100 }); }}
                  className="px-2 py-0.5 rounded bg-[#17251F] border border-[#D8B56D]/30 text-[10px] text-[#D8B56D] hover:bg-[#D8B56D] hover:text-black cursor-pointer transition-colors"
                >
                  Full Frame
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* DETECTED / EDITABLE PRODUCT DETAILS CARD                                  */}
          {/* ========================================================================= */}
          {scanStatus !== 'idle' && (
            <div className={`p-3.5 rounded-xl border space-y-3 animate-fade-in ${
              scanStatus === 'complete' 
                ? 'bg-emerald-950/40 border-emerald-500/40' 
                : scanStatus === 'incomplete' 
                ? 'bg-amber-950/40 border-amber-500/40'
                : 'bg-[#5B1F32]/40 border-rose-500/40'
            }`}>
              {/* Header Status Badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {scanStatus === 'complete' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : scanStatus === 'incomplete' ? (
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                  )}
                  <span className={`text-[10px] uppercase font-bold tracking-wider ${
                    scanStatus === 'complete' ? 'text-emerald-400' : scanStatus === 'incomplete' ? 'text-amber-400' : 'text-rose-400'
                  }`}>
                    {scanStatus === 'complete' 
                      ? 'Package Details Captured' 
                      : scanStatus === 'incomplete' 
                      ? 'Review & Confirm Details' 
                      : 'Insufficient Data (Never Faked)'}
                  </span>
                </div>
                {statusMessage && (
                  <span className="text-[10px] text-[#A8B9A5] truncate max-w-[200px]">
                    {statusMessage}
                  </span>
                )}
              </div>

              {/* FIELD 1: Product Name */}
              <div className="space-y-1.5 p-2.5 rounded-lg bg-[#111620]/90 border border-[#D8B56D]/20">
                <div className="flex items-center justify-between text-xs text-[#D8B56D]">
                  <span className="font-semibold flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" />
                    Product Name:
                  </span>
                  {detectedName && (
                    <span className="text-[10px] text-emerald-400">Scanned from package</span>
                  )}
                </div>
                <input
                  type="text"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="e.g. Aqualogica Sunscreen, Whole Milk, Brown Bread"
                  className="w-full px-3 py-1.5 rounded-lg bg-[#171D2B] border border-[#D8B56D]/40 text-[#F3E8D0] text-xs focus:outline-none focus:border-[#D8B56D]"
                />

                {/* Name suggestions chips */}
                {nameSuggestions.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-[#A8B9A5]">Suggestions:</span>
                    {nameSuggestions.map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => setManualName(sug)}
                        className={`px-2 py-0.5 rounded text-[10px] cursor-pointer transition-colors ${
                          manualName === sug 
                            ? 'bg-[#D8B56D] text-black font-bold' 
                            : 'bg-[#17251F] text-[#D8B56D] border border-[#D8B56D]/30 hover:bg-[#D8B56D] hover:text-black'
                        }`}
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* FIELD 2: Expiry Date */}
              <div className="space-y-1.5 p-2.5 rounded-lg bg-[#111620]/90 border border-[#D8B56D]/20">
                <div className="flex items-center justify-between text-xs text-[#D8B56D]">
                  <span className="font-semibold flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    Expiry Date:
                  </span>
                  {detectedResult?.isShelfLifeCalculation && (
                    <span className="text-[10px] text-emerald-400">Calculated from Shelf-Life</span>
                  )}
                </div>

                {/* Shelf-life notice & toggle */}
                {detectedResult?.isShelfLifeCalculation && (
                  <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] bg-emerald-950/40 border border-emerald-500/30 p-1.5 rounded">
                    <span className="text-emerald-200">
                      Mfg: <code className="text-[#D8B56D]">{detectedResult.mfgDate}</code> + {detectedResult.shelfLifeMonths} Mo Shelf Life
                    </span>
                    <button
                      type="button"
                      onClick={() => setManualDate(
                        manualDate === detectedResult.mfgDate ? detectedResult.formatted : detectedResult.mfgDate
                      )}
                      className="text-[10px] text-[#D8B56D] hover:underline cursor-pointer"
                    >
                      {manualDate === detectedResult.mfgDate ? 'Switch to Expiry Date' : 'Use Mfg Date'}
                    </button>
                  </div>
                )}

                {/* Quick Date Pills */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: '+3 Days', days: 3 },
                    { label: '+1 Wk', days: 7 },
                    { label: '+2 Wks', days: 14 },
                    { label: '+1 Mo', days: 30 },
                    { label: '+6 Mo', days: 180 },
                    { label: '+1 Yr', days: 365 }
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setManualDate(addDaysToToday(p.days))}
                      className="px-2 py-0.5 rounded bg-[#17251F] hover:bg-[#D8B56D] hover:text-[#171D2B] border border-[#D8B56D]/30 text-[10px] text-[#F3E8D0] transition-colors cursor-pointer"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* Date Input */}
                <div className="pt-1">
                  <input
                    type="date"
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-[#171D2B] border border-[#D8B56D]/40 text-[#F3E8D0] text-xs focus:outline-none focus:border-[#D8B56D]"
                  />
                </div>
              </div>

              {/* Action: Apply Product Details */}
              <button
                type="button"
                onClick={handleApply}
                disabled={!manualDate && !manualName}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-[#D8B56D] to-[#ECC880] text-[#171D2B] font-bold text-xs rounded-xl shadow-lg hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
              >
                <PackageCheck className="w-4 h-4 text-[#171D2B]" />
                <span>Apply Product Details ({manualName || 'Item'} • {manualDate || 'No Date'})</span>
              </button>
            </div>
          )}

          {/* Action Controls */}
          <div className="flex items-center gap-3 pt-1">
            {/* Primary 'Scan Package' Button */}
            <button
              onClick={handleScanPackage}
              disabled={isReadingText || (!cameraActive && !capturedPreview)}
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-[#D8B56D] to-[#ECC880] text-[#171D2B] font-bold text-sm shadow-lg shadow-[#D8B56D]/15 hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isReadingText ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-[#171D2B]" />
                  <span>Scanning Name & Expiry ({ocrProgress}%)...</span>
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4 text-[#171D2B]" />
                  <span>Scan Name & Expiry Date</span>
                </>
              )}
            </button>

            {/* Live Camera Reset / Upload */}
            {capturedPreview ? (
              <button
                onClick={() => {
                  setCapturedPreview(null);
                  startCamera();
                  setScanStatus('idle');
                }}
                disabled={isReadingText}
                className="py-3 px-3.5 rounded-xl bg-[#111620] hover:bg-[#17251F] border border-[#D8B56D]/30 text-xs text-[#D8B56D] font-semibold transition-colors cursor-pointer"
                title="Restart live camera stream"
              >
                Live Camera
              </button>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isReadingText}
                className="py-3 px-3.5 rounded-xl bg-[#111620] hover:bg-[#17251F] border border-[#D8B56D]/30 text-xs text-[#D8B56D] font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Upload photo from storage"
              >
                <Upload className="w-4 h-4 text-[#D8B56D]" />
                <span className="hidden sm:inline">Upload Photo</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
