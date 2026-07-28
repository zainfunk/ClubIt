-- 0019: Sales inquiries from the public marketing site.
-- The "Contact us" form on /contact writes here so a prospective school can
-- reach out to buy ClubIt (billed per student, so there's no self-serve
-- checkout). The form is fully public/unauthenticated, so writes go through
-- the service-role client in /api/contact after zod validation and per-IP
-- rate limiting. RLS denies all direct client access.

create table if not exists contact_requests (
  id            text primary key,
  created_at    text not null,
  name          text not null,
  email         text not null,
  school_name   text not null,
  role          text,
  student_count integer,
  message       text,
  status        text not null default 'new'
);

create index if not exists contact_requests_created_idx on contact_requests (created_at);

alter table contact_requests enable row level security;
-- All access is via the service-role client in /api/contact.
create policy "deny_direct" on contact_requests for all using (false);
