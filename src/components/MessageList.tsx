"use client";

import React, { useRef, useEffect } from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  profile?: {
    username: string;
    avatar_url?: string;
    first_name?: string;
    last_name?: string;
  } | null;
}

interface MessageListProps {
  messages: Message[];
  currentUserId: string | undefined;
}

const isEmail = (str: string) => /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/.test(str);

const getDisplayName = (profile: Message['profile'], userId: string) => {
  if (!profile) return `User ${userId.slice(0, 6)}`;
  if (profile.first_name) return profile.first_name;
  if (profile.username && !isEmail(profile.username)) return profile.username;
  return `User ${userId.slice(0, 6)}`;
};

const formatTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const MessageList: React.FC<MessageListProps> = ({ messages, currentUserId }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 10);
    return () => clearTimeout(timer);
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2 p-8">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-2">
          <svg className="w-6 h-6 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <p className="text-sm font-medium">No messages yet</p>
        <p className="text-xs">Be the first to say something!</p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 bg-background">
      <div className="px-4 py-4 space-y-1">
        {messages.map((message, index) => {
          const isCurrentUser = message.sender_id === currentUserId;
          const senderName = isCurrentUser ? 'You' : getDisplayName(message.profile, message.sender_id);
          const senderAvatar = message.profile?.avatar_url || `https://api.dicebear.com/7.x/lorelei/svg?seed=${message.sender_id}`;
          const isTemp = message.id.startsWith('temp-');

          // Group consecutive messages from same sender
          const prevMsg = messages[index - 1];
          const isFirstInGroup = !prevMsg || prevMsg.sender_id !== message.sender_id;

          return (
            <div
              key={message.id}
              className={cn(
                "flex items-end gap-2",
                isCurrentUser ? "justify-end" : "justify-start",
                isFirstInGroup ? "mt-4" : "mt-0.5"
              )}
            >
              {/* Avatar for others — only on first in group */}
              {!isCurrentUser && (
                <div className="w-7 flex-shrink-0">
                  {isFirstInGroup && (
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={senderAvatar} alt={senderName} />
                      <AvatarFallback className="text-[10px] bg-accent/20">{senderName.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  )}
                </div>
              )}

              <div className={cn("flex flex-col max-w-[72%]", isCurrentUser ? "items-end" : "items-start")}>
                {/* Name + time — only on first in group */}
                {isFirstInGroup && (
                  <div className={cn("flex items-baseline gap-2 mb-1 px-1", isCurrentUser ? "flex-row-reverse" : "flex-row")}>
                    <span className="text-[11px] font-semibold text-foreground/70">{senderName}</span>
                    <span className="text-[10px] text-muted-foreground">{formatTime(message.created_at)}</span>
                  </div>
                )}

                <div
                  className={cn(
                    "px-3.5 py-2.5 text-sm leading-relaxed break-words",
                    isCurrentUser
                      ? "bg-[hsl(var(--accent-primary))] text-white rounded-2xl rounded-br-sm"
                      : "bg-card border border-border/60 text-foreground rounded-2xl rounded-bl-sm",
                    isTemp && "opacity-60"
                  )}
                >
                  {message.content}
                </div>

                {/* Time for non-first messages */}
                {!isFirstInGroup && (
                  <span className="text-[10px] text-muted-foreground mt-0.5 px-1">{formatTime(message.created_at)}</span>
                )}
              </div>

              {/* Avatar for current user — only on first in group */}
              {isCurrentUser && (
                <div className="w-7 flex-shrink-0">
                  {isFirstInGroup && (
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={senderAvatar} alt={senderName} />
                      <AvatarFallback className="text-[10px] bg-[hsl(var(--accent-primary)/0.2)]">{senderName.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  )}
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>
  );
};

export default MessageList;
