-- Add multi-photo support to inventory rows.

alter table public.inventory
  add column if not exists image_urls text[] default array[]::text[];
