# Tool

Firebase-backed tool dashboard with Notes and MarkItDown conversion.

## Stack

- React 18 + TypeScript + Vite
- Tailwind CSS
- React Router 6
- Zustand
- Firebase Auth + Firestore
- Tiptap editor
- lucide-react + react-hot-toast

## Run

```bash
npm install
npm run dev
npm run build
```

Firebase config lives in `.env.local`; see `firebase.md`.
Public domain: <https://thangdo.web.app>.

## App Shape

Tool has a global top menu. Tool-specific navigation stays inside each tool.

- `/` - dashboard for tools only
- `/tools/notes` - Notes tool
- `/tools/notes/favorites` - favorite notes
- `/tools/notes/tasks` - tasks inside Notes
- `/tools/notes/trash` - deleted notes
- `/tools/notes/folder/:folderId` - notes in one folder
- `/tools/markitdown` - document-to-Markdown converter
- `/tools/telegram` - Telegram-backed file storage
- `/settings` - profile, theme, Gemini key
- `/users` - admin user management
- `/admin/firebase` - admin Firebase counts and MarkItDown quota monitor
- `/share/:noteId` - public shared note

Old routes redirect:

- `/favorites` -> `/tools/notes/favorites`
- `/tasks` -> `/tools/notes/tasks`
- `/trash` -> `/tools/notes/trash`
- `/folder/:folderId` -> `/tools/notes/folder/:folderId`

## Source Layout

```text
src/
  app/
    App.tsx                 Route tree
    layout/                 Top navbar + app shell
    pages/                  Dashboard, Settings, User Management
  features/
    auth/                   Login, signup, password reset
  shared/
    components/             Cross-app components
    hooks/                  Shared hooks
    lib/                    Firebase bootstrap
    services/               Auth/profile services
    store/                  Shared Zustand stores
    types/                  Shared types
    utils/                  AI, dialogs, validators, helpers
  tools/
    markitdown/
      MarkitdownToolPage.tsx
      markitdownApi.ts
    notes/
      NotesToolLayout.tsx   Notes-owned layout
      components/           Notes sidebar, editor, cards, quick capture
      pages/                Notes, Favorites, Trash, Share
      services/             noteService, folderService
      store/                noteStore, folderStore
      tasks/                Tasks owned by Notes
```

## Firebase Data

- `users/{uid}`: profile, role, approval status, `geminiApiKey`
- `conversionQuota/{uid_period}`: monthly MarkItDown usage
- `notes/{noteId}`: note HTML, folder, color, share flag, soft-delete state
- `folders/{folderId}`: note folders
- `tasks/{taskId}`: tasks owned by Notes
- `telegramFiles/{manifestId}`: Telegram Drive manifests owned by one user

Firestore rules protect note/task/folder/Telegram-manifest ownership. User docs are readable by owner or admin only so stored Gemini keys are not visible to other users.
Admin users can read aggregate app collections for the Firebase monitor.

Telegram Drive splits files into downloadable 20MB parts, uploads a recovery manifest, and syncs that manifest library through Firestore. Bot tokens remain in browser localStorage and are never saved to Firestore. Chat ID can be entered manually or detected after opening the bot and sending `/start`.

Notes use Telegram Drive for binary attachments. Toolbar upload, drag/drop, and pasted files are split into Telegram parts; notes keep only the manifest metadata. Images are rendered back through the authenticated Telegram API and cached for the current browser session. Other files remain downloadable attachments.

The Firebase admin monitor shows collection counts, tracked Telegram binary/metadata size, MarkItDown usage, and the current Firebase free-tier limits. Exact Firebase project usage remains available through the linked Firebase Console because the browser SDK does not expose billing usage totals.

## Notes Tool

Notes owns:

- note CRUD, folders, favorites, trash
- tasks
- rich editor
- quick capture
- AI clean/format and summarize
- note-to-task conversion
- public share view

Editor supports persisted AI colors via `<mark class="red|amber|teal|blue|purple">`, checklist blocks, headings, lists, quote, code, voice input, find/replace, and AI history.

Voice input uses the browser Speech Recognition API on web and Moonshine Voice `0.1.0` on Android. The Android model is downloaded on first use and cached on-device; the APK requires Android 8.0 (API 26) or newer. Microphone controls can be hidden or shown from Settings.

Shared checklist notes can be ticked in the public share page. Tick state is stored in that viewer's browser localStorage, not Firestore.

## MarkItDown Tool

MarkItDown accepts any file type, keeps the 20MB size limit, and lets the backend decide whether conversion is supported. Firebase mode calls `/api/convert` on <https://thangdo.web.app>; Local Docker mode calls `http://localhost:8000/convert`.

## AI Key

Settings -> AI Assistant saves Gemini key to both:

- Firestore: `users/{uid}.geminiApiKey`
- localStorage: `gemini_api_key`

On login, the key syncs from Firestore to localStorage. On logout, localStorage key is removed.

## Important Commands

```bash
npm run build
firebase deploy --only hosting --project thangdo-note
```
