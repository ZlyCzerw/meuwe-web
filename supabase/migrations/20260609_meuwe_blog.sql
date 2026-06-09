CREATE TABLE public.meuwe_blog (
  id         UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title      TEXT        NOT NULL,
  image      TEXT,
  article    TEXT        NOT NULL,
  name       TEXT,
  date       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  category   TEXT        DEFAULT 'Article',
  lang       TEXT        DEFAULT 'pl'
);

ALTER TABLE public.meuwe_blog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Blog posts are publicly readable"
ON public.meuwe_blog FOR SELECT USING (true);
