import os

from flask import Flask, jsonify, request

from shared.converter import ConversionError, MAX_FILE_BYTES, convert_upload
from shared.telegram_drive import (
    require_bot_token,
    require_text,
    telegram_discover_chat,
    telegram_download,
    telegram_upload,
)

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_FILE_BYTES + 1024 * 1024


@app.after_request
def add_cors(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response


@app.route("/convert", methods=["OPTIONS"])
@app.route("/quota", methods=["OPTIONS"])
@app.route("/api/convert", methods=["OPTIONS"])
@app.route("/api/quota", methods=["OPTIONS"])
@app.route("/api/telegram/upload-part", methods=["OPTIONS"])
@app.route("/api/telegram/download-part", methods=["OPTIONS"])
@app.route("/api/telegram/discover-chat", methods=["OPTIONS"])
def options():
    return ("", 204)


@app.get("/healthz")
def healthz():
    return jsonify({"ok": True})


@app.get("/quota")
@app.get("/api/quota")
def quota():
    return jsonify({"enabled": False, "used": 0, "limit": 0, "remaining": 0, "resetDate": "-"})


@app.post("/convert")
@app.post("/api/convert")
def convert():
    upload = request.files.get("file")
    if not upload:
        return jsonify({"error": "No file uploaded."}), 400

    try:
        markdown = convert_upload(upload.stream, upload.filename or "")
    except ConversionError as exc:
        return jsonify({"error": str(exc)}), exc.status_code

    return jsonify({"filename": upload.filename, "markdown": markdown})


@app.post("/api/telegram/upload-part")
def telegram_upload_part():
    upload = request.files.get("file")
    if not upload:
        return jsonify({"error": "No file uploaded."}), 400
    try:
        token = require_bot_token(request.form.get("botToken"))
        chat_id = require_text(request.form.get("chatId"), "Chat ID")
        original_name = request.form.get("originalName", upload.filename or "file")
        caption = f"{original_name} [{request.form.get('partIndex', '?')}/{request.form.get('totalParts', '?')}]"
        return jsonify(telegram_upload(token, chat_id, upload, caption))
    except ConversionError as exc:
        return jsonify({"error": str(exc)}), exc.status_code


@app.post("/api/telegram/download-part")
def telegram_download_part():
    try:
        data = request.get_json(silent=True) or {}
        token = require_bot_token(data.get("botToken"))
        file_id = require_text(data.get("fileId"), "File ID")
        return app.response_class(telegram_download(token, file_id), content_type="application/octet-stream")
    except ConversionError as exc:
        return jsonify({"error": str(exc)}), exc.status_code


@app.post("/api/telegram/discover-chat")
def telegram_chat():
    try:
        data = request.get_json(silent=True) or {}
        token = require_bot_token(data.get("botToken"))
        return jsonify(telegram_discover_chat(token))
    except ConversionError as exc:
        return jsonify({"error": str(exc)}), exc.status_code


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "8000")))
