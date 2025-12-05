-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.competitions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  country text,
  CONSTRAINT competitions_pkey PRIMARY KEY (id)
);
CREATE TABLE public.matches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  home_team_id uuid NOT NULL,
  away_team_id uuid NOT NULL,
  competition_id uuid,
  start_time timestamp with time zone NOT NULL,
  status text NOT NULL,
  home_score integer NOT NULL DEFAULT 0,
  away_score integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  round text,
  CONSTRAINT matches_pkey PRIMARY KEY (id),
  CONSTRAINT matches_home_team_id_fkey FOREIGN KEY (home_team_id) REFERENCES public.teams(id),
  CONSTRAINT matches_away_team_id_fkey FOREIGN KEY (away_team_id) REFERENCES public.teams(id),
  CONSTRAINT matches_competition_id_fkey FOREIGN KEY (competition_id) REFERENCES public.competitions(id)
);
CREATE TABLE public.teams (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  short_name text,
  logo_url text,
  CONSTRAINT teams_pkey PRIMARY KEY (id)
);
CREATE TABLE public.test_ping (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  message text,
  CONSTRAINT test_ping_pkey PRIMARY KEY (id)
);
CREATE TABLE public.user_profiles (
  id uuid NOT NULL,
  display_name text,
  role USER-DEFINED NOT NULL DEFAULT 'viewer'::user_role,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  team_id uuid,
  CONSTRAINT user_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT user_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id),
  CONSTRAINT user_profiles_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id)
);
