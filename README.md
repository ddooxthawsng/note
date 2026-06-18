# SuperNote

Advanced note-taking web app. **Phase 1 MVP**: auth + note CRUD with a rich-text editor, live-synced via Firestore.

Built per [`super_note_prompt.md`](./super_note_prompt.md). Full roadmap (collaboration, search, AI, kanban, calendar) lives there.

## Stack

| Concern        | Choice                                    |
| -------------- | ----------------------------------------- |
| Framework      | React 18 + TypeScript + Vite              |
| Styling        | Tailwind CSS (dark mode via `class`)      |
| State          | Zustand                                   |
| Routing        | React Router 6                            |
| Backend        | Firebase Auth + Firestore                 |
| Editor         | Tiptap (ProseMirror) — collab-ready       |
| Icons / toasts | lucide-react / react-hot-toast            |

> Editor note: the spec listed Draft.js, but it's archived by Meta. Swapped for **Tiptap** — actively maintained and has first-class Yjs support for the Phase 2 real-time collaboration goal.

## Quick start

```bash
npm install
# configure Firebase — see firebase.md, fill .env.local
npm run dev
```

App boots without Firebase keys (you'll see a warning banner on the auth screens), but sign-in and notes require a configured project. See **[firebase.md](./firebase.md)**.

## Scripts

- `npm run dev` — Vite dev server (port 5173)
- `npm run build` — type-check + production build to `dist/`
- `npm run preview` — preview the production build

## What's implemented (Phase 1)

- **Auth** — email/password + Google sign-in, signup with password-strength meter, password reset, route guards, profile name edit.
- **Notes** — create / read / edit / soft-delete, auto-save (1.5s debounce), live Firestore sync, word count, pin & favorite.
- **Organization** — dashboard grid, client-side search (title/content/tags), sort by modified/created/title, Favorites view, Trash with restore + permanent delete.
- **UX** — responsive layout, light/dark theme (persisted), toasts, loading skeletons.

## Project structure

```
src/
├── components/      AppLayout, Navbar, Sidebar, NotesList, NoteCard,
│   └── Editor/      TiptapEditor, ProtectedRoute, AuthShell
├── pages/           Login, Signup, ForgotPassword, Dashboard,
│                    Editor, Favorites, Trash, Settings
├── services/        authService, noteService (Firestore)
├── store/           authStore, noteStore, uiStore (Zustand)
├── hooks/           useAuth
├── lib/             firebase.ts
├── types/           note.ts, user.ts
└── utils/           validators (zod), cn
```

## Next (Phase 2+)

Folders & tags CRUD · sharing & permissions · real-time collaborative editing (Tiptap + Yjs) · version history · Algolia search · export/import. Tracked in `super_note_prompt.md`.
