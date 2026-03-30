import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, User, LogOut, Sun, Moon, Camera, Upload, ShieldCheck } from 'lucide-react';
import { useSession } from '@/components/SessionContextProvider';
import { showError, showSuccess } from '@/utils/toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import ChatDataManagementSection from './ChatDataManagementSection';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNavigate } from 'react-router-dom';
import { Switch } from "@/components/ui/switch";
import { useTheme } from "next-themes";
import { useDMPrivacy, type DmPrivacy } from '@/hooks/useDMPrivacy';

interface ProfileSettingsDialogProps {
  onProfileUpdated: () => void;
}

const ProfileSettingsDialog: React.FC<ProfileSettingsDialogProps> = ({ onProfileUpdated }) => {
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [dmPrivacy, setDmPrivacy] = useState<DmPrivacy>('everyone');
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { supabase, session } = useSession();
  const currentUserId = session?.user?.id;
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { updateDmPrivacy, getDmPrivacy } = useDMPrivacy();

  const fetchProfile = useCallback(async () => {
    if (!currentUserId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('first_name, last_name, username, avatar_url')
      .eq('id', currentUserId);
    if (!error && data?.length > 0) {
      const p = data[0];
      setFirstName(p.first_name || '');
      setLastName(p.last_name || '');
      setUsername(p.username || '');
      setAvatarUrl(p.avatar_url || '');
    }
    // Load DM privacy setting
    const privacy = await getDmPrivacy();
    setDmPrivacy(privacy);
    setLoading(false);
  }, [currentUserId, supabase]);

  useEffect(() => { if (open) fetchProfile(); }, [open, fetchProfile]);

  const handleSave = async () => {
    if (!currentUserId) return;
    if (!username.trim()) { showError("Username cannot be empty."); return; }
    setIsSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ first_name: firstName.trim(), last_name: lastName.trim(), username: username.trim(), avatar_url: avatarUrl.trim(), updated_at: new Date().toISOString() })
      .eq('id', currentUserId);
    if (error) showError("Failed to update: " + error.message);
    else { showSuccess("Profile updated!"); setOpen(false); onProfileUpdated(); }
    setIsSaving(false);
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) { showError("Failed to log out: " + error.message); return; }
    showSuccess("Logged out successfully.");
    setOpen(false);
    navigate('/');
  };

  const isEmail = (str: string) => /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/.test(str);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUserId) return;
    if (file.size > 2 * 1024 * 1024) { showError("Image must be under 2MB."); return; }

    setIsUploadingAvatar(true);
    const ext = file.name.split('.').pop();
    const path = `avatars/${currentUserId}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true });

    if (uploadError) {
      // Fallback: convert to base64 data URL if storage bucket not set up
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) setAvatarUrl(ev.target.result as string);
      };
      reader.readAsDataURL(file);
      setIsUploadingAvatar(false);
      return;
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    setAvatarUrl(data.publicUrl);
    setIsUploadingAvatar(false);
    showSuccess("Avatar uploaded!");
  };

  const displayName = firstName
    ? `${firstName}${lastName ? ' ' + lastName : ''}`
    : (username && !isEmail(username)) ? username : null;

  const defaultAvatar = `https://api.dicebear.com/7.x/lorelei/svg?seed=${currentUserId || 'user'}`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-accent/60" title="Settings">
          <Settings className="h-4 w-4" />
          <span className="sr-only">Settings</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md rounded-2xl p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle className="text-lg font-semibold">Settings</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Loading…</div>
        ) : (
          <ScrollArea className="max-h-[85dvh]">
            <div className="px-5 pb-6 space-y-5 pt-4">

              {/* Avatar + name preview */}
              <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/40 border border-border/50">
                <div className="relative">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={avatarUrl || defaultAvatar} alt={displayName || 'User'} />
                    <AvatarFallback className="text-lg bg-[hsl(var(--accent-primary)/0.15)]">
                      <User className="h-7 w-7 text-[hsl(var(--accent-primary))]" />
                    </AvatarFallback>
                  </Avatar>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                    className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[hsl(var(--accent-primary))] flex items-center justify-center ring-2 ring-background hover:opacity-90 transition-opacity"
                    title="Upload photo"
                  >
                    {isUploadingAvatar
                      ? <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                      : <Camera className="w-3 h-3 text-white" />
                    }
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                </div>
                <div className="min-w-0">
                  {displayName ? (
                    <>
                      <p className="font-semibold truncate">{displayName}</p>
                      <p className="text-xs text-muted-foreground truncate">{session?.user?.email}</p>
                    </>
                  ) : (
                    <p className="font-semibold truncate">{session?.user?.email}</p>
                  )}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-[hsl(var(--accent-primary))] hover:underline mt-1 flex items-center gap-1"
                  >
                    <Upload className="w-3 h-3" />
                    Upload photo
                  </button>
                </div>
              </div>

              {/* Profile fields */}
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Profile</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="firstName" className="text-xs font-medium">First name</Label>
                    <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John" className="rounded-xl h-11 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lastName" className="text-xs font-medium">Last name</Label>
                    <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" className="rounded-xl h-11 text-sm" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="username" className="text-xs font-medium">Username</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                    <Input
                      id="username"
                      value={isEmail(username) ? '' : username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="johndoe"
                      className="rounded-xl h-11 text-sm pl-7"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="avatarUrl" className="text-xs font-medium">Avatar URL <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input id="avatarUrl" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://…" className="rounded-xl h-11 text-sm" />
                </div>
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="w-full rounded-xl bg-[hsl(var(--accent-primary))] hover:bg-[hsl(var(--accent-primary)/0.85)] text-white h-11"
                >
                  {isSaving ? 'Saving…' : 'Save profile'}
                </Button>
              </div>

              <Separator />

              {/* Appearance */}
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Appearance</p>
                <div className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-card">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                      {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">Dark mode</p>
                      <p className="text-xs text-muted-foreground">{theme === 'dark' ? 'Currently dark' : 'Currently light'}</p>
                    </div>
                  </div>
                  <Switch
                    checked={theme === 'dark'}
                    onCheckedChange={(c) => setTheme(c ? 'dark' : 'light')}
                  />
                </div>
              </div>

              <Separator />

              {/* Privacy */}
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Privacy</p>
                <div className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-card">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Who can message me</p>
                      <p className="text-xs text-muted-foreground">
                        {dmPrivacy === 'everyone' ? 'Anyone can send you a request' : 'Nobody can message you'}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={dmPrivacy === 'nobody'}
                    onCheckedChange={async (c) => {
                      const val: DmPrivacy = c ? 'nobody' : 'everyone';
                      setDmPrivacy(val);
                      await updateDmPrivacy(val);
                    }}
                  />
                </div>
              </div>

              <Separator />
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Data</p>
                <ChatDataManagementSection onChatDataCleared={onProfileUpdated} />
              </div>

              <Separator />

              {/* Account */}
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Account</p>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-border/60 hover:bg-destructive/5 hover:border-destructive/30 transition-colors text-left group"
                >
                  <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center group-hover:bg-destructive/15">
                    <LogOut className="h-4 w-4 text-destructive" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-destructive">Sign out</p>
                    <p className="text-xs text-muted-foreground">You'll be redirected to the home page</p>
                  </div>
                </button>
              </div>

            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ProfileSettingsDialog;
