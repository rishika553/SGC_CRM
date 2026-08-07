import os
import uuid
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from app.models.invoices import Invoice


INVOICE_PDF_DIR = os.path.join(os.getcwd(), "uploads", "invoices")
os.makedirs(INVOICE_PDF_DIR, exist_ok=True)


def generate_invoice_pdf(invoice: Invoice) -> str:
    """
    Generates a PDF invoice file using ReportLab and returns the absolute file path.
    """
    file_name = f"Invoice_{invoice.invoice_number}.pdf"
    file_path = os.path.join(INVOICE_PDF_DIR, f"{uuid.uuid4().hex}_{file_name}")

    doc = SimpleDocTemplate(
        file_path,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "InvoiceTitle",
        parent=styles["Heading1"],
        fontSize=24,
        leading=28,
        textColor=colors.HexColor("#0F172A"),
        spaceAfter=6,
    )
    subtitle_style = ParagraphStyle(
        "InvoiceSubTitle",
        parent=styles["Normal"],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#64748B"),
    )
    body_bold = ParagraphStyle(
        "BodyBold",
        parent=styles["Normal"],
        fontSize=10,
        leading=14,
        fontName="Helvetica-Bold",
        textColor=colors.HexColor("#1E293B"),
    )

    elements = []

    # Header
    elements.append(Paragraph("TAX INVOICE", title_style))
    elements.append(Paragraph("SGC Consulting Firm Platform | Confidential & Proprietary", subtitle_style))
    elements.append(Spacer(1, 12))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#CBD5E1"), spaceAfter=15))

    # Metadata Table
    client_name = invoice.client.name if invoice.client else "N/A"
    client_email = invoice.client.email if (invoice.client and hasattr(invoice.client, 'email')) else "N/A"
    client_gst = getattr(invoice.client, 'gst_number', 'N/A') or 'N/A'

    meta_data = [
        [
            Paragraph("<b>Invoice Number:</b> " + str(invoice.invoice_number), styles["Normal"]),
            Paragraph("<b>Billed To:</b> " + client_name, styles["Normal"]),
        ],
        [
            Paragraph("<b>Issue Date:</b> " + (invoice.issue_date.strftime("%Y-%m-%d") if invoice.issue_date else "N/A"), styles["Normal"]),
            Paragraph("<b>Client Email:</b> " + (client_email or "N/A"), styles["Normal"]),
        ],
        [
            Paragraph("<b>Due Date:</b> " + (invoice.due_date.strftime("%Y-%m-%d") if invoice.due_date else "N/A"), styles["Normal"]),
            Paragraph("<b>GSTIN:</b> " + str(client_gst), styles["Normal"]),
        ],
        [
            Paragraph("<b>Status:</b> " + str(invoice.status.value.upper()), body_bold),
            Paragraph("<b>Currency:</b> " + str(invoice.currency), styles["Normal"]),
        ],
    ]
    meta_table = Table(meta_data, colWidths=[270, 270])
    meta_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(meta_table)
    elements.append(Spacer(1, 15))

    # Items Breakdown Table
    table_data = [
        [
            Paragraph("<b>Description</b>", body_bold),
            Paragraph("<b>Subtotal</b>", body_bold),
            Paragraph("<b>Tax Rate</b>", body_bold),
            Paragraph("<b>Tax Amount</b>", body_bold),
            Paragraph("<b>Total</b>", body_bold),
        ],
        [
            Paragraph(f"Consulting Services - Project Invoice #{invoice.invoice_number}", styles["Normal"]),
            Paragraph(f"{invoice.currency} {invoice.subtotal:,.2f}", styles["Normal"]),
            Paragraph(f"{invoice.tax_rate}%", styles["Normal"]),
            Paragraph(f"{invoice.currency} {invoice.tax_amount:,.2f}", styles["Normal"]),
            Paragraph(f"{invoice.currency} {invoice.total_amount:,.2f}", body_bold),
        ]
    ]

    items_table = Table(table_data, colWidths=[200, 85, 75, 90, 90])
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('PADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 15))

    # Summary Table
    summary_data = [
        [Paragraph("<b>Subtotal:</b>", styles["Normal"]), f"{invoice.currency} {invoice.subtotal:,.2f}"],
        [Paragraph("<b>Tax Amount:</b>", styles["Normal"]), f"{invoice.currency} {invoice.tax_amount:,.2f}"],
        [Paragraph("<b>Total Amount:</b>", body_bold), f"{invoice.currency} {invoice.total_amount:,.2f}"],
        [Paragraph("<b>Paid Amount:</b>", styles["Normal"]), f"{invoice.currency} {invoice.paid_amount:,.2f}"],
        [Paragraph("<b>Outstanding Balance:</b>", body_bold), f"{invoice.currency} {invoice.outstanding_amount:,.2f}"],
    ]
    summary_table = Table(summary_data, colWidths=[380, 160])
    summary_table.setStyle(TableStyle([
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('LINEBELOW', (0, 2), (1, 2), 1, colors.HexColor("#0F172A")),
        ('PADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(summary_table)

    if invoice.notes:
        elements.append(Spacer(1, 20))
        elements.append(Paragraph("<b>Payment Terms & Notes:</b>", body_bold))
        elements.append(Paragraph(str(invoice.notes), styles["Normal"]))

    doc.build(elements)
    return file_path
