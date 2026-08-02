import re

import requests

from shared.converter import ConversionError


MAX_TELEGRAM_BYTES = 20 * 1024 * 1024
BOT_TOKEN_RE = re.compile(r"^[0-9]{6,}:[A-Za-z0-9_-]{20,}$")


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


def telegram_request(token, method, *, http_method="get", timeout=60, **kwargs):
    try:
        response = requests.request(http_method, telegram_api(token, method), timeout=timeout, **kwargs)
        payload = response.json()
    except requests.RequestException as exc:
        raise ConversionError("Telegram is unreachable.", 502) from exc
    except ValueError as exc:
        raise ConversionError("Telegram returned an invalid response.", 502) from exc

    if not response.ok or not payload.get("ok"):
        raise ConversionError(payload.get("description") or f"Telegram {method} failed.", response.status_code or 502)
    return payload.get("result")


def telegram_upload(token, chat_id, upload, caption=""):
    data = upload.read()
    if len(data) > MAX_TELEGRAM_BYTES:
        raise ConversionError("Telegram bot part limit is 20MB.", 413)

    filename = upload.filename or "part.bin"
    message = telegram_request(
        token,
        "sendDocument",
        http_method="post",
        timeout=180,
        data={"chat_id": chat_id, "caption": caption[:1024]},
        files={"document": (filename, data, upload.content_type or "application/octet-stream")},
    )
    document = message["document"]
    return {
        "fileId": document["file_id"],
        "uniqueId": document.get("file_unique_id"),
        "fileName": document.get("file_name", filename),
        "size": document.get("file_size", len(data)),
        "messageId": message.get("message_id"),
        "chatId": str(message.get("chat", {}).get("id", chat_id)),
    }


def telegram_download(token, file_id):
    result = telegram_request(token, "getFile", params={"file_id": file_id})
    file_path = result["file_path"]
    try:
        response = requests.get(f"https://api.telegram.org/file/bot{token}/{file_path}", timeout=180)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise ConversionError("Telegram download failed.", 502) from exc
    if len(response.content) > MAX_TELEGRAM_BYTES:
        raise ConversionError("Telegram bot download limit is 20MB.", 413)
    return response.content


def _chat_from_update(update):
    for key in ("message", "channel_post", "edited_message", "edited_channel_post"):
        message = update.get(key) or {}
        chat = message.get("chat")
        if chat:
            return chat, message.get("text", "")
    membership = update.get("my_chat_member") or update.get("chat_member") or {}
    return membership.get("chat"), ""


def telegram_discover_chat(token):
    bot = telegram_request(token, "getMe")
    webhook = telegram_request(token, "getWebhookInfo")
    start_url = f"https://t.me/{bot['username']}?start=telegram_drive" if bot.get("username") else None
    result = {
        "bot": {
            "id": str(bot["id"]),
            "username": bot.get("username"),
            "firstName": bot.get("first_name", "Telegram bot"),
        },
        "chat": None,
        "startUrl": start_url,
        "webhookActive": bool(webhook.get("url")),
    }
    if result["webhookActive"]:
        return result

    updates = telegram_request(
        token,
        "getUpdates",
        params={
            "limit": 100,
            "timeout": 0,
            "allowed_updates": '["message","channel_post","my_chat_member"]',
        },
    )
    candidates = []
    for update in updates:
        chat, text = _chat_from_update(update)
        if chat:
            candidates.append((chat, str(text).startswith("/start")))
    if candidates:
        chat = next((item[0] for item in reversed(candidates) if item[1]), candidates[-1][0])
        result["chat"] = {
            "id": str(chat["id"]),
            "type": chat.get("type", "unknown"),
            "title": chat.get("title") or " ".join(filter(None, [chat.get("first_name"), chat.get("last_name")])) or chat.get("username"),
            "username": chat.get("username"),
        }
    return result
