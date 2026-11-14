-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL UNIQUE CHECK (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text NOT NULL DEFAULT '' CHECK (char_length(display_name) <= 60),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  base text;
  candidate text;
  dname text;
BEGIN
  base := lower(coalesce(NEW.raw_user_meta_data->>'username', split_part(coalesce(NEW.email, 'friend'), '@', 1)));
  base := regexp_replace(base, '[^a-z0-9_]', '', 'g');
  IF char_length(base) < 3 THEN base := base || 'friend'; END IF;
  base := left(base, 18);
  candidate := base;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate) LOOP
    candidate := base || '_' || substr(md5(random()::text), 1, 4);
  END LOOP;
  dname := left(coalesce(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', candidate), 60);
  INSERT INTO public.profiles (id, username, display_name) VALUES (NEW.id, candidate, dname);
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- CONVERSATIONS
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_group boolean NOT NULL DEFAULT false,
  name text CHECK (name IS NULL OR char_length(name) <= 60),
  dm_key text UNIQUE,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now(),
  last_message_preview text
);
GRANT SELECT, UPDATE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.conversation_members (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);
GRANT SELECT, UPDATE ON public.conversation_members TO authenticated;
GRANT ALL ON public.conversation_members TO service_role;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_member(_conversation_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.conversation_members WHERE conversation_id = _conversation_id AND user_id = _user_id)
$$;

CREATE POLICY "Members view conversations" ON public.conversations FOR SELECT TO authenticated USING (public.is_member(id, auth.uid()));
CREATE POLICY "Members rename group" ON public.conversations FOR UPDATE TO authenticated USING (is_group AND public.is_member(id, auth.uid())) WITH CHECK (is_group AND public.is_member(id, auth.uid()));
CREATE POLICY "Members view co-members" ON public.conversation_members FOR SELECT TO authenticated USING (public.is_member(conversation_id, auth.uid()));
CREATE POLICY "Members update own read state" ON public.conversation_members FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- MESSAGES
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text CHECK (body IS NULL OR char_length(body) <= 4000),
  image_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (coalesce(nullif(btrim(body), ''), image_path) IS NOT NULL)
);
CREATE INDEX messages_conversation_created_idx ON public.messages (conversation_id, created_at DESC);
GRANT SELECT, INSERT, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read messages" ON public.messages FOR SELECT TO authenticated USING (public.is_member(conversation_id, auth.uid()));
CREATE POLICY "Members send messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid() AND public.is_member(conversation_id, auth.uid()));
CREATE POLICY "Senders delete own messages" ON public.messages FOR DELETE TO authenticated USING (sender_id = auth.uid());

CREATE OR REPLACE FUNCTION public.bump_conversation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.conversations
     SET last_message_at = NEW.created_at,
         last_message_preview = CASE WHEN nullif(btrim(NEW.body), '') IS NOT NULL THEN left(NEW.body, 120) ELSE '📷 Photo' END
   WHERE id = NEW.conversation_id;
  UPDATE public.conversation_members SET last_read_at = NEW.created_at
   WHERE conversation_id = NEW.conversation_id AND user_id = NEW.sender_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER messages_bump AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.bump_conversation();

-- RPCs
CREATE OR REPLACE FUNCTION public.get_or_create_dm(_other uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid();
  key text;
  conv uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF _other IS NULL OR _other = me THEN RAISE EXCEPTION 'Pick someone else to chat with'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _other) THEN RAISE EXCEPTION 'User not found'; END IF;
  key := least(me::text, _other::text) || ':' || greatest(me::text, _other::text);
  SELECT id INTO conv FROM public.conversations WHERE dm_key = key;
  IF conv IS NULL THEN
    INSERT INTO public.conversations (is_group, dm_key, created_by, last_message_preview)
    VALUES (false, key, me, NULL) RETURNING id INTO conv;
    INSERT INTO public.conversation_members (conversation_id, user_id) VALUES (conv, me), (conv, _other);
  END IF;
  RETURN conv;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_group(_name text, _members uuid[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid();
  conv uuid;
  clean_name text := nullif(left(btrim(coalesce(_name, '')), 60), '');
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF clean_name IS NULL THEN RAISE EXCEPTION 'Give your group a name'; END IF;
  IF coalesce(array_length(_members, 1), 0) < 1 THEN RAISE EXCEPTION 'Add at least one friend'; END IF;
  INSERT INTO public.conversations (is_group, name, created_by) VALUES (true, clean_name, me) RETURNING id INTO conv;
  INSERT INTO public.conversation_members (conversation_id, user_id) VALUES (conv, me);
  INSERT INTO public.conversation_members (conversation_id, user_id)
    SELECT conv, p.id FROM public.profiles p WHERE p.id = ANY(_members) AND p.id <> me
    ON CONFLICT DO NOTHING;
  RETURN conv;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_group_members(_conversation uuid, _members uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_member(_conversation, auth.uid()) THEN RAISE EXCEPTION 'Not a member'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.conversations WHERE id = _conversation AND is_group) THEN RAISE EXCEPTION 'Not a group'; END IF;
  INSERT INTO public.conversation_members (conversation_id, user_id)
    SELECT _conversation, p.id FROM public.profiles p WHERE p.id = ANY(_members)
    ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_conversation(_conversation uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.conversations WHERE id = _conversation AND is_group) THEN RAISE EXCEPTION 'You can only leave groups'; END IF;
  DELETE FROM public.conversation_members WHERE conversation_id = _conversation AND user_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.list_my_conversations()
RETURNS TABLE (
  id uuid, is_group boolean, name text, last_message_at timestamptz, last_message_preview text,
  unread_count bigint, members jsonb
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.is_group, c.name, c.last_message_at, c.last_message_preview,
    (SELECT count(*) FROM public.messages m WHERE m.conversation_id = c.id AND m.created_at > me.last_read_at AND m.sender_id <> auth.uid()) AS unread_count,
    (SELECT coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'username', p.username, 'display_name', p.display_name) ORDER BY p.display_name), '[]'::jsonb)
       FROM public.conversation_members cm JOIN public.profiles p ON p.id = cm.user_id
      WHERE cm.conversation_id = c.id) AS members
  FROM public.conversations c
  JOIN public.conversation_members me ON me.conversation_id = c.id AND me.user_id = auth.uid()
  ORDER BY c.last_message_at DESC
$$;

REVOKE EXECUTE ON FUNCTION public.get_or_create_dm(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.create_group(text, uuid[]) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.add_group_members(uuid, uuid[]) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.leave_conversation(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.list_my_conversations() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_or_create_dm(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_group(text, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_group_members(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_conversation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_conversations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_member(uuid, uuid) TO authenticated;

-- REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;