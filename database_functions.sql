-- ADVANCED FUNCTIONS AND POLICIES FOR PROCHAT
-- Run this AFTER complete_fresh_database.sql has been executed successfully
-- These functions require the tables to exist first

-- ============================================================================
-- BASIC USER FUNCTION AND TRIGGER
-- ============================================================================

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, created_at, updated_at)
  VALUES (new.id, new.email, now(), now());
  RETURN new;
END;
$$;

-- Create the user trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grant function permission
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_chat_read_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_requests ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Chat rooms policies
CREATE POLICY "Chat rooms are viewable by everyone" ON chat_rooms FOR SELECT USING (is_active = true);
CREATE POLICY "Users can create chat rooms" ON chat_rooms FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Users can update their own chat rooms" ON chat_rooms FOR UPDATE USING (auth.uid() = creator_id);
CREATE POLICY "Users can delete their own chat rooms" ON chat_rooms FOR DELETE USING (auth.uid() = creator_id);

-- Messages policies
CREATE POLICY "Messages are viewable by everyone in active rooms" ON messages FOR SELECT 
  USING (is_deleted = false AND chat_room_id IN (SELECT id FROM chat_rooms WHERE is_active = true));
CREATE POLICY "Users can insert messages" ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users can update their own messages" ON messages FOR UPDATE USING (auth.uid() = sender_id);

-- Private chats policies
CREATE POLICY "Users can view private chats they are part of" ON private_chats FOR SELECT 
  USING ((auth.uid() = user1_id OR auth.uid() = user2_id) AND is_active = true);
CREATE POLICY "Users can create private chats" ON private_chats FOR INSERT 
  WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);
CREATE POLICY "Users can update private chats they are part of" ON private_chats FOR UPDATE 
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Private messages policies
CREATE POLICY "Users can view messages in private chats they are part of" ON private_messages FOR SELECT 
  USING (
    deleted_at IS NULL AND
    private_chat_id IN (
      SELECT id FROM private_chats 
      WHERE (user1_id = auth.uid() OR user2_id = auth.uid()) AND is_active = true
    )
  );
CREATE POLICY "Users can insert messages in private chats they are part of" ON private_messages FOR INSERT 
  WITH CHECK (
    auth.uid() = sender_id AND
    private_chat_id IN (
      SELECT id FROM private_chats 
      WHERE (user1_id = auth.uid() OR user2_id = auth.uid()) AND is_active = true
    )
  );
CREATE POLICY "Users can soft-delete their own private messages" ON private_messages FOR UPDATE 
  USING (auth.uid() = sender_id) WITH CHECK (auth.uid() = sender_id);

-- Read status policies
CREATE POLICY "Users can manage their own read status" ON user_chat_read_status FOR ALL 
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- User blocks policies
CREATE POLICY "Users can manage their own blocks" ON user_blocks FOR ALL 
  USING (auth.uid() = blocker_id) WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "Users can see if they are blocked" ON user_blocks FOR SELECT 
  USING (auth.uid() = blocked_id);

-- Message requests policies
CREATE POLICY "Users can view their own message requests" ON message_requests FOR SELECT 
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can send message requests" ON message_requests FOR INSERT 
  WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Receivers can update request status" ON message_requests FOR UPDATE 
  USING (auth.uid() = receiver_id);

-- ============================================================================
-- ADVANCED FUNCTIONS: Unread counts and messaging
-- ============================================================================

-- Update last message timestamp triggers
CREATE OR REPLACE FUNCTION public.update_last_message_timestamp()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_TABLE_NAME = 'messages' THEN
    UPDATE chat_rooms 
    SET last_message_at = NEW.created_at, 
        message_count = message_count + 1,
        updated_at = now()
    WHERE id = NEW.chat_room_id;
  ELSIF TG_TABLE_NAME = 'private_messages' THEN
    UPDATE private_chats 
    SET last_message_at = NEW.created_at, 
        message_count = message_count + 1,
        updated_at = now()
    WHERE id = NEW.private_chat_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Fast unread count for public chats
CREATE OR REPLACE FUNCTION get_unread_count(p_chat_room_id uuid, p_user_id uuid)
RETURNS integer 
LANGUAGE plpgsql 
STABLE 
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::integer
    FROM messages m
    LEFT JOIN user_chat_read_status urs ON (
      urs.chat_room_id = m.chat_room_id AND urs.user_id = p_user_id
    )
    WHERE m.chat_room_id = p_chat_room_id
      AND m.sender_id != p_user_id
      AND m.is_deleted = false
      AND m.created_at > COALESCE(urs.last_read_at, '1970-01-01'::timestamptz)
  );
END;
$$;

