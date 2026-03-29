"use client";

import React, { useState, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import ChatLayout from '@/components/layout/ChatLayout';
import { MadeWithProchat } from '@/components/MadeWithProchat';
import MessageInput from '@/components/MessageInput';
import MessageList from '@/components/MessageList';
import { showError } from '@/utils/toast';
import { useSession } from '@/components/SessionContextProvider';
import { useIsMobile } from '@/hooks/use-mobile';
import { useChatMessages } from '@/hooks/useChatMessages';

// Dynamically import Sidebar to reduce initial bundle size
const Sidebar = React.lazy(() => import('@/components/Sidebar'));

interface PrivateChatNotificationQueryResult {
  user1: Array<{ id: string; username: string; first_name?: string }> | null; // Changed to array
  user2: Array<{ id: string; username: string; first_name?: string }> | null; // Changed to array
}

const ChatPage: React.FC = memo(() => {
  const { supabase, session, isGuest } = useSession();
  const navigate = useNavigate();
  const [selectedChatId, setSelectedChatId] = useState<string | undefined>(undefined);
  const [selectedChatName, setSelectedChatName] = useState<string | undefined>(undefined);
  const [selectedChatType, setSelectedChatType] = useState<'public' | 'private' | undefined>(undefined);

  const currentUserId = session?.user?.id;
  const isMobile = useIsMobile();

  // Use a stable reference for the key to prevent unnecessary re-renders
  const chatKey = selectedChatId ? `${selectedChatId}-${selectedChatType}` : 'no-chat';

  const { messages, loadingMessages, sendMessage, isSending } = useChatMessages(selectedChatId, selectedChatType);

  const markChatAsRead = useCallback(async (chatId: string, chatType: 'public' | 'private') => {
    if (!currentUserId || isGuest) return;

    const now = new Date().toISOString();
    let existingReadStatusQuery;

    if (chatType === 'public') {
      existingReadStatusQuery = supabase
        .from('user_chat_read_status')
        .select('id')
        .eq('user_id', currentUserId)
        .eq('chat_room_id', chatId)
        .single();
    } else { // private
      existingReadStatusQuery = supabase
        .from('user_chat_read_status')
        .select('id')
        .eq('user_id', currentUserId)
        .eq('private_chat_id', chatId)
        .single();
    }

    const { data: existingReadStatus, error: selectError } = await existingReadStatusQuery;

    let error;
    if (selectError && selectError.code !== 'PGRST116') { // PGRST116 means "no rows found"
      console.error("Error checking existing read status:", selectError);
      showError("Failed to check read status: " + selectError.message);
      return;
    }

    if (existingReadStatus) {
      // If a record exists, update it
      const updateData = { last_read_at: now };
      let updateQuery;
      if (chatType === 'public') {
        updateQuery = supabase
          .from('user_chat_read_status')
          .update(updateData)
          .eq('id', existingReadStatus.id);
      } else {
        updateQuery = supabase
          .from('user_chat_read_status')
          .update(updateData)
          .eq('id', existingReadStatus.id);
      }
      ({ error } = await updateQuery);
    } else {
      // If no record exists, insert a new one
      const insertData = {
        user_id: currentUserId,
        last_read_at: now,
        chat_room_id: chatType === 'public' ? chatId : null,
        private_chat_id: chatType === 'private' ? chatId : null,
      };
      ({ error } = await supabase.from('user_chat_read_status').insert(insertData));
    }

    if (error) {
      console.error("Error marking chat as read:", error);
      showError("Failed to mark chat as read: " + error.message);
    }
  }, [currentUserId, supabase]);

  const handleSelectChat = useCallback((chatId: string, chatName: string, chatType: 'public' | 'private') => {
    setSelectedChatId(chatId);
    setSelectedChatName(chatName);
    setSelectedChatType(chatType);
    markChatAsRead(chatId, chatType);
  }, [markChatAsRead]);

  const handleSendMessage = async (content: string) => {
    if (!selectedChatId || !selectedChatType) {
      showError("Please select a chat to send a message.");
      return;
    }
    await sendMessage(content);
    markChatAsRead(selectedChatId, selectedChatType); // Mark as read after sending
  };

  const handleBackToSidebar = () => {
    setSelectedChatId(undefined);
    setSelectedChatName(undefined);
    setSelectedChatType(undefined);
  };

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      <React.Suspense fallback={<div className="h-screen flex items-center justify-center bg-background">Loading chat...</div>}>
        <ChatLayout
          sidebar={
            <Sidebar
              selectedChatId={selectedChatId}
              selectedChatType={selectedChatType}
              onSelectChat={handleSelectChat}
            />
          }
          isChatSelected={!!(selectedChatId && selectedChatType)}
          onBackToSidebar={handleBackToSidebar}
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center h-16 border-b border-border px-4 bg-card/70 backdrop-blur-sm">
              {selectedChatName ? (
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="h-10 w-10 rounded-full ring-2 ring-border overflow-hidden">
                      <img 
                        src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${selectedChatName}`} 
                        alt={selectedChatName} 
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full ring-2 ring-background"></div>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold leading-none">
                      {selectedChatType === 'public' ? `${selectedChatName}` : `${selectedChatName}`}
                    </h2>
                    <p className="text-xs text-muted-foreground leading-none">
                      {selectedChatType === 'public' ? 'Public room' : 'Online'}
                    </p>
                  </div>
                </div>
              ) : (
                <h2 className="text-xl font-semibold text-muted-foreground">Select a chat</h2>
              )}
            </div>
            {selectedChatId && selectedChatType ? (
              <>
                {loadingMessages && messages.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-muted-foreground">
                    <p>Loading messages...</p>
                  </div>
                ) : (
                  <MessageList key={chatKey} messages={messages} currentUserId={currentUserId} />
                )}
                <MessageInput onSendMessage={handleSendMessage} isSending={isSending} />
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground p-4">
                <p className="text-center">Start by selecting a chat from the sidebar or create a new one.</p>
              </div>
            )}
            {!isMobile && (
              <div className="footer">
                Made with ❤️ by Touseef
              </div>
            )}
          </div>
        </ChatLayout>
      </React.Suspense>
    </div>
  );
});

ChatPage.displayName = 'ChatPage';

export default ChatPage;