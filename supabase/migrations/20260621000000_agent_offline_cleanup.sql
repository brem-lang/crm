-- When the last online agent goes offline, reset all waiting chat sessions
-- back to 'bot' status and clear them from the queue so visitors aren't stuck.

CREATE OR REPLACE FUNCTION handle_agent_offline()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only fires when an agent transitions from online → offline
  IF OLD.is_online = TRUE AND NEW.is_online = FALSE THEN
    -- Only clean up if no other agents are still online
    IF NOT EXISTS (
      SELECT 1 FROM chat_agents
      WHERE is_online = TRUE AND id != NEW.id
    ) THEN
      -- Atomically reset waiting sessions to bot and remove from queue
      WITH reset_sessions AS (
        UPDATE chat_sessions
        SET status = 'bot'
        WHERE status = 'waiting'
        RETURNING id
      )
      DELETE FROM chat_queue
      WHERE session_id IN (SELECT id FROM reset_sessions);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_agent_offline
  AFTER UPDATE OF is_online ON chat_agents
  FOR EACH ROW
  EXECUTE FUNCTION handle_agent_offline();
