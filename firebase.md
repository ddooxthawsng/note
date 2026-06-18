# Firebase Setup — SuperNote

`firebase.md` was empty. This is the wiring guide. Do this once before auth/notes work.

## 1. Create project

1. Go to <https://console.firebase.google.com> → **Add project**.
2. Name it (e.g. `supernote`), disable Analytics if you want (optional).

## 2. Register a Web app

1. Project Overview → click the **`</>`** (Web) icon → register app (no Hosting checkbox needed yet).
2. Copy the `firebaseConfig` values.

## 3. Fill `.env.local`

Map the config into `.env.local` (already created with empty placeholders):

```
VITE_FIREBASE_API_KEY=<apiKey>
VITE_FIREBASE_AUTH_DOMAIN=<authDomain>
VITE_FIREBASE_PROJECT_ID=<projectId>
VITE_FIREBASE_STORAGE_BUCKET=<storageBucket>
VITE_FIREBASE_MESSAGING_SENDER_ID=<messagingSenderId>
VITE_FIREBASE_APP_ID=<appId>
```

Restart `npm run dev` after editing (Vite only reads env at startup).

## 4. Enable Authentication

Build → **Authentication** → Get started → **Sign-in method**:

- Enable **Email/Password**.
- Enable **Google** (set a support email).

## 5. Create Firestore

Build → **Firestore Database** → Create database → **Production mode** → pick a region.

## 6. Deploy rules + indexes

Rules and composite indexes live in this repo (`firestore.rules`, `firestore.indexes.json`).

```bash
npm i -g firebase-tools      # once
firebase login
firebase use --add           # pick your project, alias it "default"
firebase deploy --only firestore:rules,firestore:indexes
```

> The two composite indexes are required — the dashboard and trash queries
> filter by `userId` + `isDeleted` and order by `updatedAt`/`deletedAt`.
> Without them Firestore throws a "needs an index" error with a create link.

## 7. (Later) Hosting

```bash
npm run build
firebase deploy --only hosting
```

`firebase.json` already points hosting at `dist/` with SPA rewrites.
