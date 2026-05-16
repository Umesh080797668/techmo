import os
import uuid
import qrcode
import cloudinary
import cloudinary.uploader
from app.config import settings

# Cloudinary is configured centrally in pdf_service; ensure it's loaded first.
# If this module is used standalone, configure here too.
if not cloudinary.config().cloud_name:
    cloudinary.config(
        cloud_name=settings.cloudinary_cloud_name,
        api_key=settings.cloudinary_api_key,
        api_secret=settings.cloudinary_api_secret,
        secure=True,
    )


def _upload_qr_to_cloudinary(local_path: str) -> dict:
    result = cloudinary.uploader.upload(
        local_path,
        folder="techmo_uploads/qr-codes",
        resource_type="image",
        use_filename=True,
        unique_filename=True,
    )
    return {"url": result["secure_url"], "public_id": result["public_id"]}


def generate_qr(data: str, label: str = "") -> dict:
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    filename = f"qr_{uuid.uuid4()}.png"
    local_path = os.path.join(settings.generated_dir, filename)
    img.save(local_path)
    cloud = _upload_qr_to_cloudinary(local_path)
    os.remove(local_path)
    return {"filename": filename, **cloud}


def generate_barcode_qr(sku: str, product_name: str) -> dict:
    """Generate a QR code for a product SKU (for unbranded/bulk items)."""
    data = f"SKU:{sku}|{product_name}"
    return generate_qr(data, label=sku)
