"""
invoice_pdf.py — ReportLab PDF invoice generator.

Generates a GST-compliant "Tax Invoice" PDF for a completed Payment.
Returns raw bytes; the caller is responsible for wrapping in an HttpResponse.

SAC code 998313 (IT support / technical consulting services).
IGST 18% shown by default (CGST+SGST split requires knowing buyer's state).
"""

from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

# ── Brand palette ─────────────────────────────────────────────────
INDIGO      = colors.HexColor("#4338ca")
INDIGO_LIGHT= colors.HexColor("#e0e7ff")
SLATE_50    = colors.HexColor("#f8fafc")
SLATE_200   = colors.HexColor("#e2e8f0")
SLATE_700   = colors.HexColor("#334155")
SLATE_500   = colors.HexColor("#64748b")
SLATE_900   = colors.HexColor("#0f172a")
WHITE       = colors.white
EMERALD     = colors.HexColor("#059669")


# ── Style helpers ─────────────────────────────────────────────────
def _style(name, **kwargs):
    base = {
        "fontName": "Helvetica",
        "fontSize": 9,
        "textColor": SLATE_700,
        "leading": 13,
    }
    base.update(kwargs)
    return ParagraphStyle(name, **base)


H1   = _style("h1", fontName="Helvetica-Bold", fontSize=22, textColor=INDIGO, leading=26)
H2   = _style("h2", fontName="Helvetica-Bold", fontSize=13, textColor=SLATE_900, leading=18)
H3   = _style("h3", fontName="Helvetica-Bold", fontSize=9,  textColor=SLATE_900, leading=13)
BODY = _style("body")
BODY_RIGHT = _style("body_r", alignment=TA_RIGHT)
BODY_MID   = _style("body_m", textColor=SLATE_500)
SMALL      = _style("small", fontSize=7.5, textColor=SLATE_500, leading=11)
SMALL_RIGHT= _style("small_r", fontSize=7.5, textColor=SLATE_500, leading=11, alignment=TA_RIGHT)
MONO       = _style("mono", fontName="Courier", fontSize=8, textColor=SLATE_500, leading=12)
PAID_STYLE = _style("paid", fontName="Helvetica-Bold", fontSize=9, textColor=EMERALD)


def _hr(color=SLATE_200, thickness=0.5):
    return HRFlowable(width="100%", thickness=thickness, color=color, spaceAfter=4*mm)


def _p(text, style=BODY):
    return Paragraph(str(text) if text is not None else "—", style)


def _currency(amount):
    try:
        return f"₹{float(amount):,.2f}"
    except (TypeError, ValueError):
        return "—"


