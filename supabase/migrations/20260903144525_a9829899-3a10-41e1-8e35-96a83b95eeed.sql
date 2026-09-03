ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid,
  ADD COLUMN IF NOT EXISTS updated_by uuid;

CREATE INDEX IF NOT EXISTS items_list_active_idx ON public.items (list_id, deleted_at);

CREATE TABLE IF NOT EXISTS public.item_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL,
  list_id uuid NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  actor_id uuid,
  action text NOT NULL,
  item_name text,
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.item_events TO authenticated;
GRANT ALL ON public.item_events TO service_role;

ALTER TABLE public.item_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view list item history"
ON public.item_events FOR SELECT TO authenticated
USING (public.is_list_member(list_id, auth.uid()));

CREATE INDEX IF NOT EXISTS item_events_list_created_idx ON public.item_events (list_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.log_item_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _action text;
  _changes jsonb := '{}'::jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _action := 'created';
    INSERT INTO public.item_events (item_id, list_id, actor_id, action, item_name, changes)
    VALUES (NEW.id, NEW.list_id, COALESCE(auth.uid(), NEW.created_by), _action, NEW.name, _changes);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.item_events (item_id, list_id, actor_id, action, item_name, changes)
    VALUES (OLD.id, OLD.list_id, auth.uid(), 'purged', OLD.name, _changes);
    RETURN OLD;
  END IF;

  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    _action := 'deleted';
  ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
    _action := 'restored';
  ELSE
    _action := 'updated';
    IF NEW.name IS DISTINCT FROM OLD.name THEN
      _changes := _changes || jsonb_build_object('name', jsonb_build_array(OLD.name, NEW.name));
    END IF;
    IF NEW.barcode IS DISTINCT FROM OLD.barcode THEN
      _changes := _changes || jsonb_build_object('barcode', jsonb_build_array(OLD.barcode, NEW.barcode));
    END IF;
    IF NEW.category IS DISTINCT FROM OLD.category THEN
      _changes := _changes || jsonb_build_object('category', jsonb_build_array(OLD.category, NEW.category));
    END IF;
    IF NEW.purchase_date IS DISTINCT FROM OLD.purchase_date THEN
      _changes := _changes || jsonb_build_object('purchase_date', jsonb_build_array(OLD.purchase_date, NEW.purchase_date));
    END IF;
    IF NEW.expiry_date IS DISTINCT FROM OLD.expiry_date THEN
      _changes := _changes || jsonb_build_object('expiry_date', jsonb_build_array(OLD.expiry_date, NEW.expiry_date));
    END IF;
    IF _changes = '{}'::jsonb THEN
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO public.item_events (item_id, list_id, actor_id, action, item_name, changes)
  VALUES (NEW.id, NEW.list_id, auth.uid(), _action, NEW.name, _changes);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS items_audit_insert ON public.items;
CREATE TRIGGER items_audit_insert AFTER INSERT ON public.items
FOR EACH ROW EXECUTE FUNCTION public.log_item_event();

DROP TRIGGER IF EXISTS items_audit_update ON public.items;
CREATE TRIGGER items_audit_update AFTER UPDATE ON public.items
FOR EACH ROW EXECUTE FUNCTION public.log_item_event();

DROP TRIGGER IF EXISTS items_audit_delete ON public.items;
CREATE TRIGGER items_audit_delete AFTER DELETE ON public.items
FOR EACH ROW EXECUTE FUNCTION public.log_item_event();