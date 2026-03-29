"use client";

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useSession } from '@/components/SessionContextProvider';
import { showError } from '@/utils/toast';
import CreateChatRoomDialog from './CreateChatRoomDialog';
import StartPrivateChatDialog from './StartPrivateChatDialog';
import ProfileSettingsDialog from './ProfileSettingsDialog';
import MessageRequestsDialog from './MessageRequestsDialog';
import { Users, MessageSquare, Lock } from 'lucide-react';

interface ChatRoom {
  id: string;
  name: string;
  creator_id: string;
  unread_count?: number;
}

interface SupabaseProfile {
  id: string;
  username: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
}

interface PrivateChat {
  id: string;
  user1_id: string;
  user2_id: string;
  other_user_profile: SupabaseProfile;
  unread_count?: number;
}

interface SidebarProps {
  selectedChatId?: string;
  selectedChatType?: 'public' | 'private';
  onSelectChat: (chatId: string, chatName: string, chatType: 'public' | 'private') => void;
}

const Sidebar: React.FC<SidebarProps> = ({ selectedChatId, selectedChatType, onSelectChat }) => {
  const { supabase, session, isGuest } = useSession();
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [privateChats, setPrivateChats] = useState<PrivateChat[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const currentUserId = session?.user?.id;
  const hasFetchedRef = useRef(false);

  const fetchUnreadCounts = useCallback(async (
    rooms: ChatRoom[],
    privates: PrivateChat[]
  ): Promise<{ rooms: ChatRoom[]; privates: PrivateChat[] }> => {
    if (isGuest || !currentUserId) return { rooms, privates };

    const [roomCounts, privateCounts] = await Promise.all([
      Promise.all(rooms.map(async (room) => {
        try {
          const { data } = await supabase.rpc('get_unread_count', {
            p_chat_room_id: room.id,
            p_user_id: currentUserId,
          });
          return { id: room.id, count: typeof data === 'number' ? data : 0 };
        } catch {
          return { id: room.id, count: 0 };
        }
      })),
      Promise.all(privates.map(async (chat) => {
        try {
          const { data } = await supabase.rpc('get_private_unread_count', {
            p_private_chat_id: chat.id,
            p_user_id: currentUserId,
          });
          return { id: chat.id, count: typeof data === 'number' ? data : 0 };
        } catch {
          return { id: chat.id, count: 0 };
        }
      })),
    ]);

    const roomCountMap: Record<string, number> = {};
    roomCounts.forEach((r) => { roomCountMap[r.id] = r.count; });
    const privateCountMap: Record<string, number> = {};
    privateCounts.forEach((r) => { privateCountMap[r.id] = r.count; });

    return {
      rooms: rooms.map((r) => ({ ...r, unread_count: roomCountMap[r.id] ?? 0 })),
      privates: privates.map((p) => ({ ...p, unread_count: privateCountMap[p.id] ?? 0 })),
    };
  }, [currentUserId, supabase, isGuest]);

  const fetchChats = useCallback(async (silent = false) => {
    if (!currentUserId && !isGuest) {
      setInitialLoading(false);
      return;
    }
    if (!silent) setInitialLoading(true);

    let rooms: ChatRoom[] = [];
    let privates: PrivateChat[] = [];

    try {
      const { data: publicRooms, error } = await supabase
        .from('chat_rooms')
        .select('id, name, creator_id')
        .order('created_at', { ascending: false });
      if (error) showError('Failed to load public chat rooms: ' + error.message);
      else if (publicRooms) {
        rooms = publicRooms.map((r: any) => ({
          id: r.id,
          name: r.name,
          creator_id: r.creator_id,
          unread_count: 0,
        }));
      }
    } catch {
      showError('Unexpected error loading public chat rooms.');
    }

    if (!isGuest && currentUserId) {
      try {
        const { data: privateConvos, error } = await supabase
          .from('private_chats')
          .select(
            'id, user1_id, user2_id, user1:user1_id(id, username, first_name, last_name, avatar_url), user2:user2_id(id, username, first_name, last_name, avatar_url)'
          )
          .order('id', { ascending: false });
        if (error) showError('Failed to load private chats: ' + error.message);
        else if (privateConvos) {
          privates = privateConvos
            .map((convo: any) => {
              const u1 = convo.user1?.[0];
              const u2 = convo.user2?.[0];
              if (!u1 || !u2) return null;
              const otherUser = u1.id === currentUserId ? u2 : u1;
              return {
                id: convo.id,
                user1_id: convo.user1_id,
                user2_id: convo.user2_id,
                other_user_profile: otherUser,
                unread_count: 0,
              };
            })
            .filter(Boolean) as PrivateChat[];
        }
      } catch {
        showError('Unexpected error loading private chats.');
      }
    }

    const withCounts = await fetchUnreadCounts(rooms, privates);
    setChatRooms(withCounts.rooms);
    setPrivateChats(withCounts.privates);
    setInitialLoading(false);
  }, [currentUserId, supabase, isGuest, fetchUnreadCounts]);

  // Instantly clear the badge for the selected chat — no waiting for DB/realtime
  useEffect(() => {
    if (!selectedChatId || !selectedChatType) return;
    if (selectedChatType === 'public') {
      setChatRooms((prev) =>
        prev.map((r) => r.id === selectedChatId ? { ...r, unread_count: 0 } : r)
      );
    } else {
      setPrivateChats((prev) =>
        prev.map((c) => c.id === selectedChatId ? { ...c, unread_count: 0 } : c)
      );
    }
  }, [selectedChatId, selectedChatType]);

  const refreshUnreadCounts = useCallback(() => {
    setChatRooms((prev) => {
      if (prev.length === 0) return prev;
      fetchUnreadCounts(prev, []).then(({ rooms }) => setChatRooms(rooms));
      return prev;
    });
    setPrivateChats((prev) => {
      if (prev.length === 0) return prev;
      fetchUnreadCounts([], prev).then(({ privates }) => setPrivateChats(privates));
      return prev;
    });
  }, [fetchUnreadCounts]);

  useEffect(() => {
    if ((session || isGuest) && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchChats();
    }
  }, [session, isGuest, fetchChats]);

  useEffect(() => {
    if (!session && !isGuest) return;

    const channel = supabase
      .channel('sidebar-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_rooms' }, () => fetchChats(true))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'private_chats' }, () => fetchChats(true))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => refreshUnreadCounts())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'private_messages' }, () => refreshUnreadCounts())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_chat_read_status',
        filter: `user_id=eq.${currentUserId || 'none'}`,
      }, () => refreshUnreadCounts())
      .subscribe();

    const handleRefetch = () => fetchChats(true);
    window.addEventListener('sidebar:refetch', handleRefetch);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('sidebar:refetch', handleRefetch);
    };
  }, [session, isGuest, supabase, currentUserId, fetchChats, refreshUnreadCounts]);

  if (initialLoading) {
    return (
      <div className="flex h-full flex-col bg-sidebar-background">
        <div className="p-4 border-b border-sidebar-border">
          <div className="h-7 w-24 rounded-lg bg-muted animate-pulse" />
        </div>
        <div className="p-3 space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl">
              <div className="h-11 w-11 rounded-full bg-muted animate-pulse flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
                <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full max-h-screen flex-col bg-sidebar-background text-foreground">
      {/* Mobile Header */}
      <div className="p-4 border-b border-sidebar-border md:hidden">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Chats</h2>
          {!isGuest ? (
            <div className="flex items-center space-x-2">
              <CreateChatRoomDialog onChatRoomCreated={() => fetchChats(true)} />
              <StartPrivateChatDialog
                onChatSelected={(id: string, name: string, type: 'private') => { onSelectChat(id, name, type); fetchChats(true); }}
              />
              <MessageRequestsDialog onRequestAccepted={() => fetchChats(true)} />
              <ProfileSettingsDialog onProfileUpdated={() => fetchChats(true)} />
            </div>
          ) : (
            <div className="flex items-center space-x-2 text-muted-foreground">
              <Lock className="h-4 w-4" /><span className="text-sm">Guest Mode</span>
            </div>
          )}
        </div>
      </div>

      {/* Desktop Header */}
      <div className="hidden md:flex items-center justify-between p-4 border-b border-sidebar-border">
        <h2 className="text-xl font-semibold">Chats</h2>
        {!isGuest ? (
          <div className="flex items-center space-x-2">
            <CreateChatRoomDialog onChatRoomCreated={() => fetchChats(true)} />
            <StartPrivateChatDialog
              onChatSelected={(id: string, name: string, type: 'private') => { onSelectChat(id, name, type); fetchChats(true); }}
            />
            <MessageRequestsDialog onRequestAccepted={() => fetchChats(true)} />
            <ProfileSettingsDialog onProfileUpdated={() => fetchChats(true)} />
          </div>
        ) : (
          <div className="flex items-center space-x-2 text-muted-foreground">
            <Lock className="h-4 w-4" />
            <span className="text-sm">Guest Mode</span>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {chatRooms.length === 0 && privateChats.length === 0 ? (
            <p className="text-center text-muted-foreground p-6 text-sm">
              No chats yet. Create a public room or start a private chat!
            </p>
          ) : (
            <>
              {chatRooms.length > 0 && (
                <div className="mb-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-3 py-2">
                    Public Rooms
                  </h3>
                  {chatRooms.map((chat) => {
                    const isSelected = selectedChatId === chat.id && selectedChatType === 'public';
                    const hasUnread = (chat.unread_count ?? 0) > 0;
                    return (
                      <div
                        key={`public-${chat.id}`}
                        className={cn(
                          'flex items-center gap-3 rounded-xl p-3 text-sm transition-all hover:bg-accent/60 cursor-pointer mb-1',
                          isSelected
                            ? 'bg-accent/80 ring-1 ring-accent/50 shadow-sm'
                            : 'bg-card/60 border border-sidebar-border/40'
                        )}
                        onClick={() => onSelectChat(chat.id, chat.name, 'public')}
                      >
                        <div className="relative flex-shrink-0">
                          <Avatar className="h-11 w-11">
                            <AvatarImage
                              src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${chat.name}`}
                              alt={chat.name}
                            />
                            <AvatarFallback className="bg-accent/20">
                              <Users className="h-5 w-5" />
                            </AvatarFallback>
                          </Avatar>
                          {hasUnread && (
                            <span className="absolute -top-1 -right-1 bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] flex items-center justify-center leading-none shadow-md">
                              {chat.unread_count! > 99 ? '99+' : chat.unread_count}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn('truncate', hasUnread ? 'font-semibold' : 'font-medium')}>
                            {chat.name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">Public room</p>
                        </div>
                        {hasUnread && (
                          <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {privateChats.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-3 py-2">
                    Direct Messages
                  </h3>
                  {privateChats.map((chat) => {
                    const isSelected = selectedChatId === chat.id && selectedChatType === 'private';
                    const hasUnread = (chat.unread_count ?? 0) > 0;
                    const displayName =
                      chat.other_user_profile.first_name ||
                      chat.other_user_profile.username ||
                      `User ${chat.other_user_profile.id.slice(0, 8)}`;
                    return (
                      <div
                        key={`private-${chat.id}`}
                        className={cn(
                          'flex items-center gap-3 rounded-xl p-3 text-sm transition-all hover:bg-accent/60 cursor-pointer mb-1',
                          isSelected
                            ? 'bg-accent/80 ring-1 ring-accent/50 shadow-sm'
                            : 'bg-card/60 border border-sidebar-border/40'
                        )}
                        onClick={() => onSelectChat(chat.id, displayName, 'private')}
                      >
                        <div className="relative flex-shrink-0">
                          <Avatar className="h-11 w-11">
                            <AvatarImage
                              src={
                                chat.other_user_profile.avatar_url ||
                                `https://api.dicebear.com/7.x/lorelei/svg?seed=${chat.other_user_profile.username}`
                              }
                              alt={displayName}
                            />
                            <AvatarFallback className="bg-accent/20">
                              <MessageSquare className="h-5 w-5" />
                            </AvatarFallback>
                          </Avatar>
                          {hasUnread && (
                            <span className="absolute -top-1 -right-1 bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] flex items-center justify-center leading-none shadow-md">
                              {chat.unread_count! > 99 ? '99+' : chat.unread_count}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn('truncate', hasUnread ? 'font-semibold' : 'font-medium')}>
                            {displayName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">Direct message</p>
                        </div>
                        {hasUnread && (
                          <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default Sidebar;
