import React, { useRef, useEffect, useState, useCallback, memo } from 'react';
import { FixedSizeList as List } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Trash2, ShieldBan } from 'lucide-react';
import { useDMPrivacy } from '@/hooks/useDMPrivacy';

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

interface VirtualizedMessageListProps {
  messages: Message[];
  currentUserId: string | undefined;
  chatType?: 'public' | 'private';
  onMessageDeleted?: (messageId: string) => void;
  hasMoreMessages?: boolean;
  loadMoreMessages?: () => void;
  loadingMore?: boolean;
}

const ITEM_HEIGHT = 80; // Approximate height per message
const OVERSCAN_COUNT = 5; // Number of items to render outside visible area

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

interface ContextMenu {
  x: number;
  y: number;
  messageId: string;
  senderId: string;
  senderName: string;
  isOwn: boolean;
}

// Memoized message item component for performance
const MessageItem = memo<{
  index: number;
  style: React.CSSProperties;
  data: {
    messages: Message[];
    currentUserId: string | undefined;
    chatType: 'public' | 'private' | undefined;
    onContextMenu: (e: React.MouseEvent, msg: Message, isOwn: boolean, senderName: string) => void;
  };
}>(({ index, style, data }) => {
  const { messages, currentUserId, onContextMenu } = data;
  const message = messages[index];
  
  if (!message) {
    return (
      <div style={style} className="flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[hsl(var(--accent-primary))] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isCurrentUser = message.sender_id === currentUserId;
  const isDeleted = !!message.deleted_at;
  const senderName = isCurrentUser ? 'You' : getDisplayName(message.profile, message.sender_id);
  const senderAvatar = message.profile?.avatar_url || `https://api.dicebear.com/7.x/lorelei/svg?seed=${message.sender_id}`;
  const isTemp = message.id.startsWith('temp-');

  const prevMsg = messages[index - 1];
  const isFirstInGroup = !prevMsg || prevMsg.sender_id !== message.sender_id;

  return (
    <div
      style={style}
      className={cn(
        "flex items-end gap-2 px-4",
        isCurrentUser ? "justify-end" : "justify-start",
        isFirstInGroup ? "pt-4" : "pt-1"
      )}
      onContextMenu={(e) => !isTemp && !isDeleted && onContextMenu(e, message, isCurrentUser, senderName)}
    >
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
        {isFirstInGroup && (
          <div className={cn("flex items-baseline gap-2 mb-1 px-1", isCurrentUser ? "flex-row-reverse" : "flex-row")}>
            <span className="text-[11px] font-semibold text-foreground/70">{senderName}</span>
            <span className="text-[10px] text-muted-foreground">{formatTime(message.created_at)}</span>
          </div>
        )}

        <div
          className={cn(
            "px-3.5 py-2.5 text-sm leading-relaxed break-words",
            isDeleted
              ? "bg-muted/50 text-muted-foreground italic rounded-2xl border border-border/40"
              : isCurrentUser
                ? "bg-[hsl(var(--accent-primary))] text-white rounded-2xl rounded-br-sm"
                : "bg-card border border-border/60 text-foreground rounded-2xl rounded-bl-sm",
            isTemp && "opacity-60"
          )}
        >
          {isDeleted ? 'This message was deleted' : message.content}
        </div>

        {!isFirstInGroup && (
          <span className="text-[10px] text-muted-foreground mt-0.5 px-1">{formatTime(message.created_at)}</span>
        )}
      </div>

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
});

MessageItem.displayName = 'MessageItem';

const VirtualizedMessageList: React.FC<VirtualizedMessageListProps> = memo(({
  messages,
  currentUserId,
  chatType,
  onMessageDeleted,
  hasMoreMessages = false,
  loadMoreMessages,
  loadingMore = false
}) => {
  const listRef = useRef<List>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [listHeight, setListHeight] = useState(400);
  const containerRef = useRef<HTMLDivElement>(null);
  const { deleteMessage, blockUser } = useDMPrivacy();

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (listRef.current && messages.length > 0) {
      listRef.current.scrollToItem(messages.length - 1, 'end');
    }
  }, [messages.length]);

  // Dynamic height calculation
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const availableHeight = window.innerHeight - rect.top - 100; // Leave space for input
        setListHeight(Math.max(200, availableHeight));
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // Close context menu on outside click
  useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, msg: Message, isOwn: boolean, senderName: string) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      messageId: msg.id,
      senderId: msg.sender_id,
      senderName,
      isOwn,
    });
  }, []);

  const handleDelete = async () => {
    if (!contextMenu) return;
    const ok = await deleteMessage(contextMenu.messageId);
    if (ok && onMessageDeleted) onMessageDeleted(contextMenu.messageId);
    setContextMenu(null);
  };

  const handleBlock = async () => {
    if (!contextMenu) return;
    await blockUser(contextMenu.senderId, contextMenu.senderName);
    setContextMenu(null);
  };

  // Check if item is loaded for infinite loading
  const isItemLoaded = useCallback((index: number) => {
    return !!messages[index];
  }, [messages]);

  // Load more items
  const loadMoreItems = useCallback(async () => {
    if (loadingMore || !hasMoreMessages || !loadMoreMessages) return;
    await loadMoreMessages();
  }, [loadingMore, hasMoreMessages, loadMoreMessages]);

  const itemCount = hasMoreMessages ? messages.length + 1 : messages.length;

  const itemData = {
    messages,
    currentUserId,
    chatType,
    onContextMenu: handleContextMenu,
  };

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
    <>
      <div ref={containerRef} className="flex-1 bg-background">
        <InfiniteLoader
          isItemLoaded={isItemLoaded}
          itemCount={itemCount}
          loadMoreItems={loadMoreItems}
          threshold={5}
        >
          {({ onItemsRendered, ref }) => (
            <List
              ref={(list) => {
                listRef.current = list;
                ref(list);
              }}
              height={listHeight}
              itemCount={itemCount}
              itemSize={ITEM_HEIGHT}
              itemData={itemData}
              onItemsRendered={onItemsRendered}
              overscanCount={OVERSCAN_COUNT}
              className="scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent"
            >
              {MessageItem}
            </List>
          )}
        </InfiniteLoader>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-card border border-border rounded-xl shadow-lg py-1 min-w-[160px] text-sm"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.isOwn && (
            <button
              onClick={handleDelete}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-destructive/10 text-destructive transition-colors rounded-lg mx-1 text-left"
              style={{ width: 'calc(100% - 8px)' }}
            >
              <Trash2 className="w-4 h-4" />
              Delete message
            </button>
          )}
          {!contextMenu.isOwn && chatType === 'private' && (
            <button
              onClick={handleBlock}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-destructive/10 text-destructive transition-colors rounded-lg mx-1 text-left"
              style={{ width: 'calc(100% - 8px)' }}
            >
              <ShieldBan className="w-4 h-4" />
              Block {contextMenu.senderName}
            </button>
          )}
          {contextMenu.isOwn && chatType === 'private' && (
            <div className="h-px bg-border mx-2 my-1" />
          )}
          {!contextMenu.isOwn && chatType !== 'private' && (
            <div className="px-3 py-2 text-xs text-muted-foreground">No actions available</div>
          )}
        </div>
      )}
    </>
  );
});

VirtualizedMessageList.displayName = 'VirtualizedMessageList';
export default VirtualizedMessageList;