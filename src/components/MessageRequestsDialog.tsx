"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bell, Check, X, Inbox } from 'lucide-react';
import { useDMPrivacy } from '@/hooks/useDMPrivacy';
import { useSession } from '@/components/SessionContextProvider';
import { formatDistanceToNow } from 'date-fns';

const isEmail = (str: string) => /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/.test(str);

interface MessageRequestsDialogProps {
  onRequestAccepted: () => void;
}

const MessageRequestsDialog: React.FC<MessageRequestsDialogProps> = ({ onRequestAccepted }) => {
  const [open, setOpen] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const { getPendingRequests, respondToRequest } = useDMPrivacy();
  const { supabase, session } = useSession();
  const currentUserId = session?.user?.id;

  const loadRequests = useCallback(async () => {
    setLoading(true);
    const data = await getPendingRequests();
    setRequests(data);
    setPendingCount(data.length);
    setLoading(false);
  }, [getPendingRequests]);

  useEffect(() => {
    if (open) loadRequests();
  }, [open, loadRequests]);

  // Poll for new requests count
  useEffect(() => {
    if (!currentUserId) return;
    getPendingRequests().then(data => setPendingCount(data.length));

    const channel = supabase
      .channel('message-requests-count')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'message_requests',
        filter: `receiver_id=eq.${currentUserId}`,
      }, () => {
        getPendingRequests().then(data => setPendingCount(data.length));
        if (open) loadRequests();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUserId, supabase, getPendingRequests, open, loadRequests]);

  const handleRespond = async (requestId: string, accept: boolean) => {
    const ok = await respondToRequest(requestId, accept);
    if (ok) {
      setRequests(prev => prev.filter(r => r.id !== requestId));
      setPendingCount(prev => Math.max(0, prev - 1));
      if (accept) onRequestAccepted();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-accent/60 relative" title="Message requests">
          <Bell className="h-4 w-4" />
          {pendingCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
              {pendingCount > 9 ? '9+' : pendingCount}
            </span>
          )}
          <span className="sr-only">Message requests</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[hsl(var(--accent-primary)/0.1)] flex items-center justify-center">
              <Inbox className="w-4 h-4 text-[hsl(var(--accent-primary))]" />
            </div>
            Message Requests
          </DialogTitle>
        </DialogHeader>

        <div className="pt-2 space-y-2 min-h-[120px]">
          {loading && (
            <div className="flex items-center justify-center h-20 text-sm text-muted-foreground">Loading…</div>
          )}
          {!loading && requests.length === 0 && (
            <div className="flex flex-col items-center justify-center h-20 gap-2 text-muted-foreground">
              <Inbox className="w-8 h-8 opacity-30" />
              <p className="text-sm">No pending requests</p>
            </div>
          )}
          {!loading && requests.map((req) => {
            const sender = req.sender?.[0] || req.sender;
            if (!sender) return null;
            const displayName = sender.first_name
              ? `${sender.first_name}`
              : isEmail(sender.username) ? `User ${sender.id.slice(0, 6)}` : sender.username;
            const handle = !isEmail(sender.username) ? sender.username : null;
            return (
              <div key={req.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-card/60">
                <Avatar className="h-10 w-10 flex-shrink-0">
                  <AvatarImage src={sender.avatar_url || `https://api.dicebear.com/7.x/lorelei/svg?seed=${sender.id}`} />
                  <AvatarFallback className="text-xs bg-accent/20">{displayName.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{displayName}</p>
                  {handle && <p className="text-xs text-muted-foreground">@{handle}</p>}
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}
                  </p>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => handleRespond(req.id, true)}
                    className="w-8 h-8 rounded-lg bg-[hsl(var(--accent-primary)/0.1)] hover:bg-[hsl(var(--accent-primary)/0.2)] flex items-center justify-center transition-colors"
                    title="Accept"
                  >
                    <Check className="w-4 h-4 text-[hsl(var(--accent-primary))]" />
                  </button>
                  <button
                    onClick={() => handleRespond(req.id, false)}
                    className="w-8 h-8 rounded-lg bg-destructive/10 hover:bg-destructive/20 flex items-center justify-center transition-colors"
                    title="Decline"
                  >
                    <X className="w-4 h-4 text-destructive" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MessageRequestsDialog;
