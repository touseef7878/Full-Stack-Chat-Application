import React, { useState, useCallback, useRef, memo } from 'react';
import { Button } from "@/components/ui/button";
import { Send, Lock } from "lucide-react";
import { useSession } from '@/components/SessionContextProvider';
import { Link } from 'react-router-dom';

interface MessageInputProps {
  onSendMessage: (message: string) => Promise<void> | void;
  isSending?: boolean;
}

const MessageInput: React.FC<MessageInputProps> = memo(({ onSendMessage, isSending = false }) => {
  const { isGuest } = useSession();
  const [message, setMessage] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(async () => {
    if (message.trim() && !isGuest && !isSending) {
      const content = message.trim();
      setMessage('');
      // Reset textarea height
      if (inputRef.current) inputRef.current.style.height = 'auto';
      await onSendMessage(content);
    }
  }, [message, onSendMessage, isGuest, isSending]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isGuest && !isSending) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend, isGuest, isSending]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!isGuest) {
      setMessage(e.target.value);
      // Auto-resize
      e.target.style.height = 'auto';
      e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
    }
  }, [isGuest]);

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
        <Button
          onClick={handleSend}
          disabled={!message.trim() || isSending}
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
      </div>
      <p className="hidden sm:block text-[10px] text-muted-foreground mt-1.5 px-1">Shift+Enter for new line</p>
    </div>
  );
});

MessageInput.displayName = 'MessageInput';
export default MessageInput;
