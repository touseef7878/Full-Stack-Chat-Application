import React, { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useSession } from '@/components/SessionContextProvider';
import { showError, showSuccess } from '@/utils/toast';
import { MessageSquareOff, Hash, CheckCheck } from 'lucide-react';

interface ChatDataManagementSectionProps {
  onChatDataCleared: () => void;
}

const ChatDataManagementSection: React.FC<ChatDataManagementSectionProps> = ({ onChatDataCleared }) => {
  const { supabase, session } = useSession();
  const currentUserId = session?.user?.id;

  const [loadingMarkRead, setLoadingMarkRead] = useState(false);
  const [loadingPublic, setLoadingPublic] = useState(false);
  const [loadingPrivate, setLoadingPrivate] = useState(false);

  const handleMarkAllRead = async () => {
    if (!currentUserId) return;
    setLoadingMarkRead(true);
    try {
      const now = new Date().toISOString();
      const { data: rooms } = await supabase.from('chat_rooms').select('id');
      const { data: privates } = await supabase
        .from('private_chats').select('id')
        .or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`);

      if (rooms?.length) {
        const { error } = await supabase.from('user_chat_read_status').upsert(
          rooms.map((r: any) => ({ user_id: currentUserId, chat_room_id: r.id, private_chat_id: null, last_read_at: now })),
          { onConflict: 'user_id,chat_room_id' }
        );
        if (error) throw error;
      }
      if (privates?.length) {
        const { error } = await supabase.from('user_chat_read_status').upsert(
          privates.map((p: any) => ({ user_id: currentUserId, chat_room_id: null, private_chat_id: p.id, last_read_at: now })),
          { onConflict: 'user_id,private_chat_id' }
        );
        if (error) throw error;
      }
      showSuccess('All messages marked as read.');
      onChatDataCleared();
    } catch (err: any) {
      showError('Failed: ' + (err?.message || 'Unknown error'));
    } finally {
      setLoadingMarkRead(false);
    }
  };

  const handleDeletePublicRooms = async () => {
    if (!currentUserId) return;
    setLoadingPublic(true);
    try {
      const { error } = await supabase.from('chat_rooms').delete().eq('creator_id', currentUserId);
      if (error) throw error;
      showSuccess('Public rooms deleted.');
      onChatDataCleared();
    } catch (err: any) {
      showError('Failed: ' + (err?.message || 'Unknown error'));
    } finally {
      setLoadingPublic(false);
    }
  };

  const handleDeletePrivateChats = async () => {
    if (!currentUserId) return;
    setLoadingPrivate(true);
    try {
      const { error } = await supabase.from('private_chats').delete()
        .or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`);
      if (error) throw error;
      showSuccess('Private chats deleted.');
      onChatDataCleared();
    } catch (err: any) {
      showError('Failed: ' + (err?.message || 'Unknown error'));
    } finally {
      setLoadingPrivate(false);
    }
  };

  const actions = [
    {
      icon: CheckCheck,
      label: 'Mark all as read',
      desc: 'Clear all unread badges',
      confirmTitle: 'Mark all as read?',
      confirmDesc: 'All unread badges will be cleared.',
      actionLabel: 'Mark read',
      loading: loadingMarkRead,
      onConfirm: handleMarkAllRead,
      destructive: false,
    },
    {
      icon: Hash,
      label: 'Delete my public rooms',
      desc: 'Remove all rooms you created',
      confirmTitle: 'Delete all your public rooms?',
      confirmDesc: 'Permanently deletes every public room you created and all messages inside. Cannot be undone.',
      actionLabel: 'Delete rooms',
      loading: loadingPublic,
      onConfirm: handleDeletePublicRooms,
      destructive: true,
    },
    {
      icon: MessageSquareOff,
      label: 'Delete private chats',
      desc: 'Remove all your DM threads',
      confirmTitle: 'Delete all private chats?',
      confirmDesc: 'Permanently deletes every DM thread and all messages. The other user also loses access. Cannot be undone.',
      actionLabel: 'Delete chats',
      loading: loadingPrivate,
      onConfirm: handleDeletePrivateChats,
      destructive: true,
    },
  ];

  return (
    <div className="space-y-2">
      {actions.map(({ icon: Icon, label, desc, confirmTitle, confirmDesc, actionLabel, loading, onConfirm, destructive }) => (
        <AlertDialog key={label}>
          <AlertDialogTrigger asChild>
            <button className="w-full flex items-center gap-3 p-3 rounded-xl border border-border/60 hover:bg-muted/50 active:bg-muted/70 transition-colors text-left">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${destructive ? 'bg-destructive/10' : 'bg-muted'}`}>
                <Icon className={`h-4 w-4 ${destructive ? 'text-destructive' : 'text-foreground'}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium leading-tight ${destructive ? 'text-destructive' : ''}`}>{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{desc}</p>
              </div>
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-sm rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
              <AlertDialogDescription>{confirmDesc}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-row gap-2 sm:flex-row">
              <AlertDialogCancel disabled={loading} className="flex-1 rounded-xl">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={onConfirm}
                disabled={loading}
                className={`flex-1 rounded-xl ${destructive ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}`}
              >
                {loading ? 'Working…' : actionLabel}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ))}
    </div>
  );
};

export default ChatDataManagementSection;
