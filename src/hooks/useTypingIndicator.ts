import { useEffect, useRef, useCallback, useState } from 'react';
import { useSession } from '@/components/SessionContextProvider';

export interface TypingUser {
  userId: string;
  username: string;
}

/**
 * Real-time typing indicators using Supabase Realtime Broadcast.
 * Zero database cost — pure WebSocket channel events.
 */
export const useTypingIndicator = (
  chatId: string | undefined,
  chatType: 'public' | 'private' | undefined
) => {
  const { supabase, session } = useSession();
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const typingTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const currentUserId = session?.user?.id;
  const currentUsername =
    session?.user?.user_metadata?.first_name ||
    session?.user?.user_metadata?.username ||
    'Someone';

  useEffect(() => {
    if (!chatId || !chatType || !currentUserId) return;

    const channelName = `typing:${chatType}:${chatId}`;
    const channel = supabase.channel(channelName);
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'typing' }, ({ payload }: { payload: { userId: string; username: string } }) => {
        if (payload.userId === currentUserId) return;

        setTypingUsers(prev => {
          if (prev.some(u => u.userId === payload.userId)) return prev;
          return [...prev, { userId: payload.userId, username: payload.username }];
        });

        // Auto-clear after 3s of no updates
        const existing = typingTimeoutsRef.current.get(payload.userId);
        if (existing) clearTimeout(existing);
        const timeout = setTimeout(() => {
          setTypingUsers(prev => prev.filter(u => u.userId !== payload.userId));
          typingTimeoutsRef.current.delete(payload.userId);
        }, 3000);
        typingTimeoutsRef.current.set(payload.userId, timeout);
      })
      .on('broadcast', { event: 'stopped_typing' }, ({ payload }: { payload: { userId: string } }) => {
        if (payload.userId === currentUserId) return;
        setTypingUsers(prev => prev.filter(u => u.userId !== payload.userId));
        const existing = typingTimeoutsRef.current.get(payload.userId);
        if (existing) {
          clearTimeout(existing);
          typingTimeoutsRef.current.delete(payload.userId);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
      typingTimeoutsRef.current.forEach(t => clearTimeout(t));
      typingTimeoutsRef.current.clear();
      setTypingUsers([]);
    };
  }, [chatId, chatType, currentUserId, supabase]);

  const emitTyping = useCallback(() => {
    if (!channelRef.current || !currentUserId) return;
    channelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: currentUserId, username: currentUsername },
    });
  }, [currentUserId, currentUsername]);

  const emitStoppedTyping = useCallback(() => {
    if (!channelRef.current || !currentUserId) return;
    channelRef.current.send({
      type: 'broadcast',
      event: 'stopped_typing',
      payload: { userId: currentUserId },
    });
  }, [currentUserId]);

  return { typingUsers, emitTyping, emitStoppedTyping };
};
