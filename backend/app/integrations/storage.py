"""File storage for recordings. The database keeps only the path, never the audio."""

from pathlib import Path

import httpx

from app.core.config import Settings

RECORDINGS_DIR = Path(__file__).resolve().parents[2] / ".recordings"


class LocalStorage:
    """Development storage on local disk (gitignored). The 'stub' storage provider."""

    def __init__(self, root: Path = RECORDINGS_DIR):
        self.root = root

    def _full(self, path: str) -> Path:
        full = (self.root / path).resolve()
        if self.root.resolve() not in full.parents:
            raise ValueError("path escapes storage root")
        return full

    def put(self, path: str, data: bytes, content_type: str) -> None:
        full = self._full(path)
        full.parent.mkdir(parents=True, exist_ok=True)
        full.write_bytes(data)

    def get(self, path: str) -> bytes:
        return self._full(path).read_bytes()

    def delete(self, path: str) -> None:
        self._full(path).unlink(missing_ok=True)


class SupabaseStorage:
    """Private Supabase Storage bucket, accessed with the service key (server side only)."""

    def __init__(self, settings: Settings):
        self.base = f"{settings.supabase_url.rstrip('/')}/storage/v1/object"
        self.bucket = settings.storage_bucket
        self.headers = {"Authorization": f"Bearer {settings.supabase_service_key}",
                        "apikey": settings.supabase_service_key}

    def put(self, path: str, data: bytes, content_type: str) -> None:
        r = httpx.post(f"{self.base}/{self.bucket}/{path}", content=data, timeout=60,
                       headers={**self.headers, "Content-Type": content_type, "x-upsert": "true"})
        r.raise_for_status()

    def get(self, path: str) -> bytes:
        r = httpx.get(f"{self.base}/authenticated/{self.bucket}/{path}", headers=self.headers, timeout=60)
        r.raise_for_status()
        return r.content

    def delete(self, path: str) -> None:
        r = httpx.delete(f"{self.base}/{self.bucket}/{path}", headers=self.headers, timeout=30)
        if r.status_code not in (200, 204, 404):
            r.raise_for_status()
