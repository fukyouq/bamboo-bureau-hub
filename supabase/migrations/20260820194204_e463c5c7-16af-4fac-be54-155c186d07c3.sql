CREATE TABLE public.roles (
  id integer PRIMARY KEY,
  name text NOT NULL UNIQUE,
  rank integer NOT NULL,
  category text NOT NULL CHECK (category IN ('organisation','sector'))
);
GRANT SELECT ON public.roles TO authenticated;
GRANT ALL ON public.roles TO service_role;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles_read" ON public.roles FOR SELECT TO authenticated USING (true);

INSERT INTO public.roles (id, name, rank, category) VALUES
 (1,'Head of Bamboo Company',1,'organisation'),
 (2,'Vice Head of Bamboo Company',2,'organisation'),
 (3,'Assistant of the Head Office',3,'organisation'),
 (4,'Head Director of Operations and Logistics',4,'organisation'),
 (5,'Vice Director of Operations and Logistics',5,'organisation'),
 (6,'Assistant of Director''s Office',6,'organisation'),
 (7,'Head of Sector',7,'organisation'),
 (8,'Vice Head of Sector',8,'organisation'),
 (9,'Assistant of Sector''s Office',9,'organisation'),
 (10,'Head of Assistance',10,'organisation'),
 (11,'Vice Head of Assistance',11,'organisation'),
 (12,'Head Director of Supervisors',12,'organisation'),
 (13,'Assistant Director of Supervisors',13,'organisation'),
 (14,'Chief Supervisor of all Sectors',14,'organisation'),
 (15,'Senior Supervisor of all Sectors',15,'organisation'),
 (16,'Supervisor of all Sectors',16,'organisation'),
 (17,'Junior Supervisor of all Sectors',17,'organisation'),
 (18,'Trainee Supervisor',18,'organisation'),
 (19,'Representative Assistant of Director''s Office',19,'sector'),
 (20,'Director of Sector',20,'sector'),
 (21,'Assistant Director of Sector',21,'sector'),
 (22,'Manager',22,'sector'),
 (23,'Assistant Manager',23,'sector'),
 (24,'Head Supervisor',24,'sector'),
 (25,'Supervisor',25,'sector'),
 (26,'Senior Employee',26,'sector'),
 (27,'Employee',27,'sector'),
 (28,'Trainee',28,'sector');

CREATE TABLE public.sectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sectors TO authenticated;
GRANT ALL ON public.sectors TO service_role;
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  date_of_birth date,
  nationality text,
  country_of_birth text,
  race text,
  role_id integer NOT NULL REFERENCES public.roles(id),
  sector_id uuid REFERENCES public.sectors(id) ON DELETE SET NULL,
  must_change_password boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_rank()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.rank FROM public.profiles p JOIN public.roles r ON r.id = p.role_id
  WHERE p.id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.has_min_rank(_rank integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_rank() <= _rank, false)
$$;

CREATE POLICY "sectors_read" ON public.sectors FOR SELECT TO authenticated USING (true);
CREATE POLICY "sectors_write" ON public.sectors FOR ALL TO authenticated
  USING (public.has_min_rank(3)) WITH CHECK (public.has_min_rank(3));

CREATE POLICY "profiles_read" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_admin_write" ON public.profiles FOR ALL TO authenticated
  USING (public.has_min_rank(6)) WITH CHECK (public.has_min_rank(6));

CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL,
  sector_id uuid REFERENCES public.sectors(id) ON DELETE SET NULL,
  published_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  publisher_rank integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.document_roles (
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  role_id integer NOT NULL REFERENCES public.roles(id),
  PRIMARY KEY (document_id, role_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_roles TO authenticated;
GRANT ALL ON public.document_roles TO service_role;
ALTER TABLE public.document_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_view_document(_document_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.id = _document_id
      AND (
        d.published_by = auth.uid()
        OR COALESCE(public.current_rank() <= d.publisher_rank, false)
        OR EXISTS (
          SELECT 1 FROM public.document_roles dr
          JOIN public.profiles p ON p.id = auth.uid()
          WHERE dr.document_id = d.id AND dr.role_id = p.role_id
        )
      )
  )
$$;

CREATE POLICY "documents_read" ON public.documents FOR SELECT TO authenticated
  USING (
    published_by = auth.uid()
    OR COALESCE(public.current_rank() <= publisher_rank, false)
    OR EXISTS (
      SELECT 1 FROM public.document_roles dr
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE dr.document_id = documents.id AND dr.role_id = p.role_id
    )
  );
CREATE POLICY "documents_insert" ON public.documents FOR INSERT TO authenticated
  WITH CHECK (published_by = auth.uid());
CREATE POLICY "documents_delete" ON public.documents FOR DELETE TO authenticated
  USING (published_by = auth.uid() OR public.has_min_rank(3));

CREATE POLICY "document_roles_read" ON public.document_roles FOR SELECT TO authenticated
  USING (public.can_view_document(document_id));
CREATE POLICY "document_roles_insert" ON public.document_roles FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_id AND d.published_by = auth.uid()));
CREATE POLICY "document_roles_delete" ON public.document_roles FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_id AND d.published_by = auth.uid()));