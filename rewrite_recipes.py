# -*- coding: utf-8 -*-
import io

with io.open('pages/Recipes.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update form interfaces
content = content.replace(
    u"tagsText: string;\n  imageUrl: string;",
    u"tagsText: string;\n  imageUrl: string;\n  kcal: string;\n  protein: string;\n  carbs: string;"
)

content = content.replace(
    u"tagsText: '',\n  imageUrl: '',",
    u"tagsText: '',\n  imageUrl: '',\n  kcal: '',\n  protein: '',\n  carbs: '',"
)

# 2. Update normalize function
content = content.replace(
    u"    tagsText: recipe.tags?.labels ? recipe.tags.labels.join(', ') : '',\n    imageUrl: recipe.tags?.image_url || '',",
    u"    tagsText: recipe.tags?.labels ? recipe.tags.labels.join(', ') : '',\n    imageUrl: recipe.tags?.image_url || '',\n    kcal: recipe.tags?.nutrition?.kcal || '',\n    protein: recipe.tags?.nutrition?.protein || '',\n    carbs: recipe.tags?.nutrition?.carbs || '',"
)

# 3. Update save payload
save_mod = u"""    if (form.imageUrl.trim()) {
      parsedTags.image_url = form.imageUrl.trim();
    }
    
    // Add nutrition info
    if (form.kcal || form.protein || form.carbs) {
      parsedTags.nutrition = {
        kcal: form.kcal.trim(),
        protein: form.protein.trim(),
        carbs: form.carbs.trim()
      };
    }"""
content = content.replace(
    u"    if (form.imageUrl.trim()) {\n      parsedTags.image_url = form.imageUrl.trim();\n    }",
    save_mod
)

# 4. Add UI in Step 4 for Nutritional Info
ui_mod = u"""                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">5. Informação Nutricional (porção)</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <label className="block">
                      <span className="text-xs font-semibold text-slate-500">Kcal</span>
                      <input value={form.kcal} onChange={(e) => setForm({ ...form, kcal: e.target.value })} className="mt-1 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none" placeholder="Ex: 250" />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-slate-500">Prot (g)</span>
                      <input value={form.protein} onChange={(e) => setForm({ ...form, protein: e.target.value })} className="mt-1 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none" placeholder="Ex: 15" />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-slate-500">Carbs (g)</span>
                      <input value={form.carbs} onChange={(e) => setForm({ ...form, carbs: e.target.value })} className="mt-1 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none" placeholder="Ex: 30" />
                    </label>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">"""
content = content.replace(
    u"                <div>\n                  <h3 className=\"text-sm font-bold text-slate-800 dark:text-slate-200 mb-3\">5. Tags (Opcional)</h3>",
    ui_mod
)
content = content.replace(
    u"5. Tags (Opcional)</h3>",
    u"6. Tags (Opcional)</h3>"
)

# Fix possible issue if "5. Informação" got appended before "5. Imagem"
# Let's check where the replacement occurred. Replacing EXACTLY where `5. Tags` is.
# Wait, let's fix the index numbers in the UI.
# The original code has:
# 1. Identificacao
# 2. Composicao
# 3. Execucao
# 4. Finalizacao - Inside Finalizacao we have "4. Foto (Opcional)" and "5. Tags".
# So "5. Tags" becomes "6. Tags" and new block is "5. Info Nutri". This is correct.

with io.open('pages/Recipes.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated Recipes.tsx")
