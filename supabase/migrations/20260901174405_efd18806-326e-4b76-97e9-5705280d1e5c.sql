REVOKE ALL ON FUNCTION public.is_list_member(uuid, uuid) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.join_list_by_code(text) FROM anon, public;
REVOKE ALL ON FUNCTION public.add_list_owner_as_member() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.join_list_by_code(text) TO authenticated;