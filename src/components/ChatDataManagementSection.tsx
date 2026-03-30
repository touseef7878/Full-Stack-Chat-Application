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

      // Fetch all public chat rooms
      const { data: rooms } = await supabase.from('chat_rooms').select('id');
      // Fetch all private chats for this user
      const { data: privates } = await supabase
        .from('private_chats')
        .select('id')
        .or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`);

      // Upsert read status for every public room
      if (rooms && rooms.length > 0) {
        const publicUpserts = rooms.map((r: any) => ({
          user_id: currentUserId,
          chat_room_id: r.id,
          private_chat_id: null,
          last_read_at: now,
        }));
        const { error } = await supabase
          .from('user_chat_read_status')
          .upsert(publicUpserts, { onConflict: 'user_id,chat_room_id' });
        if (error) throw error;
      }

      // Upsert read status for every private chat
      if (privates && privates.length > 0) {
        const privateUpserts = privates.map((p: any) => ({
          user_id: currentUserId,
          chat_room_id: null,
          private_chat_id: p.id,
          last_read_at: now,
        }));
        const { error } = await supabase
          .from('user_chat_read_status')
          .upsert(privateUpserts, { onConflict: 'user_id,private_chat_id' });
        if (error) throw error;
      }

      showSuccess('All messages marked as read.');
      onChatDataCleared();
    } catch (err: any) {
      showError('Failed to mark all read: ' + (err?.message || 'Unknown error'));
    } finally {
      setLoadingMarkRead(false);
    }
  };

  const handleDeletePublicRooms = async () => {
    if (!currentUserId) return;
    setLoadingPublic(true);
    try {
      // Delete ALL public rooms created by this user (cascade deletes messages)
      const { error } = await supabase
        .from('chat_rooms')
        .delete()
        .eq('creator_id', currentUserId);
      if (error) throw error;
      showSuccess('All your public rooms deleted.');
      onChatDataCleared();
    } catch (err: any) {
      showError('Failed to delete public rooms: ' + (err?.message || 'Unknown error'));
    } finally {
      setLoadingPublic(false);
    }
  };

  const handleDeletePrivateChats = async () => {
    if (!currentUserId) return;
    setLoadingPrivate(true);
    try {
      // Delete all private chats this user is part of (cascade deletes messages)
      const { error } = await supabase
        .from('private_chats')
        .delete()
        .or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`);
      if (error) throw error;
      showSuccess('All private chats deleted.');
      onChatDataCleared();
    } catch (err: any) {
      showError('Failed to delete private chats: ' + (err?.message || 'Unknown error'));
    } finally {
      setLoadingPrivate(false);
    }
  };

  const actions = [
    {
      icon: CheckCheck,
      label: 'Mark all messages as read',
      desc: 'Clears all unread badges across every room and DM.',
      confirmTitle: 'Mark all as read?',
      confirmDesc: 'All unread badges will be cleared. This cannot be undone.',
      actionLabel: 'Mark all read',
      loading: loadingMarkRead,
      onConfirm: handleMarkAllRead,
      destructive: false,
    },
    {
      icon: Hash,
      label: 'Delete all my public rooms',
      desc: 'Permanently deletes all public rooms you created and their messages.',
      confirmTitle: 'Delete all your public rooms?',
      confirmDesc: 'This permanently deletes every public room you created and all messages inside them. This cannot be undone.',
      actionLabel: 'Delete rooms',
      loading: loadingPublic,
      onConfirm: handleDeletePublicRooms,
      destructive: true,
    },
    {
      icon: MessageSquareOff,
      label: 'Delete all private chats',
      desc: 'Permanently deletes all DMs you are part of and their messages.',
      confirmTitle: 'Delete all private chats?',
      confirmDesc: 'This permanently deletes every DM thread you are part of and all messages inside them. The other user will also lose access. This cannot be undone.',
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
            <button className="w-full flex items-center gap-3 p-3 rounded-xl border border-border/60 hover:bg-muted/50 transition-colors text-left group">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${destructive ? 'bg-destructive/10' : 'bg-muted'}`}>
                <Icon className={`h-4 w-4 ${destructive ? 'text-destructive' : 'text-foreground'}`} />
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-medium ${destructive ? 'text-destructive' : ''}`}>{label}</p>
                <p className="text-xs text-muted-foreground truncate">{desc}</p>
              </div>
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
              <AlertDialogDescription>{confirmDesc}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={onConfirm}
                disabled={loading}
                className={destructive ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
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
