"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PenSquare, Search } from 'lucide-react';
import { useSession } from '@/components/SessionContextProvider';
import { showError, showSuccess } from '@/utils/toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface Profile {
  id: string;
  username: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
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
  const [starting, setStarting] = useState(false);
  const { supabase, session } = useSession();
  const currentUserId = session?.user?.id;

  useEffect(() => {
    if (!open) { setSearchTerm(''); setSearchResults([]); }
  }, [open]);

  useEffect(() => {
    const search = async () => {
      if (!searchTerm.trim()) { setSearchResults([]); return; }
      setLoading(true);
      const q = `%${searchTerm.trim().toLowerCase()}%`;
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, first_name, last_name, avatar_url')
        .or(`username.ilike.${q},first_name.ilike.${q},last_name.ilike.${q}`)
        .neq('id', currentUserId)
        .limit(20);
      if (!error) setSearchResults(data || []);
      setLoading(false);
    };
    const t = setTimeout(search, 300);
    return () => clearTimeout(t);
  }, [searchTerm, supabase, currentUserId]);

  const handleSelectUser = async (user: Profile) => {
    if (!currentUserId) return;
    setStarting(true);
    const { data: existing, error: checkErr } = await supabase
      .from('private_chats')
      .select('id')
      .or(`and(user1_id.eq.${currentUserId},user2_id.eq.${user.id}),and(user1_id.eq.${user.id},user2_id.eq.${currentUserId})`)
      .single();

    if (checkErr && checkErr.code !== 'PGRST116') {
      showError("Error: " + checkErr.message);
      setStarting(false);
      return;
    }

    let chatId: string;
    if (existing) {
      chatId = existing.id;
    } else {
      const { data: newChat, error: createErr } = await supabase
        .from('private_chats')
        .insert({ user1_id: currentUserId, user2_id: user.id })
        .select('id')
        .single();
      if (createErr) { showError("Failed to start chat: " + createErr.message); setStarting(false); return; }
      chatId = newChat.id;
      showSuccess(`Chat started with ${user.first_name || user.username}`);
    }

    const displayName = user.first_name || (isEmail(user.username) ? `User ${user.id.slice(0, 6)}` : user.username);
    onChatSelected(chatId, displayName, 'private');
    setOpen(false);
    setStarting(false);
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
              placeholder="Search by name or username…"
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
              <div className="flex items-center justify-center h-20 text-sm text-muted-foreground">Type a name to search</div>
            )}
            {!loading && searchResults.length > 0 && (
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {searchResults.map((user) => {
                  const displayName = user.first_name
                    ? `${user.first_name}${user.last_name ? ' ' + user.last_name : ''}`
                    : isEmail(user.username) ? `User ${user.id.slice(0, 6)}` : user.username;
                  const handle = !isEmail(user.username) ? user.username : null;
                  return (
                    <button
                      key={user.id}
                      onClick={() => handleSelectUser(user)}
                      disabled={starting}
                      className={cn(
                        "w-full flex items-center gap-3 p-2.5 rounded-lg text-left hover:bg-accent/60 transition-colors",
                        starting && "opacity-50 pointer-events-none"
                      )}
                    >
                      <Avatar className="h-9 w-9 flex-shrink-0">
                        <AvatarImage src={user.avatar_url || `https://api.dicebear.com/7.x/lorelei/svg?seed=${user.id}`} />
                        <AvatarFallback className="text-xs bg-accent/20">{displayName.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{displayName}</p>
                        {handle && <p className="text-xs text-muted-foreground truncate">@{handle}</p>}
                      </div>
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
