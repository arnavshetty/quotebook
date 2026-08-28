-- Fire new-quote notifications when a quote block is created, not when utterances
-- are inserted. update_quote_entry deletes and re-inserts utterances on edit, which
-- previously caused false "new quote" notifications for blocks that never had one.

DROP TRIGGER IF EXISTS create_new_quote_notifications_on_utterance ON public.utterances;

CREATE OR REPLACE FUNCTION public.trigger_create_new_quote_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM public.create_new_quote_notifications(NEW.id);
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.trigger_create_new_quote_notifications()
  FROM PUBLIC, anon, authenticated;

CREATE CONSTRAINT TRIGGER create_new_quote_notifications_on_block
    AFTER INSERT ON public.quote_blocks
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_create_new_quote_notifications();
