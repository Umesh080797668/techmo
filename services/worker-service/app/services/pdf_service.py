import os
import uuid
import cloudinary
import cloudinary.uploader
import cloudinary.api
from weasyprint import HTML
from jinja2 import Environment, FileSystemLoader
from app.config import settings

template_dir = os.path.join(os.path.dirname(__file__), "..", "..", "templates")
env = Environment(loader=FileSystemLoader(template_dir))

# Configure Cloudinary once at module load
cloudinary.config(
    cloud_name=settings.cloudinary_cloud_name,
    api_key=settings.cloudinary_api_key,
    api_secret=settings.cloudinary_api_secret,
    secure=True,
)


def _upload_to_cloudinary(local_path: str, folder: str, resource_type: str = "raw") -> dict:
    """Upload a file to Cloudinary and return {url, public_id}.

    Before uploading, checks whether a file with the same name already exists
    in Cloudinary.  If it does, the existing URL is returned immediately without
    consuming any upload quota.  The public_id is built deterministically from
    the filename so repeated calls for the same invoice/receipt are idempotent.

    Cloudinary public_id conventions:
      - resource_type="image" → extension is stripped from the public_id
      - resource_type="raw"   → extension is kept in the public_id
    """
    basename = os.path.basename(local_path)
    basename_no_ext = os.path.splitext(basename)[0]
    public_id = (
        f"techmo_uploads/{folder}/{basename_no_ext}"
        if resource_type == "image"
        else f"techmo_uploads/{folder}/{basename}"
    )

    # ── Check for existing resource ─────────────────────────────────────────
    try:
        existing = cloudinary.api.resource(public_id, resource_type=resource_type)
        return {"url": existing["secure_url"], "public_id": existing["public_id"]}
    except cloudinary.exceptions.NotFound:
        pass  # file doesn't exist yet — proceed with upload
    except Exception:
        pass  # API error (auth, network) — attempt upload anyway

    # ── Fresh upload ─────────────────────────────────────────────────────────
    result = cloudinary.uploader.upload(
        local_path,
        folder=f"techmo_uploads/{folder}",
        resource_type=resource_type,
        use_filename=True,
        unique_filename=False,   # deterministic public_id so the check above works
        overwrite=False,         # guard against rare race conditions
        access_mode="public",
    )
    return {"url": result["secure_url"], "public_id": result["public_id"]}


def generate_invoice_pdf(invoice_data: dict) -> dict:
    template = env.get_template("invoice.html")
    html_content = template.render(**invoice_data)
    filename = f"invoice_{invoice_data.get('invoice_no', uuid.uuid4())}.pdf"
    local_path = os.path.join(settings.generated_dir, filename)
    HTML(string=html_content).write_pdf(local_path)
    cloud = _upload_to_cloudinary(local_path, "invoices", resource_type="image")
    os.remove(local_path)  # clean up local temp file
    return {"filename": filename, **cloud}


def generate_repair_receipt_pdf(repair_data: dict) -> dict:
    template = env.get_template("repair_receipt.html")
    html_content = template.render(**repair_data)
    filename = f"repair_{repair_data.get('ticket_number', uuid.uuid4())}.pdf"
    local_path = os.path.join(settings.generated_dir, filename)
    HTML(string=html_content).write_pdf(local_path)
    cloud = _upload_to_cloudinary(local_path, "repair-receipts")
    os.remove(local_path)
    return {"filename": filename, **cloud}


def generate_signed_repair_receipt_pdf(repair_data: dict) -> dict:
    """
    Generates a completion receipt with embedded digital signature and after-photos.
    repair_data must include:
      ticket_number, customer_name, customer_phone, device, issue,
      final_cost, technician_notes, signature_data_url, after_photos (list of URLs),
      completed_at
    """
    template = env.get_template("signed_repair_receipt.html")
    html_content = template.render(**repair_data)
    filename = f"signed_receipt_{repair_data.get('ticket_number', uuid.uuid4())}.pdf"
    local_path = os.path.join(settings.generated_dir, filename)
    HTML(string=html_content).write_pdf(local_path)
    cloud = _upload_to_cloudinary(local_path, "signed-receipts")
    os.remove(local_path)
    return {"filename": filename, **cloud}


def generate_emergency_pos_sheet(data: dict) -> dict:
    """
    Generates a printable offline POS reference sheet.
    data must include: products (list of {name, sku, price}), date, cashier_name
    """
    template = env.get_template("emergency_sheet.html")
    html_content = template.render(**data)
    filename = f"emergency_sheet_{data.get('date', uuid.uuid4())}.pdf"
    local_path = os.path.join(settings.generated_dir, filename)
    HTML(string=html_content).write_pdf(local_path)
    cloud = _upload_to_cloudinary(local_path, "emergency-sheets")
    os.remove(local_path)
    return {"filename": filename, **cloud}


def generate_qr_status_sticker_pdf(data: dict) -> dict:
    """
    Generates a small printable QR status sticker.
    data: ticket_number, device, status, tracking_url, qr_token
    The QR image is generated on-the-fly from the tracking_url using qrcode.
    """
    import qrcode
    import base64
    from io import BytesIO

    # Generate QR code as base64 PNG for embedding in HTML
    qr = qrcode.QRCode(box_size=6, border=2)
    qr.add_data(data.get("tracking_url", ""))
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = BytesIO()
    img.save(buf, format="PNG")
    qr_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

    template = env.get_template("status_sticker.html")
    html_content = template.render(**data, qr_b64=qr_b64)
    filename = f"sticker_{data.get('ticket_number', uuid.uuid4())}.pdf"
    local_path = os.path.join(settings.generated_dir, filename)
    HTML(string=html_content).write_pdf(local_path)
    cloud = _upload_to_cloudinary(local_path, "stickers")
    os.remove(local_path)
    return {"filename": filename, **cloud}


def generate_daily_pulse_pdf(data: dict) -> dict:
    """
    Generates the nightly End-of-Day summary PDF.

    data keys:
      date, total_sales, total_transactions, total_repairs_completed,
      top_products (list of {name, qty, revenue}), battery_alerts,
      branch, generated_by
    """
    template = env.get_template("daily_pulse.html")
    html_content = template.render(**data)
    filename = f"daily_pulse_{data.get('date', uuid.uuid4())}.pdf"
    local_path = os.path.join(settings.generated_dir, filename)
    HTML(string=html_content).write_pdf(local_path)
    cloud = _upload_to_cloudinary(local_path, "daily-pulse")
    os.remove(local_path)
    return {"filename": filename, **cloud}
