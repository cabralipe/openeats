# -*- coding: utf-8 -*-
import io

with io.open('pages/Deliveries.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. ADD STATE FOR SIGNATURE MODAL
state_inserts = u"""
  // ===== Nutritionist Signature =====
  const [showSignModal, setShowSignModal] = useState(false);
  const [nutriSignatureData, setNutriSignatureData] = useState('');
  const [nutriHasSignature, setNutriHasSignature] = useState(false);
  const [nutriName, setNutriName] = useState('');
  const [nutriCrn, setNutriCrn] = useState('');
  const [nutriRole, setNutriRole] = useState('Nutricionista');
  const [isDrawingNutri, setIsDrawingNutri] = useState(false);
  const [signing, setSigning] = useState(false);
  const nutriCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const startDrawingNutri = (e: React.MouseEvent | React.TouchEvent) => {
    if ('touches' in e) e.preventDefault();
    const canvas = nutriCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setIsDrawingNutri(true);
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };
  const drawNutri = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawingNutri) return;
    if ('touches' in e) e.preventDefault();
    const canvas = nutriCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
    setNutriHasSignature(true);
  };
  const stopDrawingNutri = () => setIsDrawingNutri(false);
  const clearNutriSignature = () => {
    const canvas = nutriCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setNutriHasSignature(false);
    setNutriSignatureData('');
  };
  
  const handleSignDelivery = async () => {
    const canvas = nutriCanvasRef.current;
    if (!canvas) return;
    const sigData = canvas.toDataURL('image/png');
    if (!nutriHasSignature || !sigData) {
      setError('Assinatura obrigatória.');
      return;
    }
    if (!nutriName.trim()) {
      setError('Informe seu nome.');
      return;
    }
    setSigning(true);
    setError('');
    try {
      const { signDelivery } = await import('../api');
      const updated = await signDelivery(selectedDelivery.id, sigData, nutriName, nutriCrn, nutriRole);
      setDeliveries(deliveries.map(d => d.id === updated.id ? updated : d));
      setSelectedDelivery(updated);
      setSuccess('Entrega assinada com sucesso!');
      setShowSignModal(false);
      clearNutriSignature();
      setNutriName('');
      setNutriCrn('');
    } catch (err: any) {
      setError(err?.message || 'Erro ao assinar entrega.');
    } finally {
      setSigning(false);
    }
  };

  const handleDownloadReceiptPdf = async (id: string) => {
    try {
        const { getDeliveryReceiptPdf } = await import('../api');
        const blob = await getDeliveryReceiptPdf(id);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Recibo_Entrega_${id.slice(0,6)}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch(e: any) {
        setError(e?.message || 'Erro ao baixar PDF');
    }
  };
"""

# inject right after const [signaturePreview, setSignaturePreview]...
content = content.replace(u"  const [signaturePreview, setSignaturePreview] = useState<any | null>(null);", u"  const [signaturePreview, setSignaturePreview] = useState<any | null>(null);\n" + state_inserts)

# 2. Add buttons for signing / pdf inside the rendered block of 'isConferred' and 'isFinalized'
content = content.replace(
u"""          {isConferred && (
            <div className="mb-8">
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 mb-4">Autenticação</h3>""",
u"""          {(isConferred || delivery.status === 'FINALIZED') && (
            <div className="mb-8">
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 mb-4">Autenticação</h3>"""
)

# And inside that block, add the nutritionist signatures renderer
autenticacao_block = u"""                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                      <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400">draw</span>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Ver Assinatura Digital</p>
                      <p className="text-[10px] text-slate-500 font-medium uppercase tracking-tight">Assinado digitalmente pelo receptor</p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-slate-400 text-lg">chevron_right</span>
                </button>
              )}"""

new_autenticacao_block = u"""                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                      <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400">draw</span>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Ver Assinatura Digital</p>
                      <p className="text-[10px] text-slate-500 font-medium uppercase tracking-tight">Assinado digitalmente por {delivery.receiver_signed_by}</p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-slate-400 text-lg">chevron_right</span>
                </button>
              )}
              
              {delivery.nutritionist_signatures && delivery.nutritionist_signatures.length > 0 && (
                <div className="mt-4 space-y-3">
                    <h4 className="text-sm font-bold text-slate-600 dark:text-slate-300">Assinaturas de Nutricionistas:</h4>
                    {delivery.nutritionist_signatures.map((sig: any) => (
                        <div key={sig.id} className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
                                    <span className="material-symbols-outlined text-blue-600 dark:text-blue-400">verified</span>
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{sig.name}</p>
                                    <p className="text-[10px] text-slate-500 uppercase truncate">{sig.function_role} {sig.crn ? `- CRN: ${sig.crn}` : ''}</p>
                                </div>
                            </div>
                            <button onClick={() => setSignaturePreview({ image: sig.signature_data, title: 'Nutricionista', signedBy: sig.name })} className="p-2 bg-slate-100 rounded-xl hover:bg-slate-200 text-primary-600 font-semibold text-[10px] uppercase shrink-0">
                                Ver
                            </button>
                        </div>
                    ))}
                </div>
              )}
"""
content = content.replace(autenticacao_block, new_autenticacao_block)

# Fix mobile autenticação block
mobile_aut_block_start = u"""            {isConferred && (
              <section className="space-y-3">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 px-1">Autenticação</h2>"""

mobile_aut_block_new = u"""            {(isConferred || delivery.status === 'FINALIZED') && (
              <section className="space-y-3">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 px-1">Autenticação</h2>"""
content = content.replace(mobile_aut_block_start, mobile_aut_block_new)

# 3. Add to footer buttons: the Gerar PDF and Gerar Assinatura buttons for Conferred/Finalized
old_footer = u"""                {isSent && (
                  <button
                    type="button"
                    onClick={() => handleCopyConferenceLink(delivery)}
                    className="flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-3.5 px-4 rounded-2xl transition-all active:scale-[0.98]"
                  >
                    <span className="material-symbols-outlined text-[18px]">content_copy</span>
                    Copiar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleShareDelivery(delivery)}
                  className="flex items-center justify-center gap-2 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/30 text-primary-600 dark:text-primary-400 font-bold py-3.5 px-4 rounded-2xl transition-all active:scale-[0.98]"
                >
                  <span className="material-symbols-outlined text-[18px]">share</span>
                  Compartilhar
                </button>
              </div>"""

new_footer = u"""                {isSent && (
                  <button
                    type="button"
                    onClick={() => handleCopyConferenceLink(delivery)}
                    className="flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-3.5 px-4 rounded-2xl transition-all active:scale-[0.98]"
                  >
                    <span className="material-symbols-outlined text-[18px]">content_copy</span>
                    Copiar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleShareDelivery(delivery)}
                  className="flex items-center justify-center gap-2 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/30 text-primary-600 dark:text-primary-400 font-bold py-3.5 px-4 rounded-2xl transition-all active:scale-[0.98]"
                >
                  <span className="material-symbols-outlined text-[18px]">share</span>
                  Compartilhar
                </button>
              </div>
              
              {(isConferred || delivery.status === 'FINALIZED') && (
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <button
                    onClick={() => setShowSignModal(true)}
                    className="flex items-center justify-center gap-2 bg-emerald-50 text-emerald-600 font-bold py-3.5 rounded-2xl border border-emerald-200 transition-all hover:bg-emerald-100"
                  >
                     <span className="material-symbols-outlined">draw</span> Assinar 
                  </button>
                  <button
                    onClick={() => handleDownloadReceiptPdf(delivery.id)}
                    className="flex items-center justify-center gap-2 bg-rose-50 text-rose-600 font-bold py-3.5 rounded-2xl border border-rose-200 transition-all hover:bg-rose-100"
                  >
                     <span className="material-symbols-outlined">picture_as_pdf</span> Baixar PDF
                  </button>
                </div>
              )}"""

content = content.replace(old_footer, new_footer)

# Modal HTML right before signaturePreview block 
modal_html = u"""
      {showSignModal && (
        <div className="modal-overlay" onClick={() => setShowSignModal(false)}>
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold dark:text-white">Assinar Entrega</h3>
              <button onClick={() => setShowSignModal(false)} className="btn-ghost">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                 <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Seu Nome</label>
                 <input value={nutriName} onChange={e => setNutriName(e.target.value)} className="input" placeholder="Maria Silva" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                  <div>
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Cargo</label>
                      <input value={nutriRole} onChange={e => setNutriRole(e.target.value)} className="input" placeholder="Nutricionista" />
                  </div>
                  <div>
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">CRN (opcional)</label>
                      <input value={nutriCrn} onChange={e => setNutriCrn(e.target.value)} className="input" placeholder="99999" />
                  </div>
              </div>
              
              <div className="space-y-2 mt-4">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Desenhe sua assinatura</label>
                <div className="border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 dark:bg-slate-800 overflow-hidden relative touch-none">
                    <canvas 
                        ref={nutriCanvasRef}
                        width={500}
                        height={200}
                        className="w-full h-40 cursor-crosshair bg-white"
                        onMouseDown={startDrawingNutri}
                        onMouseMove={drawNutri}
                        onMouseUp={stopDrawingNutri}
                        onMouseLeave={stopDrawingNutri}
                        onTouchStart={startDrawingNutri}
                        onTouchMove={drawNutri}
                        onTouchEnd={stopDrawingNutri}
                    />
                </div>
                <button type="button" onClick={clearNutriSignature} className="text-xs text-primary-600 font-semibold items-center gap-1 inline-flex hover:underline">
                    <span className="material-symbols-outlined text-[14px]">refresh</span> Limpar
                </button>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowSignModal(false)} className="flex-1 btn-secondary py-3">Cancelar</button>
                <button onClick={handleSignDelivery} disabled={signing || !nutriHasSignature} className="flex-1 btn-primary py-3 disabled:opacity-50">
                    {signing ? 'Assinando...' : 'Assinar Entrega'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}"""

content = content.replace(u"{signaturePreview && (", modal_html + u"\n\n      {signaturePreview && (")

# Re-read and write to file
with io.open('pages/Deliveries.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Deliveries.tsx modified successfully.")
