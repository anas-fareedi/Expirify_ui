-- profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- lists
CREATE TABLE public.lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  join_code text NOT NULL UNIQUE DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lists TO authenticated;
GRANT ALL ON public.lists TO service_role;
ALTER TABLE public.lists ENABLE ROW LEVEL SECURITY;

-- membership
CREATE TYPE public.list_role AS ENUM ('owner', 'member');

CREATE TABLE public.list_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role public.list_role NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (list_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.list_members TO authenticated;
GRANT ALL ON public.list_members TO service_role;
ALTER TABLE public.list_members ENABLE ROW LEVEL SECURITY;

-- items
CREATE TABLE public.items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name text NOT NULL,
  barcode text,
  category text,
  purchase_date date NOT NULL DEFAULT current_date,
  expiry_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX items_list_expiry_idx ON public.items (list_id, expiry_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.items TO authenticated;
GRANT ALL ON public.items TO service_role;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

-- helper: membership check without recursive RLS
CREATE OR REPLACE FUNCTION public.is_list_member(_list_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.list_members
    WHERE list_id = _list_id AND user_id = _user_id
  );
$$;

-- policies: profiles
CREATE POLICY "Users manage own profile" ON public.profiles
  FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Members see profiles of shared lists" ON public.profiles
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.list_members lm
      WHERE lm.user_id = profiles.id
        AND public.is_list_member(lm.list_id, auth.uid())
    )
  );

-- policies: lists
CREATE POLICY "Members view their lists" ON public.lists
  FOR SELECT TO authenticated USING (public.is_list_member(id, auth.uid()));

CREATE POLICY "Users create lists they own" ON public.lists
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners update their lists" ON public.lists
  FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners delete their lists" ON public.lists
  FOR DELETE TO authenticated USING (auth.uid() = owner_id);

-- policies: list_members
CREATE POLICY "Members view membership of their lists" ON public.list_members
  FOR SELECT TO authenticated USING (public.is_list_member(list_id, auth.uid()));

CREATE POLICY "Users add themselves or owners add members" ON public.list_members
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.lists l WHERE l.id = list_id AND l.owner_id = auth.uid())
  );

CREATE POLICY "Users leave lists or owners remove members" ON public.list_members
  FOR DELETE TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.lists l WHERE l.id = list_id AND l.owner_id = auth.uid())
  );

-- policies: items
CREATE POLICY "Members view list items" ON public.items
  FOR SELECT TO authenticated USING (public.is_list_member(list_id, auth.uid()));

CREATE POLICY "Members add items" ON public.items
  FOR INSERT TO authenticated WITH CHECK (
    public.is_list_member(list_id, auth.uid()) AND auth.uid() = created_by
  );

CREATE POLICY "Members update list items" ON public.items
  FOR UPDATE TO authenticated USING (public.is_list_member(list_id, auth.uid()))
  WITH CHECK (public.is_list_member(list_id, auth.uid()));

CREATE POLICY "Members delete list items" ON public.items
  FOR DELETE TO authenticated USING (public.is_list_member(list_id, auth.uid()));

-- join by code
CREATE OR REPLACE FUNCTION public.join_list_by_code(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _list_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id INTO _list_id FROM public.lists WHERE join_code = upper(trim(_code));
  IF _list_id IS NULL THEN
    RAISE EXCEPTION 'Invalid join code';
  END IF;

  INSERT INTO public.list_members (list_id, user_id, role)
  VALUES (_list_id, auth.uid(), 'member')
  ON CONFLICT (list_id, user_id) DO NOTHING;

  RETURN _list_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_list_by_code(text) TO authenticated;

-- timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_lists_updated_at BEFORE UPDATE ON public.lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- owner becomes a member automatically
CREATE OR REPLACE FUNCTION public.add_list_owner_as_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.list_members (list_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (list_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER lists_add_owner_member AFTER INSERT ON public.lists
  FOR EACH ROW EXECUTE FUNCTION public.add_list_owner_as_member();

-- profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(COALESCE(NEW.email, ''), '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER PUBLICATION supabase_realtime ADD TABLE public.items;