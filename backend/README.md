# MarkItDown backend

Local Docker:

```bash
docker build -t markitdown-backend backend
docker run --rm -p 8000:8000 markitdown-backend
```

Firebase Hosting routes `/api/**` to the Python `api` function in `main.py`.
