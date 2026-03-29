"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSession } from '@/components/SessionContextProvider';
import { showError } from '@/utils/toast';

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  deleted_at?: string | null;
  chat_room_id?: string;
  private_chat_id?: string;
  profile?: {
    username: string;
    avatar_url?: string;
    first_name?: string;
    last_name?: string;
  } | null;
}

export const useChatMessages = (chatId: string | undefined, chatType: 'public' | 'private' | undefined) => {
  const { supabase, session } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const profileCacheRef = useRef<Record<string, any>>({});
  const currentUserId = session?.user?.id;
  // Track which chatId we've already fetched so we don't double-fetch
  const fetchedChatRef = useRef<string | null>(null);

  const fetchMessages = useCallback(async (id: string, type: 'public' | 'private') => {
    if (!id || !type) return;
    setLoadingMessages(true);

    const { data, error } = await supabase
      .from(type === 'public' ? 'messages' : 'private_messages')
      .select(`id, created_at, sender_id, content, ${type === 'public' ? 'chat_room_id' : 'private_chat_id'}`)
      .eq(type === 'public' ? 'chat_room_id' : 'private_chat_id', id)
      .order('created_at', { ascending: true });

    if (error) {
      showError("Failed to load messages: " + error.message);
      setMessages([]);
      setLoadingMessages(false);
      return;
    }

    // Batch fetch profiles
    const uniqueSenderIds = [...new Set(data.map(msg => msg.sender_id))];
    const uncachedIds = uniqueSenderIds.filter(sid => !profileCacheRef.current[sid]);

    if (uncachedIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, first_name, last_name')
        .in('id', uncachedIds);

      if (profilesData) {
        profilesData.forEach(p => { profileCacheRef.current[p.id] = p; });
      }
    }

    const processedData = data.map(msg => ({
      ...msg,
      profile: profileCacheRef.current[msg.sender_id] || null,
    }));

    setMessages(processedData as Message[]);
    setLoadingMessages(false);
  }, [supabase]);

  const sendMessage = useCallback(async (content: string) => {
    if (!chatId || !currentUserId || !chatType) {
      showError("Cannot send message: chat context is not fully loaded.");
      return;
    }

    const table = chatType === 'public' ? 'messages' : 'private_messages';
    const chat_id_column = chatType === 'public' ? 'chat_room_id' : 'private_chat_id';

    const userProfile = profileCacheRef.current[currentUserId] || {
      username: session?.user?.user_metadata?.username || 'You',
      avatar_url: session?.user?.user_metadata?.avatar_url,
      first_name: session?.user?.user_metadata?.first_name,
      last_name: session?.user?.user_metadata?.last_name,
    };

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: Message = {
      id: tempId,
      sender_id: currentUserId,
      content,
      created_at: new Date().toISOString(),
      [chat_id_column]: chatId,
      profile: userProfile,
    };

    setIsSending(true);
    setMessages(prev => [...prev, optimisticMessage]);

    const { error } = await supabase.from(table).insert({
      [chat_id_column]: chatId,
      sender_id: currentUserId,
      content,
    });

    setIsSending(false);

    if (error) {
      showError("Failed to send message: " + error.message);
      // Revert only this specific optimistic message
      setMessages(prev => prev.filter(m => m.id !== tempId));
    }
  }, [chatId, chatType, currentUserId, supabase, session]);

  useEffect(() => {
    if (!chatId || !chatType) {
      setMessages([]);
      fetchedChatRef.current = null;
      return;
    }

    const chatKey = `${chatType}-${chatId}`;

    // Only fetch if we haven't already fetched this chat
    if (fetchedChatRef.current !== chatKey) {
      fetchedChatRef.current = chatKey;
      fetchMessages(chatId, chatType);
    }

    const handleNewMessage = async (payload: { new: any }) => {
      const newMessage = payload.new as Message;

      // Get profile from cache or fetch it
      let profile = profileCacheRef.current[newMessage.sender_id];
      if (!profile && newMessage.sender_id) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, username, avatar_url, first_name, last_name')
          .eq('id', newMessage.sender_id)
          .single();
        if (profileData) {
          profile = profileData;
          profileCacheRef.current[newMessage.sender_id] = profileData;
        }
      }

      const messageWithProfile: Message = { ...newMessage, profile: profile || null };

      setMessages(prev => {
        // If we already have this real message, skip
        if (prev.some(m => m.id === messageWithProfile.id)) return prev;

        // If this message was sent by current user, replace the matching temp message
        if (newMessage.sender_id === currentUserId) {
          const hasTempMsg = prev.some(m => m.id.startsWith('temp-'));
          if (hasTempMsg) {
            // Replace the oldest temp message with the real one
            let replaced = false;
            return prev.map(m => {
              if (!replaced && m.id.startsWith('temp-') && m.content === newMessage.content) {
                replaced = true;
                return messageWithProfile;
              }
              return m;
            });
          }
        }

        return [...prev, messageWithProfile];
      });
    };

    const channel = supabase
      .channel(`${chatType}-chat-${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: chatType === 'public' ? 'messages' : 'private_messages',
          filter: `${chatType === 'public' ? 'chat_room_id' : 'private_chat_id'}=eq.${chatId}`,
        },
        handleNewMessage
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'private_messages',
          filter: `private_chat_id=eq.${chatId}`,
        },
        (payload: { new: any }) => {
          // Handle soft-delete updates
          setMessages(prev => prev.map(m =>
            m.id === payload.new.id
              ? { ...m, deleted_at: payload.new.deleted_at, content: payload.new.content }
              : m
          ));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId, chatType, fetchMessages, supabase, currentUserId]);

  const deleteMessageLocally = useCallback((messageId: string) => {
    setMessages(prev => prev.map(m =>
      m.id === messageId ? { ...m, deleted_at: new Date().toISOString(), content: '' } : m
    ));
  }, []);

  return { messages, loadingMessages, sendMessage, isSending, deleteMessageLocally };
};
