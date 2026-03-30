import React, { useState, useCallback, memo, useMemo } from 'react';
import ChatLayout from '@/components/layout/ChatLayout';
import MessageInput from '@/components/MessageInput';
import MessageList from '@/components/MessageList';
import { useSession } from '@/components/SessionContextProvider';
import { useChatMessages } from '@/hooks/useChatMessages';

const Sidebar = React.lazy(() => import('@/components/Sidebar'));

const noop = async (_: string) => {};

const GuestChatPage: React.FC = memo(() => {
  const { session } = useSession();
  const [selectedChatId, setSelectedChatId] = useState<string | undefined>(undefined);
  const [selectedChatName, setSelectedChatName] = useState<string | undefined>(undefined);
  const [selectedChatType, setSelectedChatType] = useState<'public' | 'private' | undefined>(undefined);

  const currentUserId = session?.user?.id;
  const chatKey = useMemo(
    () => selectedChatId ? `${selectedChatId}-${selectedChatType}` : 'no-chat',
    [selectedChatId, selectedChatType]
  );

  const { messages, loadingMessages } = useChatMessages(selectedChatId, selectedChatType);

  const handleSelectChat = useCallback((chatId: string, chatName: string, chatType: 'public' | 'private') => {
    setSelectedChatId(chatId);
    setSelectedChatName(chatName);
    setSelectedChatType(chatType);
  }, []);

  const handleBackToSidebar = useCallback(() => {
    setSelectedChatId(undefined);
    setSelectedChatName(undefined);
    setSelectedChatType(undefined);
  }, []);

  return (
    <div className="h-[100dvh] flex flex-col bg-background text-foreground">
      <React.Suspense fallback={<div className="h-[100dvh] flex items-center justify-center bg-background"><div className="w-8 h-8 border-2 border-[hsl(var(--accent-primary))] border-t-transparent rounded-full animate-spin" /></div>}>
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
            {/* Desktop header */}
            <div className="hidden md:flex items-center h-14 border-b border-border px-4 bg-card/80 backdrop-blur-sm flex-shrink-0">
              {selectedChatName ? (
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative flex-shrink-0">
                    <div className="h-9 w-9 rounded-full overflow-hidden ring-2 ring-border/50">
                      <img src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${selectedChatName}`} alt={selectedChatName} className="w-full h-full object-cover" />
                    </div>
                    <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full ring-2 ring-background" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold leading-none truncate">{selectedChatName}</h2>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Public room · Guest view</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Select a conversation</p>
              )}
            </div>

            {/* Mobile header */}
            <div className="flex md:hidden items-center h-14 border-b border-border px-4 bg-card/80 backdrop-blur-sm flex-shrink-0">
              {selectedChatName && (
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-8 w-8 rounded-full overflow-hidden ring-2 ring-border/50 flex-shrink-0">
                    <img src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${selectedChatName}`} alt={selectedChatName} className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold leading-none truncate">{selectedChatName}</h2>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Guest view</p>
                  </div>
                </div>
              )}
            </div>

            {selectedChatId && selectedChatType ? (
              <>
                {loadingMessages && messages.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-[hsl(var(--accent-primary))] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <MessageList key={chatKey} messages={messages} currentUserId={currentUserId} />
                )}
                <MessageInput onSendMessage={noop} />
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 gap-3">
                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-2">
                  <svg className="w-8 h-8 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="font-medium text-sm">No conversation selected</p>
                <p className="text-xs text-center max-w-xs">Pick a public room from the sidebar to start reading</p>
              </div>
            )}
          </div>
        </ChatLayout>
      </React.Suspense>
    </div>
  );
});

GuestChatPage.displayName = 'GuestChatPage';
export default GuestChatPage;
