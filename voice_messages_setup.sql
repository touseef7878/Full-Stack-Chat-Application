-- ============================================================================
-- VOICE MESSAGES SETUP
-- Run this in Supabase SQL Editor
-- ============================================================================

-- 1. Update message_type CHECK constraint to allow 'voice' in public messages
ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_message_type_check;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_message_type_check
  CHECK (message_type IN ('text', 'image', 'file', 'system', 'voice'));

-- 2. Update message_type CHECK constraint in private_messages
ALTER TABLE public.private_messages
  DROP CONSTRAINT IF EXISTS private_messages_message_type_check;

ALTER TABLE public.private_messages
  ADD CONSTRAINT private_messages_message_type_check
  CHECK (message_type IN ('text', 'image', 'file', 'system', 'voice'));

-- 3. Relax content_length constraint for voice messages (URL + JSON can be longer)
ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS content_length;

ALTER TABLE public.messages
  ADD CONSTRAINT content_length
  CHECK (char_length(content) >= 1 AND char_length(content) <= 8000);

ALTER TABLE public.private_messages
  DROP CONSTRAINT IF EXISTS content_length;

ALTER TABLE public.private_messages
  ADD CONSTRAINT content_length
  CHECK (char_length(content) >= 1 AND char_length(content) <= 8000);

-- 4. Create the voice-messages storage bucket (public read)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'voice-messages',
  'voice-messages',
  true,
  10485760, -- 10MB max per file
  ARRAY['audio/webm', 'audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg', 'audio/mpeg']
)
ON CONFLICT (id) DO NOTHING;

-- 5. Storage RLS: authenticated users can upload to their own folder
CREATE POLICY "Users can upload own voice messages"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'voice-messages'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 6. Storage RLS: anyone can read voice messages (public bucket)
CREATE POLICY "Voice messages are publicly readable"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'voice-messages');

-- 7. Storage RLS: users can delete their own voice messages
CREATE POLICY "Users can delete own voice messages"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'voice-messages'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

SELECT 'Voice messages setup complete!' as result;
