-- PART 1: TEAR DOWN SCRIPT
-- Drop existing tables. The CASCADE option handles dependent objects.
DROP TABLE IF EXISTS public.user_chat_read_status CASCADE;
DROP TABLE IF EXISTS public.private_messages CASCADE;
DROP TABLE IF EXISTS public.private_chats CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.chat_rooms CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Drop the trigger and function for handling new users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- PART 2: SETUP SCRIPT
-- Grant usage on the public schema to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


-- Create a table for public profiles
CREATE TABLE profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
  username TEXT UNIQUE,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  updated_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT username_length CHECK (char_length(username) >= 3)
);

-- Grant permissions for profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


CREATE POLICY "Public profiles are viewable by everyone."
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own profile."
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile."
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create a table for chat rooms
CREATE TABLE chat_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  name TEXT NOT NULL,
  creator_id uuid REFERENCES profiles(id) ON DELETE CASCADE
);

-- Grant permissions for chat_rooms table
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.chat_rooms TO authenticated;
GRANT ALL ON TABLE public.chat_rooms TO service_role;


-- Add index on creator_id for faster queries
CREATE INDEX idx_chat_rooms_creator_id ON chat_rooms(creator_id);

CREATE POLICY "Chat rooms are viewable by everyone."
  ON chat_rooms FOR SELECT
  USING (true);

CREATE POLICY "Users can create chat rooms."
  ON chat_rooms FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Users can update their own chat rooms."
  ON chat_rooms FOR UPDATE
  USING (auth.uid() = creator_id);

CREATE POLICY "Users can delete their own chat rooms."
  ON chat_rooms FOR DELETE
  USING (auth.uid() = creator_id);

-- Create a table for messages in public chat rooms
CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  chat_room_id uuid REFERENCES chat_rooms(id) ON DELETE CASCADE NOT NULL,
  sender_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL
);

-- Grant permissions for messages table
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.messages TO authenticated;
GRANT ALL ON TABLE public.messages TO service_role;


-- Add indexes for faster queries on messages
CREATE INDEX idx_messages_chat_room_id ON messages(chat_room_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);

CREATE POLICY "Messages are viewable by everyone in the chat room."
  ON messages FOR SELECT
  USING (true);

CREATE POLICY "Users can insert messages."
  ON messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- Create a table for private chats
CREATE TABLE private_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  user1_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  user2_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  CONSTRAINT unique_private_chat UNIQUE (user1_id, user2_id)
);

-- Grant permissions for private_chats table
ALTER TABLE private_chats ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.private_chats TO authenticated;
GRANT ALL ON TABLE public.private_chats TO service_role;


-- Add indexes for faster queries on private_chats
CREATE INDEX idx_private_chats_user1_id ON private_chats(user1_id);
CREATE INDEX idx_private_chats_user2_id ON private_chats(user2_id);

CREATE POLICY "Users can view private chats they are part of."
  ON private_chats FOR SELECT
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "Users can create private chats."
  ON private_chats FOR INSERT
  WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "Users can delete private chats they are part of."
    ON private_chats FOR DELETE
    USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Create a table for messages in private chats
CREATE TABLE private_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  private_chat_id uuid REFERENCES private_chats(id) ON DELETE CASCADE NOT NULL,
  sender_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL
);

-- Grant permissions for private_messages table
ALTER TABLE private_messages ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.private_messages TO authenticated;
GRANT ALL ON TABLE public.private_messages TO service_role;


-- Add indexes for faster queries on private_messages
CREATE INDEX idx_private_messages_private_chat_id ON private_messages(private_chat_id);
CREATE INDEX idx_private_messages_sender_id ON private_messages(sender_id);

CREATE POLICY "Users can view messages in private chats they are part of."
  ON private_messages FOR SELECT
  USING (
    private_chat_id IN (
      SELECT id FROM private_chats WHERE user1_id = auth.uid() OR user2_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages in private chats they are part of."
  ON private_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    private_chat_id IN (
      SELECT id FROM private_chats WHERE user1_id = auth.uid() OR user2_id = auth.uid()
    )
  );

-- Create a table to track user's read status for chats
CREATE TABLE user_chat_read_status (
    id BIGSERIAL PRIMARY KEY,
    user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    chat_room_id uuid REFERENCES chat_rooms(id) ON DELETE CASCADE,
    private_chat_id uuid REFERENCES private_chats(id) ON DELETE CASCADE,
    last_read_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT unique_read_status UNIQUE (user_id, chat_room_id),
    CONSTRAINT unique_private_read_status UNIQUE (user_id, private_chat_id)
);

-- Grant permissions for user_chat_read_status table
ALTER TABLE user_chat_read_status ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_chat_read_status TO authenticated;
GRANT ALL ON TABLE public.user_chat_read_status TO service_role;


-- Add indexes for faster queries on user_chat_read_status
CREATE INDEX idx_user_chat_read_status_user_id ON user_chat_read_status(user_id);
CREATE INDEX idx_user_chat_read_status_chat_room_id ON user_chat_read_status(chat_room_id);
CREATE INDEX idx_user_chat_read_status_private_chat_id ON user_chat_read_status(private_chat_id);

CREATE POLICY "Users can manage their own read status."
    ON user_chat_read_status
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Create a function to automatically create a profile for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- Trigger the function on new user sign-ups
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
