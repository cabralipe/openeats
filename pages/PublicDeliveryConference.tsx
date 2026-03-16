import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { getPublicDeliveryCurrent, submitPublicDeliveryConference } from '../api';

type LotConferenceFormEntry = {
  received_quantity: string;
  note: string;
};

type ItemConferenceFormEntry = {
  received_quantity: string;
  note: string;
  confirmed: boolean;
  lots?: Record<string, LotConferenceFormEntry>;
};

const PublicDeliveryConference: React.FC = () => {
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const slug = params.get('slug') || '';
  const token = params.get('token') || '';
  const deliveryId = params.get('delivery_id') || '';

  const [delivery, setDelivery] = useState<any | null>(null);
  const [form, setForm] = useState<Record<string, ItemConferenceFormEntry>>({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  // Sender (who delivered) signature
  const [senderSignatureData, setSenderSignatureData] = useState('');
  const [senderHasSignature, setSenderHasSignature] = useState(false);
  const [senderName, setSenderName] = useState('');
  // Receiver (who received at school) signature
  const [receiverSignatureData, setReceiverSignatureData] = useState('');
  const [receiverHasSignature, setReceiverHasSignature] = useState(false);
  const [receiverName, setReceiverName] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const senderCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const receiverCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const items = delivery?.items || [];
  // Step logic: 0 = Sender, 1 to items.length = Items, last = Receiver
  const totalSteps = items.length + 2;
  const isSenderSignatureStep = currentStep === 0;
  const isReceiverSignatureStep = currentStep === items.length + 1;
  const isComplete = delivery?.status === 'CONFERRED' || delivery?.status === 'FINALIZED';
  const confirmedCount = Object.values(form).filter((f) => f.confirmed).length;
  const progress = isComplete ? 100 : Math.round((confirmedCount / Math.max(items.length, 1)) * 100);

  useEffect(() => {
    if (!slug || !token || !deliveryId) {
      setError('Link de conferência inválido.');
      setLoading(false);
      return;
    }

    setLoading(true);
    getPublicDeliveryCurrent(slug, token, deliveryId)
      .then((data: any) => {
        setDelivery(data);
        const itemsLength = (data.items || []).length;
        const nextForm: Record<string, ItemConferenceFormEntry> = {};
        (data.items || []).forEach((item: any) => {
          const lotState = Object.fromEntries(
            ((item.lots || []) as any[]).map((lot: any) => [
              lot.id,
              {
                received_quantity: String(lot.received_quantity ?? lot.planned_quantity ?? ''),
                note: lot.divergence_note || '',
              },
            ]),
          );
          nextForm[item.id] = {
            received_quantity: String(item.received_quantity ?? item.planned_quantity ?? ''),
            note: item.divergence_note || '',
            confirmed: data.status === 'CONFERRED' || (item.received_quantity !== null && item.received_quantity !== undefined),
            lots: lotState,
          };
        });
        setForm(nextForm);
        // Load existing signatures
        setSenderSignatureData(data.sender_signature || '');
        setSenderHasSignature(!!data.sender_signature);
        setSenderName(data.sender_signed_by || data.sender_name || '');
        setReceiverSignatureData(data.receiver_signature || data.conference_signature || '');
        setReceiverHasSignature(!!data.receiver_signature || !!data.conference_signature);
        setReceiverName(data.receiver_signed_by || data.conference_signed_by || '');

        if (data.status === 'CONFERRED' || data.status === 'FINALIZED') {
          setCurrentStep(itemsLength + 2);
        } else if (!data.sender_signature) {
          setCurrentStep(0); // Go to sender
        } else {
          // Find first item not confirmed
          let startItemIdx = 0;
          let allItemsConfirmed = true;
          for (let i = 0; i < itemsLength; i++) {
            // In backend, "received_quantity" isn't saved until they send it.
            // We check local state length 
            const item = data.items[i];
            if (item.received_quantity === null || item.received_quantity === undefined) {
              startItemIdx = i;
              allItemsConfirmed = false;
              break;
            }
          }
          if (allItemsConfirmed && itemsLength > 0) {
            setCurrentStep(itemsLength + 1); // Receiver
          } else {
            setCurrentStep(startItemIdx + 1); // Items start at offset 1
          }
        }
      })
      .catch(() => setError('Não foi possível carregar a entrega.'))
      .finally(() => setLoading(false));
  }, [slug, token, deliveryId]);

  // Clear sender canvas when entering sender signature step (if coming from receiver step)
  useEffect(() => {
    if (isSenderSignatureStep && !senderHasSignature) {
      const senderCanvas = senderCanvasRef.current;
      if (senderCanvas) {
        const ctx = senderCanvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, senderCanvas.width, senderCanvas.height);
        }
      }
    }
  }, [isSenderSignatureStep, senderHasSignature]);

  const updateItem = (itemId: string, field: 'received_quantity' | 'note', value: string) => {
    setForm((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: value },
    }));
  };

  const updateItemLot = (itemId: string, lotId: string, field: 'received_quantity' | 'note', value: string) => {
    setForm((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        lots: {
          ...(prev[itemId]?.lots || {}),
          [lotId]: {
            ...(prev[itemId]?.lots?.[lotId] || { received_quantity: '', note: '' }),
            [field]: value,
          },
        },
      },
    }));
  };

  const confirmCurrentItem = () => {
    const item = items[currentStep];
    if (!item) return;

    const qty = Number(form[item.id]?.received_quantity);
    if (isNaN(qty) || qty < 0) {
      setError('Informe uma quantidade válida.');
      return;
    }
    if ((item.lots || []).length > 0) {
      const lotsTotal = (item.lots || []).reduce((acc: number, lot: any) => {
        const lotQty = Number(form[item.id]?.lots?.[lot.id]?.received_quantity ?? lot.received_quantity ?? lot.planned_quantity ?? 0);
        return acc + (Number.isFinite(lotQty) ? lotQty : 0);
      }, 0);
      if (Math.abs(lotsTotal - qty) > 0.0001) {
        setError('A soma das quantidades por lote deve ser igual à quantidade recebida do item.');
        return;
      }
    }

    setForm((prev) => ({
      ...prev,
      [item.id]: { ...prev[item.id], confirmed: true },
    }));
    setError('');
    setCurrentStep((prev) => prev + 1);
  };

  const goBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSubmitStep = async (stepName: 'sender' | 'items' | 'receiver') => {
    if (!delivery) return;

    setSending(true);
    setError('');

    try {
      const payload: any = { step: stepName };

      if (stepName === 'sender') {
        const senderCanvas = senderCanvasRef.current;
        const senderSig = senderSignatureData || senderCanvas?.toDataURL('image/png') || '';
        if (!senderSig || !senderHasSignature) throw new Error('Assinatura do remetente obrigatória.');
        if (!senderName.trim()) throw new Error('Informe o nome do remetente.');
        payload.sender_signature_data = senderSig;
        payload.sender_signer_name = senderName.trim();
      }

      if (stepName === 'items' || stepName === 'receiver') {
        payload.items = delivery.items.map((item: any) => ({
          item_id: item.id,
          received_quantity: Number(form[item.id]?.received_quantity || 0),
          note: form[item.id]?.note || '',
          lots: (item.lots || []).length > 0
            ? (item.lots || []).map((lot: any) => ({
              delivery_item_lot: lot.id,
              received_quantity: Number(form[item.id]?.lots?.[lot.id]?.received_quantity ?? lot.received_quantity ?? lot.planned_quantity ?? 0),
              note: form[item.id]?.lots?.[lot.id]?.note || '',
            }))
            : undefined,
        }));
      }

      if (stepName === 'receiver') {
        const receiverCanvas = receiverCanvasRef.current;
        const receiverSig = receiverSignatureData || receiverCanvas?.toDataURL('image/png') || '';
        if (!receiverSig || !receiverHasSignature) throw new Error('Assinatura do receptor obrigatória.');
        if (!receiverName.trim()) throw new Error('Informe o nome do receptor.');
        payload.receiver_signature_data = receiverSig;
        payload.receiver_signer_name = receiverName.trim();
      }

      const data = await submitPublicDeliveryConference(slug, token, deliveryId, payload);
      setDelivery(data);

      if (stepName === 'sender') {
        const senderCanvas = senderCanvasRef.current;
        setSenderSignatureData(data.sender_signature || senderCanvas?.toDataURL('image/png') || '');
        setSenderHasSignature(true);
        setCurrentStep(1); // Go to first item
      } else if (stepName === 'receiver') {
        setSuccess('Conferência concluída com sucesso!');
      }

    } catch (err: any) {
      setError(err?.message || 'Não foi possível enviar a etapa da conferência.');
    } finally {
      setSending(false);
    }
  };

  const handleSaveItems = async () => {
    await handleSubmitStep('items');
    setSuccess('Itens salvos com sucesso!');
    setTimeout(() => setSuccess(''), 3000);
  };

  const startDrawing = (
    event: React.MouseEvent | React.TouchEvent,
    canvasRef: React.RefObject<HTMLCanvasElement | null>
  ) => {
    if (isComplete) return;
    if ('touches' in event) event.preventDefault();
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

  const draw = (
    event: React.MouseEvent | React.TouchEvent,
    canvasRef: React.RefObject<HTMLCanvasElement | null>,
    setHasSignature: (val: boolean) => void
  ) => {
    if (!isDrawing || isComplete) return;
    if ('touches' in event) event.preventDefault();
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

  const stopDrawing = () => setIsDrawing(false);

  const clearSignature = (
    canvasRef: React.RefObject<HTMLCanvasElement | null>,
    setHasSignature: (val: boolean) => void
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-500 to-secondary-600 flex items-center justify-center p-4">
        <div className="text-center text-white">
          <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg font-medium">Carregando entrega...</p>
        </div>
      </div>
    );
  }

  if (error && !delivery) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-danger-500 to-danger-700 flex items-center justify-center p-4">
        <div className="text-center text-white">
          <span className="material-symbols-outlined text-6xl mb-4">error</span>
          <p className="text-xl font-bold mb-2">Erro</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const currentItem = items[currentStep];
  const currentItemLotSum = currentItem
    ? (currentItem.lots || []).reduce((acc: number, lot: any) => {
      const lotQty = Number(form[currentItem.id]?.lots?.[lot.id]?.received_quantity ?? lot.received_quantity ?? lot.planned_quantity ?? 0);
      return acc + (Number.isFinite(lotQty) ? lotQty : 0);
    }, 0)
    : 0;
  const currentItemReceivedQty = currentItem ? Number(form[currentItem.id]?.received_quantity || 0) : 0;
  const lotSumMatchesItem = !currentItem || !(currentItem.lots || []).length
    ? true
    : Math.abs(currentItemLotSum - currentItemReceivedQty) <= 0.0001;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-primary-900 to-secondary-900 flex flex-col">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-xl border-b border-white/10 p-4 safe-top">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-white">local_shipping</span>
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-white font-bold truncate">{delivery?.school_name}</h1>
              <p className="text-white/60 text-sm">{delivery?.delivery_date}</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="relative h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-success-400 to-success-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-white/60">
            <span>{confirmedCount} de {items.length} itens conferidos</span>
            <span>{progress}%</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          {/* Success State */}
          {isComplete && success ? (
            <div className="bg-white rounded-3xl shadow-2xl p-8 text-center animate-scale-in">
              <div className="w-20 h-20 rounded-full bg-success-100 flex items-center justify-center mx-auto mb-6">
                <span className="material-symbols-outlined text-success-500 text-4xl">check_circle</span>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Conferência Concluída!</h2>
              <p className="text-slate-500 mb-6">Todos os itens foram conferidos e a entrega foi registrada.</p>

              {/* Show both signatures on success */}
              <div className="space-y-4 mb-4">
                {senderSignatureData && (
                  <div className="border border-slate-200 rounded-xl p-4">
                    <p className="text-xs text-slate-500 mb-2">Remetente: {senderName}</p>
                    <img src={senderSignatureData} alt="Assinatura do Remetente" className="max-w-full rounded-lg h-16 object-contain" />
                  </div>
                )}
                {receiverSignatureData && (
                  <div className="border border-slate-200 rounded-xl p-4">
                    <p className="text-xs text-slate-500 mb-2">Receptor: {receiverName}</p>
                    <img src={receiverSignatureData} alt="Assinatura do Receptor" className="max-w-full rounded-lg h-16 object-contain" />
                  </div>
                )}
              </div>

              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-success-100 text-success-700 font-medium">
                <span className="material-symbols-outlined text-sm">verified</span>
                Entrega Conferida
              </div>
            </div>
          ) : isReceiverSignatureStep ? (
            /* Receiver Signature Step - First signature step */
            <div className="bg-white rounded-3xl shadow-2xl overflow-hidden animate-fade-in">
              <div className="bg-gradient-to-r from-secondary-500 to-primary-500 p-6 text-white text-center">
                <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-3xl">local_shipping</span>
                </div>
                <h2 className="text-xl font-bold">Assinatura do Receptor</h2>
                <p className="text-white/80 text-sm mt-1">Quem está recebendo na escola</p>
              </div>

              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Nome do receptor</label>
                  <input
                    value={receiverName}
                    onChange={(e) => setReceiverName(e.target.value)}
                    className="input"
                    placeholder="Digite o nome de quem recebeu"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Assinatura</label>
                  <div className="border-2 border-dashed border-slate-300 rounded-xl overflow-hidden bg-slate-50">
                    <canvas
                      ref={receiverCanvasRef}
                      width={400}
                      height={150}
                      onMouseDown={(e) => startDrawing(e, receiverCanvasRef)}
                      onMouseMove={(e) => draw(e, receiverCanvasRef, setReceiverHasSignature)}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={(e) => startDrawing(e, receiverCanvasRef)}
                      onTouchMove={(e) => draw(e, receiverCanvasRef, setReceiverHasSignature)}
                      onTouchEnd={stopDrawing}
                      className="w-full h-36 touch-none cursor-crosshair"
                    />
                  </div>
                  <button type="button" onClick={() => clearSignature(receiverCanvasRef, setReceiverHasSignature)} className="text-sm text-slate-500 hover:text-slate-700">
                    <span className="material-symbols-outlined text-sm align-middle mr-1">refresh</span>
                    Limpar assinatura
                  </button>
                </div>

                {error && (
                  <div className="p-3 rounded-xl bg-danger-50 text-danger-600 text-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg">error</span>
                    {error}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button onClick={goBack} className="btn-secondary flex-1">
                    <span className="material-symbols-outlined">arrow_back</span>
                    Voltar
                  </button>
                  <button
                    onClick={() => {
                      if (!receiverName.trim()) {
                        setError('Informe o nome do receptor.');
                        return;
                      }
                      if (!receiverHasSignature) {
                        setError('Assinatura do receptor obrigatória.');
                        return;
                      }
                      handleSubmitStep('receiver');
                    }}
                    disabled={sending}
                    className="btn flex-1 bg-gradient-to-r from-success-500 to-success-600 text-white shadow-lg shadow-success-500/30"
                  >
                    {sending ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Enviando...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined">check</span>
                        Confirmar Tudo
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : isSenderSignatureStep ? (
            /* Sender Signature Step - Final step */
            <div className="bg-white rounded-3xl shadow-2xl overflow-hidden animate-fade-in">
              <div className="bg-gradient-to-r from-success-500 to-primary-500 p-6 text-white text-center">
                <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-3xl">local_shipping</span>
                </div>
                <h2 className="text-xl font-bold">Assinatura do Remetente</h2>
                <p className="text-white/80 text-sm mt-1">Quem está entregando os itens (última etapa)</p>
              </div>

              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Nome do entregador</label>
                  <input
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    className="input"
                    placeholder="Digite o nome de quem entregou"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Assinatura</label>
                  <div className="border-2 border-dashed border-slate-300 rounded-xl overflow-hidden bg-slate-50">
                    <canvas
                      ref={senderCanvasRef}
                      width={400}
                      height={150}
                      onMouseDown={(e) => startDrawing(e, senderCanvasRef)}
                      onMouseMove={(e) => draw(e, senderCanvasRef, setSenderHasSignature)}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={(e) => startDrawing(e, senderCanvasRef)}
                      onTouchMove={(e) => draw(e, senderCanvasRef, setSenderHasSignature)}
                      onTouchEnd={stopDrawing}
                      className="w-full h-36 touch-none cursor-crosshair"
                    />
                  </div>
                  <button type="button" onClick={() => clearSignature(senderCanvasRef, setSenderHasSignature)} className="text-sm text-slate-500 hover:text-slate-700">
                    <span className="material-symbols-outlined text-sm align-middle mr-1">refresh</span>
                    Limpar assinatura
                  </button>
                </div>


                {error && (
                  <div className="p-3 rounded-xl bg-danger-50 text-danger-600 text-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg">error</span>
                    {error}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button onClick={goBack} className="btn-secondary flex-1">
                    <span className="material-symbols-outlined">arrow_back</span>
                    Voltar
                  </button>
                  <button
                    onClick={() => handleSubmitStep('sender')}
                    disabled={sending}
                    className="btn-primary flex-1"
                  >
                    {sending ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Enviando...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined">arrow_forward</span>
                        Próximo
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

          ) : currentItem ? (
            /* Item Card */
            <div className="bg-white rounded-3xl shadow-2xl overflow-hidden animate-fade-in" key={currentItem.id}>
              {/* Step Header */}
              <div className="bg-gradient-to-r from-primary-500 to-secondary-500 p-6 text-white">
                <div className="flex items-center justify-between mb-4">
                  <span className="px-3 py-1 rounded-full bg-white/20 text-sm font-medium">
                    Item {currentStep + 1} de {items.length}
                  </span>
                  {form[currentItem.id]?.confirmed && (
                    <span className="material-symbols-outlined text-success-300">check_circle</span>
                  )}
                </div>
                <h2 className="text-2xl font-bold">{currentItem.supply_name}</h2>
              </div>

              {/* Item Details */}
              <div className="p-6 space-y-4">
                {/* Expected Quantity */}
                <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-100">
                  <span className="text-slate-600">Quantidade prevista</span>
                  <span className="text-2xl font-bold text-slate-900">
                    {currentItem.planned_quantity} <span className="text-base font-normal text-slate-500">{currentItem.supply_unit}</span>
                  </span>
                </div>

                {/* Received Quantity Input */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Quantidade recebida</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form[currentItem.id]?.received_quantity || ''}
                      onChange={(e) => updateItem(currentItem.id, 'received_quantity', e.target.value)}
                      className="input text-2xl font-bold text-center py-4"
                      placeholder="0"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">{currentItem.supply_unit}</span>
                  </div>
                </div>

                {/* Divergence Check */}
                {Number(form[currentItem.id]?.received_quantity) !== currentItem.planned_quantity && (
                  <div className="p-4 rounded-2xl bg-warning-50 border border-warning-200">
                    <div className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-warning-500">warning</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-warning-700">Quantidade diferente da prevista</p>
                        <input
                          value={form[currentItem.id]?.note || ''}
                          onChange={(e) => updateItem(currentItem.id, 'note', e.target.value)}
                          className="input mt-2 text-sm"
                          placeholder="Motivo da divergência (opcional)"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {(currentItem.lots || []).length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-slate-700">Conferência por lote</label>
                      <span className="text-xs text-slate-500">{(currentItem.lots || []).length} lote(s)</span>
                    </div>
                    <div className={`rounded-xl border px-3 py-2 text-xs ${lotSumMatchesItem ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                      Soma dos lotes: <span className="font-bold">{currentItemLotSum.toFixed(2)}</span> {currentItem.supply_unit}
                      {' '}• Item: <span className="font-bold">{Number.isFinite(currentItemReceivedQty) ? currentItemReceivedQty.toFixed(2) : '0.00'}</span> {currentItem.supply_unit}
                    </div>
                    <div className="space-y-2">
                      {(currentItem.lots || []).map((lot: any) => (
                        <div key={lot.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50/70">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-semibold text-sm text-slate-800">Lote {lot.lot_code || String(lot.lot).slice(0, 8)}</p>
                              <p className="text-xs text-slate-500">
                                {lot.expiry_date ? `Validade ${lot.expiry_date}` : 'Validade não informada'} • Previsto {lot.planned_quantity} {currentItem.supply_unit}
                              </p>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 gap-2 mt-2">
                            <div className="relative">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={form[currentItem.id]?.lots?.[lot.id]?.received_quantity ?? lot.received_quantity ?? lot.planned_quantity ?? ''}
                                onChange={(e) => updateItemLot(currentItem.id, lot.id, 'received_quantity', e.target.value)}
                                className="input"
                                placeholder="Qtd recebida no lote"
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{currentItem.supply_unit}</span>
                            </div>
                            <input
                              value={form[currentItem.id]?.lots?.[lot.id]?.note ?? ''}
                              onChange={(e) => updateItemLot(currentItem.id, lot.id, 'note', e.target.value)}
                              className="input text-sm"
                              placeholder="Observação do lote (opcional)"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {error && (
                  <div className="p-3 rounded-xl bg-danger-50 text-danger-600 text-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg">error</span>
                    {error}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  {currentStep > 1 && (
                    <button onClick={goBack} className="btn-secondary">
                      <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                  )}
                  {success && <span className="text-success-600 font-medium self-center text-sm">{success}</span>}

                  <button onClick={handleSaveItems} disabled={sending} className="btn-secondary h-14 text-sm font-medium">
                    <span className="material-symbols-outlined">save</span>
                    Salvar Progresso
                  </button>

                  <button
                    onClick={confirmCurrentItem}
                    className="btn-primary flex-1 h-14 text-base shadow-lg shadow-primary-500/30"
                  >
                    <span className="material-symbols-outlined">arrow_forward</span>
                    Avançar Etapa
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {/* Step Indicators */}
          {!isComplete && (
            <div className="flex justify-center gap-2 mt-6">
              {items.map((_: any, index: number) => (
                <button
                  key={index}
                  onClick={() => form[items[index].id]?.confirmed || index <= currentStep ? setCurrentStep(index) : null}
                  className={`w-3 h-3 rounded-full transition-all ${index === currentStep
                    ? 'w-8 bg-white'
                    : form[items[index].id]?.confirmed
                      ? 'bg-success-400'
                      : 'bg-white/30'
                    }`}
                />
              ))}
              {/* Receiver signature step indicator (first after items) */}
              <button
                onClick={() => confirmedCount === items.length ? setCurrentStep(items.length) : null}
                className={`w-3 h-3 rounded-full transition-all ${isReceiverSignatureStep ? 'w-8 bg-white' : receiverHasSignature ? 'bg-success-400' : confirmedCount === items.length ? 'bg-white/50' : 'bg-white/30'
                  }`}
              />
              {/* Sender signature step indicator (last step) */}
              <button
                onClick={() => receiverHasSignature ? setCurrentStep(items.length + 1) : null}
                className={`w-3 h-3 rounded-full transition-all ${isSenderSignatureStep ? 'w-8 bg-white' : senderHasSignature ? 'bg-success-400' : receiverHasSignature ? 'bg-white/50' : 'bg-white/30'
                  }`}
              />

            </div>
          )}

        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white/5 backdrop-blur-xl border-t border-white/10 p-4 text-center">
        <p className="text-white/40 text-xs">Merenda SEMED • Conferência de Entrega</p>
      </footer>
    </div>
  );
};

export default PublicDeliveryConference;