-- Fast unread count for private chats
CREATE OR REPLACE FUNCTION get_private_unread_count(p_private_chat_id uuid, p_user_id uuid)
RETURNS integer 
LANGUAGE plpgsql 
STABLE 
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::integer
    FROM private_messages pm
    LEFT JOIN user_chat_read_status urs ON (
      urs.private_chat_id = pm.private_chat_id AND urs.user_id = p_user_id
    )
    WHERE pm.private_chat_id = p_private_chat_id
      AND pm.sender_id != p_user_id
      AND pm.deleted_at IS NULL
      AND pm.created_at > COALESCE(urs.last_read_at, '1970-01-01'::timestamptz)
  );
END;
$$;

-- Bulk unread counts (optimized for sidebar)
CREATE OR REPLACE FUNCTION get_all_unread_counts(p_user_id uuid)
RETURNS TABLE(chat_id uuid, chat_type text, unread_count integer) 
LANGUAGE plpgsql 
STABLE 
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH user_read_status AS (
    SELECT 
      chat_room_id,
      private_chat_id,
      COALESCE(last_read_at, '1970-01-01'::timestamptz) as last_read
    FROM user_chat_read_status 
    WHERE user_id = p_user_id
  ),
  public_unread AS (
    SELECT 
      m.chat_room_id as chat_id,
      'public'::text as chat_type,
      COUNT(*)::integer as unread_count
    FROM messages m
    LEFT JOIN user_read_status urs ON urs.chat_room_id = m.chat_room_id
    WHERE m.sender_id != p_user_id
      AND m.is_deleted = false
      AND m.created_at > COALESCE(urs.last_read, '1970-01-01'::timestamptz)
    GROUP BY m.chat_room_id
    HAVING COUNT(*) > 0
  ),
  private_unread AS (
    SELECT 
      pm.private_chat_id as chat_id,
      'private'::text as chat_type,
      COUNT(*)::integer as unread_count
    FROM private_messages pm
    LEFT JOIN user_read_status urs ON urs.private_chat_id = pm.private_chat_id
    WHERE pm.sender_id != p_user_id
      AND pm.deleted_at IS NULL
      AND pm.created_at > COALESCE(urs.last_read, '1970-01-01'::timestamptz)
    GROUP BY pm.private_chat_id
    HAVING COUNT(*) > 0
  )
  SELECT * FROM public_unread
  UNION ALL
  SELECT * FROM private_unread;
END;
$$;

-- Mark messages as read (optimized)
CREATE OR REPLACE FUNCTION mark_messages_read(p_chat_room_id uuid, p_user_id uuid)
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO user_chat_read_status (user_id, chat_room_id, last_read_at, updated_at)
  VALUES (p_user_id, p_chat_room_id, now(), now())
  ON CONFLICT (user_id, chat_room_id)
  DO UPDATE SET 
    last_read_at = now(),
    updated_at = now();
END;
$$;

-- Mark private messages as read (optimized)
CREATE OR REPLACE FUNCTION mark_private_messages_read(p_private_chat_id uuid, p_user_id uuid)
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO user_chat_read_status (user_id, private_chat_id, last_read_at, updated_at)
  VALUES (p_user_id, p_private_chat_id, now(), now())
  ON CONFLICT (user_id, private_chat_id)
  DO UPDATE SET 
    last_read_at = now(),
    updated_at = now();
END;
$$;

-- Fast user search
CREATE OR REPLACE FUNCTION search_users(search_term text)
RETURNS TABLE(
  id uuid,
  username text,
  first_name text,
  last_name text,
  avatar_url text,
  is_online boolean
) 
LANGUAGE plpgsql 
STABLE 
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.username,
    p.first_name,
    p.last_name,
    p.avatar_url,
    p.is_online
  FROM profiles p
  WHERE 
    p.username ILIKE '%' || search_term || '%' OR
    p.first_name ILIKE '%' || search_term || '%' OR
    p.last_name ILIKE '%' || search_term || '%'
  ORDER BY 
    CASE WHEN p.is_online THEN 0 ELSE 1 END,
    p.last_seen DESC
  LIMIT 50;
END;
$$;

-- ============================================================================
-- TRIGGERS: Create triggers for the advanced functions
-- ============================================================================

CREATE TRIGGER update_chat_room_timestamp
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION public.update_last_message_timestamp();

CREATE TRIGGER update_private_chat_timestamp
  AFTER INSERT ON private_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_last_message_timestamp();

-- ============================================================================
-- FUNCTION PERMISSIONS
-- ============================================================================

-- Grant function permissions
GRANT EXECUTE ON FUNCTION public.update_last_message_timestamp() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_unread_count(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_private_unread_count(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_unread_counts(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_messages_read(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_private_messages_read(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_users(text) TO authenticated;

-- Grant all function permissions to service role
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- ============================================================================
-- PERFORMANCE OPTIMIZATION
-- ============================================================================

-- Update table statistics for query planner
ANALYZE profiles;
ANALYZE chat_rooms;
ANALYZE messages;
ANALYZE private_chats;
ANALYZE private_messages;
ANALYZE user_chat_read_status;
ANALYZE user_blocks;
ANALYZE message_requests;

-- Success message
SELECT 'ProChat advanced functions setup completed! Unread count functions are now available.' as result;