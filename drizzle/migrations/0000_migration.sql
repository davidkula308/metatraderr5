CREATE TABLE public.terminal (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  state jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.terminal TO service_role;
ALTER TABLE public.terminal ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.terminal_log (
  id bigserial PRIMARY KEY,
  kind text NOT NULL,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.terminal_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.terminal_log_id_seq TO service_role;
ALTER TABLE public.terminal_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX terminal_log_kind_id_idx ON public.terminal_log (kind, id);

-- Atomically save the shared terminal state (optimistic version check) and append its new log rows.
CREATE OR REPLACE FUNCTION public.terminal_commit(p_expected integer, p_state jsonb, p_logs jsonb, p_reset boolean)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v integer;
BEGIN
  IF p_expected = 0 THEN
    INSERT INTO public.terminal (id, state, version) VALUES (1, p_state, 1) ON CONFLICT (id) DO NOTHING;
    IF NOT FOUND THEN
      RETURN -1;
    END IF;
    v := 1;
  ELSE
    UPDATE public.terminal
      SET state = p_state, version = version + 1, updated_at = now()
      WHERE id = 1 AND version = p_expected
      RETURNING version INTO v;
    IF v IS NULL THEN
      RETURN -1;
    END IF;
  END IF;
  IF p_reset THEN
    DELETE FROM public.terminal_log;
  END IF;
  INSERT INTO public.terminal_log (kind, data)
    SELECT e->>'kind', e->'data' FROM jsonb_array_elements(p_logs) WITH ORDINALITY AS t(e, n) ORDER BY n;
  RETURN v;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.terminal_commit(integer, jsonb, jsonb, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.terminal_commit(integer, jsonb, jsonb, boolean) TO service_role;