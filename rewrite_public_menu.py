# -*- coding: utf-8 -*-
import io

with io.open('pages/PublicMenu.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Import getPublicRecipe
content = content.replace(
    u"from '../api';",
    u"from '../api';\nimport { getPublicRecipe } from '../api';"
)

# 2. Add state for recipe modal
content = content.replace(
    u"  const [touchStartX, setTouchStartX] = useState<number | null>(null);",
    u"  const [touchStartX, setTouchStartX] = useState<number | null>(null);\n  const [viewingRecipeId, setViewingRecipeId] = useState<string | null>(null);\n  const [recipeData, setRecipeData] = useState<any>(null);\n  const [loadingRecipe, setLoadingRecipe] = useState(false);\n  const [recipeStep, setRecipeStep] = useState(1);"
)

# 3. Add function to open recipe
open_recipe_func = u"""
  const handleViewRecipe = async (recipeId: string) => {
    setViewingRecipeId(recipeId);
    setLoadingRecipe(true);
    setRecipeStep(1);
    try {
      const data = await getPublicRecipe(recipeId);
      setRecipeData(data);
    } catch {
      // ignore
    } finally {
      setLoadingRecipe(false);
    }
  };
"""
content = content.replace(
    u"  const goBack = () => {",
    open_recipe_func + u"\n  const goBack = () => {"
)

# 4. Include recipe in meals push
content = content.replace(
    u"        description: item.description || '',\n        image: item.image_data || item.image_url || '',\n      });",
    u"        description: item.description || '',\n        image: item.image_data || item.image_url || '',\n        recipe: item.recipe || null,\n        recipeName: item.recipe_name || '',\n      });"
)

# 5. Modify currentMealsByType to hold objects
content = content.replace(
    u"const grouped: Record<string, { key: string; label: string; icon: string; items: string[] }> = {};",
    u"const grouped: Record<string, { key: string; label: string; icon: string; items: Array<{text: string, recipe: string | null, recipeName: string}> }> = {};"
)

content = content.replace(
    u"      const text = [meal.mealName, meal.description].filter(Boolean).join(' - ') || meal.description || meal.mealName || 'Item sem descrição';\n      grouped[key].items.push(meal.portionText ? `${text} (${meal.portionText})` : text);",
    u"      const text = [meal.mealName, meal.description].filter(Boolean).join(' - ') || meal.description || meal.mealName || 'Item sem descrição';\n      grouped[key].items.push({\n        text: meal.portionText ? `${text} (${meal.portionText})` : text,\n        recipe: meal.recipe,\n        recipeName: meal.recipeName\n      });"
)

# 6. Render recipe button on the menu items
content = content.replace(
    u"""                        <li key={`${mealSection.key}-${idx}`} className="flex items-start gap-3">
                          <span className="material-symbols-outlined text-slate-400 text-sm mt-1">fiber_manual_record</span>
                          <p className="text-slate-700 dark:text-slate-300">{desc}</p>
                        </li>""",
    u"""                        <li key={`${mealSection.key}-${idx}`} className="flex items-start gap-3 justify-between">
                          <div className="flex items-start gap-3">
                            <span className="material-symbols-outlined text-slate-400 text-sm mt-1">fiber_manual_record</span>
                            <p className="text-slate-700 dark:text-slate-300">{desc.text}</p>
                          </div>
                          {desc.recipe && (
                            <button 
                              onClick={() => handleViewRecipe(desc.recipe as string)}
                              className="shrink-0 flex items-center gap-1.5 px-3 py-1 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold rounded-full transition-colors"
                              title={`Ver receita: ${desc.recipeName}`}
                            >
                              <span className="material-symbols-outlined text-[14px]">menu_book</span>
                              Ver Receita
                            </button>
                          )}
                        </li>"""
)

# 7. Add Recipe Modal UI
recipe_modal_ui = u"""
      {/* Recipe Modal */}
      {viewingRecipeId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200 relative my-auto">
            
            <div className="flex items-center justify-between p-4 md:p-6 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">menu_book</span>
                Cartão de Receita
              </h2>
              <button onClick={() => setViewingRecipeId(null)} className="w-10 h-10 flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-xl transition-colors shrink-0">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              {loadingRecipe ? (
                 <div className="flex justify-center p-10"><div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin"></div></div>
              ) : !recipeData ? (
                 <div className="text-center p-10 text-slate-500">Falha ao carregar a receita.</div>
              ) : (
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">{recipeData.name}</h3>
                    {recipeData.category && <span className="text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">{recipeData.category}</span>}
                  </div>

                  <div className="flex flex-col gap-4">
                    {/* Render Step by Step Instructions if available inside instruction parsed via newlines maybe? Or from backend text */}
                    
                    {recipeData.instructions ? (
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
                    )}
                    
                    {recipeData.ingredients && recipeData.ingredients.length > 0 && (
                      <div className="mt-6 border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden">
                        <div className="bg-slate-50 dark:bg-slate-800 px-4 py-3 font-bold text-slate-700 dark:text-slate-200 text-sm flex gap-2 items-center">
                          <span className="material-symbols-outlined text-lg">kitchen</span>
                          Ingredientes ({recipeData.servings_base} porções base)
                        </div>
                        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                          {recipeData.ingredients.map((ing: any, idx: number) => (
                            <li key={idx} className="px-4 py-2.5 text-sm flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                              <span className="text-slate-700 dark:text-slate-300">{ing.supply_name} {ing.optional ? '(Opcional)':''}</span>
                              <span className="font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-xs">{ing.qty_base} {ing.unit}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
"""

content = content.replace(
    u"      </div>\n    );\n  }\n\n  // Menu display",
    u"      </div>\n    );\n  }\n\n  // Menu display"
)

# Note: need to append modal right before closing div of // Menu display
idx = content.rfind(u"    </div>\n  );\n};\n\nexport default PublicMenu;")
if idx != -1:
    content = content[:idx] + recipe_modal_ui + content[idx:]

with io.open('pages/PublicMenu.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated PublicMenu.tsx")
