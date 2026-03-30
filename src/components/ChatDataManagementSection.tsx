import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
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
import { MessageSquareOff, Users, CheckCircle } from 'lucide-react';
import { Separator } from '@/components/ui/separator'; // Re-import Separator

interface ChatDataManagementSectionProps {
  onChatDataCleared: () => void;
}

const ChatDataManagementSection: React.FC<ChatDataManagementSectionProps> = ({ onChatDataCleared }) => {
  const { supabase, session } = useSession();
  const currentUserId = session?.user?.id;

  const [isClearingPublicRooms, setIsClearingPublicRooms] = useState(false);
  const [isClearingPrivateChats, setIsClearingPrivateChats] = useState(false);
  const [isMarkingRead, setIsMarkingRead] = useState(false);

  const handleClearPublicChatRooms = async () => {
    if (!currentUserId) {
      showError("You must be logged in to clear chat rooms.");
      return;
    }
    setIsClearingPublicRooms(true);
    try {
      // This will delete all public chat rooms created by the current user.
      // Due to foreign key constraints with ON DELETE CASCADE, all messages within these rooms
      // (regardless of sender) will also be deleted.
      const { error } = await supabase
        .from('chat_rooms')
        .delete()
        .eq('creator_id', currentUserId);

      if (error) throw error;
      showSuccess("All public chat rooms you created, and their messages, have been cleared!");
      onChatDataCleared(); // Refresh sidebar and chat view
    } catch (error) {
      if (error instanceof Error) {
        showError("Failed to clear public chat rooms: " + error.message);
        console.error("Error clearing public chat rooms:", error);
      } else {
        showError("An unknown error occurred while clearing public chat rooms.");
        console.error("Unknown error clearing public chat rooms:", error);
      }
    } finally {
      setIsClearingPublicRooms(false);
    }
  };

  const handleClearPrivateChats = async () => {
    if (!currentUserId) {
      showError("You must be logged in to clear private chats.");
      return;
    }
    setIsClearingPrivateChats(true);
    try {
      // This will delete all private chats where the current user is involved.
      // Due to foreign key constraints with ON DELETE CASCADE, all private messages within these chats
      // (regardless of sender) will also be deleted.
      const { error } = await supabase
        .from('private_chats')
        .delete()
        .or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`);

      if (error) throw error;
      showSuccess("All private chats you are involved in, and their messages, have been cleared!");
      onChatDataCleared(); // Refresh sidebar and chat view
    } catch (error) {
      if (error instanceof Error) {
        showError("Failed to clear private chats: " + error.message);
        console.error("Error clearing private chats:", error);
      } else {
        showError("An unknown error occurred while clearing private chats.");
        console.error("Unknown error clearing private chats:", error);
      }
    } finally {
      setIsClearingPrivateChats(false);
    }
  };

  const handleMarkAllRead = async () => {
    if (!currentUserId) {
      showError("You must be logged in to mark messages as read.");
      return;
    }
    setIsMarkingRead(true);
    try {
      const now = new Date().toISOString();
      // Update last_read_at for all public chat read statuses for the current user
      const { error: publicReadError } = await supabase
        .from('user_chat_read_status')
        .update({ last_read_at: now })
        .eq('user_id', currentUserId)
        .not('chat_room_id', 'is', null); // Only update public chat statuses

      if (publicReadError) throw publicReadError;

      // Update last_read_at for all private chat read statuses for the current user
      const { error: privateReadError } = await supabase
        .from('user_chat_read_status')
        .update({ last_read_at: now })
        .eq('user_id', currentUserId)
        .not('private_chat_id', 'is', null); // Only update private chat statuses

      if (privateReadError) throw privateReadError;

      showSuccess("All your messages have been marked as read!");
      onChatDataCleared(); // Refresh sidebar to update unread counts
    } catch (error) {
      if (error instanceof Error) {
        showError("Failed to mark all messages as read: " + error.message);
        console.error("Error marking all messages as read:", error);
      } else {
        showError("An unknown error occurred while marking messages as read.");
        console.error("Unknown error marking messages as read:", error);
      }
    } finally {
      setIsMarkingRead(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Chat Data Management</h3>
      <p className="text-sm text-muted-foreground">
        Manage and delete specific parts of your chat data, or mark all messages as read.
      </p>

      {/* Mark All Messages Read */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" className="w-full justify-start">
            <CheckCircle className="mr-2 h-4 w-4" /> Mark All Messages Read
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="shadow-lg border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Mark all messages as read?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will update the read status for all your public and private chats to the current time.
              Any unread badges will be cleared.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMarkingRead}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleMarkAllRead} disabled={isMarkingRead}>
              {isMarkingRead ? 'Marking...' : 'Mark All Read'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Separator className="my-4" /> {/* Re-added Separator */}

      {/* Clear Public Chat Rooms */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" className="w-full justify-start">
            <Users className="mr-2 h-4 w-4" /> Clear My Public Chat Rooms
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="shadow-lg border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete ALL public chat rooms you have created.
              <br /><br />
              **Important:** Deleting a room you created will also permanently delete ALL messages within that room, regardless of who sent them. This action does NOT affect public chat rooms created by other users.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClearingPublicRooms}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearPublicChatRooms} disabled={isClearingPublicRooms} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isClearingPublicRooms ? 'Clearing...' : 'Clear Public Rooms'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Separator className="my-4" /> {/* Re-added Separator */}

      {/* Clear Private Chats */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" className="w-full justify-start">
            <MessageSquareOff className="mr-2 h-4 w-4" /> Clear My Private Chats
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="shadow-lg border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete ALL private chats you are involved in.
              <br /><br />
              **Important:** Deleting a private chat will also permanently delete ALL messages within that chat, regardless of who sent them. This action affects both your messages and the other user's messages in those specific private chats.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClearingPrivateChats}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearPrivateChats} disabled={isClearingPrivateChats} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isClearingPrivateChats ? 'Clearing...' : 'Clear Private Chats'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ChatDataManagementSection;