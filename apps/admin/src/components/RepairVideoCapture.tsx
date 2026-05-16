'use client';

/**
 * RepairVideoCapture — post-repair "proof-of-function" video recorder.
 *
 * Supports:
 *   1. Live camera capture (up to 10 s)
 *   2. File picker — choose any existing video file from device
 *
 * Video is uploaded to Cloudinary via the gateway → worker-service.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Video, FolderOpen, CloudUpload, Circle, Square } from 'lucide-react';

// The gateway URL — falls back to same-origin for production setups
const GATEWAY = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface RepairVideoCaptureProps {
  ticketRef:       string;
  existingVideoUrl?: string;
  onUploaded:      (cloudinaryUrl: string) => void;
  className?:      string;
}

// ─── Component ───────────────────────────────────────────────────────────────────

const MAX_DURATION_MS = 10_000;  // 10 seconds hard limit

export default function RepairVideoCapture({
  ticketRef,
  existingVideoUrl,
  onUploaded,
  className = '',
}: RepairVideoCaptureProps) {
  const videoRef     = useRef<HTMLVideoElement>(null);
  const streamRef    = useRef<MediaStream | null>(null);
  const recorderRef  = useRef<MediaRecorder | null>(null);
  const chunksRef    = useRef<Blob[]>([]);
  const timerRef     = useRef<ReturnType<typeof setTimeout>>();
  const countRef     = useRef<ReturnType<typeof setInterval>>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode]       = useState<'idle' | 'camera' | 'file'>('idle');
  const [phase, setPhase]     = useState<'idle' | 'preview' | 'recording' | 'review' | 'uploading' | 'done' | 'error'>('idle');
  const [countdown, setCountdown]   = useState(10);
  const [blobUrl, setBlobUrl]       = useState<string | null>(null);
  const [pickedBlob, setPickedBlob] = useState<Blob | null>(null);
  const [pickedName, setPickedName] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);

  // ── Cleanup ───────────────────────────────────────────────────────────

  const cleanup = useCallback(() => {
    clearTimeout(timerRef.current);
    clearInterval(countRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const resetAll = useCallback(() => {
    cleanup();
    setBlobUrl(null);
    setPickedBlob(null);
    setPickedName('');
    setPhase('idle');
    setMode('idle');
    setUploadError(null);
  }, [cleanup]);

  // ── Start camera preview ─────────────────────────────────────────────────

  const startPreview = async () => {
    setMode('camera');
    setPhase('preview');
    setUploadError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        await videoRef.current.play();
      }
    } catch (err) {
      setPhase('error');
      setUploadError((err as Error).message);
    }
  };

  // ── File picker ─────────────────────────────────────────────────────────────

  const openFilePicker = () => fileInputRef.current?.click();

  const handleFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMode('file');
    setUploadError(null);
    setPickedBlob(file);
    setPickedName(file.name);
    const url = URL.createObjectURL(file);
    setBlobUrl(url);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.src = url;
      videoRef.current.muted = false;
      videoRef.current.loop = true;
      videoRef.current.play().catch(() => {});
    }
    setPhase('review');
    // reset input so same file can be re-picked
    e.target.value = '';
  };

  // ── Start recording ───────────────────────────────────────────────────────

  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    setCountdown(10);

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : 'video/webm';

    const recorder = new MediaRecorder(streamRef.current, { mimeType });
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const url  = URL.createObjectURL(blob);
      setBlobUrl(url);

      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;

      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.src = url;
        videoRef.current.muted = false;
        videoRef.current.loop = true;
        videoRef.current.play().catch(() => {});
      }
      setPhase('review');
    };

    recorder.start(250);
    setPhase('recording');

    countRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(countRef.current); return 0; }
        return c - 1;
      });
    }, 1000);

    timerRef.current = setTimeout(() => stopRecording(), MAX_DURATION_MS);
  };

  const stopRecording = useCallback(() => {
    clearTimeout(timerRef.current);
    clearInterval(countRef.current);
    recorderRef.current?.stop();
  }, []);

  // ── Upload to Cloudinary via gateway ─────────────────────────────────────────

  const uploadVideo = async () => {
    setPhase('uploading');
    setUploadError(null);
    try {
      let blob: Blob;
      let filename: string;
      if (mode === 'file' && pickedBlob) {
        blob     = pickedBlob;
        filename = pickedName || `${ticketRef}-proof.mp4`;
      } else {
        if (!chunksRef.current.length) return;
        blob     = new Blob(chunksRef.current, { type: 'video/webm' });
        filename = `${ticketRef}-proof.webm`;
      }

      const formData = new FormData();
      formData.append('file',      blob, filename);
      formData.append('ticketRef', ticketRef);

      const res = await fetch(`${GATEWAY}/api/v1/worker/upload-repair-video`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error(await res.text());
      const { url } = await res.json();
      setPhase('done');
      onUploaded(url);
    } catch (err) {
      setUploadError((err as Error).message ?? 'Upload failed');
      setPhase('review');
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,video/*"
        className="hidden"
        onChange={handleFilePicked}
      />

      <div className="flex items-center gap-2">
        <span className="text-indigo-400 text-sm font-semibold flex items-center gap-1.5"><Video className="w-4 h-4" /> Post-Repair Video</span>
        {existingVideoUrl && phase === 'idle' && (
          <span className="text-xs bg-green-900/40 text-green-400 border border-green-800 rounded px-2 py-0.5">
            ✓ Video recorded
          </span>
        )}
      </div>

      {/* Existing video playback */}
      {existingVideoUrl && phase === 'idle' && (
        <div className="rounded-xl overflow-hidden border border-zinc-700 bg-zinc-900">
          <video src={existingVideoUrl} controls className="w-full max-w-md" />
          <p className="text-xs text-zinc-500 px-3 py-2">Repair proof video · {ticketRef}</p>
        </div>
      )}

      {/* Viewfinder / playback */}
      {phase !== 'idle' && (
        <div className="relative rounded-xl overflow-hidden border border-zinc-700 bg-zinc-900 max-w-md">
          <video ref={videoRef} className="w-full aspect-video object-cover" playsInline />

          {phase === 'recording' && (
            <div className="absolute top-3 right-3 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-white text-sm font-bold font-mono bg-black/60 px-2 rounded">{countdown}s</span>
            </div>
          )}
          {phase === 'uploading' && (
            <div className="absolute inset-0 bg-zinc-900/80 flex items-center justify-center flex-col gap-2">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-white text-sm">Uploading…</p>
            </div>
          )}
          {phase === 'done' && (
            <div className="absolute inset-0 bg-green-900/60 flex items-center justify-center flex-col gap-2">
              <span className="text-5xl flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-400"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></span>
              <p className="text-white font-semibold">Uploaded successfully</p>
            </div>
          )}
          {mode === 'file' && phase === 'review' && (
            <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-3 py-1">
              <p className="text-white text-xs truncate flex items-center gap-1"><FolderOpen className="w-3 h-3" /> {pickedName}</p>
            </div>
          )}
        </div>
      )}

      {uploadError && <p className="text-red-400 text-sm">{uploadError}</p>}

      {/* Controls */}
      <div className="flex gap-2 flex-wrap">
        {phase === 'idle' && (
          <>
            <button
              onClick={startPreview}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors flex items-center gap-2"
            >
              <Video className="w-4 h-4" /> {existingVideoUrl ? 'Re-record' : 'Record Video'}
            </button>
            <button
              onClick={openFilePicker}
              className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-medium transition-colors flex items-center gap-2"
            >
              <FolderOpen className="w-4 h-4" /> Choose File
            </button>
          </>
        )}
        {phase === 'preview' && (
          <button onClick={startRecording}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium">
            ⏺ Start Recording (max 10s)
          </button>
        )}
        {phase === 'recording' && (
          <button onClick={stopRecording}
            className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-medium">
            ⏹ Stop
          </button>
        )}
        {phase === 'review' && (
          <>
            <button onClick={uploadVideo}
              className="px-4 py-2 rounded-lg bg-green-700 hover:bg-green-600 text-white text-sm font-medium flex items-center gap-2">
              <CloudUpload className="w-4 h-4" /> Save to Repair Record
            </button>
            <button onClick={resetAll}
              className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-medium">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline mr-1"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>{mode === 'file' ? 'Change File' : 'Re-record'}
            </button>
          </>
        )}
        {(phase === 'done' || phase === 'error') && (
          <button onClick={resetAll}
            className="px-3 py-2 rounded-lg bg-zinc-700 text-white text-sm">Done</button>
        )}
        {phase !== 'idle' && phase !== 'recording' && phase !== 'uploading' && (
          <button onClick={resetAll}
            className="px-3 py-2 rounded-lg bg-zinc-800 text-zinc-400 text-sm">Cancel</button>
        )}
      </div>

      <p className="text-xs text-zinc-500">
        Record live (max 10s) or upload an existing video · stored in Cloudinary · visible to customer in their portal
      </p>
    </div>
  );
}