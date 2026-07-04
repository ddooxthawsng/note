import os

from flask import Flask, jsonify, request

from shared.converter import ConversionError, MAX_FILE_BYTES, convert_upload

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
def options():
    return ("", 204)


@app.get("/healthz")
def healthz():
    return jsonify({"ok": True})


@app.get("/quota")
def quota():
    return jsonify({"enabled": False, "used": 0, "limit": 0, "remaining": 0, "resetDate": "-"})


@app.post("/convert")
def convert():
    upload = request.files.get("file")
    if not upload:
        return jsonify({"error": "No file uploaded."}), 400

    try:
        markdown = convert_upload(upload.stream, upload.filename or "")
    except ConversionError as exc:
        return jsonify({"error": str(exc)}), exc.status_code

    return jsonify({"filename": upload.filename, "markdown": markdown})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "8000")))
