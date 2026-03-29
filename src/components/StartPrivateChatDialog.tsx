"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PenSquare, Search, ShieldOff } from 'lucide-react';
import { useSession } from '@/components/SessionContextProvider';
import { showError, showSuccess } from '@/utils/toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useDMPrivacy } from '@/hooks/useDMPrivacy';

interface Profile {
  id: string;
  username: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  dm_privacy?: string;
}

interface StartPrivateChatDialogProps {
  onChatSelected: (chatId: string, chatName: string, chatType: 'private') => void;
}

const isEmail = (str: string) => /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/.test(str);

const StartPrivateChatDialog: React.FC<StartPrivateChatDialogProps> = ({ onChatSelected }) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  const { supabase, session } = useSession();
  const { sendMessageRequest, isBlocked } = useDMPrivacy();
  const currentUserId = session?.user?.id;

  useEffect(() => {
    if (!open) { setSearchTerm(''); setSearchResults([]); }
  }, [open]);

  useEffect(() => {
    const search = async () => {
      if (!searchTerm.trim()) { setSearchResults([]); return; }

      // Only search if input starts with @ or treat the whole input as a username query
      const raw = searchTerm.trim().replace(/^@/, ''); // strip leading @
      if (!raw) { setSearchResults([]); return; }

      setLoading(true);
      const q = `%${raw.toLowerCase()}%`;

      // Only search by username — never by name or email
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, first_name, last_name, avatar_url, dm_privacy')
        .ilike('username', q)
        .neq('id', currentUserId)
        .limit(20);

      if (!error && data) {
        // Filter out profiles whose username is an email (no real username set)
        const filtered = data.filter(u => !isEmail(u.username));
        setSearchResults(filtered);
      }
      setLoading(false);
    };
    const t = setTimeout(search, 300);
    return () => clearTimeout(t);
  }, [searchTerm, supabase, currentUserId]);

  const handleSelectUser = async (user: Profile) => {
    if (!currentUserId) return;
    setStarting(user.id);

    // Check if blocked by target
    const blocked = await isBlocked(user.id);
    if (blocked) {
      showError("You can't message this user.");
      setStarting(null);
      return;
    }

    // Check DM privacy
    if (user.dm_privacy === 'nobody') {
      showError("This user is not accepting messages.");
      setStarting(null);
      return;
    }

    // Check existing chat
    const { data: existing } = await supabase
      .from('private_chats')
      .select('id')
      .or(`and(user1_id.eq.${currentUserId},user2_id.eq.${user.id}),and(user1_id.eq.${user.id},user2_id.eq.${currentUserId})`)
      .maybeSingle();

    const displayName = user.first_name
      ? `${user.first_name}${user.last_name ? ' ' + user.last_name : ''}`
      : isEmail(user.username) ? `User ${user.id.slice(0, 6)}` : user.username;

    if (existing) {
      onChatSelected(existing.id, displayName, 'private');
      setOpen(false);
      setStarting(null);
      return;
    }

    // Check accepted request
    const { data: acceptedReq } = await supabase
      .from('message_requests')
      .select('id')
      .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${user.id}),and(sender_id.eq.${user.id},receiver_id.eq.${currentUserId})`)
      .eq('status', 'accepted')
      .maybeSingle();

    if (acceptedReq) {
      const { data: newChat, error } = await supabase
        .from('private_chats')
        .insert({ user1_id: currentUserId, user2_id: user.id })
        .select('id')
        .single();
      if (error) { showError("Failed to start chat."); setStarting(null); return; }
      onChatSelected(newChat.id, displayName, 'private');
      setOpen(false);
      setStarting(null);
      return;
    }

    // Send message request
    const result = await sendMessageRequest(user.id);
    if (result.status === 'pending') {
      showSuccess('Message request sent! They need to accept before you can chat.');
    } else if (result.status === 'declined') {
      showError('Your previous request was declined.');
    }

    setOpen(false);
    setStarting(null);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-accent/60" title="New direct message">
          <PenSquare className="h-4 w-4" />
          <span className="sr-only">New DM</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[hsl(var(--accent-primary)/0.1)] flex items-center justify-center">
              <PenSquare className="w-4 h-4 text-[hsl(var(--accent-primary))]" />
            </div>
            New direct message
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="@username"
              className="pl-9 rounded-lg"
              autoFocus
            />
          </div>

          <div className="min-h-[160px]">
            {loading && (
              <div className="flex items-center justify-center h-20 text-sm text-muted-foreground">Searching…</div>
            )}
            {!loading && searchTerm && searchResults.length === 0 && (
              <div className="flex items-center justify-center h-20 text-sm text-muted-foreground">No users found</div>
            )}
            {!loading && !searchTerm && (
              <div className="flex flex-col items-center justify-center h-20 gap-1 text-muted-foreground">
                <p className="text-sm">Type <span className="font-mono font-semibold text-[hsl(var(--accent-primary))]">@username</span> to search</p>
                <p className="text-xs opacity-60">Only users with a set username appear</p>
              </div>
            )}
            {!loading && searchResults.length > 0 && (
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {searchResults.map((user) => {
                  const displayName = user.first_name
                    ? `${user.first_name}${user.last_name ? ' ' + user.last_name : ''}`
                    : isEmail(user.username) ? `User ${user.id.slice(0, 6)}` : user.username;
                  const handle = !isEmail(user.username) ? user.username : null;
                  const dmsClosed = user.dm_privacy === 'nobody';
                  const isStarting = starting === user.id;
                  return (
                    <button
                      key={user.id}
                      onClick={() => !dmsClosed && handleSelectUser(user)}
                      disabled={isStarting || dmsClosed}
                      className={cn(
                        "w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors",
                        dmsClosed ? "opacity-50 cursor-not-allowed" : "hover:bg-accent/60",
                        isStarting && "opacity-50 pointer-events-none"
                      )}
                    >
                      <Avatar className="h-9 w-9 flex-shrink-0">
                        <AvatarImage src={user.avatar_url || `https://api.dicebear.com/7.x/lorelei/svg?seed=${user.id}`} />
                        <AvatarFallback className="text-xs bg-accent/20">{displayName.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{displayName}</p>
                        {handle && <p className="text-xs text-muted-foreground truncate">@{handle}</p>}
                      </div>
                      {dmsClosed && <ShieldOff className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                      {isStarting && (
                        <span className="w-4 h-4 border-2 border-[hsl(var(--accent-primary))] border-t-transparent rounded-full animate-spin flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StartPrivateChatDialog;
