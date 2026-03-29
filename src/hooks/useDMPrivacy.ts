import { useCallback } from 'react';
import { useSession } from '@/components/SessionContextProvider';
import { showError, showSuccess } from '@/utils/toast';

export type DmPrivacy = 'everyone' | 'nobody';

export const useDMPrivacy = () => {
  const { supabase, session } = useSession();
  const currentUserId = session?.user?.id;

  const blockUser = useCallback(async (targetId: string, targetName: string) => {
    if (!currentUserId) return false;
    const { error } = await supabase
      .from('user_blocks')
      .insert({ blocker_id: currentUserId, blocked_id: targetId });
    if (error) { showError('Failed to block user.'); return false; }
    showSuccess(`${targetName} has been blocked.`);
    return true;
  }, [currentUserId, supabase]);

  const unblockUser = useCallback(async (targetId: string, targetName: string) => {
    if (!currentUserId) return false;
    const { error } = await supabase
      .from('user_blocks')
      .delete()
      .eq('blocker_id', currentUserId)
      .eq('blocked_id', targetId);
    if (error) { showError('Failed to unblock user.'); return false; }
    showSuccess(`${targetName} has been unblocked.`);
    return true;
  }, [currentUserId, supabase]);

  const isBlocked = useCallback(async (targetId: string): Promise<boolean> => {
    if (!currentUserId) return false;
    const { data } = await supabase
      .from('user_blocks')
      .select('id')
      .eq('blocker_id', currentUserId)
      .eq('blocked_id', targetId)
      .maybeSingle();
    return !!data;
  }, [currentUserId, supabase]);

  const deleteMessage = useCallback(async (messageId: string) => {
    if (!currentUserId) return false;
    const { error } = await supabase
      .from('private_messages')
      .update({ deleted_at: new Date().toISOString(), deleted_by: currentUserId, content: '' })
      .eq('id', messageId)
      .eq('sender_id', currentUserId);
    if (error) { showError('Failed to delete message.'); return false; }
    return true;
  }, [currentUserId, supabase]);

  const sendMessageRequest = useCallback(async (receiverId: string) => {
    if (!currentUserId) return { status: 'error' as const };
    // Check if request already exists
    const { data: existing } = await supabase
      .from('message_requests')
      .select('id, status')
      .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${currentUserId})`)
      .maybeSingle();

    if (existing) return { status: existing.status as string };

    const { error } = await supabase
      .from('message_requests')
      .insert({ sender_id: currentUserId, receiver_id: receiverId });
    if (error) { showError('Failed to send message request.'); return { status: 'error' as const }; }
    return { status: 'pending' as const };
  }, [currentUserId, supabase]);

  const respondToRequest = useCallback(async (requestId: string, accept: boolean) => {
    if (!currentUserId) return { ok: false, chatId: null as string | null };

    // First get the request so we know the sender_id
    const { data: req, error: fetchErr } = await supabase
      .from('message_requests')
      .select('id, sender_id, receiver_id')
      .eq('id', requestId)
      .eq('receiver_id', currentUserId)
      .single();

    if (fetchErr || !req) { showError('Request not found.'); return { ok: false, chatId: null }; }

    // Update status
    const { error } = await supabase
      .from('message_requests')
      .update({ status: accept ? 'accepted' : 'declined', updated_at: new Date().toISOString() })
      .eq('id', requestId);

    if (error) { showError('Failed to respond to request.'); return { ok: false, chatId: null }; }

    if (!accept) {
      showSuccess('Request declined.');
      return { ok: true, chatId: null };
    }

    // On accept — create the private_chats row so both users see it in sidebar
    const { data: existing } = await supabase
      .from('private_chats')
      .select('id')
      .or(`and(user1_id.eq.${req.sender_id},user2_id.eq.${currentUserId}),and(user1_id.eq.${currentUserId},user2_id.eq.${req.sender_id})`)
      .maybeSingle();

    let chatId: string;
    if (existing) {
      chatId = existing.id;
    } else {
      const { data: newChat, error: createErr } = await supabase
        .from('private_chats')
        .insert({ user1_id: req.sender_id, user2_id: currentUserId })
        .select('id')
        .single();
      if (createErr || !newChat) { showError('Failed to create chat.'); return { ok: false, chatId: null }; }
      chatId = newChat.id;
    }

    showSuccess('Request accepted! You can now chat.');
    // Notify sidebar on both users' sides
    window.dispatchEvent(new Event('sidebar:refetch'));
    return { ok: true, chatId };
  }, [currentUserId, supabase]);

  const getPendingRequests = useCallback(async () => {
    if (!currentUserId) return [];
    const { data, error } = await supabase
      .from('message_requests')
      .select('id, sender_id, created_at, sender:sender_id(id, username, first_name, last_name, avatar_url)')
      .eq('receiver_id', currentUserId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) return [];
    return data || [];
  }, [currentUserId, supabase]);

  const updateDmPrivacy = useCallback(async (privacy: DmPrivacy) => {
    if (!currentUserId) return false;
    const { error } = await supabase
      .from('profiles')
      .update({ dm_privacy: privacy })
      .eq('id', currentUserId);
    if (error) { showError('Failed to update privacy setting.'); return false; }
    showSuccess('Privacy setting updated.');
    return true;
  }, [currentUserId, supabase]);

  const getDmPrivacy = useCallback(async (): Promise<DmPrivacy> => {
    if (!currentUserId) return 'everyone';
    const { data } = await supabase
      .from('profiles')
      .select('dm_privacy')
      .eq('id', currentUserId)
      .single();
    return (data?.dm_privacy as DmPrivacy) || 'everyone';
  }, [currentUserId, supabase]);

  return {
    blockUser, unblockUser, isBlocked,
    deleteMessage,
    sendMessageRequest, respondToRequest, getPendingRequests,
    updateDmPrivacy, getDmPrivacy,
  };
};
