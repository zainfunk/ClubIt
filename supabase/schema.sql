-- ============================================================
-- ClubIt — Full Schema + Seed
-- Run once in Supabase SQL Editor
-- ============================================================

-- Users
create table if not exists users (
  id text primary key,
  name text not null,
  email text not null,
  role text not null check (role in ('admin', 'advisor', 'student')),
  avatar_url text
);

-- Clubs
create table if not exists clubs (
  id text primary key,
  name text not null,
  description text,
  icon_url text,
  capacity int,
  advisor_id text references users(id),
  auto_accept boolean default false,
  tags text[] default '{}',
  event_creator_ids text[] default '{}',
  created_at text not null
);

-- Leadership positions
create table if not exists leadership_positions (
  id text primary key,
  club_id text references clubs(id) on delete cascade,
  title text not null,
  user_id text references users(id) on delete set null
);

-- Social links (club)
create table if not exists club_social_links (
  id text primary key default gen_random_uuid()::text,
  club_id text references clubs(id) on delete cascade,
  platform text not null,
  url text not null
);

-- Meeting times
create table if not exists meeting_times (
  id text primary key,
  club_id text references clubs(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time text not null,
  end_time text not null,
  location text
);

-- Memberships
create table if not exists memberships (
  id text primary key,
  club_id text references clubs(id) on delete cascade,
  user_id text references users(id) on delete cascade,
  joined_at text not null,
  unique(club_id, user_id)
);

-- Events
create table if not exists events (
  id text primary key,
  club_id text references clubs(id) on delete cascade,
  title text not null,
  description text,
  date text not null,
  location text,
  is_public boolean default true,
  created_by text references users(id)
);

-- Join requests
create table if not exists join_requests (
  id text primary key,
  club_id text references clubs(id) on delete cascade,
  user_id text references users(id) on delete cascade,
  requested_at text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected'))
);

-- Attendance records
create table if not exists attendance_records (
  id text primary key,
  club_id text references clubs(id) on delete cascade,
  user_id text references users(id) on delete cascade,
  meeting_date text not null,
  present boolean not null,
  unique(club_id, user_id, meeting_date)
);

-- Attendance sessions (QR check-in)
create table if not exists attendance_sessions (
  id text primary key,
  club_id text references clubs(id) on delete cascade,
  meeting_date text not null,
  created_by text references users(id),
  expires_at text not null,
  max_distance_meters int default 0,
  advisor_lat float,
  advisor_lng float,
  recorded_user_ids text[] default '{}'
);

-- Club news
create table if not exists club_news (
  id text primary key,
  club_id text references clubs(id) on delete cascade,
  title text not null,
  content text not null,
  author_id text references users(id),
  created_at text not null,
  is_pinned boolean default false
);

-- Polls
create table if not exists polls (
  id text primary key,
  club_id text references clubs(id) on delete cascade,
  position_title text not null,
  created_at text not null,
  is_open boolean default true
);

create table if not exists poll_candidates (
  id text primary key default gen_random_uuid()::text,
  poll_id text references polls(id) on delete cascade,
  user_id text references users(id)
);

create table if not exists poll_votes (
  poll_id text references polls(id) on delete cascade,
  candidate_user_id text references users(id),
  voter_user_id text references users(id),
  primary key (poll_id, voter_user_id)
);

-- School elections
create table if not exists school_elections (
  id text primary key,
  position_title text not null,
  description text,
  created_at text not null,
  is_open boolean default true
);

create table if not exists election_candidates (
  id text primary key default gen_random_uuid()::text,
  election_id text references school_elections(id) on delete cascade,
  user_id text references users(id)
);

create table if not exists election_votes (
  election_id text references school_elections(id) on delete cascade,
  candidate_user_id text references users(id),
  voter_user_id text references users(id),
  primary key (election_id, voter_user_id)
);

-- Chat messages
create table if not exists chat_messages (
  id text primary key,
  club_id text references clubs(id) on delete cascade,
  sender_id text references users(id),
  content text not null,
  sent_at text not null
);

-- Club forms
create table if not exists club_forms (
  id text primary key,
  club_id text references clubs(id) on delete cascade,
  title text not null,
  description text,
  form_type text not null check (form_type in ('signup', 'nomination', 'survey', 'approval')),
  is_open boolean default true,
  closes_at text,
  created_at text not null
);

create table if not exists form_responses (
  form_id text references club_forms(id) on delete cascade,
  user_id text references users(id),
  responded_at text not null default now()::text,
  primary key (form_id, user_id)
);

-- User profiles (extended)
create table if not exists user_profiles (
  user_id text primary key references users(id) on delete cascade,
  bio text default '',
  skills text[] default '{}',
  interests text[] default '{}',
  socials jsonb default '[]'
);

-- User overrides (name/email edits by admin)
create table if not exists user_overrides (
  user_id text primary key references users(id) on delete cascade,
  name text,
  email text
);

-- Admin settings (single row)
create table if not exists admin_settings (
  id int primary key default 1,
  achievements_enabled boolean default true,
  attendance_enabled boolean default true,
  clubs_enabled boolean default true,
  student_socials_enabled boolean default true,
  check (id = 1)
);

-- User privacy settings
create table if not exists user_privacy_settings (
  user_id text primary key references users(id) on delete cascade,
  achievements_public boolean default true,
  attendance_public boolean default false,
  clubs_public boolean default true
);

-- ============================================================
-- Seed Data
-- ============================================================

insert into users (id, name, email, role) values
  ('user-admin-1',   'Principal Hayes', 'hayes@clubit.edu',    'admin'),
  ('user-advisor-1', 'Ms. Patel',       'patel@clubit.edu',    'advisor'),
  ('user-advisor-2', 'Mr. Thompson',    'thompson@clubit.edu', 'advisor'),
  ('user-student-1', 'Alex Rivera',     'alex@clubit.edu',     'student'),
  ('user-student-2', 'Jordan Kim',      'jordan@clubit.edu',   'student'),
  ('user-student-3', 'Sam Okafor',      'sam@clubit.edu',      'student')
on conflict (id) do nothing;

insert into clubs (id, name, description, icon_url, capacity, advisor_id, auto_accept, tags, event_creator_ids, created_at) values
  ('club-robotics',    'Robotics Club',       'Build and program robots to compete in regional and national competitions. No experience required — just curiosity and drive.', '🤖', 20,   'user-advisor-1', true,  array['STEM','Engineering','Competition'], array['user-student-1'], '2024-09-01'),
  ('club-drama',       'Drama Club',          'Perform in school plays and musicals, develop stage presence, and explore the world of theatre. Open to all skill levels.',    '🎭', 30,   'user-advisor-2', false, array['Arts','Performance','Theatre'],    array['user-student-3'], '2024-09-01'),
  ('club-chess',       'Chess Club',          'Sharpen your strategy and compete against other schools. Beginners welcome — experienced members will help you learn.',          '♟️', null, 'user-advisor-1', false, array['Strategy','Competition','Games'],  array[]::text[],         '2024-09-01'),
  ('club-environment', 'Environmental Club',  'Take action on sustainability, organize campus clean-ups, and raise awareness about environmental issues in our community.',    '🌱', 25,   'user-advisor-2', true,  array['Environment','Community','Activism'], array['user-student-2'], '2024-09-01')
on conflict (id) do nothing;

insert into leadership_positions (id, club_id, title, user_id) values
  ('lp-1', 'club-robotics',    'President',             'user-student-1'),
  ('lp-2', 'club-robotics',    'Vice President',        'user-student-2'),
  ('lp-3', 'club-robotics',    'Build Lead',            null),
  ('lp-4', 'club-drama',       'President',             'user-student-3'),
  ('lp-5', 'club-drama',       'Stage Manager',         null),
  ('lp-6', 'club-chess',       'President',             'user-student-1'),
  ('lp-7', 'club-chess',       'Tournament Coordinator',null),
  ('lp-8', 'club-environment', 'President',             null),
  ('lp-9', 'club-environment', 'Events Coordinator',    'user-student-2')
on conflict (id) do nothing;

insert into club_social_links (club_id, platform, url) values
  ('club-robotics',    'instagram', 'https://instagram.com'),
  ('club-robotics',    'discord',   'https://discord.com'),
  ('club-drama',       'instagram', 'https://instagram.com'),
  ('club-environment', 'instagram', 'https://instagram.com'),
  ('club-environment', 'twitter',   'https://twitter.com')
on conflict do nothing;

insert into meeting_times (id, club_id, day_of_week, start_time, end_time, location) values
  ('mt-1', 'club-robotics',    2, '15:00', '16:30', 'Room 204'),
  ('mt-2', 'club-robotics',    4, '15:00', '16:30', 'Room 204'),
  ('mt-3', 'club-drama',       1, '14:30', '16:00', 'Auditorium'),
  ('mt-4', 'club-drama',       3, '14:30', '16:00', 'Auditorium'),
  ('mt-5', 'club-chess',       3, '15:00', '16:00', 'Library'),
  ('mt-6', 'club-environment', 5, '12:00', '13:00', 'Room 101')
on conflict (id) do nothing;

insert into memberships (id, club_id, user_id, joined_at) values
  ('m-1', 'club-robotics',    'user-student-1', '2024-09-05'),
  ('m-2', 'club-robotics',    'user-student-2', '2024-09-05'),
  ('m-3', 'club-drama',       'user-student-2', '2024-09-06'),
  ('m-4', 'club-drama',       'user-student-3', '2024-09-06'),
  ('m-5', 'club-chess',       'user-student-1', '2024-09-07'),
  ('m-6', 'club-chess',       'user-student-3', '2024-09-07'),
  ('m-7', 'club-environment', 'user-student-2', '2024-09-08')
on conflict (club_id, user_id) do nothing;

insert into events (id, club_id, title, description, date, location, is_public, created_by) values
  ('event-1', 'club-robotics',    'Regional Robotics Qualifier',  'Compete against 12 other schools in the regional qualifier round.',    '2026-04-20', 'Westfield High Gymnasium', true,  'user-advisor-1'),
  ('event-2', 'club-drama',       'Spring Musical — Auditions',   'Auditions for this year''s spring musical. Open to all students.',     '2026-04-15', 'Main Auditorium',          true,  'user-advisor-2'),
  ('event-3', 'club-chess',       'Interschool Chess Tournament', 'Home tournament — we''re hosting 6 schools this year.',               '2026-05-03', 'Library',                  true,  'user-advisor-1'),
  ('event-4', 'club-environment', 'Earth Day Campus Clean-Up',    'Join us for our annual Earth Day clean-up. All students welcome.',     '2026-04-22', 'School Grounds',           true,  'user-student-2'),
  ('event-5', 'club-robotics',    'Build Workshop',               'Internal workshop for members to work on the robot chassis.',          '2026-04-10', 'Room 204',                 false, 'user-student-1')
on conflict (id) do nothing;

insert into join_requests (id, club_id, user_id, requested_at, status) values
  ('req-1', 'club-robotics',    'user-student-3', '2026-04-01T09:15:00Z', 'pending'),
  ('req-2', 'club-drama',       'user-student-1', '2026-04-02T10:30:00Z', 'pending'),
  ('req-3', 'club-chess',       'user-student-2', '2026-04-01T14:00:00Z', 'pending'),
  ('req-4', 'club-environment', 'user-student-1', '2026-04-03T08:00:00Z', 'pending'),
  ('req-5', 'club-environment', 'user-student-3', '2026-04-03T11:45:00Z', 'pending')
on conflict (id) do nothing;

insert into attendance_records (id, club_id, user_id, meeting_date, present) values
  ('att-1',  'club-robotics',    'user-student-1', '2026-03-19', true),
  ('att-2',  'club-robotics',    'user-student-2', '2026-03-19', false),
  ('att-3',  'club-robotics',    'user-student-1', '2026-03-24', true),
  ('att-4',  'club-robotics',    'user-student-2', '2026-03-24', true),
  ('att-5',  'club-robotics',    'user-student-1', '2026-03-26', true),
  ('att-6',  'club-robotics',    'user-student-2', '2026-03-26', true),
  ('att-7',  'club-drama',       'user-student-2', '2026-03-16', true),
  ('att-8',  'club-drama',       'user-student-3', '2026-03-16', true),
  ('att-9',  'club-drama',       'user-student-2', '2026-03-18', false),
  ('att-10', 'club-drama',       'user-student-3', '2026-03-18', true),
  ('att-11', 'club-chess',       'user-student-1', '2026-03-18', true),
  ('att-12', 'club-chess',       'user-student-3', '2026-03-18', false),
  ('att-13', 'club-chess',       'user-student-1', '2026-03-25', true),
  ('att-14', 'club-chess',       'user-student-3', '2026-03-25', true),
  ('att-15', 'club-environment', 'user-student-2', '2026-03-20', true),
  ('att-16', 'club-environment', 'user-student-2', '2026-03-27', false)
on conflict (club_id, user_id, meeting_date) do nothing;

insert into club_news (id, club_id, title, content, author_id, created_at, is_pinned) values
  ('news-1', 'club-robotics', 'Qualifier Prep Starts Monday',  'All members please come prepared with your build notes. We will be doing a full run-through of the competition routine before the qualifier on April 20.', 'user-advisor-1', '2026-04-04T08:00:00Z', true),
  ('news-2', 'club-robotics', 'New Parts Arrived',             'The replacement servo motors and sensor kits have arrived. Pick them up from Room 204 before our next session.',                                          'user-student-1', '2026-04-02T14:00:00Z', false),
  ('news-3', 'club-drama',    'Audition Slots Open',           'Sign-up sheet for audition slots is now available outside the auditorium. Slots fill up fast — grab yours by Friday!',                                    'user-advisor-2', '2026-04-03T09:30:00Z', true)
on conflict (id) do nothing;

insert into polls (id, club_id, position_title, created_at, is_open) values
  ('poll-1', 'club-robotics', 'Build Lead', '2026-04-04T10:00:00Z', true)
on conflict (id) do nothing;

insert into poll_candidates (poll_id, user_id) values
  ('poll-1', 'user-student-1'),
  ('poll-1', 'user-student-2')
on conflict do nothing;

insert into school_elections (id, position_title, description, created_at, is_open) values
  ('selec-1', 'Student Body President',      'Vote for next year''s Student Body President. Shape the future of campus life.',                                          '2026-04-01T09:00:00Z', true),
  ('selec-2', 'Student Body Treasurer',      'Vote for next year''s Student Body Treasurer. Responsible for managing the student activity fund.',                      '2026-04-01T09:05:00Z', true),
  ('selec-3', 'Student Body Vice President', 'Past election — Vice President for the 2025–26 school year.',                                                             '2025-09-10T09:00:00Z', false)
on conflict (id) do nothing;

insert into election_candidates (election_id, user_id) values
  ('selec-1', 'user-student-1'),
  ('selec-1', 'user-student-3'),
  ('selec-2', 'user-student-2'),
  ('selec-2', 'user-student-3'),
  ('selec-3', 'user-student-1'),
  ('selec-3', 'user-student-2')
on conflict do nothing;

insert into election_votes (election_id, candidate_user_id, voter_user_id) values
  ('selec-1', 'user-student-1', 'user-student-2'),
  ('selec-3', 'user-student-1', 'user-admin-1'),
  ('selec-3', 'user-student-1', 'user-advisor-1'),
  ('selec-3', 'user-student-2', 'user-advisor-2')
on conflict do nothing;

insert into chat_messages (id, club_id, sender_id, content, sent_at) values
  ('msg-1',  'club-robotics',    'user-student-1', 'Hey team! Anyone working on the chassis this week?',                                                                 '2026-04-04T09:15:00Z'),
  ('msg-2',  'club-robotics',    'user-student-2', 'Yeah, I''ll be in Room 204 on Tuesday after school.',                                                                '2026-04-04T09:22:00Z'),
  ('msg-3',  'club-robotics',    'user-advisor-1', 'Great! Remember the qualifier is April 20th. Make sure the motors are calibrated before then.',                      '2026-04-04T09:45:00Z'),
  ('msg-4',  'club-robotics',    'user-student-1', 'On it. Also thinking about adding a sensor array for the obstacle course.',                                          '2026-04-04T10:01:00Z'),
  ('msg-5',  'club-drama',       'user-student-2', 'Auditions are April 15th — who else is trying out?',                                                                 '2026-04-03T14:00:00Z'),
  ('msg-6',  'club-drama',       'user-student-3', 'I am! Hoping to get the lead this year. Been practicing all week.',                                                   '2026-04-03T14:10:00Z'),
  ('msg-7',  'club-drama',       'user-advisor-2', 'Come prepared with a 2-minute monologue. Sheet music for the musical numbers will be handed out on the day.',        '2026-04-03T14:30:00Z'),
  ('msg-8',  'club-chess',       'user-student-1', 'Tournament is May 3rd. Want to do a practice session before?',                                                       '2026-04-02T16:00:00Z'),
  ('msg-9',  'club-chess',       'user-student-3', 'Definitely. How about next Wednesday in the library at 3 PM?',                                                       '2026-04-02T16:30:00Z'),
  ('msg-10', 'club-chess',       'user-student-1', 'Works for me. I''ll bring the boards.',                                                                               '2026-04-02T16:45:00Z'),
  ('msg-11', 'club-environment', 'user-student-2', 'Earth Day is April 22nd. Who''s coming to the campus clean-up?',                                                     '2026-04-01T11:00:00Z'),
  ('msg-12', 'club-environment', 'user-advisor-2', 'Count me in. I can bring extra gloves and bags. Great initiative, Jordan!',                                          '2026-04-01T11:20:00Z')
on conflict (id) do nothing;

insert into club_forms (id, club_id, title, description, form_type, is_open, closes_at, created_at) values
  ('form-1', 'club-drama',       'Officer Nominations',           'Nominate candidates for Stage Manager and Treasurer for the upcoming semester.',         'nomination', true,  '2026-04-08T17:00:00Z', '2026-04-01T10:00:00Z'),
  ('form-2', 'club-robotics',    'Regional Competition Sign-Up',  'Travel authorization and liability waiver for the Spring Regional Robotics Competition.','signup',     true,  '2026-04-10T17:00:00Z', '2026-04-01T10:00:00Z'),
  ('form-3', 'club-environment', 'Earth Day Project Selection',   'Vote on our Earth Day initiative: campus clean-up, recycling drive, or tree planting.', 'survey',     true,  '2026-04-11T18:00:00Z', '2026-04-02T10:00:00Z'),
  ('form-4', 'club-chess',       'Annual Budget Approval 2026',   'Review and approve the proposed annual budget for club activities and equipment.',       'approval',   false, '2026-03-28T17:00:00Z', '2026-03-20T10:00:00Z')
on conflict (id) do nothing;

insert into admin_settings (id) values (1)
on conflict (id) do nothing;

-- ============================================================
-- Multi-tenant: Schools (tenant boundary)
-- ============================================================

create table if not exists schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  district text,
  contact_name text not null,
  contact_email text not null,
  status text not null default 'pending' check (status in ('pending', 'active', 'suspended')),
  student_invite_code text unique,
  admin_invite_code text unique,
  -- One-time IT setup link token
  setup_token text unique,
  setup_token_expires_at timestamptz,
  setup_completed_at timestamptz,
  created_at timestamptz default now()
);

