import { useState, useRef, useCallback } from 'react';

export type RecordingState = 'idle' | 'recording' | 'stopped';

export interface VoiceRecording {
  blob: Blob;
  url: string;
  duration: number; // seconds
  mimeType: string;
}

export const useVoiceRecorder = () => {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Pick best supported format
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start(100); // collect chunks every 100ms
      setRecordingState('recording');
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);

      return true;
    } catch {
      return false;
    }
  }, []);

  const stopRecording = useCallback((): Promise<VoiceRecording | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        resolve(null);
        return;
      }

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);

        // Stop all tracks
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;

        setRecordingState('idle');
        setDuration(0);

        resolve({ blob, url, duration: 0, mimeType });
      };

      recorder.stop();
      setRecordingState('stopped');
    });
  }, []);

  const cancelRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    chunksRef.current = [];
    setRecordingState('idle');
    setDuration(0);
  }, []);

  return { recordingState, duration, startRecording, stopRecording, cancelRecording };
};
