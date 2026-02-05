import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { getPublicDeliveryCurrent, submitPublicDeliveryConference } from '../api';

const PublicDeliveryConference: React.FC = () => {
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const slug = params.get('slug') || '';
  const token = params.get('token') || '';
  const deliveryId = params.get('delivery_id') || '';

  const [delivery, setDelivery] = useState<any | null>(null);
  const [form, setForm] = useState<Record<string, { received_quantity: string; note: string }>>({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [signatureData, setSignatureData] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [signerName, setSignerName] = useState('');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!slug || !token || !deliveryId) {
      setError('Link de conferencia invalido.');
      setLoading(false);
      return;
    }

    setLoading(true);
    getPublicDeliveryCurrent(slug, token, deliveryId)
      .then((data) => {
        setDelivery(data);
        const nextForm: Record<string, { received_quantity: string; note: string }> = {};
        (data.items || []).forEach((item: any) => {
          nextForm[item.id] = {
            received_quantity: item.received_quantity ?? item.planned_quantity,
            note: item.divergence_note || '',
          };
        });
        setForm(nextForm);
        setSignatureData(data.conference_signature || '');
        setHasSignature(!!data.conference_signature);
        setSignerName(data.conference_signed_by || '');
      })
      .catch(() => setError('Nao foi possivel carregar a entrega.'))
      .finally(() => setLoading(false));
  }, [slug, token, deliveryId]);

  const updateItem = (itemId: string, field: 'received_quantity' | 'note', value: string) => {
    setForm((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value,
      },
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!delivery) return;
    setSending(true);
    setError('');
    setSuccess('');
    try {
      const canvas = canvasRef.current;
      const signature = delivery?.status === 'CONFERRED' ? signatureData : canvas?.toDataURL('image/png') || '';
      if (!signature || !hasSignature) {
        setError('Assinatura obrigatoria.');
        setSending(false);
        return;
      }
      if (!signerName.trim()) {
        setError('Informe o nome de quem assinou.');
        setSending(false);
        return;
      }
      const payload = {
        items: delivery.items.map((item: any) => ({
          item_id: item.id,
          received_quantity: Number(form[item.id]?.received_quantity || 0),
          note: form[item.id]?.note || '',
        })),
        signature_data: signature,
        signer_name: signerName.trim(),
      };
      const data = await submitPublicDeliveryConference(slug, token, deliveryId, payload);
      setDelivery(data);
      setSignatureData(data.conference_signature || signature);
      setHasSignature(true);
      setSuccess('Conferencia enviada com sucesso.');
    } catch {
      setError('Nao foi possivel enviar a conferencia.');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">Carregando entrega...</div>;
  }

  const startDrawing = (event: React.MouseEvent | React.TouchEvent) => {
    if (delivery?.status === 'CONFERRED') return;
    if ('touches' in event) {
      event.preventDefault();
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (event: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || delivery?.status === 'CONFERRED') return;
    if ('touches' in event) {
      event.preventDefault();
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 pb-12">
      <div className="mx-auto max-w-3xl bg-white rounded-xl border border-slate-200 p-4">
        <h1 className="text-xl font-bold">Conferencia de entrega</h1>
        {delivery && (
          <p className="text-sm text-slate-600 mt-1">
            {delivery.school_name} • Data prevista: {delivery.delivery_date}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          {(delivery?.items || []).map((item: any) => (
            <div key={item.id} className="rounded-lg border border-slate-200 p-3">
              <p className="font-semibold">{item.supply_name}</p>
              <p className="text-xs text-slate-500">Previsto: {item.planned_quantity} {item.supply_unit}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form[item.id]?.received_quantity || ''}
                  onChange={(e) => updateItem(item.id, 'received_quantity', e.target.value)}
                  className="h-10 rounded-lg border border-slate-200 px-3"
                  placeholder="Quantidade recebida"
                  disabled={delivery?.status === 'CONFERRED'}
                />
                <input
                  value={form[item.id]?.note || ''}
                  onChange={(e) => updateItem(item.id, 'note', e.target.value)}
                  className="h-10 rounded-lg border border-slate-200 px-3"
                  placeholder="Observacao (opcional)"
                  disabled={delivery?.status === 'CONFERRED'}
                />
              </div>
            </div>
          ))}

          {delivery?.status !== 'CONFERRED' && (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Nome de quem recebeu</span>
                <input
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  className="h-10 rounded-lg border border-slate-200 px-3"
                  placeholder="Nome completo"
                />
              </label>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-sm font-semibold">Assinatura do responsavel</p>
                <p className="text-xs text-slate-500 mb-2">Desenhe no campo abaixo para validar o recebimento.</p>
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                  <canvas
                    ref={canvasRef}
                    width={600}
                    height={200}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="w-full h-40 touch-none"
                  />
                </div>
                <button type="button" onClick={clearSignature} className="mt-2 text-xs text-slate-500 underline">
                  Limpar assinatura
                </button>
              </div>
              <button disabled={sending} type="submit" className="h-11 rounded-lg bg-primary text-white font-bold disabled:opacity-60">
                {sending ? 'Enviando...' : 'Enviar conferencia'}
              </button>
            </>
          )}
        </form>

        {delivery?.status === 'CONFERRED' && (
          <div className="mt-3">
            <p className="text-green-600 text-sm">Conferencia ja enviada para a SEMED.</p>
            {signatureData && (
              <div className="mt-2">
                {signerName && (
                  <p className="text-xs text-slate-500 mb-1">Assinada por: {signerName}</p>
                )}
                <p className="text-xs text-slate-500 mb-1">Assinatura registrada</p>
                <img src={signatureData} alt="Assinatura" className="max-w-full border border-slate-200 rounded-lg" />
              </div>
            )}
          </div>
        )}
        {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
        {success && <p className="text-green-600 text-sm mt-3">{success}</p>}
      </div>
    </div>
  );
};

export default PublicDeliveryConference;
