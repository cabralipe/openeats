# -*- coding: utf-8 -*-
import io
import re

with io.open('pages/PublicMenu.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the specific instructions block inside the modal
old_block = u"""                    {recipeData.instructions ? (
                      <div className="space-y-4">
                        <h4 className="font-bold text-slate-700 dark:text-slate-200">Passo a Passo</h4>
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
                          {recipeData.instructions.split('\\n').filter((l:string) => l.trim()).map((stepText:string, index:number) => (
                            <div key={index} className="flex gap-4 items-start">
                              <div className="w-8 h-8 rounded-full bg-primary/20 text-primary font-bold text-sm flex items-center justify-center shrink-0 mt-0.5">
                                {index + 1}
                              </div>
                              <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm pt-1">
                                {stepText.trim()}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-6 text-slate-500 bg-slate-50 dark:bg-slate-800/30 rounded-xl">Nenhuma instrução cadastrada.</div>
                    )}"""

new_block = u"""                    {recipeData.instructions && (
                      <div className="space-y-3">
                        <h4 className="font-bold text-slate-700 dark:text-slate-200">Orientações Gerais</h4>
                        <p className="text-slate-600 dark:text-slate-300 text-sm whitespace-pre-wrap leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                          {recipeData.instructions}
                        </p>
                      </div>
                    )}

                    {recipeData.tags?.prep_steps && Array.isArray(recipeData.tags.prep_steps) && recipeData.tags.prep_steps.length > 0 && (
                      <div className="space-y-4 pt-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-slate-700 dark:text-slate-200">Modo de Preparo</h4>
                          {recipeData.tags?.prep_time_minutes && (
                            <span className="flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">
                              <span className="material-symbols-outlined text-[14px]">timer</span>
                              {recipeData.tags.prep_time_minutes} min
                            </span>
                          )}
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
                          {recipeData.tags.prep_steps.map((stepText: string, index: number) => (
                            <div key={index} className="flex gap-4 items-start">
                              <div className="w-8 h-8 rounded-full bg-primary/20 text-primary font-bold text-sm flex items-center justify-center shrink-0 mt-0.5">
                                {index + 1}
                              </div>
                              <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm pt-1">
                                {stepText}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {(!recipeData.instructions && (!recipeData.tags?.prep_steps || recipeData.tags.prep_steps.length === 0)) && (
                      <div className="text-center py-6 text-slate-500 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-800">Nenhuma instrução cadastrada.</div>
                    )}"""

content = content.replace(old_block, new_block)

with io.open('pages/PublicMenu.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated PublicMenu.tsx with correct prep steps rendering")
