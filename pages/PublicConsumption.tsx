import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getPublicSupplies, submitPublicConsumption } from '../api';

const PublicConsumption: React.FC = () => {
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const slug = params.get('slug') || '';
  const token = params.get('token') || '';

  const [supplies, setSupplies] = useState<any[]>([]);
  const [movementDate, setMovementDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [form, setForm] = useState<Record<string, { quantity: string; note: string; added: boolean }>>({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentStep, setCurrentStep] = useState(-1); // -1 = date step, 0+ = supply step
  const [showSummary, setShowSummary] = useState(false);

  const addedItems = useMemo(() => {
    return supplies.filter((s) => {
      const qty = Number(form[s.id]?.quantity || 0);
      return qty > 0 && form[s.id]?.added;
    });
  }, [supplies, form]);

  const isDateStep = currentStep === -1;
  const isSummaryStep = showSummary;
  const currentSupply = supplies[currentStep];
  const progress = supplies.length > 0 ? Math.round((addedItems.length / supplies.length) * 100) : 0;

  useEffect(() => {
    if (!slug || !token) {
      setError('Link de consumo inválido.');
      setLoading(false);
      return;
    }

    setLoading(true);
    getPublicSupplies(slug, token)
      .then((data) => {
        setSupplies(data);
        const nextForm: Record<string, { quantity: string; note: string; added: boolean }> = {};
        data.forEach((supply: any) => {
          nextForm[supply.id] = { quantity: '', note: '', added: false };
        });
        setForm(nextForm);
      })
      .catch((err) => {
        const message = err instanceof Error && err.message ? err.message : 'Não foi possível carregar os insumos.';
        setError(message);
      })
      .finally(() => setLoading(false));
  }, [slug, token]);

  const updateItem = (supplyId: string, field: 'quantity' | 'note', value: string) => {
    setForm((prev) => ({
      ...prev,
      [supplyId]: { ...prev[supplyId], [field]: value },
    }));
  };

  const confirmDateStep = () => {
    if (!movementDate) {
      setError('Selecione a data do consumo.');
      return;
    }
    setError('');
    setCurrentStep(0);
  };

  const confirmCurrentItem = (skip = false) => {
    const supply = currentSupply;
    if (!supply) return;

    const qty = Number(form[supply.id]?.quantity || 0);

    if (!skip && qty > 0) {
      setForm((prev) => ({
        ...prev,
        [supply.id]: { ...prev[supply.id], added: true },
      }));
    }

    setError('');

    // Move to next item or show summary
    if (currentStep < supplies.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      setShowSummary(true);
    }
  };

  const goBack = () => {
    if (showSummary) {
      setShowSummary(false);
      setCurrentStep(supplies.length - 1);
    } else if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    } else if (currentStep === 0) {
      setCurrentStep(-1);
    }
  };

  const removeItem = (supplyId: string) => {
    setForm((prev) => ({
      ...prev,
      [supplyId]: { quantity: '', note: '', added: false },
    }));
  };

  const handleSubmit = async () => {
    setSending(true);
    setError('');
    setSuccess('');

    const items = addedItems.map((supply) => ({
      supply: supply.id,
      quantity: Number(form[supply.id]?.quantity || 0),
      movement_date: movementDate,
      note: form[supply.id]?.note || '',
    }));

    if (!items.length) {
      setError('Adicione ao menos um item com quantidade.');
      setSending(false);
      return;
    }

    try {
      await submitPublicConsumption(slug, token, { items });
      setSuccess('Consumo registrado com sucesso!');
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : 'Não foi possível registrar o consumo.';
      setError(message);
    } finally {
      setSending(false);
    }
  };

  const resetForm = () => {
    setForm((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        next[key] = { quantity: '', note: '', added: false };
      });
      return next;
    });
    setSuccess('');
    setCurrentStep(-1);
    setShowSummary(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-accent-500 to-success-600 flex items-center justify-center p-4">
        <div className="text-center text-white">
          <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg font-medium">Carregando insumos...</p>
        </div>
      </div>
    );
  }

  if (error && !supplies.length) {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-accent-900 to-success-900 flex flex-col">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-xl border-b border-white/10 p-4 safe-top">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-white">inventory_2</span>
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-white font-bold">Registro de Consumo</h1>
              <p className="text-white/60 text-sm">Data: {movementDate}</p>
            </div>
            {addedItems.length > 0 && (
              <div className="px-3 py-1 rounded-full bg-success-500/30 text-success-300 text-sm font-medium">
                {addedItems.length} item{addedItems.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>

          {/* Progress bar */}
          <div className="relative h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-accent-400 to-success-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-white/60">
            <span>{addedItems.length} de {supplies.length} insumos registrados</span>
            <span>{progress}%</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          {/* Success State */}
          {success ? (
            <div className="bg-white rounded-3xl shadow-2xl p-8 text-center animate-scale-in">
              <div className="w-20 h-20 rounded-full bg-success-100 flex items-center justify-center mx-auto mb-6">
                <span className="material-symbols-outlined text-success-500 text-4xl">check_circle</span>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Consumo Registrado!</h2>
              <p className="text-slate-500 mb-6">{addedItems.length} item(ns) enviado(s) para a SEMED</p>

              <div className="space-y-2 mb-6">
                {addedItems.map((supply) => (
                  <div key={supply.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                    <span className="text-slate-700">{supply.name}</span>
                    <span className="font-bold text-slate-900">{form[supply.id]?.quantity} {supply.unit}</span>
                  </div>
                ))}
              </div>

              <button onClick={resetForm} className="btn-primary w-full">
                <span className="material-symbols-outlined">add</span>
                Novo Registro
              </button>
            </div>
          ) : isSummaryStep ? (
            /* Summary Step */
            <div className="bg-white rounded-3xl shadow-2xl overflow-hidden animate-fade-in">
              <div className="bg-gradient-to-r from-accent-500 to-success-500 p-6 text-white text-center">
                <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-3xl">checklist</span>
                </div>
                <h2 className="text-xl font-bold">Resumo do Consumo</h2>
                <p className="text-white/80 text-sm mt-1">Confira os itens antes de enviar</p>
              </div>

              <div className="p-6 space-y-4">
                {/* Date */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-100">
                  <span className="text-slate-600">Data</span>
                  <span className="font-bold text-slate-900">{movementDate}</span>
                </div>

                {/* Items */}
                {addedItems.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-700">Itens a registrar:</p>
                    {addedItems.map((supply) => (
                      <div key={supply.id} className="flex items-center justify-between p-3 rounded-xl bg-success-50">
                        <div className="flex-1">
                          <p className="font-medium text-slate-900">{supply.name}</p>
                          {form[supply.id]?.note && (
                            <p className="text-xs text-slate-500">{form[supply.id].note}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-success-600">{form[supply.id]?.quantity} {supply.unit}</span>
                          <button onClick={() => removeItem(supply.id)} className="text-danger-500">
                            <span className="material-symbols-outlined text-lg">close</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">inventory_2</span>
                    <p className="text-slate-500">Nenhum item adicionado</p>
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
                  <button onClick={goBack} className="btn-secondary flex-1">
                    <span className="material-symbols-outlined">arrow_back</span>
                    Voltar
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={sending || addedItems.length === 0}
                    className="btn flex-1 bg-gradient-to-r from-success-500 to-success-600 text-white shadow-lg shadow-success-500/30 disabled:opacity-50"
                  >
                    {sending ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Enviando...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined">send</span>
                        Enviar
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : isDateStep ? (
            /* Date Step */
            <div className="bg-white rounded-3xl shadow-2xl overflow-hidden animate-fade-in">
              <div className="bg-gradient-to-r from-accent-500 to-success-500 p-6 text-white text-center">
                <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-3xl">calendar_today</span>
                </div>
                <h2 className="text-xl font-bold">Data do Consumo</h2>
                <p className="text-white/80 text-sm mt-1">Quando os materiais foram utilizados?</p>
              </div>

              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Selecione a data</label>
                  <input
                    type="date"
                    value={movementDate}
                    onChange={(e) => setMovementDate(e.target.value)}
                    className="input text-center text-lg py-4"
                  />
                </div>

                {error && (
                  <div className="p-3 rounded-xl bg-danger-50 text-danger-600 text-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg">error</span>
                    {error}
                  </div>
                )}

                <button
                  onClick={confirmDateStep}
                  className="btn-primary w-full h-14 text-base shadow-lg shadow-primary-500/30"
                >
                  <span className="material-symbols-outlined">arrow_forward</span>
                  Começar Registro
                </button>
              </div>
            </div>
          ) : currentSupply ? (
            /* Supply Card */
            <div className="bg-white rounded-3xl shadow-2xl overflow-hidden animate-fade-in" key={currentSupply.id}>
              <div className="bg-gradient-to-r from-accent-500 to-success-500 p-6 text-white">
                <div className="flex items-center justify-between mb-4">
                  <span className="px-3 py-1 rounded-full bg-white/20 text-sm font-medium">
                    {currentStep + 1} de {supplies.length}
                  </span>
                  {form[currentSupply.id]?.added && (
                    <span className="material-symbols-outlined text-success-300">check_circle</span>
                  )}
                </div>
                <h2 className="text-2xl font-bold">{currentSupply.name}</h2>
                <p className="text-white/80 text-sm mt-1">Unidade: {currentSupply.unit}</p>
              </div>

              <div className="p-6 space-y-4">
                {/* Quantity Input */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Quantidade consumida</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form[currentSupply.id]?.quantity || ''}
                      onChange={(e) => updateItem(currentSupply.id, 'quantity', e.target.value)}
                      className="input text-2xl font-bold text-center py-4"
                      placeholder="0"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">{currentSupply.unit}</span>
                  </div>
                </div>

                {/* Note Input (optional) */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Observação (opcional)</label>
                  <input
                    value={form[currentSupply.id]?.note || ''}
                    onChange={(e) => updateItem(currentSupply.id, 'note', e.target.value)}
                    className="input"
                    placeholder="Ex: Preparação de merenda especial"
                  />
                </div>

                {error && (
                  <div className="p-3 rounded-xl bg-danger-50 text-danger-600 text-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg">error</span>
                    {error}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button onClick={goBack} className="btn-secondary">
                    <span className="material-symbols-outlined">arrow_back</span>
                  </button>
                  <button
                    onClick={() => confirmCurrentItem(true)}
                    className="btn-ghost flex-1"
                  >
                    Pular
                  </button>
                  <button
                    onClick={() => confirmCurrentItem(false)}
                    disabled={!form[currentSupply.id]?.quantity || Number(form[currentSupply.id]?.quantity) <= 0}
                    className="btn-primary flex-1 shadow-lg shadow-primary-500/30 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined">add</span>
                    Adicionar
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {/* Step Indicators */}
          {!success && (
            <div className="flex justify-center gap-2 mt-6 flex-wrap">
              {/* Date indicator */}
              <div className={`w-3 h-3 rounded-full transition-all ${isDateStep ? 'w-8 bg-white' : 'bg-white/50'}`} />
              {/* Supply indicators */}
              {supplies.map((supply, index) => (
                <div
                  key={supply.id}
                  className={`w-3 h-3 rounded-full transition-all ${index === currentStep && !isSummaryStep
                      ? 'w-8 bg-white'
                      : form[supply.id]?.added
                        ? 'bg-success-400'
                        : index < currentStep
                          ? 'bg-white/50'
                          : 'bg-white/30'
                    }`}
                />
              ))}
              {/* Summary indicator */}
              <div className={`w-3 h-3 rounded-full transition-all ${isSummaryStep ? 'w-8 bg-white' : 'bg-white/30'}`} />
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white/5 backdrop-blur-xl border-t border-white/10 p-4 text-center">
        <p className="text-white/40 text-xs">Merenda SEMED • Registro de Consumo</p>
      </footer>
    </div>
  );
};

export default PublicConsumption;
