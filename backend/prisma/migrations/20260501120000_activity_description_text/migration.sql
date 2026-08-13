-- Allow longer activity descriptions without truncation errors in production.
ALTER TABLE `Activity`
  MODIFY `description` TEXT NOT NULL;
