# -*- coding: utf-8 -*-
import io
import re

with io.open('pages/Deliveries.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Update the modal to be simpler:
old_modal_html = u"""            <div className="space-y-4">
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
              
              <div className="space-y-2 mt-4">"""

new_modal_html = u"""            <div className="space-y-4">
              <p className="text-sm text-slate-500 mb-2">Seus dados de nutricionista (Nome e CRN) serão registrados automaticamente com base na sua conta atual.</p>
              
              <div className="space-y-2 mt-4">"""

content = content.replace(old_modal_html, new_modal_html)

# And update handleSignDelivery:
old_handle_sign = u"""    if (!nutriName.trim()) {
      setError('Informe seu nome.');
      return;
    }
    setSigning(true);
    setError('');
    try {
      const { signDelivery } = await import('../api');
      const updated = await signDelivery(selectedDelivery.id, sigData, nutriName, nutriCrn, nutriRole);"""

new_handle_sign = u"""    setSigning(true);
    setError('');
    try {
      const { signDelivery } = await import('../api');
      const updated = await signDelivery(selectedDelivery.id, sigData, nutriName, nutriCrn, nutriRole);"""

content = content.replace(old_handle_sign, new_handle_sign)

with io.open('pages/Deliveries.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Simplified modal applied.")
