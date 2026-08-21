CREATE TABLE public.interviews (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_name text NOT NULL,
  date_of_birth date,
  position_role_id integer NOT NULL REFERENCES public.roles(id),
  sector_id uuid REFERENCES public.sectors(id),
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  decided_by uuid,
  decided_at timestamp with time zone,
  CONSTRAINT interviews_status_check CHECK (status IN ('pending','passed','failed'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.interviews TO authenticated;
GRANT ALL ON public.interviews TO service_role;
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY interviews_read ON public.interviews FOR SELECT TO authenticated USING (true);
CREATE POLICY interviews_insert ON public.interviews FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.has_min_rank(22));
CREATE POLICY interviews_update ON public.interviews FOR UPDATE TO authenticated
  USING (public.has_min_rank(22)) WITH CHECK (public.has_min_rank(22));
CREATE POLICY interviews_delete ON public.interviews FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.has_min_rank(6));

CREATE TABLE public.vacation_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id uuid NOT NULL,
  sector_id uuid REFERENCES public.sectors(id),
  start_date date NOT NULL,
  end_date date NOT NULL,
  days integer NOT NULL,
  is_medical boolean NOT NULL DEFAULT false,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  decision_note text,
  decided_by uuid,
  decided_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT vacation_status_check CHECK (status IN ('pending','approved','denied')),
  CONSTRAINT vacation_days_check CHECK (days > 0 AND days <= 365),
  CONSTRAINT vacation_dates_check CHECK (end_date >= start_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vacation_requests TO authenticated;
GRANT ALL ON public.vacation_requests TO service_role;
ALTER TABLE public.vacation_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY vacation_read ON public.vacation_requests FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR public.has_min_rank(22));
CREATE POLICY vacation_insert ON public.vacation_requests FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid() AND status = 'pending');
CREATE POLICY vacation_decide ON public.vacation_requests FOR UPDATE TO authenticated
  USING (
    (days > 20 AND public.has_min_rank(9))
    OR (days <= 20 AND public.has_min_rank(22))
  )
  WITH CHECK (
    (days > 20 AND public.has_min_rank(9))
    OR (days <= 20 AND public.has_min_rank(22))
  );
CREATE POLICY vacation_delete ON public.vacation_requests FOR DELETE TO authenticated
  USING ((requester_id = auth.uid() AND status = 'pending') OR public.has_min_rank(6));