"""
Public contact endpoint — receives website form submissions.
No authentication required (public endpoint).
Rate-limited to 5 submissions / 10 minutes per IP.
"""

from fastapi import APIRouter, Request
from pydantic import BaseModel, EmailStr
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.services.smtp_service import send_contact

router = APIRouter(prefix="/contact", tags=["contact"])
limiter = Limiter(key_func=get_remote_address)


class ContactPayload(BaseModel):
    firstname: str
    lastname: str
    email: EmailStr
    organisation: str = ""
    need_type: str
    message: str = ""


@router.post("")
@limiter.limit("5/10minutes")
def submit_contact(request: Request, payload: ContactPayload) -> dict:
    """
    Receive a contact form submission from the DataSphere website.
    Sends a notification email to the team (if SMTP configured).
    Always returns 200 to avoid leaking info — errors are logged server-side.
    """
    result = send_contact(
        firstname=payload.firstname,
        lastname=payload.lastname,
        email=str(payload.email),
        organisation=payload.organisation,
        need_type=payload.need_type,
        message=payload.message,
    )
    return {
        "success": True,
        "message": "Votre demande a bien été reçue. Nous vous répondrons sous 24h.",
        "notified": result.sent,
    }
