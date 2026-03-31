-- COMPLETE FRESH DATABASE SETUP FOR PROCHAT
-- Ultra-minimal version - Tables only
-- Run this in Supabase SQL Editor to create a fresh database

-- ============================================================================
-- CLEANUP: Drop tables only (no triggers)
-- ============================================================================

-- Drop all tables in correct order (respecting foreign keys)
DROP TABLE IF EXISTS public.user_chat_read_status CASCADE;
DROP TABLE IF EXISTS public.private_messages CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.private_chats CASCADE;
DROP TABLE IF EXISTS public.chat_rooms CASCADE;
DROP TABLE IF EXISTS public.user_blocks CASCADE;
DROP TABLE IF EXISTS public.message_requests CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Drop all functions
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.get_all_unread_counts(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_unread_count(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_private_unread_count(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.mark_messages_read(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.mark_private_messages_read(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_chat_participants(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.search_users(text) CASCADE;
DROP FUNCTION IF EXISTS public.update_last_message_timestamp() CASCADE;

-- Grant basic permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- ============================================================================
-- CORE TABLES: Optimized for Performance
-- ============================================================================

-- Profiles table with optimized indexing
CREATE TABLE profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
  username TEXT UNIQUE,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  dm_privacy TEXT NOT NULL DEFAULT 'everyone' CHECK (dm_privacy IN ('everyone', 'nobody')),
  is_online BOOLEAN DEFAULT false,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT username_length CHECK (char_length(username) >= 3)
);

-- Chat rooms with message count and last activity tracking
CREATE TABLE chat_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  creator_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  message_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  
  CONSTRAINT name_length CHECK (char_length(name) >= 1 AND char_length(name) <= 100)
);

-- Messages with optimized structure
CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  chat_room_id uuid REFERENCES chat_rooms(id) ON DELETE CASCADE NOT NULL,
  sender_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'system')),
  edited_at TIMESTAMP WITH TIME ZONE,
  reply_to_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  is_deleted BOOLEAN DEFAULT false,
  
  CONSTRAINT content_length CHECK (char_length(content) >= 1 AND char_length(content) <= 4000)
);

-- Private chats with bidirectional support
CREATE TABLE private_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  user1_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  user2_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  message_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  
  CONSTRAINT unique_private_chat UNIQUE (user1_id, user2_id),
  CONSTRAINT different_users CHECK (user1_id != user2_id)
);

-- Private messages with soft delete support
CREATE TABLE private_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  private_chat_id uuid REFERENCES private_chats(id) ON DELETE CASCADE NOT NULL,
  sender_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'system')),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  deleted_by uuid REFERENCES profiles(id) ON DELETE SET NULL DEFAULT NULL,
  edited_at TIMESTAMP WITH TIME ZONE,
  reply_to_id uuid REFERENCES private_messages(id) ON DELETE SET NULL,
  
  CONSTRAINT content_length CHECK (char_length(content) >= 1 AND char_length(content) <= 4000)
);

-- Read status tracking for unread counts
CREATE TABLE user_chat_read_status (
  id BIGSERIAL PRIMARY KEY,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  chat_room_id uuid REFERENCES chat_rooms(id) ON DELETE CASCADE,
  private_chat_id uuid REFERENCES private_chats(id) ON DELETE CASCADE,
  last_read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT unique_read_status UNIQUE (user_id, chat_room_id),
  CONSTRAINT unique_private_read_status UNIQUE (user_id, private_chat_id),
  CONSTRAINT one_chat_type CHECK (
    (chat_room_id IS NOT NULL AND private_chat_id IS NULL) OR 
    (chat_room_id IS NULL AND private_chat_id IS NOT NULL)
  )
);

-- User blocking system
CREATE TABLE user_blocks (
  id BIGSERIAL PRIMARY KEY,
  blocker_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  blocked_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  
  CONSTRAINT unique_block UNIQUE (blocker_id, blocked_id),
  CONSTRAINT no_self_block CHECK (blocker_id != blocked_id)
);

-- Message requests for DM privacy
CREATE TABLE message_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  receiver_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  
  CONSTRAINT unique_message_request UNIQUE (sender_id, receiver_id),
  CONSTRAINT no_self_request CHECK (sender_id != receiver_id)
);

-- ============================================================================
-- PERFORMANCE INDEXES: WhatsApp-Level Optimization
-- ============================================================================

-- Profiles indexes
CREATE INDEX idx_profiles_username ON profiles(username) WHERE username IS NOT NULL;
CREATE INDEX idx_profiles_online ON profiles(is_online, last_seen) WHERE is_online = true;

-- Chat rooms indexes
CREATE INDEX idx_chat_rooms_creator ON chat_rooms(creator_id);
CREATE INDEX idx_chat_rooms_active ON chat_rooms(is_active, last_message_at DESC) WHERE is_active = true;

-- Messages indexes (critical for performance)
CREATE INDEX idx_messages_chat_room_time ON messages(chat_room_id, created_at DESC) WHERE is_deleted = false;
CREATE INDEX idx_messages_sender ON messages(sender_id, created_at DESC);
CREATE INDEX idx_messages_reply ON messages(reply_to_id) WHERE reply_to_id IS NOT NULL;

-- Private chats indexes
CREATE INDEX idx_private_chats_user1_active ON private_chats(user1_id, last_message_at DESC) WHERE is_active = true;
CREATE INDEX idx_private_chats_user2_active ON private_chats(user2_id, last_message_at DESC) WHERE is_active = true;
CREATE INDEX idx_private_chats_users ON private_chats(user1_id, user2_id);

-- Private messages indexes
CREATE INDEX idx_private_messages_chat_time ON private_messages(private_chat_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_private_messages_sender ON private_messages(sender_id, created_at DESC);

-- Read status indexes (critical for unread counts)
CREATE INDEX idx_read_status_user_public ON user_chat_read_status(user_id, chat_room_id, last_read_at) WHERE chat_room_id IS NOT NULL;
CREATE INDEX idx_read_status_user_private ON user_chat_read_status(user_id, private_chat_id, last_read_at) WHERE private_chat_id IS NOT NULL;

-- User blocks indexes
CREATE INDEX idx_user_blocks_blocker ON user_blocks(blocker_id, created_at DESC);
CREATE INDEX idx_user_blocks_blocked ON user_blocks(blocked_id);

-- Message requests indexes
CREATE INDEX idx_message_requests_receiver ON message_requests(receiver_id, status, created_at DESC);
CREATE INDEX idx_message_requests_sender ON message_requests(sender_id, created_at DESC);

-- ============================================================================
-- BASIC PERMISSIONS
-- ============================================================================

-- Grant table permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.chat_rooms TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.private_chats TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.private_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_chat_read_status TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.user_blocks TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.message_requests TO authenticated;

-- Grant sequence permissions
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Grant all permissions to service role
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Success message for basic setup
SELECT 'ProChat tables created successfully! Run database_functions.sql next for functions and policies.' as result;