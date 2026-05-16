from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
from app.services.pdf_service import (
    generate_invoice_pdf,
    generate_repair_receipt_pdf,
    generate_signed_repair_receipt_pdf,
    generate_emergency_pos_sheet,
    generate_qr_status_sticker_pdf,
    generate_daily_pulse_pdf,
)

router = APIRouter()


class InvoiceRequest(BaseModel):
    invoice_no: str
    customer_name: str
    items: list[dict]
    subtotal: float
    discount: float
    total: float
    cashier_name: str
    date: str


class RepairReceiptRequest(BaseModel):
    ticket_number: str
    customer_name: str
    customer_phone: str
    device: str
    issue: str
    status: str
    estimated_cost: Optional[float] = None
    qr_token: str


class SignedRepairReceiptRequest(BaseModel):
    ticket_number: str
    customer_name: str
    customer_phone: str
    device: str
    issue: str
    final_cost: Optional[float] = None
    technician_notes: Optional[str] = None
    signature_data_url: str        # base64 data:image/png;base64,...
    after_photos: List[str] = []   # Cloudinary URLs of AFTER photos
    completed_at: str


class EmergencyPosSheetRequest(BaseModel):
    cashier_name: str
    date: str
    products: List[dict]           # [{name, sku, price, qty_available}]


class StatusStickerRequest(BaseModel):
    ticket_number: str
    device: str
    status: str
    tracking_url: str
    qr_token: str


class DailyPulseRequest(BaseModel):
    date: str
    branch: str = "Main Branch"
    generated_by: str = "n8n automation"
    total_sales: float = 0
    total_transactions: int = 0
    total_repairs_completed: int = 0
    battery_alerts: int = 0
    top_products: List[dict] = []  # [{name, qty, revenue}]


@router.post("/invoice")
def generate_invoice(request: InvoiceRequest):
    """Generate an invoice PDF, upload to Cloudinary, return the CDN URL."""
    result = generate_invoice_pdf(request.model_dump())
    return result  # {filename, url, public_id}


@router.post("/repair-receipt")
def generate_repair_receipt(request: RepairReceiptRequest):
    """Generate a repair receipt PDF, upload to Cloudinary, return the CDN URL."""
    result = generate_repair_receipt_pdf(request.model_dump())
    return result  # {filename, url, public_id}


@router.post("/signed-repair-receipt")
def generate_signed_receipt(request: SignedRepairReceiptRequest):
    """Generate a signed completion receipt with embedded signature and after-photos."""
    result = generate_signed_repair_receipt_pdf(request.model_dump())
    return result


@router.post("/emergency-sheet")
def generate_emergency(request: EmergencyPosSheetRequest):
    """Generate a printable offline POS reference sheet."""
    result = generate_emergency_pos_sheet(request.model_dump())
    return result


@router.post("/status-sticker")
def generate_sticker(request: StatusStickerRequest):
    """Generate a small printable QR status sticker PDF."""
    result = generate_qr_status_sticker_pdf(request.model_dump())
    return result


@router.post("/daily-pulse")
def generate_daily_pulse(request: DailyPulseRequest):
    """Generate the nightly End-of-Day Pulse summary PDF, upload to Cloudinary, return the CDN URL."""
    result = generate_daily_pulse_pdf(request.model_dump())
    return result
