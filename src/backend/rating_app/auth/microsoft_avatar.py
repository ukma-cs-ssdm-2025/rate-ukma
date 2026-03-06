import uuid

from django.core.files.base import ContentFile

import requests
import structlog

logger = structlog.get_logger(__name__)

GRAPH_PHOTO_URL = "https://graph.microsoft.com/v1.0/me/photo/$value"
FETCH_TIMEOUT_SECONDS = 10
MAX_PHOTO_BYTES = 4 * 1024 * 1024  # 4 MB


def fetch_microsoft_avatar(access_token: str) -> ContentFile | None:
    """Fetch the user's profile photo from Microsoft Graph API.

    Returns a Django ContentFile ready for saving to an ImageField,
    or None if the photo is unavailable.
    """
    try:
        response = requests.get(
            GRAPH_PHOTO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=FETCH_TIMEOUT_SECONDS,
        )

        if response.status_code == 404:
            logger.debug("microsoft_avatar_not_found")
            return None

        response.raise_for_status()

        content_type = response.headers.get("content-type", "")
        if not content_type.startswith("image/"):
            logger.warning("microsoft_avatar_unexpected_content_type", content_type=content_type)
            return None

        photo_bytes = response.content
        if len(photo_bytes) > MAX_PHOTO_BYTES:
            logger.warning("microsoft_avatar_too_large", size=len(photo_bytes))
            return None

        mime_type = content_type.split(";")[0].strip()
        ext = "jpg" if "jpeg" in mime_type else mime_type.split("/")[-1]
        filename = f"{uuid.uuid4().hex}.{ext}"

        return ContentFile(photo_bytes, name=filename)

    except requests.RequestException as exc:
        logger.warning("microsoft_avatar_fetch_failed", err=str(exc))
        return None
