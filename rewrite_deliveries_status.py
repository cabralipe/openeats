# -*- coding: utf-8 -*-
import io

with io.open('pages/Deliveries.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1) Add FINALIZED to getStatusLabel
old_status_label = u"""  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'Rascunho';
      case 'SENT': return 'Enviada';
      case 'CONFERRED': return 'Conferida';
      default: return status;
    }
  };"""

new_status_label = u"""  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'Rascunho';
      case 'SENT': return 'Enviada';
      case 'CONFERRED': return 'Conferida';
      case 'FINALIZED': return 'Finalizada';
      default: return status;
    }
  };"""
content = content.replace(old_status_label, new_status_label)

# 2) Add FINALIZED to getStatusClasses
old_status_classes = u"""      case 'CONFERRED':
        return {
          stripe: 'bg-emerald-500',
          chip: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
        };
      default:"""

new_status_classes = u"""      case 'CONFERRED':
        return {
          stripe: 'bg-emerald-500',
          chip: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
        };
      case 'FINALIZED':
        return {
          stripe: 'bg-violet-500',
          chip: 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400',
        };
      default:"""
content = content.replace(old_status_classes, new_status_classes)

# 3) Add FINALIZED to filter buttons
old_filter = u"{['', 'DRAFT', 'SENT', 'CONFERRED'].map((status) => ("
new_filter = u"{['', 'DRAFT', 'SENT', 'CONFERRED', 'FINALIZED'].map((status) => ("
content = content.replace(old_filter, new_filter)

# 4) Add FINALIZED to statusChip definition
old_status_chip = u"""    const statusChip = delivery.status === 'CONFERRED'
      ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800'
      : delivery.status === 'SENT'"""

new_status_chip = u"""    const statusChip = delivery.status === 'FINALIZED'
      ? 'bg-violet-50 text-violet-600 border-violet-200 dark:bg-violet-900/20 dark:text-violet-400 dark:border-violet-800'
      : delivery.status === 'CONFERRED'
      ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800'
      : delivery.status === 'SENT'"""
content = content.replace(old_status_chip, new_status_chip)


with io.open('pages/Deliveries.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Status labels and tabs updated.")
