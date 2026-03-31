import React, { useState, useCallback, useRef, memo } from 'react';
import { Button } from "@/components/ui/button";
import { Send, Lock, Mic, Square, X } from "lucide-react";
import { useSession } from '@/components/SessionContextProvider';
import { Link } from 'react-router-dom';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { cn } from '@/lib/utils';

interface MessageInputProps {
  onSendMessage: (message: string) => Promise<void> | void;
  onSendVoice?: (blob: Blob, duration: number) => Promise<void> | void;
  isSending?: boolean;
  onTyping?: () => void;
  onStoppedTyping?: () => void;
}

const formatDuration = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

const MessageInput: React.FC<MessageInputProps> = memo(({
  onSendMessage,
  onSendVoice,
  isSending = false,
  onTyping,
  onStoppedTyping,
}) => {
  const { isGuest } = useSession();
  const [message, setMessage] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordedDurationRef = useRef(0);

  const { recordingState, duration, startRecording, stopRecording, cancelRecording } = useVoiceRecorder();
  const isRecording = recordingState === 'recording';

  const handleSend = useCallback(async () => {
    if (message.trim() && !isGuest && !isSending) {
      const content = message.trim();
      setMessage('');
      if (inputRef.current) inputRef.current.style.height = 'auto';
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      onStoppedTyping?.();
      await onSendMessage(content);
    }
  }, [message, onSendMessage, isGuest, isSending, onStoppedTyping]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isGuest && !isSending) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend, isGuest, isSending]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!isGuest) {
      setMessage(e.target.value);
      e.target.style.height = 'auto';
      e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
      if (e.target.value.trim()) {
        onTyping?.();
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => { onStoppedTyping?.(); }, 2500);
      } else {
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        onStoppedTyping?.();
      }
    }
  }, [isGuest, onTyping, onStoppedTyping]);

  const handleMicClick = useCallback(async () => {
    if (isRecording) return;
    const ok = await startRecording();
    if (!ok) {
      // Microphone permission denied or not available
      return;
    }
    recordedDurationRef.current = 0;
  }, [isRecording, startRecording]);

  const handleStopAndSend = useCallback(async () => {
    const recording = await stopRecording();
    if (!recording || !onSendVoice) return;
    // duration was tracked by the hook
    await onSendVoice(recording.blob, duration);
  }, [stopRecording, onSendVoice, duration]);

  const handleCancel = useCallback(() => {
    cancelRecording();
  }, [cancelRecording]);

  if (isGuest) {
    return (
      <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-t border-border bg-card/80 backdrop-blur-sm pb-[calc(0.625rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-muted/60 border border-border/50">
          <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <p className="text-sm text-muted-foreground flex-1">
            <Link to="/login" className="text-[hsl(var(--accent-primary))] font-medium hover:underline">Sign in</Link>
            {' '}or{' '}
            <Link to="/register" className="text-[hsl(var(--accent-primary))] font-medium hover:underline">create an account</Link>
            {' '}to send messages
          </p>
        </div>
      </div>
    );
  }

  // Recording UI
  if (isRecording) {
    return (
      <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-t border-border bg-card/80 backdrop-blur-sm pb-[calc(0.625rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-3 bg-background rounded-xl border border-red-400/60 px-3 py-2 ring-1 ring-red-400/20">
          {/* Cancel */}
          <button
            onClick={handleCancel}
            className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            aria-label="Cancel recording"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Pulse + timer */}
          <div className="flex items-center gap-2 flex-1">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
            <span className="text-sm font-mono text-red-500 tabular-nums">{formatDuration(duration)}</span>
            {/* Animated waveform bars */}
            <div className="flex items-center gap-[2px] flex-1">
              {Array.from({ length: 20 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-red-400/60 rounded-full flex-shrink-0"
                  style={{
                    width: 2,
                    height: `${6 + Math.sin((Date.now() / 200) + i) * 4}px`,
                    animation: `pulse ${0.4 + (i % 3) * 0.15}s ease-in-out infinite alternate`,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Send */}
          <button
            onClick={handleStopAndSend}
            className="flex-shrink-0 w-8 h-8 rounded-lg bg-[hsl(var(--accent-primary))] hover:bg-[hsl(var(--accent-primary)/0.85)] flex items-center justify-center text-white transition-colors"
            aria-label="Send voice message"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-t border-border bg-card/80 backdrop-blur-sm pb-[calc(0.625rem+env(safe-area-inset-bottom))]">
      <div className="flex items-end gap-2 bg-background rounded-xl border border-border/80 px-3 py-2 focus-within:border-[hsl(var(--accent-primary)/0.6)] focus-within:ring-1 focus-within:ring-[hsl(var(--accent-primary)/0.2)] transition-all">
        <textarea
          ref={inputRef}
          rows={1}
          placeholder="Type a message…"
          value={message}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent text-sm resize-none outline-none placeholder:text-muted-foreground py-1.5 max-h-[120px] leading-relaxed"
          style={{ fontSize: '16px' }}
        />

        {/* Mic button — shown when input is empty */}
        {!message.trim() && (
          <button
            onClick={handleMicClick}
            className={cn(
              "flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center mb-0.5 transition-all",
              "text-muted-foreground hover:text-[hsl(var(--accent-primary))] hover:bg-[hsl(var(--accent-primary)/0.1)]"
            )}
            aria-label="Record voice message"
          >
            <Mic className="h-4 w-4" />
          </button>
        )}

        {/* Send button — shown when there's text */}
        {message.trim() && (
          <Button
            onClick={handleSend}
            disabled={isSending}
            size="icon"
            className="h-8 w-8 rounded-lg bg-[hsl(var(--accent-primary))] hover:bg-[hsl(var(--accent-primary)/0.85)] disabled:opacity-40 flex-shrink-0 mb-0.5 transition-all"
          >
            {isSending ? (
              <span className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            <span className="sr-only">Send</span>
          </Button>
        )}
      </div>
      <p className="hidden sm:block text-[10px] text-muted-foreground mt-1.5 px-1">Shift+Enter for new line</p>
    </div>
  );
});

MessageInput.displayName = 'MessageInput';
export default MessageInput;