# ── Public entry point ────────────────────────────────────────────
def generate_invoice_pdf(payment) -> bytes:
    """
    Generate a professional GST tax invoice PDF for `payment`.
    Returns raw PDF bytes.
    """
    from django.conf import settings as s

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=15 * mm,
        leftMargin=15 * mm,
        topMargin=15 * mm,
        bottomMargin=20 * mm,
        title=f"Invoice {payment.invoice_number}",
        author="SupportMitra Technologies",
    )

    # ── Derived values ────────────────────────────────────────────
    business_name  = getattr(s, "BUSINESS_NAME",   "SupportMitra Technologies")
    business_gstin = getattr(s, "BUSINESS_GSTIN",  "22AAAAA0000A1Z5")
    business_email = getattr(s, "DEFAULT_FROM_EMAIL", "support@supportmitra.in")
    gst_rate       = float(getattr(s, "GST_RATE", 0.18))
    gst_pct        = f"{gst_rate * 100:.0f}%"

    customer = payment.customer
    ticket   = payment.ticket

    buyer_name = (
        f"{customer.user.first_name} {customer.user.last_name}".strip()
        or customer.user.email
    )
    inv_number = payment.invoice_number or f"INV-{str(payment.id)[:8].upper()}"
    inv_date   = payment.created_at.strftime("%d %B %Y")
    base_amt   = float(payment.amount)
    gst_amt    = float(payment.gst_amount)
    total_amt  = base_amt + gst_amt

    # ── STORY ─────────────────────────────────────────────────────
    story = []
    W = 180 * mm   # usable width

    # ── 1. Header band ────────────────────────────────────────────
    # Two-column: brand left, invoice meta right
    header_data = [[
        # Left: brand
        [
            _p("SupportMitra", H1),
            _p(business_name, _style("biz", fontName="Helvetica-Bold", fontSize=9,
                                     textColor=SLATE_700, leading=12)),
            _p(f"GSTIN: {business_gstin}", SMALL),
            _p(f"Email: {business_email}", SMALL),
            _p("SAC: 998313 | India", SMALL),
        ],
        # Right: invoice details
        [
            _p("TAX INVOICE", _style("tag", fontName="Helvetica-Bold", fontSize=14,
                                      textColor=INDIGO, alignment=TA_RIGHT, leading=18)),
            _p(inv_number, _style("invno", fontName="Helvetica-Bold", fontSize=10,
                                   textColor=SLATE_900, alignment=TA_RIGHT, leading=14)),
            _p(f"Date: {inv_date}", SMALL_RIGHT),
            _p(f"Status: {payment.get_status_display()}", _style(
                "stat",
                fontName="Helvetica-Bold", fontSize=9,
                textColor=EMERALD if payment.status == "completed" else SLATE_500,
                alignment=TA_RIGHT, leading=12,
            )),
        ],
    ]]
    header_table = Table(header_data, colWidths=[W * 0.55, W * 0.45])
    header_table.setStyle(TableStyle([
        ("VALIGN",  (0, 0), (-1, -1), "TOP"),
        ("PADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 5 * mm))
    story.append(_hr(INDIGO, thickness=1.5))
    story.append(Spacer(1, 3 * mm))

    # ── 2. Bill To + Ticket details ───────────────────────────────
    def _field(label, value):
        if not value:
            return []
        return [
            _p(f'<font color="#94a3b8">{label}</font>', SMALL),
            _p(str(value), BODY),
            Spacer(1, 1 * mm),
        ]

    left_col = (
        [_p("Bill To", H3), Spacer(1, 2 * mm)]
        + _field("Name",    buyer_name)
        + _field("Company", customer.company)
        + _field("Email",   customer.user.email)
        + _field("Phone",   customer.phone)
        + _field("GSTIN",   customer.gstin)
        + _field("Address", customer.address)
    )

    right_col = [_p("Ticket", H3), Spacer(1, 2 * mm)]
    if ticket:
        right_col += (
            _field("Ticket #",    ticket.ticket_number)
            + _field("Service",   ticket.get_service_type_display())
            + _field("Title",     ticket.title)
        )
    else:
        right_col.append(_p("No ticket linked", BODY_MID))

    bill_data = [[left_col, right_col]]
    bill_table = Table(bill_data, colWidths=[W * 0.55, W * 0.45])
    bill_table.setStyle(TableStyle([
        ("VALIGN",  (0, 0), (-1, -1), "TOP"),
        ("PADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(bill_table)
    story.append(Spacer(1, 5 * mm))
    story.append(_hr())
    story.append(Spacer(1, 3 * mm))

    # ── 3. Line items table ───────────────────────────────────────
    story.append(_p("Line Items", H3))
    story.append(Spacer(1, 2 * mm))

    item_header = [
        _p("Description",   _style("th", fontName="Helvetica-Bold", fontSize=8,
                                    textColor=WHITE, leading=11)),
        _p("SAC Code",      _style("th2", fontName="Helvetica-Bold", fontSize=8,
                                    textColor=WHITE, alignment=TA_CENTER, leading=11)),
        _p("Base Amount",   _style("th3", fontName="Helvetica-Bold", fontSize=8,
                                    textColor=WHITE, alignment=TA_RIGHT, leading=11)),
        _p(f"IGST ({gst_pct})",
                            _style("th4", fontName="Helvetica-Bold", fontSize=8,
                                    textColor=WHITE, alignment=TA_RIGHT, leading=11)),
        _p("Total",         _style("th5", fontName="Helvetica-Bold", fontSize=8,
                                    textColor=WHITE, alignment=TA_RIGHT, leading=11)),
    ]
    item_row = [
        _p(payment.get_payment_type_display(), BODY),
        _p("998313",  _style("sac", fontSize=8, textColor=SLATE_500,
                               alignment=TA_CENTER, leading=11)),
        _p(_currency(base_amt), BODY_RIGHT),
        _p(_currency(gst_amt),  BODY_RIGHT),
        _p(_currency(total_amt), _style("tot", fontName="Helvetica-Bold",
                                         fontSize=9, textColor=SLATE_900,
                                         alignment=TA_RIGHT, leading=13)),
    ]
    col_w = [W * 0.38, W * 0.14, W * 0.16, W * 0.16, W * 0.16]
    items_table = Table(
        [item_header, item_row],
        colWidths=col_w,
        repeatRows=1,
    )
    items_table.setStyle(TableStyle([
        ("BACKGROUND",  (0, 0), (-1, 0), INDIGO),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, SLATE_50]),
        ("GRID",        (0, 0), (-1, -1), 0.4, SLATE_200),
        ("VALIGN",      (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",  (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING",(0, 0),(-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING",(0, 0), (-1, -1), 6),
    ]))
    story.append(items_table)
    story.append(Spacer(1, 5 * mm))

    # ── 4. Totals summary ─────────────────────────────────────────
    totals_data = [
        [_p("Subtotal",           BODY_MID), _p(_currency(base_amt),  BODY_RIGHT)],
        [_p(f"IGST @ {gst_pct}", BODY_MID), _p(_currency(gst_amt),   BODY_RIGHT)],
        [_p("Grand Total",        _style("gt", fontName="Helvetica-Bold",
                                          fontSize=11, textColor=SLATE_900, leading=16)),
         _p(_currency(total_amt), _style("gtr", fontName="Helvetica-Bold",
                                          fontSize=11, textColor=INDIGO,
                                          alignment=TA_RIGHT, leading=16))],
    ]
    totals_table = Table(totals_data, colWidths=[W * 0.75, W * 0.25])
    totals_table.setStyle(TableStyle([
        ("VALIGN",       (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",   (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 4),
        ("LINEABOVE",    (0, 2), (-1, 2), 1.0, INDIGO),
        ("TOPPADDING",   (0, 2), (-1, 2), 6),
        ("BOTTOMPADDING",(0, 2), (-1, 2), 6),
        ("BACKGROUND",   (0, 2), (-1, 2), INDIGO_LIGHT),
    ]))
    story.append(totals_table)
    story.append(Spacer(1, 5 * mm))
    story.append(_hr())
    story.append(Spacer(1, 3 * mm))

    # ── 5. Payment details ────────────────────────────────────────
    story.append(_p("Payment Details", H3))
    story.append(Spacer(1, 2 * mm))

    pay_rows = [
        ["Gateway",    payment.gateway.title() if payment.gateway else "—"],
        ["Payment ID", payment.gateway_payment_id or "—"],
        ["Order ID",   payment.gateway_order_id  or "—"],
        ["Currency",   payment.currency],
    ]
    pay_data = [
        [
            _p(label, _style(f"pl{i}", fontSize=8, textColor=SLATE_500, leading=11)),
            _p(value, _style(f"pv{i}", fontName="Courier", fontSize=8,
                              textColor=SLATE_700, leading=11)),
        ]
        for i, (label, value) in enumerate(pay_rows)
    ]
    pay_table = Table(pay_data, colWidths=[W * 0.22, W * 0.78])
    pay_table.setStyle(TableStyle([
        ("VALIGN",       (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",   (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 3),
    ]))
    story.append(pay_table)
    story.append(Spacer(1, 8 * mm))
    story.append(_hr(SLATE_200, thickness=0.3))
    story.append(Spacer(1, 3 * mm))

    # ── 6. Footer ─────────────────────────────────────────────────
    story.append(_p(
        "This is a computer-generated GST Tax Invoice and does not require a physical signature. "
        f"IGST charged at {gst_pct} under SAC 998313 (IT support services). "
        "For billing queries contact support@supportmitra.in.",
        _style("footer", fontSize=7.5, textColor=SLATE_500, leading=11),
    ))

    doc.build(story)
    return buffer.getvalue()
