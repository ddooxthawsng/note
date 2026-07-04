import json
import re
from datetime import date, datetime, timezone

from firebase_functions import https_fn, options

from shared.converter import ConversionError

# ponytail: lazy init — firebase_admin is heavy and only needed at runtime
_firebase = None
def _get_db():
    global _firebase
    if _firebase is None:
        import firebase_admin
        from firebase_admin import firestore
        firebase_admin.initialize_app()
        _firebase = firestore.client()
    return _firebase

MONTHLY_LIMIT = 100
DB_COLLECTION = "toolQuota"
MAX_TELEGRAM_BYTES = 20 * 1024 * 1024
BOT_TOKEN_RE = re.compile(r"^[0-9]{6,}:[A-Za-z0-9_-]{20,}$")


def json_response(payload, status=200):
    return https_fn.Response(
        json.dumps(payload),
        status=status,
        content_type="application/json",
    )


def current_month(now=None):
    now = now or datetime.now(timezone.utc)
    return now.strftime("%Y-%m")


def reset_date(now=None):
    today = (now or datetime.now(timezone.utc)).date()
    year = today.year + (1 if today.month == 12 else 0)
    month = 1 if today.month == 12 else today.month + 1
    return date(year, month, 1).isoformat()


def _verify_token(token):
    from firebase_admin import auth
    return auth.verify_id_token(token)["uid"]


def require_uid(req):
    header = req.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        raise ConversionError("Authentication required.", 401)
    token = header.removeprefix("Bearer ").strip()
    try:
        return _verify_token(token)
    except Exception as exc:
        raise ConversionError("Authentication required.", 401) from exc


def quota_ref(uid, now=None):
    return _get_db().collection(DB_COLLECTION).document(f"{uid}_{current_month(now)}")


def quota_payload(ref):
    snap = ref.get()
    data = snap.to_dict() if snap.exists else {}
    used = int(data.get("used", 0))
    return {
        "enabled": True,
        "used": used,
        "limit": MONTHLY_LIMIT,
        "remaining": max(0, MONTHLY_LIMIT - used),
        "resetDate": reset_date(),
    }


def increment_usage(ref, uid):
    from firebase_admin import firestore

    db = _get_db()
    transaction = db.transaction()

    @firestore.transactional
    def bump(transaction, doc_ref):
        snap = doc_ref.get(transaction=transaction)
        data = snap.to_dict() if snap.exists else {}
        used = int(data.get("used", 0))
        if used >= MONTHLY_LIMIT:
            raise ConversionError("You have reached your monthly free limit.", 429)
        next_used = used + 1
        transaction.set(
            doc_ref,
            {
                "uid": uid,
                "period": current_month(),
                "used": next_used,
                "limit": MONTHLY_LIMIT,
                "resetDate": reset_date(),
                "updatedAt": firestore.SERVER_TIMESTAMP,
            },
            merge=True,
        )
        return next_used

    return bump(transaction, ref)


def require_bot_token(value):
    token = (value or "").strip()
    if not BOT_TOKEN_RE.match(token):
        raise ConversionError("Invalid bot token.", 400)
    return token


def require_text(value, name):
    text = (value or "").strip()
    if not text:
        raise ConversionError(f"{name} is required.", 400)
    return text


def telegram_api(token, method):
    return f"https://api.telegram.org/bot{token}/{method}"


def telegram_upload(token, chat_id, upload, caption=""):
    import requests

    data = upload.read()
    if len(data) > MAX_TELEGRAM_BYTES:
        raise ConversionError("Telegram bot part limit is 20MB.", 413)

    filename = upload.filename or "part.bin"
    response = requests.post(
        telegram_api(token, "sendDocument"),
        data={"chat_id": chat_id, "caption": caption[:1024]},
        files={"document": (filename, data, upload.content_type or "application/octet-stream")},
        timeout=180,
    )
    payload = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
    if not response.ok or not payload.get("ok"):
        raise ConversionError(payload.get("description") or "Telegram upload failed.", response.status_code or 502)

    document = payload["result"]["document"]
    return {
        "fileId": document["file_id"],
        "uniqueId": document.get("file_unique_id"),
        "fileName": document.get("file_name", filename),
        "size": document.get("file_size", len(data)),
    }


def telegram_download(token, file_id):
    import requests

    response = requests.get(telegram_api(token, "getFile"), params={"file_id": file_id}, timeout=60)
    payload = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
    if not response.ok or not payload.get("ok"):
        raise ConversionError(payload.get("description") or "Telegram getFile failed.", response.status_code or 502)

    file_path = payload["result"]["file_path"]
    file_response = requests.get(f"https://api.telegram.org/file/bot{token}/{file_path}", timeout=180)
    if not file_response.ok:
        raise ConversionError("Telegram download failed.", file_response.status_code or 502)
    if len(file_response.content) > MAX_TELEGRAM_BYTES:
        raise ConversionError("Telegram bot download limit is 20MB.", 413)
    return file_response.content


def handle_quota(req):
    uid = require_uid(req)
    return json_response(quota_payload(quota_ref(uid)))


def handle_convert(req):
    uid = require_uid(req)
    ref = quota_ref(uid)
    if quota_payload(ref)["remaining"] <= 0:
        return json_response({"error": "You have reached your monthly free limit."}, 429)

    upload = req.files.get("file")
    if not upload:
        return json_response({"error": "No file uploaded."}, 400)

    from shared.converter import convert_upload
    markdown = convert_upload(upload.stream, upload.filename or "")
    used = increment_usage(ref, uid)
    return json_response(
        {
            "filename": upload.filename,
            "markdown": markdown,
            "quota": {
                "enabled": True,
                "used": used,
                "limit": MONTHLY_LIMIT,
                "remaining": max(0, MONTHLY_LIMIT - used),
                "resetDate": reset_date(),
            },
        },
    )


def handle_telegram_upload_part(req):
    require_uid(req)
    token = require_bot_token(req.form.get("botToken"))
    chat_id = require_text(req.form.get("chatId"), "Chat ID")
    upload = req.files.get("file")
    if not upload:
        return json_response({"error": "No file uploaded."}, 400)

    part_index = req.form.get("partIndex", "?")
    total_parts = req.form.get("totalParts", "?")
    original_name = req.form.get("originalName", upload.filename or "file")
    caption = f"{original_name} [{part_index}/{total_parts}]"
    return json_response(telegram_upload(token, chat_id, upload, caption))


def handle_telegram_download_part(req):
    require_uid(req)
    data = req.get_json(silent=True) or {}
    token = require_bot_token(data.get("botToken"))
    file_id = require_text(data.get("fileId"), "File ID")
    return https_fn.Response(
        telegram_download(token, file_id),
        status=200,
        content_type="application/octet-stream",
    )


@https_fn.on_request(
    cors=options.CorsOptions(
        cors_origins=["*"],
        cors_methods=["get", "post", "options"],
    ),
    invoker="public",
)
def tool(req: https_fn.Request) -> https_fn.Response:
    if req.method == "OPTIONS":
        return json_response({}, 204)

    path = req.path.rstrip("/")
    try:
        if req.method == "GET" and path.endswith("/quota"):
            return handle_quota(req)
        if req.method == "POST" and path.endswith("/convert"):
            return handle_convert(req)
        if req.method == "POST" and path.endswith("/telegram/upload-part"):
            return handle_telegram_upload_part(req)
        if req.method == "POST" and path.endswith("/telegram/download-part"):
            return handle_telegram_download_part(req)
    except ConversionError as exc:
        return json_response({"error": str(exc)}, exc.status_code)

    return json_response({"error": "Not found."}, 404)
