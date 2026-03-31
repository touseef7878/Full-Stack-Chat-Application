import { useEffect, useRef, useState, useCallback } from 'react';
import { useSession } from '@/components/SessionContextProvider';

export interface OnlineUser {
  userId: string;
  username: string;
  onlineAt: string;
}

/**
 * Real-time presence tracking using Supabase Realtime Presence.
 * Tracks who is online in a given chat room — zero DB writes.
 */
export const usePresence = (
  chatId: string | undefined,
  chatType: 'public' | 'private' | undefined
) => {
  const { supabase, session } = useSession();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const currentUserId = session?.user?.id;

  const syncPresence = useCallback((state: Record<string, any[]>) => {
    const users: OnlineUser[] = [];
    Object.values(state).forEach(presences => {
      presences.forEach((p: any) => {
        if (p.userId) {
          users.push({ userId: p.userId, username: p.username || 'User', onlineAt: p.onlineAt });
        }
      });
    });
    setOnlineUsers(users);
  }, []);

  useEffect(() => {
    if (!chatId || !chatType || !currentUserId) return;

    const channelName = `presence:${chatType}:${chatId}`;
    const channel = supabase.channel(channelName, {
      config: { presence: { key: currentUserId } },
    });
    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        syncPresence(channel.presenceState());
      })
      .on('presence', { event: 'join' }, ({ newPresences }: { newPresences: any[] }) => {
        setOnlineUsers(prev => {
          const incoming = newPresences
            .filter((p: any) => p.userId && !prev.some(u => u.userId === p.userId))
            .map((p: any) => ({ userId: p.userId, username: p.username || 'User', onlineAt: p.onlineAt }));
          return [...prev, ...incoming];
        });
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }: { leftPresences: any[] }) => {
        const leftIds = new Set(leftPresences.map((p: any) => p.userId));
        setOnlineUsers(prev => prev.filter(u => !leftIds.has(u.userId)));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            userId: currentUserId,
            username:
              session?.user?.user_metadata?.first_name ||
              session?.user?.user_metadata?.username ||
              'User',
            onlineAt: new Date().toISOString(),
          });
        }
      });

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
      channelRef.current = null;
      setOnlineUsers([]);
    };
  }, [chatId, chatType, currentUserId, supabase, session, syncPresence]);

  const isUserOnline = useCallback(
    (userId: string) => onlineUsers.some(u => u.userId === userId),
    [onlineUsers]
  );

  return { onlineUsers, onlineCount: onlineUsers.length, isUserOnline };
};
