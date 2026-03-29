-- ============================================================
-- DM Privacy Features Migration
-- Features: message deletion, block users, hide emails,
--           message requests, DM privacy setting
-- ============================================================

-- 1. Add soft-delete to private_messages
ALTER TABLE private_messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
ALTER TABLE private_messages ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES profiles(id) ON DELETE SET NULL DEFAULT NULL;

-- 2. Block list table
CREATE TABLE IF NOT EXISTS user_blocks (
  id BIGSERIAL PRIMARY KEY,
  blocker_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  blocked_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  CONSTRAINT unique_block UNIQUE (blocker_id, blocked_id)
);

ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON TABLE public.user_blocks TO authenticated;
GRANT ALL ON TABLE public.user_blocks TO service_role;

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON user_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON user_blocks(blocked_id);

CREATE POLICY "Users can manage their own blocks."
  ON user_blocks FOR ALL
  USING (auth.uid() = blocker_id)
  WITH CHECK (auth.uid() = blocker_id);

-- Blocked users can see they are blocked (needed to check status)
CREATE POLICY "Users can see if they are blocked."
  ON user_blocks FOR SELECT
  USING (auth.uid() = blocked_id);

-- 3. Message requests table
CREATE TABLE IF NOT EXISTS message_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  receiver_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  CONSTRAINT unique_message_request UNIQUE (sender_id, receiver_id)
);

ALTER TABLE message_requests ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON TABLE public.message_requests TO authenticated;
GRANT ALL ON TABLE public.message_requests TO service_role;

CREATE INDEX IF NOT EXISTS idx_message_requests_sender ON message_requests(sender_id);
CREATE INDEX IF NOT EXISTS idx_message_requests_receiver ON message_requests(receiver_id);
CREATE INDEX IF NOT EXISTS idx_message_requests_status ON message_requests(status);

CREATE POLICY "Users can view their own message requests."
  ON message_requests FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send message requests."
  ON message_requests FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Receivers can update request status."
  ON message_requests FOR UPDATE
  USING (auth.uid() = receiver_id);

-- 4. DM privacy setting on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS dm_privacy TEXT NOT NULL DEFAULT 'everyone' CHECK (dm_privacy IN ('everyone', 'nobody'));

-- 5. Update private_messages DELETE policy — only sender can soft-delete
-- (We use UPDATE to set deleted_at instead of hard DELETE)
CREATE POLICY "Users can soft-delete their own private messages."
  ON private_messages FOR UPDATE
  USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);

-- 6. RPC: check if user A is blocked by user B
CREATE OR REPLACE FUNCTION is_blocked_by(p_viewer uuid, p_target uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_blocks
    WHERE blocker_id = p_target AND blocked_id = p_viewer
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION is_blocked_by(uuid, uuid) TO authenticated;

-- 7. RPC: check if two users have an accepted DM relationship
--    (either existing private_chat or accepted message_request)
CREATE OR REPLACE FUNCTION can_send_dm(p_sender uuid, p_receiver uuid)
RETURNS boolean AS $$
DECLARE
  v_privacy TEXT;
  v_blocked BOOLEAN;
  v_has_chat BOOLEAN;
  v_accepted BOOLEAN;
BEGIN
  -- Check receiver's DM privacy setting
  SELECT dm_privacy INTO v_privacy FROM profiles WHERE id = p_receiver;
  IF v_privacy = 'nobody' THEN RETURN false; END IF;

  -- Check if sender is blocked by receiver
  SELECT EXISTS(
    SELECT 1 FROM user_blocks WHERE blocker_id = p_receiver AND blocked_id = p_sender
  ) INTO v_blocked;
  IF v_blocked THEN RETURN false; END IF;

  -- If they already have a chat, allow
  SELECT EXISTS(
    SELECT 1 FROM private_chats
    WHERE (user1_id = p_sender AND user2_id = p_receiver)
       OR (user1_id = p_receiver AND user2_id = p_sender)
  ) INTO v_has_chat;
  IF v_has_chat THEN RETURN true; END IF;

  -- Check for accepted request
  SELECT EXISTS(
    SELECT 1 FROM message_requests
    WHERE ((sender_id = p_sender AND receiver_id = p_receiver)
        OR (sender_id = p_receiver AND receiver_id = p_sender))
      AND status = 'accepted'
  ) INTO v_accepted;

  RETURN v_accepted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION can_send_dm(uuid, uuid) TO authenticated;
