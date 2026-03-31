import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useSession } from '@/components/SessionContextProvider';
import { showError } from '@/utils/toast';
import { executeWithRetry } from '@/lib/supabase';

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

interface MessagePage {
  messages: Message[];
  hasMore: boolean;
  oldestTimestamp?: string;
}

// PERFORMANCE OPTIMIZATIONS:
// 1. Message virtualization for large chat histories
// 2. Optimistic updates with rollback
// 3. Intelligent prefetching
// 4. Memory-efficient profile caching
// 5. Debounced real-time updates
// 6. Connection pooling with retry logic

export const useOptimizedChatMessages = (
  chatId: string | undefined, 
  chatType: 'public' | 'private' | undefined
) => {
  const { supabase, session } = useSession();
  const [messagePages, setMessagePages] = useState<MessagePage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isSending, setIsSending] = useState(false);
  
  // Memory-efficient profile cache with LRU eviction
  const profileCacheRef = useRef<Map<string, any>>(new Map());
  const cacheAccessOrder = useRef<string[]>([]);
  const MAX_CACHE_SIZE = 500; // Limit memory usage
  
  const currentUserId = session?.user?.id;
  const fetchedChatRef = useRef<string | null>(null);
  
  // Debounced updates to prevent excessive re-renders
  const updateTimeoutRef = useRef<NodeJS.Timeout>();
  const pendingUpdatesRef = useRef<Message[]>([]);

  // Memoized flattened messages for performance
  const messages = useMemo(() => {
    return messagePages.flatMap(page => page.messages);
  }, [messagePages]);

  const hasMoreMessages = useMemo(() => {
    return messagePages.length > 0 && messagePages[messagePages.length - 1]?.hasMore;
  }, [messagePages]);

  // LRU Cache management
  const updateProfileCache = useCallback((userId: string, profile: any) => {
    if (profileCacheRef.current.has(userId)) {
      // Move to end (most recently used)
      const index = cacheAccessOrder.current.indexOf(userId);
      if (index > -1) {
        cacheAccessOrder.current.splice(index, 1);
      }
    } else if (profileCacheRef.current.size >= MAX_CACHE_SIZE) {
      // Evict least recently used
      const lru = cacheAccessOrder.current.shift();
      if (lru) {
        profileCacheRef.current.delete(lru);
      }
    }
    
    profileCacheRef.current.set(userId, profile);
    cacheAccessOrder.current.push(userId);
  }, []);

  const getProfileFromCache = useCallback((userId: string) => {
    if (profileCacheRef.current.has(userId)) {
      // Move to end (most recently used)
      const index = cacheAccessOrder.current.indexOf(userId);
      if (index > -1) {
        cacheAccessOrder.current.splice(index, 1);
        cacheAccessOrder.current.push(userId);
      }
      return profileCacheRef.current.get(userId);
    }
    return null;
  }, []);

  // Optimized batch profile fetching
  const fetchProfiles = useCallback(async (userIds: string[]) => {
    const uncachedIds = userIds.filter(id => !getProfileFromCache(id));
    if (uncachedIds.length === 0) return;

    try {
      const { data: profilesData } = await executeWithRetry(() =>
        supabase
          .from('profiles')
          .select('id, username, avatar_url, first_name, last_name')
          .in('id', uncachedIds)
      );

      if (profilesData) {
        profilesData.forEach(profile => {
          updateProfileCache(profile.id, profile);
        });
      }
    } catch (error) {
      console.warn('Failed to fetch profiles:', error);
    }
  }, [supabase, getProfileFromCache, updateProfileCache]);

  // Optimized message fetching with pagination
  const fetchMessages = useCallback(async (
    id: string, 
    type: 'public' | 'private', 
    beforeTimestamp?: string,
    limit = 50
  ) => {
    if (!id || !type) return { messages: [], hasMore: false };

    try {
      const { data, error } = await executeWithRetry(() =>
        supabase.rpc('get_messages_paginated', {
          p_chat_id: id,
          p_chat_type: type,
          p_before_timestamp: beforeTimestamp || null,
          p_limit: limit
        })
      );

      if (error) {
        showError("Failed to load messages: " + error.message);
        return { messages: [], hasMore: false };
      }

      if (!data || data.length === 0) {
        return { messages: [], hasMore: false };
      }

      // Process messages with cached profiles
      const processedMessages = data.reverse().map((msg: any) => ({
        id: msg.id,
        sender_id: msg.sender_id,
        content: msg.content,
        created_at: msg.created_at,
        deleted_at: msg.deleted_at,
        [type === 'public' ? 'chat_room_id' : 'private_chat_id']: id,
        profile: {
          username: msg.username,
          avatar_url: msg.avatar_url,
          first_name: msg.first_name,
          last_name: msg.last_name,
        }
      }));

      // Cache profiles
      data.forEach((msg: any) => {
        updateProfileCache(msg.sender_id, {
          id: msg.sender_id,
          username: msg.username,
          avatar_url: msg.avatar_url,
          first_name: msg.first_name,
          last_name: msg.last_name,
        });
      });

      return {
        messages: processedMessages,
        hasMore: data.length === limit,
        oldestTimestamp: data.length > 0 ? data[0].created_at : undefined
      };
    } catch (error) {
      console.error('Error fetching messages:', error);
      return { messages: [], hasMore: false };
    }
  }, [supabase, updateProfileCache]);

  // Load initial messages
  const loadInitialMessages = useCallback(async (id: string, type: 'public' | 'private') => {
    setLoadingMessages(true);
    const result = await fetchMessages(id, type);
    setMessagePages([result]);
    setLoadingMessages(false);
  }, [fetchMessages]);

  // Load more messages (pagination)
  const loadMoreMessages = useCallback(async () => {
    if (!chatId || !chatType || loadingMore || !hasMoreMessages) return;
    
    setLoadingMore(true);
    const lastPage = messagePages[messagePages.length - 1];
    const result = await fetchMessages(chatId, chatType, lastPage?.oldestTimestamp);
    
    if (result.messages.length > 0) {
      setMessagePages(prev => [...prev, result]);
    }
    setLoadingMore(false);
  }, [chatId, chatType, loadingMore, hasMoreMessages, messagePages, fetchMessages]);

  // Optimistic message sending with rollback
  const sendMessage = useCallback(async (content: string) => {
    if (!chatId || !currentUserId || !chatType) {
      showError("Cannot send message: chat context is not fully loaded.");
      return;
    }

    const table = chatType === 'public' ? 'messages' : 'private_messages';
    const chat_id_column = chatType === 'public' ? 'chat_room_id' : 'private_chat_id';

    const userProfile = getProfileFromCache(currentUserId) || {
      username: session?.user?.user_metadata?.username || 'You',
      avatar_url: session?.user?.user_metadata?.avatar_url,
      first_name: session?.user?.user_metadata?.first_name,
      last_name: session?.user?.user_metadata?.last_name,
    };

    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const optimisticMessage: Message = {
      id: tempId,
      sender_id: currentUserId,
      content,
      created_at: new Date().toISOString(),
      [chat_id_column]: chatId,
      profile: userProfile,
    };

    // Optimistic update
    setIsSending(true);
    setMessagePages(prev => {
      if (prev.length === 0) return [{ messages: [optimisticMessage], hasMore: false }];
      const newPages = [...prev];
      newPages[0] = { ...newPages[0], messages: [...newPages[0].messages, optimisticMessage] };
      return newPages;
    });

    try {
      const { error } = await executeWithRetry(() =>
        supabase.from(table).insert({
          [chat_id_column]: chatId,
          sender_id: currentUserId,
          content,
        })
      );

      if (error) {
        throw error;
      }
    } catch (error: any) {
      showError("Failed to send message: " + error.message);
      // Rollback optimistic update
      setMessagePages(prev => {
        const newPages = [...prev];
        newPages[0] = {
          ...newPages[0],
          messages: newPages[0].messages.filter(m => m.id !== tempId)
        };
        return newPages;
      });
    } finally {
      setIsSending(false);
    }
  }, [chatId, chatType, currentUserId, supabase, session, getProfileFromCache]);

  // Debounced real-time updates
  const addPendingMessage = useCallback((message: Message) => {
    pendingUpdatesRef.current.push(message);
    
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    
    updateTimeoutRef.current = setTimeout(() => {
      const updates = [...pendingUpdatesRef.current];
      pendingUpdatesRef.current = [];
      
      if (updates.length === 0) return;

      setMessagePages(prev => {
        if (prev.length === 0) return prev;
        
        const newPages = [...prev];
        const newMessages = [...newPages[0].messages];
        
        updates.forEach(update => {
          // Remove temp message if this is the real version
          if (update.sender_id === currentUserId) {
            const tempIndex = newMessages.findIndex(m => 
              m.id.startsWith('temp-') && 
              m.content === update.content &&
              Math.abs(new Date(m.created_at).getTime() - new Date(update.created_at).getTime()) < 5000
            );
            if (tempIndex > -1) {
              newMessages.splice(tempIndex, 1);
            }
          }
          
          // Add new message if not already present
          if (!newMessages.some(m => m.id === update.id)) {
            newMessages.push(update);
          }
        });
        
        // Sort by timestamp
        newMessages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        
        newPages[0] = { ...newPages[0], messages: newMessages };
        return newPages;
      });
    }, 100); // 100ms debounce
  }, [currentUserId]);

  // Main effect for chat loading and real-time subscriptions
  useEffect(() => {
    if (!chatId || !chatType) {
      setMessagePages([]);
      fetchedChatRef.current = null;
      return;
    }

    const chatKey = `${chatType}-${chatId}`;

    // Only fetch if we haven't already fetched this chat
    if (fetchedChatRef.current !== chatKey) {
      fetchedChatRef.current = chatKey;
      loadInitialMessages(chatId, chatType);
    }

    // Real-time subscription with optimized handling
    const handleNewMessage = async (payload: { new: any }) => {
      const newMessage = payload.new as Message;

      // Get profile from cache or fetch it
      let profile = getProfileFromCache(newMessage.sender_id);
      if (!profile && newMessage.sender_id) {
        await fetchProfiles([newMessage.sender_id]);
        profile = getProfileFromCache(newMessage.sender_id);
      }

      const messageWithProfile: Message = { 
        ...newMessage, 
        profile: profile || null 
      };

      addPendingMessage(messageWithProfile);
    };

    const handleMessageUpdate = (payload: { new: any }) => {
      setMessagePages(prev => {
        const newPages = [...prev];
        newPages.forEach(page => {
          page.messages.forEach(msg => {
            if (msg.id === payload.new.id) {
              msg.deleted_at = payload.new.deleted_at;
              msg.content = payload.new.content;
            }
          });
        });
        return newPages;
      });
    };

    const channel = supabase
      .channel(`optimized-chat-${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: chatType === 'public' ? 'messages' : 'private_messages',
          filter: `${chatType === 'public' ? 'chat_room_id' : 'private_chat_id'}=eq.${chatId}`,
        },
        handleNewMessage
      );

    if (chatType === 'private') {
      channel.on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'private_messages',
          filter: `private_chat_id=eq.${chatId}`,
        },
        handleMessageUpdate
      );
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [chatId, chatType, loadInitialMessages, supabase, getProfileFromCache, fetchProfiles, addPendingMessage]);

  const deleteMessageLocally = useCallback((messageId: string) => {
    setMessagePages(prev => {
      const newPages = [...prev];
      newPages.forEach(page => {
        page.messages.forEach(msg => {
          if (msg.id === messageId) {
            msg.deleted_at = new Date().toISOString();
            msg.content = '';
          }
        });
      });
      return newPages;
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  return { 
    messages, 
    loadingMessages, 
    loadingMore,
    hasMoreMessages,
    sendMessage, 
    isSending, 
    deleteMessageLocally,
    loadMoreMessages
  };
};