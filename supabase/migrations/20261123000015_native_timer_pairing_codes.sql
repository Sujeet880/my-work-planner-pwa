-- ==============================================================================
-- My Work Planner — Milestone 9: Native Mini Timer Pairing & Session Handshake
-- Migration: 20261123000015_native_timer_pairing_codes.sql
-- Description:
--   Single-use, short-lived (90-second) pairing authorizations linking the
--   authenticated browser user session to the macOS Native Mini Focus Timer.
--   Enforces cryptographic hash storage, atomic single-use redemption,
--   and automatic expiration to prevent replay and token leakage.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.native_timer_pairing_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL UNIQUE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    redeemed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Enable Row Level Security
ALTER TABLE public.native_timer_pairing_codes ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view/insert only their own pairing codes
CREATE POLICY "Users can create their own pairing codes"
    ON public.native_timer_pairing_codes
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own pairing codes"
    ON public.native_timer_pairing_codes
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Privileged service_role policy for Edge Functions to exchange & redeem pairing codes
CREATE POLICY "Service role full access on native_timer_pairing_codes"
    ON public.native_timer_pairing_codes
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Index for sub-millisecond atomic lookups by code_hash
CREATE INDEX IF NOT EXISTS idx_native_timer_pairing_lookup
    ON public.native_timer_pairing_codes (code_hash, redeemed_at, expires_at);

-- Optional periodic cleanup function for expired unredeemed codes (> 1 hour old)
CREATE OR REPLACE FUNCTION public.cleanup_expired_pairing_codes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM public.native_timer_pairing_codes
    WHERE expires_at < (now() - interval '1 hour');
END;
$$;
