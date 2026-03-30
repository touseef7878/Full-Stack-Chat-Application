import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Hash } from 'lucide-react';
import { useSession } from '@/components/SessionContextProvider';
import { showSuccess, showError } from '@/utils/toast';

interface CreateChatRoomDialogProps {
  onChatRoomCreated: () => void;
}

const CreateChatRoomDialog: React.FC<CreateChatRoomDialogProps> = ({ onChatRoomCreated }) => {
  const [open, setOpen] = useState(false);
  const [chatRoomName, setChatRoomName] = useState('');
  const [loading, setLoading] = useState(false);
  const { supabase, session } = useSession();

  const handleCreate = async () => {
    if (!chatRoomName.trim()) { showError("Room name cannot be empty."); return; }
    if (!session?.user?.id) { showError("You must be logged in."); return; }
    setLoading(true);
    const { error } = await supabase
      .from('chat_rooms')
      .insert({ name: chatRoomName.trim(), creator_id: session.user.id })
      .select();
    setLoading(false);
    if (error) { showError("Failed to create room: " + error.message); return; }
    showSuccess(`#${chatRoomName} created!`);
    setChatRoomName('');
    setOpen(false);
    onChatRoomCreated();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-accent/60" title="Create public room">
          <Hash className="h-4 w-4" />
          <span className="sr-only">Create room</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[hsl(var(--accent-primary)/0.1)] flex items-center justify-center">
              <Hash className="w-4 h-4 text-[hsl(var(--accent-primary))]" />
            </div>
            New public room
          </DialogTitle>
          <DialogDescription className="sr-only">Create a new public chat room</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="room-name" className="text-sm font-medium">Room name</Label>
            <Input
              id="room-name"
              value={chatRoomName}
              onChange={(e) => setChatRoomName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="e.g. general, random, dev-talk"
              className="rounded-xl h-11"
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} className="flex-1 rounded-xl h-11">Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={!chatRoomName.trim() || loading}
              className="flex-1 rounded-xl h-11 bg-[hsl(var(--accent-primary))] hover:bg-[hsl(var(--accent-primary)/0.85)] text-white"
            >
              {loading ? 'Creating…' : 'Create'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateChatRoomDialog;