-- Add school_id to users (nullable: superadmin users have no school)
alter table users add column if not exists school_id uuid references schools(id) on delete set null;

-- Add school_id to clubs and school elections
alter table clubs add column if not exists school_id uuid references schools(id) on delete cascade;
alter table school_elections add column if not exists school_id uuid references schools(id) on delete cascade;
alter table admin_settings add column if not exists school_id uuid references schools(id) on delete cascade;

-- Add superadmin to allowed roles
alter table users drop constraint if exists users_role_check;
alter table users add constraint users_role_check
  check (role in ('superadmin', 'admin', 'advisor', 'student'));

-- ============================================================
-- Seed: Demo school for existing seed data
-- ============================================================

insert into schools (id, name, district, contact_name, contact_email, status, student_invite_code, admin_invite_code, setup_completed_at) values
  ('00000000-0000-0000-0000-000000000001', 'Demo High School', 'Demo District', 'Principal Hayes', 'hayes@clubit.edu', 'active', 'DEMO-STU-0001', 'DEMO-ADM-0001', now())
on conflict (id) do nothing;

-- Assign existing seed users to the demo school
update users set school_id = '00000000-0000-0000-0000-000000000001'
where id in ('user-admin-1', 'user-advisor-1', 'user-advisor-2', 'user-student-1', 'user-student-2', 'user-student-3')
  and school_id is null;

