from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from django.utils import timezone

def _pdf_text(value):
    text = '' if value is None else str(value)
    return text.encode('latin-1', 'replace').decode('latin-1')

def _start_pdf_page(pdf, title, generated_at, filters, page_number):
    width, height = A4
    left = 32
    right = width - 32

    pdf.setFillColor(colors.HexColor('#1f3a6d'))
    pdf.rect(0, height - 84, width, 84, stroke=0, fill=1)
    pdf.setFillColor(colors.white)
    pdf.setFont('Helvetica-Bold', 16)
    # pdf.drawString(left, height - 32, _pdf_text('SEMED - Prestacao de Contas')) # Removed
    pdf.setFont('Helvetica', 11)
    pdf.drawString(left, height - 50, _pdf_text(title))
    pdf.setFont('Helvetica', 9)
    pdf.drawRightString(right, height - 32, _pdf_text(f"Pagina {page_number}"))
    pdf.drawRightString(right, height - 50, _pdf_text(f"Gerado em: {generated_at.strftime('%Y-%m-%d %H:%M')}"))

    y = height - 102
    pdf.setFillColor(colors.HexColor('#f4f6fb'))
    pdf.rect(left, y - 28, right - left, 28, stroke=0, fill=1)
    pdf.setFillColor(colors.HexColor('#1b2a41'))
    pdf.setFont('Helvetica', 8.5)
    filters_text = ' | '.join([f"{label}: {value}" for label, value in filters])
    pdf.drawString(left + 8, y - 17, _pdf_text(filters_text))
    return y - 40

def _draw_pdf_footer(pdf, page_number):
    width, _ = A4
    pdf.setStrokeColor(colors.HexColor('#d2d8e6'))
    pdf.line(32, 26, width - 32, 26)
    pdf.setFont('Helvetica', 8)
    pdf.setFillColor(colors.HexColor('#5b6578'))
    pdf.drawString(32, 14, _pdf_text('Documento de cardapio escolar'))
    pdf.drawRightString(width - 32, 14, _pdf_text(f"Pagina {page_number}"))

def generate_menu_pdf(menu, buffer):
    """
    Generates a PDF for the given menu and writes it to the buffer (file-like object).
    """
    pdf = canvas.Canvas(buffer, pagesize=A4)
    _, height = A4
    generated_at = timezone.now()
    page_number = 1
    filters = [
        ('Escola', menu.school.name),
        ('Cardapio', menu.name or 'Sem nome'),
        ('Semana', f"{menu.week_start} a {menu.week_end}"),
    ]
    
    y = _start_pdf_page(pdf, 'Relatorio de Cardapio Semanal', generated_at, filters, page_number)

    items = menu.items.all().order_by('day_of_week', 'meal_type')
    pdf.setFont('Helvetica', 9)
    pdf.setFillColor(colors.HexColor('#1b2a41'))
    pdf.drawString(32, y, _pdf_text(f"Total de preparacoes planejadas: {items.count()}"))
    y -= 18

    current_day = None
    for item in items:
        if y < 74:
            _draw_pdf_footer(pdf, page_number)
            pdf.showPage()
            page_number += 1
            y = _start_pdf_page(pdf, 'Relatorio de Cardapio Semanal', generated_at, filters, page_number)

        day_label = item.get_day_of_week_display()
        if day_label != current_day:
            current_day = day_label
            pdf.setFillColor(colors.HexColor('#e3e9f5'))
            pdf.rect(32, y - 14, 530, 16, stroke=0, fill=1)
            pdf.setFillColor(colors.HexColor('#1b2a41'))
            pdf.setFont('Helvetica-Bold', 9)
            pdf.drawString(36, y - 10, _pdf_text(day_label))
            y -= 20
            if y < 74:
                _draw_pdf_footer(pdf, page_number)
                pdf.showPage()
                page_number += 1
                y = _start_pdf_page(pdf, 'Relatorio de Cardapio Semanal', generated_at, filters, page_number)

        meal_label = item.meal_name or item.get_meal_type_display()
        portion = item.portion_text or '-'
        description = item.description or '-'

        pdf.setFont('Helvetica-Bold', 8.5)
        pdf.setFillColor(colors.HexColor('#1b2a41'))
        pdf.drawString(36, y - 8, _pdf_text(meal_label[:45]))
        pdf.setFont('Helvetica', 8)
        pdf.drawString(300, y - 8, _pdf_text(f"Porcao: {portion[:18]}"))
        y -= 12

        wrapped_description = [description[i:i + 95] for i in range(0, len(description), 95)] or ['-']
        for line in wrapped_description[:3]:
            if y < 64:
                _draw_pdf_footer(pdf, page_number)
                pdf.showPage()
                page_number += 1
                y = _start_pdf_page(pdf, 'Relatorio de Cardapio Semanal', generated_at, filters, page_number)
            pdf.setFont('Helvetica', 8)
            pdf.setFillColor(colors.black)
            pdf.drawString(46, y - 8, _pdf_text(line))
            y -= 11

        pdf.setStrokeColor(colors.HexColor('#e8edf6'))
        pdf.line(36, y - 3, 556, y - 3)
        y -= 8

    _draw_pdf_footer(pdf, page_number)
    pdf.save()
