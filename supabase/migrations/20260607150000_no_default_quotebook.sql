-- New users get a profile only; they create quotebooks from the app.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    chosen_username TEXT;
BEGIN
    chosen_username := COALESCE(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'username'), ''),
        split_part(NEW.email, '@', 1)
    );

    INSERT INTO public.profiles (id, username)
    VALUES (NEW.id, chosen_username);

    RETURN NEW;
END;
$$;
