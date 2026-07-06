import { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, Upload, CheckCircle2, AlertCircle } from 'lucide-react';

// Captures a selfie via webcam (with a file-upload fallback for devices/browsers
// without camera access) and reports it back as a base64 JPEG data URL.
export default function SelfieCapture({ value, onChange, label = 'Take a selfie', required = true }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [mode, setMode] = useState(value ? 'preview' : 'idle'); // idle | camera | preview
  const [cameraError, setCameraError] = useState(false);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => stopStream(), [stopStream]);

  const startCamera = async () => {
    setCameraError(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      streamRef.current = stream;
      setMode('camera');
      // Wait a tick for the <video> element to mount before attaching the stream
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      }, 0);
    } catch (err) {
      setCameraError(true);
    }
  };

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    stopStream();
    onChange(dataUrl);
    setMode('preview');
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      onChange(reader.result);
      setMode('preview');
    };
    reader.readAsDataURL(file);
  };

  const retake = () => {
    onChange(null);
    setMode('idle');
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label} {required && <span className="text-red-400">*</span>}</label>

      {mode === 'idle' && (
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center">
          <Camera size={28} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-500 mb-4">We need a clear photo of your face for identity verification.</p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button type="button" onClick={startCamera}
              className="bg-primary-600 hover:bg-primary-700 text-white text-sm px-4 py-2.5 rounded-lg flex items-center gap-2">
              <Camera size={15} /> Use camera
            </button>
            <label className="border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm px-4 py-2.5 rounded-lg flex items-center gap-2 cursor-pointer">
              <Upload size={15} /> Upload photo
              <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
            </label>
          </div>
          {cameraError && (
            <p className="text-xs text-red-500 mt-3 flex items-center justify-center gap-1">
              <AlertCircle size={12} /> Couldn't access camera. Please upload a photo instead.
            </p>
          )}
        </div>
      )}

      {mode === 'camera' && (
        <div className="rounded-xl overflow-hidden border border-gray-200 bg-black">
          <video ref={videoRef} autoPlay playsInline muted className="w-full aspect-[4/3] object-cover scale-x-[-1]" />
          <div className="p-3 bg-gray-900 flex justify-center">
            <button type="button" onClick={capture}
              className="bg-white text-gray-900 text-sm px-5 py-2 rounded-full font-medium flex items-center gap-2">
              <Camera size={15} /> Capture
            </button>
          </div>
        </div>
      )}

      {mode === 'preview' && value && (
        <div className="relative rounded-xl overflow-hidden border border-gray-200">
          <img src={value} alt="Selfie preview" className="w-full aspect-[4/3] object-cover" />
          <div className="absolute top-2 right-2 bg-white/90 rounded-full p-1">
            <CheckCircle2 size={18} className="text-green-600" />
          </div>
          <button type="button" onClick={retake}
            className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-white/90 hover:bg-white text-gray-700 text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm">
            <RefreshCw size={12} /> Retake
          </button>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