-- Assign existing seed clubs to the demo school
update clubs set school_id = '00000000-0000-0000-0000-000000000001'
where school_id is null;

-- Assign existing seed elections to the demo school
update school_elections set school_id = '00000000-0000-0000-0000-000000000001'
where school_id is null;

-- ============================================================
-- School invites (superadmin-generated onboarding links)
-- ============================================================

create table if not exists school_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  token text unique not null,
  created_at timestamptz default now(),
  used_at timestamptz,
  school_id uuid references schools(id) on delete set null
);

-- ============================================================
-- Row-Level Security (requires Clerk → Supabase JWT bridge)
-- See: https://clerk.com/docs/integrations/databases/supabase
-- Uncomment after configuring the JWT template in Clerk dashboard.
-- ============================================================

-- alter table schools enable row level security;
-- alter table users enable row level security;
-- alter table clubs enable row level security;
-- alter table school_elections enable row level security;

-- -- Users can only see users in their own school
-- create policy "school_isolation_users" on users
--   for all using (
--     school_id = (select school_id from users where id = auth.uid())
--   );

-- -- Users can only see clubs in their own school
-- create policy "school_isolation_clubs" on clubs
--   for all using (
--     school_id = (select school_id from users where id = auth.uid())
--   );

-- -- Users can only see elections in their own school
-- create policy "school_isolation_elections" on school_elections
--   for all using (
--     school_id = (select school_id from users where id = auth.uid())
--   );


-- ============================================================
-- Issue Reports
-- ============================================================

create table if not exists issue_reports (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references schools(id) on delete cascade,
  reporter_id text references users(id) on delete set null,
  reporter_name text not null,
  reporter_email text not null,
  message text not null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz default now()
);
