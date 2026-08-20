REVOKE ALL ON FUNCTION public.current_rank() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_min_rank(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_view_document(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_rank() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_min_rank(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_document(uuid) TO authenticated, service_role;