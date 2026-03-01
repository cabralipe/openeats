# -*- coding: utf-8 -*-
import io

with io.open('backend/inventory/views.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Add receipt_pdf action to DeliveryViewSet
action_str = u"""        serializer = self.get_serializer(delivery)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def receipt_pdf(self, request, pk=None):
        delivery = self.get_object()
        response = HttpResponse(content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="delivery_{delivery.id}.pdf"'
        
        pdf = canvas.Canvas(response, pagesize=A4)
        _, height = A4
        
        pdf.setFont('Helvetica-Bold', 14)
        pdf.drawString(40, height - 50, _pdf_text('Termo de Recebimento e Conferencia de Entrega'))
        
        pdf.setFont('Helvetica', 10)
        pdf.drawString(40, height - 80, _pdf_text(f"Escola: {delivery.school.name}"))
        pdf.drawString(40, height - 95, _pdf_text(f"Data da Entrega: {delivery.delivery_date}"))
        pdf.drawString(40, height - 110, _pdf_text(f"Status: {delivery.get_status_display()}"))
        
        y = height - 140
        pdf.setFont('Helvetica-Bold', 10)
        pdf.drawString(40, y, _pdf_text('Itens Recebidos:'))
        y -= 20
        
        pdf.setFont('Helvetica-Bold', 9)
        pdf.drawString(40, y, _pdf_text('Insumo'))
        pdf.drawRightString(350, y, _pdf_text('Planejado'))
        pdf.drawRightString(420, y, _pdf_text('Recebido'))
        pdf.drawString(430, y, _pdf_text('Lotes / Validade'))
        y -= 15
        
        pdf.setFont('Helvetica', 9)
        for item in delivery.items.select_related('supply').prefetch_related('lots__lot').all():
            name_lines = get_wrapped_text_lines(_pdf_text(item.supply.name), 'Helvetica', 9, 240)
            
            lots_text = []
            for item_lot in item.lots.all():
                lots_text.append(f"Lote: {item_lot.lot.lot_code} (Val: {item_lot.lot.expiry_date}) Qtd: {item_lot.received_quantity if item_lot.received_quantity else '-'}")
            
            lots_joined = " | ".join(lots_text) if lots_text else "-"
            lots_lines = get_wrapped_text_lines(_pdf_text(lots_joined), 'Helvetica', 8, 120)
            
            max_lines = max(len(name_lines), len(lots_lines), 1)
            row_height = max_lines * 10 + 5
            
            if y < 150:
                pdf.showPage()
                y = height - 50
            
            text_y = y
            for line in name_lines:
                pdf.drawString(40, text_y, line)
                text_y -= 10
                
            pdf.drawRightString(350, y, _pdf_text(f"{item.planned_quantity} {item.supply.unit}"))
            recv_val = f"{item.received_quantity} {item.supply.unit}" if item.received_quantity is not None else "-"
            pdf.drawRightString(420, y, _pdf_text(recv_val))
            
            text_y = y
            for line in lots_lines:
                pdf.drawString(430, text_y, line)
                text_y -= 10
                
            y -= row_height
        
        y -= 20
        if y < 200:
            pdf.showPage()
            y = height - 50
            
        pdf.setFont('Helvetica-Bold', 10)
        pdf.drawString(40, y, _pdf_text('Assinaturas da Entrega e Conferencia:'))
        y -= 20
        
        pdf.setFont('Helvetica', 9)
        pdf.drawString(40, y, _pdf_text(f"Entregue por: {delivery.sender_signed_by or '-'}"))
        pdf.drawString(300, y, _pdf_text(f"Recebido por (Escola): {delivery.receiver_signed_by or '-'}"))
        
        # We can try to draw signatures from base64 but it requires Image and ReportLab advanced.
        # It's usually better to just list them or draw a simple line since we don't have PIL guaranteed.
        # By default, openeats might not have Pillow. We will just list the names clearly.
        
        y -= 40
        pdf.setFont('Helvetica-Bold', 10)
        pdf.drawString(40, y, _pdf_text('Nutricionistas Responsaveis:'))
        y -= 20
        pdf.setFont('Helvetica', 9)
        
        sigs = delivery.nutritionist_signatures.all()
        if not sigs:
            pdf.drawString(40, y, _pdf_text('Nenhuma assinatura de nutricionista registrada.'))
        else:
            for sig in sigs:
                pdf.drawString(40, y, _pdf_text(f"Nome: {sig.name} | CRN: {sig.crn} | {sig.function_role}"))
                y -= 15
        
        pdf.save()
        return response"""

content = content.replace(
    u"        serializer = self.get_serializer(delivery)\n        return Response(serializer.data)\n\n\nclass NotificationViewSet(viewsets.ModelViewSet):",
    action_str + u"\n\nclass NotificationViewSet(viewsets.ModelViewSet):"
)

with io.open('backend/inventory/views.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("Added receipt_pdf to views.py")
