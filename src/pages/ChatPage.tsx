import React, { useState, useCallback, memo, useMemo } from 'react';
import ChatLayout from '@/components/layout/ChatLayout';
import MessageInput from '@/components/MessageInput';
import MessageList from '@/components/MessageList';
import { showError } from '@/utils/toast';
import { useSession } from '@/components/SessionContextProvider';
import { useChatMessages } from '@/hooks/useChatMessages';

// Dynamically import Sidebar to reduce initial bundle size
const Sidebar = React.lazy(() => import('@/components/Sidebar'));

const ChatPage: React.FC = memo(() => {
  const { supabase, session, isGuest } = useSession();
  const [selectedChatId, setSelectedChatId] = useState<string | undefined>(undefined);
  const [selectedChatName, setSelectedChatName] = useState<string | undefined>(undefined);
  const [selectedChatType, setSelectedChatType] = useState<'public' | 'private' | undefined>(undefined);
  const currentUserId = session?.user?.id;

  const chatKey = useMemo(
    () => selectedChatId ? `${selectedChatId}-${selectedChatType}` : 'no-chat',
    [selectedChatId, selectedChatType]
  );

  const { messages, loadingMessages, sendMessage, isSending, deleteMessageLocally } = useChatMessages(selectedChatId, selectedChatType);

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
            {/* Chat header — desktop only (mobile back btn is in ChatLayout) */}
            <div className="hidden md:flex items-center h-14 border-b border-border px-4 bg-card/80 backdrop-blur-sm flex-shrink-0">
              {selectedChatName ? (
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative flex-shrink-0">
                    <div className="h-9 w-9 rounded-full overflow-hidden ring-2 ring-border/50">
                      <img
                        src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${selectedChatName}`}
                        alt={selectedChatName}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full ring-2 ring-background" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold leading-none truncate">{selectedChatName}</h2>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {selectedChatType === 'public' ? 'Public room' : 'Direct message'}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Select a conversation</p>
              )}
            </div>

            {/* Mobile chat header info (back btn already in ChatLayout) */}
            <div className="flex md:hidden items-center h-14 border-b border-border px-4 bg-card/80 backdrop-blur-sm flex-shrink-0">
              {selectedChatName ? (
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative flex-shrink-0">
                    <div className="h-8 w-8 rounded-full overflow-hidden ring-2 ring-border/50">
                      <img
                        src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${selectedChatName}`}
                        alt={selectedChatName}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full ring-2 ring-background" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold leading-none truncate">{selectedChatName}</h2>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {selectedChatType === 'public' ? 'Public room' : 'Direct message'}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            {selectedChatId && selectedChatType ? (
              <>
                {loadingMessages && messages.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <div className="w-8 h-8 border-2 border-[hsl(var(--accent-primary))] border-t-transparent rounded-full animate-spin" />
                      <p className="text-sm">Loading messages…</p>
                    </div>
                  </div>
                ) : (
                  <MessageList
                    key={chatKey}
                    messages={messages}
                    currentUserId={currentUserId}
                    chatType={selectedChatType}
                    onMessageDeleted={deleteMessageLocally}
                  />
                )}
                <MessageInput onSendMessage={handleSendMessage} isSending={isSending} />
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 gap-3">
                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-2">
                  <svg className="w-8 h-8 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="font-medium text-sm">No conversation selected</p>
                <p className="text-xs text-center max-w-xs">Pick a public room or start a direct message from the sidebar</p>
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