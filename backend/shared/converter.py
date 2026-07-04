from pathlib import Path
from tempfile import NamedTemporaryFile

MAX_FILE_BYTES = 20 * 1024 * 1024

# ponytail: lazy import — markitdown pulls onnxruntime/magika, slow to load
_markitdown = None
def _get_markitdown():
    global _markitdown
    if _markitdown is None:
        from markitdown import MarkItDown
        _markitdown = MarkItDown()
    return _markitdown


class ConversionError(Exception):
    def __init__(self, message, status_code=400):
        super().__init__(message)
        self.status_code = status_code


def extension(filename):
    return Path(filename).suffix.lower().lstrip(".")


def convert_upload(stream, filename):
    ext = extension(filename)
    suffix = f".{ext}" if ext else ""

    temp_path = None
    total = 0

    try:
        with NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_path = Path(temp_file.name)
            while True:
                chunk = stream.read(1024 * 1024)
                if not chunk:
                    break
                total += len(chunk)
                if total > MAX_FILE_BYTES:
                    raise ConversionError("File too large. Maximum size is 20MB.", 413)
                temp_file.write(chunk)

        result = _get_markitdown().convert(str(temp_path))
        return result.text_content or ""
    except ConversionError:
        raise
    except Exception as exc:
        raise ConversionError("Conversion failed.", 500) from exc
    finally:
        if temp_path:
            temp_path.unlink(missing_ok=True)
