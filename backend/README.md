# MarkItDown backend

Local Docker:

```bash
docker build -t markitdown-backend backend
docker run --rm -p 8000:8000 markitdown-backend
```

Firebase Hosting routes `/api/**` to the Python `tool` function in `main.py`.

Both Firebase and the local server expose the same paths:

- `POST /api/convert`
- `GET /api/quota`
- `POST /api/telegram/upload-part`
- `POST /api/telegram/download-part`
- `POST /api/telegram/discover-chat`

Firebase endpoints require a Firebase ID token. The local server is development-only and does not verify Firebase authentication.
