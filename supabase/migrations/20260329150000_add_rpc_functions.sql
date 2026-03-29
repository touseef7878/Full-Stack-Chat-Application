-- RPC: get unread count for a public chat room
CREATE OR REPLACE FUNCTION get_unread_count(
  p_chat_room_id uuid,
  p_user_id uuid
) RETURNS integer AS $$
BEGIN
  RETURN (
    SELECT COUNT(*) FROM messages m
    WHERE m.chat_room_id = p_chat_room_id
      AND m.sender_id <> p_user_id
      AND m.created_at > COALESCE((
        SELECT last_read_at FROM user_chat_read_status
        WHERE chat_room_id = p_chat_room_id AND user_id = p_user_id
      ), '1970-01-01')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_unread_count(uuid, uuid) TO authenticated;

-- RPC: get unread count for a private chat
CREATE OR REPLACE FUNCTION get_private_unread_count(
  p_private_chat_id uuid,
  p_user_id uuid
) RETURNS integer AS $$
BEGIN
  RETURN (
    SELECT COUNT(*) FROM private_messages m
    WHERE m.private_chat_id = p_private_chat_id
      AND m.sender_id <> p_user_id
      AND m.created_at > COALESCE((
        SELECT last_read_at FROM user_chat_read_status
        WHERE private_chat_id = p_private_chat_id AND user_id = p_user_id
      ), '1970-01-01')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_private_unread_count(uuid, uuid) TO authenticated;
