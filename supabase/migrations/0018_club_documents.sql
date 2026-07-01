-- 0018: Documents advisors share with a club (permission slips, forms, etc.).
-- Advisors/admins upload; anyone who can see the club can download. Files live
-- in a private storage bucket and are served through short-lived signed URLs.

create table if not exists club_documents (
  id           text primary key,
  club_id      text not null references clubs(id) on delete cascade,
  uploaded_by  text not null references users(id) on delete cascade,
  name         text not null,
  storage_path text not null,
  content_type text not null,
  size_bytes   bigint not null,
  created_at   text not null
);

create index if not exists club_documents_club_idx on club_documents (club_id);

alter table club_documents enable row level security;
-- All API routes use the service-role client which bypasses RLS.
create policy "deny_direct" on club_documents for all using (false);

-- Private bucket; downloads go through signed URLs minted server-side.
insert into storage.buckets (id, name, public)
values ('club-documents', 'club-documents', false)
on conflict (id) do nothing;
