# -*- coding: utf-8 -*-
import io

with io.open('pages/PublicMenu.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add nutrition below the prep_steps in recipe data modal
old_block = u"""                    {(!recipeData.instructions && (!recipeData.tags?.prep_steps || recipeData.tags.prep_steps.length === 0)) && (
                      <div className="text-center py-6 text-slate-500 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-800">Nenhuma instrução cadastrada.</div>
                    )}"""

new_block = u"""                    {(!recipeData.instructions && (!recipeData.tags?.prep_steps || recipeData.tags.prep_steps.length === 0)) && (
                      <div className="text-center py-6 text-slate-500 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-800">Nenhuma instrução cadastrada.</div>
                    )}

                    {recipeData.tags?.nutrition && (recipeData.tags.nutrition.kcal || recipeData.tags.nutrition.protein || recipeData.tags.nutrition.carbs) && (
                      <div className="mt-4 border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden">
                        <div className="bg-slate-50 dark:bg-slate-800 px-4 py-3 font-bold text-slate-700 dark:text-slate-200 text-sm flex gap-2 items-center">
                          <span className="material-symbols-outlined text-lg">local_dining</span>
                          Informação Nutricional (por porção)
                        </div>
                        <div className="flex gap-4 p-4 bg-white dark:bg-slate-900 justify-around">
                          <div className="text-center">
                            <p className="text-[10px] uppercase font-bold text-slate-400">Energia</p>
                            <p className="text-lg font-black text-primary">{recipeData.tags.nutrition.kcal || '-'} <span className="text-sm font-medium">kcal</span></p>
                          </div>
                          <div className="text-center">
                            <p className="text-[10px] uppercase font-bold text-slate-400">Proteínas</p>
                            <p className="text-lg font-black text-primary">{recipeData.tags.nutrition.protein || '-'} <span className="text-sm font-medium">g</span></p>
                          </div>
                          <div className="text-center">
                            <p className="text-[10px] uppercase font-bold text-slate-400">Carboidratos</p>
                            <p className="text-lg font-black text-primary">{recipeData.tags.nutrition.carbs || '-'} <span className="text-sm font-medium">g</span></p>
                          </div>
                        </div>
                      </div>
                    )}"""

content = content.replace(old_block, new_block)

with io.open('pages/PublicMenu.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated PublicMenu.tsx recipe modal nutrition")
