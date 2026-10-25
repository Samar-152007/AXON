import React, { useState, useRef, useEffect } from 'react';
import Tesseract from 'tesseract.js';
import { 
  Camera, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Scan, 
  Calendar, 
  Sparkles, 
  Upload,
  VideoOff
} from 'lucide-react';
import { parseExpiryDate } from '../utils/dateParser';

/**
 * ProductScanner Component
 * 
 * Live video camera scanner for product packaging with client-side Tesseract.js OCR.
 * Captures video frames, extracts text, parses expiry dates via regex,
 * and auto-fills the dashboard's expiry date state.
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
  const [detectedDate, setDetectedDate] = useState(null);
  const [rawOcrText, setRawOcrText] = useState('');
  const [scanError, setScanError] = useState(null);
  const [capturedPreview, setCapturedPreview] = useState(null);

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
    setScanError(null);
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
    setDetectedDate(null);
    setRawOcrText('');
    setScanError(null);
    setCapturedPreview(null);
  };

  /**
   * Captures the current video frame and runs Tesseract.js OCR
   */
  const handleScanExpiry = async () => {
    if (isReadingText) return;

    setScanError(null);
    setDetectedDate(null);
    setRawOcrText('');

    let imageSource = null;

    // 1. Try grabbing frame from active video stream
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
      setScanError('No active camera frame or image to scan. Please adjust camera or upload a photo.');
      return;
    }

    // 2. Run Tesseract.js client-side OCR
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

      const extractedText = result?.data?.text || '';
      setRawOcrText(extractedText);

      // 3. Parse date using our dateParser utility
      const parsed = parseExpiryDate(extractedText);

      if (parsed && parsed.formatted) {
        setDetectedDate(parsed.formatted);
        if (showToast) {
          showToast(`Expiry date detected: ${parsed.formatted}`, 'success');
        }
        if (onExpiryDetected) {
          onExpiryDetected(parsed.formatted, parsed);
        }
      } else {
        // Fallback: prompt user to adjust camera
        setScanError(
          'No expiry date detected in frame. Please adjust the camera angle, ensure adequate lighting, or enter it manually.'
        );
        if (showToast) {
          showToast('No expiry date detected. Adjust camera and try again.', 'error');
        }
      }
    } catch (err) {
      console.error('Tesseract recognition error:', err);
      setScanError('Failed to process image: ' + (err.message || 'OCR processing error'));
      if (showToast) {
        showToast('OCR Error: ' + err.message, 'error');
      }
    } finally {
      setIsReadingText(false);
      setOcrProgress(0);
    }
  };

  // Upload fallback photo handler
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setCapturedPreview(event.target?.result);
      setScanError(null);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg rounded-2xl bg-[#171D2B] border border-[#D8B56D]/40 shadow-2xl overflow-hidden text-[#F3E8D0]">
        {/* Hidden Canvas for Frame Capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Hidden File Picker Fallback */}
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
                Point camera at date stamp (e.g. 'EXP 12/26', 'Use By: Oct 2026')
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
          <div className="relative w-full h-64 sm:h-72 rounded-xl bg-black overflow-hidden border border-[#D8B56D]/30 flex items-center justify-center">
            {/* Live Video Stream */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${cameraActive && !capturedPreview ? 'block' : 'hidden'}`}
            />

            {/* Static Image Preview if snapshot or file upload */}
            {capturedPreview && (
              <img 
                src={capturedPreview} 
                alt="Captured product frame" 
                className="w-full h-full object-contain bg-black" 
              />
            )}

            {/* Camera Fallback / Error State */}
            {!cameraActive && !capturedPreview && (
              <div className="p-6 text-center space-y-3">
                <VideoOff className="w-10 h-10 text-[#D8B56D]/40 mx-auto" />
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
              <div className="absolute inset-8 pointer-events-none border-2 border-dashed border-[#D8B56D]/60 rounded-xl flex items-center justify-center">
                <div className="text-[11px] font-semibold text-[#D8B56D] bg-[#171D2B]/85 px-3 py-1 rounded-full border border-[#D8B56D]/40 shadow-md">
                  Align Expiry Date Inside Reticle
                </div>
              </div>
            )}

            {/* Loading State Overlay while Tesseract processes */}
            {isReadingText && (
              <div className="absolute inset-0 z-20 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center space-y-3 text-[#F3E8D0]">
                <div className="relative">
                  <RefreshCw className="w-10 h-10 text-[#D8B56D] animate-spin" />
                  <Sparkles className="w-4 h-4 text-emerald-400 absolute -top-1 -right-1 animate-pulse" />
                </div>
                <div className="text-center space-y-1">
                  <p className="font-enchanted font-bold text-sm text-[#F3E8D0]">
                    Reading Expiry Date...
                  </p>
                  <p className="text-xs text-[#A8B9A5]">
                    Running client-side Tesseract.js OCR ({ocrProgress}%)
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Success Result Display */}
          {detectedDate && (
            <div className="p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-200 flex items-center justify-between animate-fade-in">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400">
                    Expiry Date Detected
                  </span>
                  <div className="font-enchanted text-lg font-bold text-white flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#D8B56D]" />
                    <span>{detectedDate}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                Apply to Dashboard
              </button>
            </div>
          )}

          {/* Error / Fallback Alert Prompt */}
          {scanError && (
            <div className="p-3.5 rounded-xl bg-[#5B1F32]/40 border border-red-500/40 text-red-200 text-xs flex items-start gap-2.5 animate-fade-in">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold text-red-300">Date Detection Notice</span>
                <p className="text-[#F3E8D0] leading-relaxed">{scanError}</p>
                <p className="text-[11px] text-[#A8B9A5]">
                  Tip: Hold the product steady, avoid shadows, and ensure the date text is sharply in focus.
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
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
                  <span>Processing Frame ({ocrProgress}%)...</span>
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4 text-[#171D2B]" />
                  <span>Scan Expiry</span>
                </>
              )}
            </button>

            {/* Snap from file / retake */}
            {capturedPreview ? (
              <button
                onClick={() => {
                  setCapturedPreview(null);
                  startCamera();
                }}
                disabled={isReadingText}
                className="py-3 px-3.5 rounded-xl bg-[#111620] hover:bg-[#17251F] border border-[#D8B56D]/30 text-xs text-[#D8B56D] font-semibold transition-colors cursor-pointer"
                title="Retake camera stream"
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
