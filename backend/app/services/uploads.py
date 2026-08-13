import os

from werkzeug.datastructures import FileStorage

ALLOWED_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
ALLOWED_DOC_EXTS = {".pdf"}

# Magic bytes for real content sniffing (defeats renaming-an-exe-as-.jpg).
_MAGIC = {
    b"\xff\xd8\xff": ("jpg", "jpeg"),
    b"\x89PNG\r\n\x1a\n": ("png",),
    b"GIF87a": ("gif",),
    b"GIF89a": ("gif",),
    b"RIFF": ("webp",),
    b"%PDF-": ("pdf",),
}


def file_matches_ext(file: FileStorage, allowed_exts):
    """Return (ok, msg). Validates extension against allowed set AND sniffs
    magic bytes so the declared content type actually matches the bytes.
    """
    if not file or not file.filename:
        return False, "No file provided"
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_exts:
        return False, "Unsupported file format"
    if not file.content_type:
        return False, "Missing content type"

    head = file.stream.read(8)
    file.stream.seek(0)
    if not head:
        return False, "Empty file"

    expected_kinds = _MAGIC.get(head[:3]) or _MAGIC.get(head[:4]) or _MAGIC.get(head[:5]) or _MAGIC.get(head[:8])
    if not expected_kinds:
        return False, "File content does not match a supported type"

    # jpg -> jpeg normalization
    actual_kinds = {("jpg" if k == "jpeg" else k) for k in expected_kinds}
    base = ext.lstrip(".")
    if base not in actual_kinds:
        return False, "File content does not match its extension"

    if ext in ALLOWED_DOC_EXTS and any(c in file.content_type.lower() for c in ("image/",)):
        # PDFs shouldn't claim an image mime; accept application/pdf or octet-stream
        if not file.content_type.lower().startswith("application/"):
            return False, "Unexpected content type"
    return True, "ok"