-- Document versioning + OCR text + publish permissions

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS ocr_text text,
  ADD COLUMN IF NOT EXISTS current_version integer NOT NULL DEFAULT 1;

ALTER TABLE public.roles
  ADD COLUMN IF NOT EXISTS can_publish boolean NOT NULL DEFAULT true;

CREATE TABLE public.document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  version integer NOT NULL,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL,
  ocr_text text,
  uploaded_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (document_id, version)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_versions TO authenticated;
GRANT ALL ON public.document_versions TO service_role;

ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY document_versions_read ON public.document_versions
  FOR SELECT TO authenticated
  USING (public.can_view_document(document_id));

CREATE POLICY document_versions_insert ON public.document_versions
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.id = document_id AND (d.published_by = auth.uid() OR public.has_min_rank(3))
  ));

CREATE POLICY document_versions_delete ON public.document_versions
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.id = document_id AND (d.published_by = auth.uid() OR public.has_min_rank(3))
  ));

-- Publishers (and rank 3+) may update their documents: title, sector, current version, OCR text
CREATE POLICY documents_update ON public.documents
  FOR UPDATE TO authenticated
  USING (published_by = auth.uid() OR public.has_min_rank(3))
  WITH CHECK (published_by = auth.uid() OR public.has_min_rank(3));

-- Role access matrix: only the Head Office (rank 1-2) may change publishing rights
CREATE POLICY roles_update ON public.roles
  FOR UPDATE TO authenticated
  USING (public.has_min_rank(2))
  WITH CHECK (public.has_min_rank(2));

-- Document role visibility can be edited by the publisher (matrix editor)
CREATE POLICY document_roles_update ON public.document_roles
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.id = document_id AND (d.published_by = auth.uid() OR public.has_min_rank(3))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.id = document_id AND (d.published_by = auth.uid() OR public.has_min_rank(3))
  ));