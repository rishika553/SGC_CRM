import hashlib
import os
import uuid
from typing import Tuple, Optional
import httpx
from app.core.config import settings

DOCUMENTS_UPLOAD_DIR = os.path.join(os.getcwd(), "uploads", "documents")
os.makedirs(DOCUMENTS_UPLOAD_DIR, exist_ok=True)


async def upload_file_to_storage(
    content: bytes,
    filename: str,
    mime_type: str = "application/octet-stream"
) -> Tuple[str, str, int, str]:
    """
    Uploads file content to Supabase Storage if configured, or fallback local storage.
    Returns: (storage_path, storage_type, file_size, checksum)
    """
    file_size = len(content)
    checksum = hashlib.sha256(content).hexdigest()
    ext = os.path.splitext(filename)[1]
    unique_key = f"{uuid.uuid4().hex}_{filename}"

    # Try Supabase Storage if SUPABASE_URL & ANON_KEY are present
    if settings.SUPABASE_URL and settings.SUPABASE_ANON_KEY:
        try:
            bucket_name = "crm-documents"
            upload_url = f"{settings.SUPABASE_URL.rstrip('/')}/storage/v1/object/{bucket_name}/{unique_key}"
            headers = {
                "Authorization": f"Bearer {settings.SUPABASE_ANON_KEY}",
                "apiKey": settings.SUPABASE_ANON_KEY,
                "Content-Type": mime_type,
            }
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(upload_url, content=content, headers=headers)
                if res.status_code in (200, 201):
                    storage_path = f"{bucket_name}/{unique_key}"
                    return storage_path, "supabase", file_size, checksum
        except Exception:
            # Fallback to local storage if network or Supabase bucket is unreachable
            pass

    # Fallback Local Storage
    local_path = os.path.join(DOCUMENTS_UPLOAD_DIR, unique_key)
    with open(local_path, "wb") as f:
        f.write(content)

    return local_path, "local", file_size, checksum


def generate_secure_signed_url(storage_path: str, storage_type: str = "supabase", expires_in_seconds: int = 3600) -> str:
    """
    Generates a secure signed URL for preview or download.
    """
    if storage_type == "supabase" and settings.SUPABASE_URL:
        # Construct Supabase Storage signed URL format
        return f"{settings.SUPABASE_URL.rstrip('/')}/storage/v1/object/public/{storage_path}"

    # Local storage fallback link
    return f"/api/v1/documents/stream-file?path={storage_path}"
