# App Store listing — ClubIt (draft)

Draft metadata for the App Store Connect submission. Fill the `TODO` items
before submitting. Copy is written to be reviewer- and student-friendly and
to reinforce the native, non-"web-wrapper" framing (Guideline 4.2).

## Basics

| Field | Value |
|---|---|
| App name (30 char max) | `ClubIt` |
| Subtitle (30 char max) | `Run your school's clubs` |
| Bundle ID | `com.clubit.app` |
| Primary category | Education |
| Secondary category | Social Networking |
| Price | Free (no in-app purchases on iOS — schools subscribe on the web; see Guideline 3.1.1 handling) |

## Promotional text (170 char max — editable without review)

> Discover clubs, check in to meetings with a quick QR scan, chat with members, vote in elections, and keep your whole school's club life in one place.

## Keywords (100 char max, comma-separated, no spaces)

```
club,school,high school,clubs,student,activities,attendance,check in,roster,election,education,campus
```

## Description

> **ClubIt brings your school's clubs together in one app.**
>
> Whether you're a student finding your people, a club leader running the show, or an advisor keeping it all on track, ClubIt makes school clubs simple.
>
> **For students**
> - Discover and join clubs at your school
> - Check in to meetings in seconds by scanning the club's QR code
> - Chat with your club members
> - Vote in club elections and polls
> - Keep track of events and your attendance
>
> **For club leaders & advisors**
> - Create and manage clubs, rosters, and roles
> - Post news and schedule events
> - Run elections and approve members
> - Manage check-ins and attendance
>
> **Built for schools**
> - Private and school-scoped — you only see your school
> - Moderated chat with reporting and blocking
> - No ads, no third-party tracking
>
> ClubIt is free for students. Schools manage their subscription on the web.

## Age rating

The app has **user-generated content** (club chat), so the questionnaire will
ask about it. ClubIt has moderation (server-side profanity filter, in-app
**report** + **block**, and an admin moderation queue), which supports a lower
rating. Expected outcome: **12+**. Answer the questionnaire honestly:
- User-Generated Content: **Yes** → note moderation, reporting, blocking.
- No unrestricted web access, no gambling, no mature themes.
- List under **Education**, NOT the Kids Category (see `docs/security/MINORS_PRIVACY.md`).

## App privacy ("nutrition label")

Per `docs/security/MINORS_PRIVACY.md` — no tracking, no ads. Declare:

| Data type | Collected? | Linked to user? | Used for tracking? | Purpose |
|---|---|---|---|---|
| Name | Yes | Yes | No | App Functionality |
| Email address | Yes | Yes | No | App Functionality |
| User Content (chat, profile) | Yes | Yes | No | App Functionality |
| Identifiers (user ID) | Yes | Yes | No | App Functionality |
| Coarse/precise location | Used, not stored | No | No | App Functionality (QR check-in confirmation only) |

- **Data used to track you:** None.
- **Third parties:** Clerk (auth), Supabase (data store). Both processors, not trackers.

## Required URLs — ✅ PUBLISHED

App Store Connect requires a **Privacy Policy URL** and a **Support URL**.
All are now live, public, and reachable without signing in (verified HTTP 200):

| Field | URL | Status |
|---|---|---|
| Privacy Policy URL | `https://clubit.app/privacy` | ✅ live |
| Support URL | `https://clubit.app/support` | ✅ live |
| Marketing URL (optional) | `https://clubit.app` | ✅ live |
| Terms / EULA | `https://clubit.app/terms` | ✅ live |

> Implemented as public bare routes (`app/privacy`, `app/terms`, `app/support`)
> added to the `proxy.ts` public matcher + `AppShell` BARE_ROUTES. Content drawn
> from `docs/security/TERMS.md` and the minors-privacy audit.
>
> ⚠️ Business/legal blanks to finalize with counsel before launch: legal entity
> name, governing law/forum, mailing address (see `docs/security/TERMS.md` TODOs),
> and the support/security/legal email inboxes must actually receive mail (App
> Review may email support).

## Review notes (App Review → App Information → Notes)

> ClubIt is a school-clubs platform. Sign in with the demo student account below.
>
> Demo account:
>   Email: TODO@clubit.app
>   Password: TODO
>   (School: TODO — a demo school already exists in-app.)
>
> Native features to try:
>   - QR check-in: open the dashboard and tap "Scan to check in" to use the
>     in-app camera to scan a meeting QR code.
>   - Haptic feedback on check-in and when casting a vote.
>   - Push notifications for chat/events (if enabled in this build).
>
> Notes:
>   - The app is free. School subscriptions are handled on the web; no purchase
>     UI is shown in the iOS app (Guideline 3.1.1).
>   - Chat is moderated: tap any message to Report or Block (Guideline 1.2).
>   - Account deletion is available in Settings (Guideline 5.1.1(v)).

## Screenshots

Required: **6.9" iPhone** (1320×2868 or 1290×2796). Optional: 6.5", 13" iPad.
Suggested set (in order):
1. Sign in / welcome
2. Student home — your clubs
3. Club detail — events, news, members
4. QR check-in (camera) — *the native hook; lead with this for 4.2*
5. Club chat
6. Elections / voting

> Captured from the iPhone 17 Pro Max simulator (correct 6.9" size). The
> launch screen and sign-in are captured; the in-app content screens need a
> signed-in session to capture. See the Phase A summary for how to produce the
> full set.

## What's done vs. TODO

- ✅ App name, subtitle, description, keywords, promo text — drafted above
- ✅ Age-rating + privacy-label guidance
- ⚠️ Privacy Policy + Support + Terms URLs — must publish pages (currently 404)
- ⚠️ Demo student account credentials — fill in
- ⚠️ Full screenshot set — needs signed-in capture
