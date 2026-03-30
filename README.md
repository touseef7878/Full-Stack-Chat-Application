# Prochat

A real-time chat application built with React, TypeScript, Vite, and Supabase.

## Features

### Messaging
- Public chat rooms — open to all authenticated users and guests (read-only)
- Direct messages — private one-on-one conversations
- Real-time message delivery via Supabase Realtime
- Optimistic UI — messages appear instantly before DB confirmation
- Message grouping by sender with timestamps
- Soft-delete your own DM messages (shows "This message was deleted")

### Privacy & Security
- Message request system — users must accept before a DM thread is created
- Block users — blocked users cannot message you or appear in your DM search
- DM privacy setting — toggle between "Everyone" and "Nobody" can message you
- Username-only search — DM search only works with `@username`, emails never exposed
- Row-level security on all Supabase tables

### Sidebar
- Unified sidebar with Public Rooms and Direct Messages sections
- DMs have a unique lock badge + `DM` pill tag to distinguish from group rooms
- Unread message badges with real-time count updates
- Sidebar search bar to filter existing chats
- Badges clear instantly when a chat is opened

### Auth
- Email/password sign up and sign in via Supabase Auth
- Guest mode — read-only access without an account
- Profile settings — first name, last name, username, avatar upload

### UI
- Light/dark mode toggle (persisted to localStorage)
- Fully responsive — Android phones, tablets, and laptops
- Smooth slide animation between sidebar and chat on mobile
- Skeleton loading states, no layout flashes

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS, shadcn/ui |
| Backend | Supabase (Postgres + Realtime + Auth + Storage) |
| Email | Resend (via Supabase custom SMTP) |
| Routing | React Router v6 |
| State | React Context + hooks (no Redux) |

## Database Schema

```
profiles          — user profiles (username, name, avatar, dm_privacy)
chat_rooms        — public group rooms
messages          — messages in public rooms
private_chats     — accepted DM threads between two users
private_messages  — messages in DMs (with soft-delete support)
user_chat_read_status — tracks last-read timestamp per user per chat
user_blocks       — block list (blocker_id → blocked_id)
message_requests  — pending/accepted/declined DM requests
```

## Setup

### 1. Install dependencies
```bash
pnpm install
```

### 2. Configure environment
Create `.env` with your Supabase project credentials:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Run database migrations
In your Supabase SQL editor, run in order:
1. `supabase/migrations/20260329144307_create_tables.sql` — core schema
2. `supabase/migrations/20260329150000_add_rpc_functions.sql` — unread count RPCs
3. `supabase/migrations/20260329160000_dm_privacy.sql` — DM privacy features

### 4. Start dev server
```bash
pnpm dev
```

## Project Structure

```
src/
├── components/
│   ├── layout/          # ChatLayout (responsive), AuthLayout
│   ├── ui/              # shadcn/ui primitives
│   ├── Sidebar.tsx      # Chat list with search, unread badges
│   ├── MessageList.tsx  # Message rendering with context menu
│   ├── MessageInput.tsx # Auto-resize textarea input
│   ├── ProfileSettingsDialog.tsx
│   ├── StartPrivateChatDialog.tsx
│   ├── MessageRequestsDialog.tsx
│   └── CreateChatRoomDialog.tsx
├── hooks/
│   ├── useChatMessages.tsx  # Message fetch + realtime subscription
│   └── useDMPrivacy.ts      # Block, delete, requests, privacy
├── pages/
│   ├── Index.tsx        # Landing page
│   ├── LoginPage.tsx
│   ├── RegisterPage.tsx
│   ├── ChatPage.tsx     # Authenticated chat
│   └── GuestChatPage.tsx
└── lib/
    └── supabase.ts      # Supabase client
```

## Built by

**Touseef Ur Rehman** · Pakistan 🇵🇰
