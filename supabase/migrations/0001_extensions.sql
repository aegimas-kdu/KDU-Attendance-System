-- =========================================================
-- KDU GLOBAL ATTENDANCE SYSTEM - 0001
-- EXTENSIONS AND SHARED UTILITIES
-- =========================================================
-- Run this file first. Everything else depends on it.

-- pgcrypto gives us crypt(), gen_salt() and gen_random_bytes(),
-- which we use to hash attendance codes instead of storing them
-- as readable four-digit values.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;


-- ---------------------------------------------------------
-- safe_uuid()
-- Casts text to UUID and returns NULL instead of raising an
-- error when the text is not a UUID. Storage policies use it
-- because object paths are free text.
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.safe_uuid(p_text TEXT)
RETURNS UUID
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
    RETURN p_text::UUID;
EXCEPTION
    WHEN invalid_text_representation THEN
        RETURN NULL;
END;
$$;


-- ---------------------------------------------------------
-- set_updated_at()
-- Generic BEFORE UPDATE trigger that keeps updated_at honest.
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;
