# -*- coding: utf-8 -*-
import io

with io.open('pages/PublicMenu.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# `PublicMenu` currently displays:
old_info = u"""              <div className="bg-primary/5 dark:bg-primary/10 px-8 py-5 border-t border-slate-100 dark:border-slate-700">
                <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Informação Nutricional</h4>
                <div className="flex flex-wrap gap-3">
                  <div className="bg-white dark:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm flex items-center gap-2">
                    <span className="text-xs font-bold text-primary">Kcal</span>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">-</span>
                  </div>
                  <div className="bg-white dark:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm flex items-center gap-2">
                    <span className="text-xs font-bold text-primary">Prot</span>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">-</span>
                  </div>
                  <div className="bg-white dark:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm flex items-center gap-2">
                    <span className="text-xs font-bold text-primary">Carbs</span>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">-</span>
                  </div>
                </div>
              </div>"""

new_info = u"""              <div className="bg-primary/5 dark:bg-primary/10 px-8 py-5 border-t border-slate-100 dark:border-slate-700">
                <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Informação Nutricional</h4>
                <div className="flex flex-wrap gap-3">
                  <div className="bg-white dark:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm flex items-center gap-2">
                    <span className="text-xs font-bold text-primary">Kcal</span>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      {menu?.nutritional_info?.[currentDay?.dayCode]?.kcal || '-'}
                    </span>
                  </div>
                  <div className="bg-white dark:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm flex items-center gap-2">
                    <span className="text-xs font-bold text-primary">Prot</span>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      {menu?.nutritional_info?.[currentDay?.dayCode]?.protein ? `${menu.nutritional_info[currentDay.dayCode].protein}g` : '-'}
                    </span>
                  </div>
                  <div className="bg-white dark:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm flex items-center gap-2">
                    <span className="text-xs font-bold text-primary">Carbs</span>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      {menu?.nutritional_info?.[currentDay?.dayCode]?.carbs ? `${menu.nutritional_info[currentDay.dayCode].carbs}g` : '-'}
                    </span>
                  </div>
                </div>
              </div>"""

content = content.replace(old_info, new_info)

with io.open('pages/PublicMenu.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated PublicMenu.tsx")
