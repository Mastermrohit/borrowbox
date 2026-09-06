-- =============================================================================
-- BorrowBox — Return Flow Migration
-- Run this in the Supabase SQL Editor.
-- =============================================================================

-- 1. Extend borrow_requests.status to include new lifecycle values
ALTER TABLE borrow_requests
  DROP CONSTRAINT borrow_requests_status_check;

ALTER TABLE borrow_requests
  ADD CONSTRAINT borrow_requests_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'borrowed', 'return_requested', 'returned'));

-- 2. Add returned_at timestamp (nullable — only set when owner confirms return)
ALTER TABLE borrow_requests
  ADD COLUMN IF NOT EXISTS returned_at timestamptz;
