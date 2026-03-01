# -*- coding: utf-8 -*-
import io

with io.open('pages/MenuEditor.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. State for nutritional info
state_block = u"""  const [activeMeal, setActiveMeal] = useState<MealKey>('LUNCH');
  const [items, setItems] = useState<WeekContent>(createEmptyWeek());
  const [nutritionalInfo, setNutritionalInfo] = useState<Record<string, { kcal: string; protein: string; carbs: string }>>({});
"""
content = content.replace(
    u"  const [activeMeal, setActiveMeal] = useState<MealKey>('LUNCH');\n  const [items, setItems] = useState<WeekContent>(createEmptyWeek());\n",
    state_block
)

# 2. Reset nutritional info on empty/new menu
content = content.replace(
    u"          setMenuName('');\n          setNotes('');\n          setItems(createEmptyWeek());\n",
    u"          setMenuName('');\n          setNotes('');\n          setItems(createEmptyWeek());\n          setNutritionalInfo({});\n"
)

# 3. Load from menu data
content = content.replace(
    u"    setWeekStart(menu.week_start);\n    setWeekEnd(menu.week_end);\n    setNotes(menu.notes || '');\n",
    u"    setWeekStart(menu.week_start);\n    setWeekEnd(menu.week_end);\n    setNotes(menu.notes || '');\n    setNutritionalInfo(menu.nutritional_info || {});\n"
)

# 4. Save nutritional info in ensureMenu
content = content.replace(
    u"        week_end: weekEnd,\n        status: 'DRAFT',\n        notes,\n      });",
    u"        week_end: weekEnd,\n        status: 'DRAFT',\n        notes,\n        nutritional_info: nutritionalInfo,\n      });"
)

content = content.replace(
    u"      week_end: weekEnd,\n      status: 'DRAFT',\n      notes,\n    });",
    u"      week_end: weekEnd,\n      status: 'DRAFT',\n      notes,\n      nutritional_info: nutritionalInfo,\n    });"
)

# 5. UI for entering Kcal, Prot, Carbs
# In MenuEditor, there's a `<div className="p-5 space-y-5">` where meals are edited. At the bottom of `xl:col-span-8`, after the items iteration or below it.
# We will place the nutritional info editor at the bottom of the "week" overview, but wait, the active view is for the `activeMeal`. We want to edit nutritional info for the `activeDay`.
# Let's insert it below the meal content, or as a separate block in the active day's page.
# "xl:col-span-4" covers the meals sidebar. We can add a Nutritional Info block at the bottom of that sidebar, or at the bottom of the form where they edit the meal.
# The `activeDay` is currently selected, so putting a small box for Daily Nutritional Info makes sense.
ui_block = u"""
              <div className="mt-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">Informação Nutricional do Dia</h2>
                <div className="grid grid-cols-3 gap-3">
                  <label className="block">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase">Kcal</span>
                    <input 
                      value={nutritionalInfo[activeDay]?.kcal || ''} 
                      onChange={(e) => setNutritionalInfo(prev => ({ ...prev, [activeDay]: { ...prev[activeDay], kcal: e.target.value } }))}
                      className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 text-xs" placeholder="Ex: 500" 
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase">Prot (g)</span>
                    <input 
                      value={nutritionalInfo[activeDay]?.protein || ''} 
                      onChange={(e) => setNutritionalInfo(prev => ({ ...prev, [activeDay]: { ...prev[activeDay], protein: e.target.value } }))}
                      className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 text-xs" placeholder="Ex: 20" 
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase">Carbs (g)</span>
                    <input 
                      value={nutritionalInfo[activeDay]?.carbs || ''} 
                      onChange={(e) => setNutritionalInfo(prev => ({ ...prev, [activeDay]: { ...prev[activeDay], carbs: e.target.value } }))}
                      className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 text-xs" placeholder="Ex: 60" 
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="xl:col-span-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
"""
content = content.replace(
    u"            </div>\n\n            <div className=\"xl:col-span-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden\">",
    ui_block
)

with io.open('pages/MenuEditor.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated MenuEditor.tsx")
