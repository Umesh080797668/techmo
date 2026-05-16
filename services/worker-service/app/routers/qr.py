from fastapi import APIRouter
from pydantic import BaseModel
from app.services.qr_service import generate_qr, generate_barcode_qr

router = APIRouter()


class QrRequest(BaseModel):
    data: str
    label: str = ""


class BarcodeQrRequest(BaseModel):
    sku: str
    product_name: str


@router.post("/generate")
def generate(request: QrRequest):
    """Generate a QR code, upload to Cloudinary, return the CDN URL."""
    result = generate_qr(request.data, request.label)
    return result  # {filename, url, public_id}


@router.post("/product")
def product_qr(request: BarcodeQrRequest):
    """Generate a product QR code and return its Cloudinary CDN URL."""
    result = generate_barcode_qr(request.sku, request.product_name)
    return result  # {filename, url, public_id}
