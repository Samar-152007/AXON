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
  HelpCircle,
  Clock
} from 'lucide-react';
import { parseExpiryDate } from '../utils/dateParser';

/**
 * ProductScanner Component
 * 
 * Live video camera & photo scanner with client-side Tesseract.js OCR.
 * Never invents fake dates. If data is insufficient or partial, shows clear
 * "Incomplete Information" indicators and provides a seamless inline manual
 * completion interface to make the workflow fast and feasible.
 */
export default function ProductScanner({ 
  isOpen, 
  onClose, 
  onExpiryDetected, 
  showToast 
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const streamRef = useRef(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [isReadingText, setIsReadingText] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);

  // Scan results & completeness tracking
  const [detectedResult, setDetectedResult] = useState(null);
  const [rawOcrText, setRawOcrText] = useState('');
  const [scanStatus, setScanStatus] = useState('idle'); // 'idle' | 'complete' | 'incomplete' | 'insufficient'
  const [statusMessage, setStatusMessage] = useState('');
  const [capturedPreview, setCapturedPreview] = useState(null);

  // Manual completion state for incomplete/insufficient scans
  const [manualDate, setManualDate] = useState('');
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
          : 'Live camera is unavailable on this device. You can upload an image of the expiry label.'
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
    setRawOcrText('');
    setScanStatus('idle');
    setStatusMessage('');
    setCapturedPreview(null);
    setManualDate('');
    setIsEditingManually(false);
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
   * Captures current frame and runs Tesseract.js OCR
   */
  const handleScanExpiry = async () => {
    if (isReadingText) return;

    setDetectedResult(null);
    setScanStatus('idle');
    setStatusMessage('');
    setIsEditingManually(false);

    let imageSource = null;

    if (videoRef.current && canvasRef.current && cameraActive) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      imageSource = canvas;
      setCapturedPreview(canvas.toDataURL('image/jpeg', 0.85));
    } else if (capturedPreview) {
      imageSource = capturedPreview;
    } else {
      setScanStatus('insufficient');
      setStatusMessage('No camera frame or image to scan. Please adjust camera or upload a photo.');
      return;
    }

    try {
      setIsReadingText(true);
      setOcrProgress(10);

      const result = await Tesseract.recognize(
        imageSource,
        'eng',
        {
          logger: (m) => {
            if (m.status === 'recognizing text' && m.progress) {
              setOcrProgress(Math.round(m.progress * 100));
            }
          }
        }
      );

      const extractedText = (result?.data?.text || '').trim();
      setRawOcrText(extractedText);

      // Parse with completeness metadata
      const parsed = parseExpiryDate(extractedText);

      if (parsed && parsed.formatted && parsed.isComplete) {
        // Complete full date detected
        setDetectedResult(parsed);
        setManualDate(parsed.formatted);
        setScanStatus('complete');
        setStatusMessage(`Complete date detected with high confidence (${parsed.formatted}).`);
        if (showToast) {
          showToast(`Expiry date detected: ${parsed.formatted}`, 'success');
        }
      } else if (parsed && parsed.formatted && !parsed.isComplete) {
        // Incomplete / partial date detected (e.g. Month & Year, missing exact day)
        setDetectedResult(parsed);
        setManualDate(parsed.formatted);
        setScanStatus('incomplete');
        setStatusMessage(
          parsed.notice || 'Incomplete date detected. Month and year found, but exact day is missing.'
        );
        setIsEditingManually(true);
        if (showToast) {
          showToast('Incomplete date detected. Please verify or adjust.', 'info');
        }
      } else {
        // Insufficient date data in frame - Never fake data
        setDetectedResult(null);
        setManualDate('');
        setScanStatus('insufficient');
        setStatusMessage(
          'Insufficient data in frame. No clear expiry date pattern detected. You can complete the date manually below.'
        );
        setIsEditingManually(true);
        if (showToast) {
          showToast('No legible date stamp found. Complete manually below.', 'info');
        }
      }
    } catch (err) {
      console.error('Tesseract recognition error:', err);
      setScanStatus('insufficient');
      setStatusMessage('OCR processing error: ' + (err.message || 'Unable to decipher image'));
      setIsEditingManually(true);
      if (showToast) {
        showToast('OCR Error: ' + err.message, 'error');
      }
    } finally {
      setIsReadingText(false);
      setOcrProgress(0);
    }
  };

  const handleApplyDate = (dateToApply) => {
    const finalDate = dateToApply || manualDate;
    if (!finalDate) {
      if (showToast) showToast('Please select or enter a valid date.', 'error');
      return;
    }

    if (onExpiryDetected) {
      onExpiryDetected(finalDate, {
        isComplete: scanStatus === 'complete' && !isEditingManually,
        rawOcrText,
        wasManuallyCompleted: isEditingManually || scanStatus !== 'complete'
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
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-2xl bg-[#171D2B] border border-[#D8B56D]/40 shadow-2xl overflow-hidden text-[#F3E8D0] my-4">
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
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#D8B56D]/20 bg-[#121720]/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#D8B56D]/15 border border-[#D8B56D]/30 text-[#D8B56D]">
              <Scan className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-enchanted font-bold text-base sm:text-lg text-[#F3E8D0]">
                Product Expiry Scanner
              </h3>
              <p className="text-xs text-[#A8B9A5]">
                Real-time package OCR. Never shows fake data.
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

        {/* Viewport / Video Area */}
        <div className="p-4 sm:p-5 space-y-4">
          <div className="relative w-full h-56 sm:h-64 rounded-xl bg-black overflow-hidden border border-[#D8B56D]/30 flex items-center justify-center">
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
                className="w-full h-full object-contain bg-black" 
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
                    className="px-3 py-1.5 rounded-lg bg-[#111620] border border-[#D8B56D]/30 text-xs text-[#D8B56D] hover:bg-[#17251F]"
                  >
                    Retry Camera
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-[#17251F] border border-[#D8B56D]/40 text-xs text-[#F3E8D0] hover:bg-[#D8B56D] hover:text-[#171D2B]"
                  >
                    Upload Photo
                  </button>
                </div>
              </div>
            )}

            {/* Viewfinder Target Reticle */}
            {(cameraActive || capturedPreview) && (
              <div className="absolute inset-6 pointer-events-none border-2 border-dashed border-[#D8B56D]/60 rounded-xl flex items-center justify-center">
                <div className="text-[11px] font-semibold text-[#D8B56D] bg-[#171D2B]/85 px-3 py-1 rounded-full border border-[#D8B56D]/40 shadow-md">
                  Align Date Stamp (EXP / Use By / BB)
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
                    Deciphering Package Text...
                  </p>
                  <p className="text-xs text-[#A8B9A5]">
                    Scanning packaging via Tesseract OCR ({ocrProgress}%)
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* RESULT CASE 1: FULL & COMPLETE DATE DETECTED                             */}
          {/* ========================================================================= */}
          {scanStatus === 'complete' && detectedResult && (
            <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 space-y-2 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400">
                      Complete Expiry Date Detected (High Confidence)
                    </span>
                    <div className="font-enchanted text-lg font-bold text-white flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-[#D8B56D]" />
                      <span>{detectedResult.formatted}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleApplyDate(detectedResult.formatted)}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs shadow-md transition-all cursor-pointer"
                >
                  Apply Date
                </button>
              </div>
              {detectedResult.rawMatch && (
                <div className="text-[11px] text-emerald-300/80 bg-emerald-950/40 px-2 py-1 rounded">
                  Match from packaging: <code className="text-[#F3E8D0] font-mono font-semibold">"{detectedResult.rawMatch}"</code>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* RESULT CASE 2: INCOMPLETE / PARTIAL INFORMATION DETECTED                  */}
          {/* ========================================================================= */}
          {scanStatus === 'incomplete' && (
            <div className="p-3.5 rounded-xl bg-amber-950/50 border border-amber-500/40 text-amber-200 space-y-2.5 animate-fade-in">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400 bg-amber-900/60 px-2 py-0.5 rounded">
                      Incomplete Information Detected
                    </span>
                    <span className="text-[10px] text-amber-300/80 font-medium">
                      Missing exact day
                    </span>
                  </div>
                  <p className="text-xs text-[#F3E8D0] leading-relaxed">
                    {statusMessage}
                  </p>
                  {detectedResult?.rawMatch && (
                    <p className="text-[11px] text-amber-200/90">
                      Scanned fragment: <code className="bg-[#111620] px-1.5 py-0.5 rounded text-[#D8B56D] font-mono">"{detectedResult.rawMatch}"</code>
                    </p>
                  )}
                </div>
              </div>

              {/* Inline Completion Section */}
              <div className="p-3 rounded-lg bg-[#111620]/90 border border-amber-500/20 space-y-2">
                <div className="flex items-center justify-between text-xs text-[#D8B56D]">
                  <span className="font-semibold flex items-center gap-1.5">
                    <Edit3 className="w-3.5 h-3.5" />
                    Complete / Adjust Expiry Date:
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-[#171D2B] border border-[#D8B56D]/40 text-[#F3E8D0] text-xs focus:outline-none focus:border-[#D8B56D]"
                  />
                  <button
                    onClick={() => handleApplyDate(manualDate)}
                    disabled={!manualDate}
                    className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-[#D8B56D] text-black font-bold text-xs rounded-lg hover:brightness-110 transition-all cursor-pointer disabled:opacity-50"
                  >
                    Confirm & Apply
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* RESULT CASE 3: INSUFFICIENT DATA / NO DATE IN FRAME                       */}
          {/* ========================================================================= */}
          {scanStatus === 'insufficient' && (
            <div className="p-3.5 rounded-xl bg-[#5B1F32]/40 border border-red-500/40 text-red-200 space-y-2.5 animate-fade-in">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-rose-400 bg-rose-950/60 px-2 py-0.5 rounded">
                      Insufficient Information
                    </span>
                  </div>
                  <p className="text-xs text-[#F3E8D0] leading-relaxed">
                    No clear date stamp was deciphered from this frame. (GrocIQ never shows fake or assumed dates).
                  </p>
                  {rawOcrText ? (
                    <div className="text-[11px] text-[#A8B9A5] bg-[#111620] p-2 rounded border border-[#D8B56D]/20 mt-1">
                      <span className="text-[#D8B56D] font-semibold">Raw text deciphered: </span>
                      <span className="italic">"{rawOcrText.slice(0, 100)}{rawOcrText.length > 100 ? '...' : ''}"</span>
                    </div>
                  ) : (
                    <p className="text-[11px] text-[#A8B9A5]">
                      No legible text detected. Ensure proper lighting, steady hands, or upload a clear photo.
                    </p>
                  )}
                </div>
              </div>

              {/* Fast Inline Manual Completion */}
              <div className="p-3 rounded-lg bg-[#111620]/90 border border-[#D8B56D]/30 space-y-2">
                <div className="flex items-center justify-between text-xs text-[#D8B56D]">
                  <span className="font-semibold flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Complete Date Manually:
                  </span>
                  <span className="text-[10px] text-[#A8B9A5]">Choose quick estimate or custom date</span>
                </div>

                {/* Quick estimate pills */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: '+3 Days', days: 3 },
                    { label: '+1 Week', days: 7 },
                    { label: '+2 Weeks', days: 14 },
                    { label: '+1 Month', days: 30 }
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setManualDate(addDaysToToday(p.days))}
                      className="px-2.5 py-1 rounded bg-[#17251F] hover:bg-[#D8B56D] hover:text-[#171D2B] border border-[#D8B56D]/30 text-[11px] text-[#F3E8D0] transition-colors cursor-pointer"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* Date Input & Submit */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="date"
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-[#171D2B] border border-[#D8B56D]/40 text-[#F3E8D0] text-xs focus:outline-none focus:border-[#D8B56D]"
                  />
                  <button
                    onClick={() => handleApplyDate(manualDate)}
                    disabled={!manualDate}
                    className="px-3.5 py-1.5 bg-gradient-to-r from-[#D8B56D] to-[#ECC880] text-[#171D2B] font-bold text-xs rounded-lg hover:brightness-110 transition-all cursor-pointer disabled:opacity-40"
                  >
                    Apply Date
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Action Controls */}
          <div className="flex items-center gap-3 pt-1">
            {/* Primary 'Scan Expiry' Button */}
            <button
              onClick={handleScanExpiry}
              disabled={isReadingText || (!cameraActive && !capturedPreview)}
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-[#D8B56D] to-[#ECC880] text-[#171D2B] font-bold text-sm shadow-lg shadow-[#D8B56D]/15 hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isReadingText ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-[#171D2B]" />
                  <span>Deciphering Frame ({ocrProgress}%)...</span>
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4 text-[#171D2B]" />
                  <span>Scan Date Stamp</span>
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
