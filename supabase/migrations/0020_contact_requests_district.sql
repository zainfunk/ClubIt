-- 0020: Capture the school district on marketing sales inquiries. Added after
-- 0019 shipped, so it's a separate additive column (nullable).

alter table contact_requests add column if not exists district text;
