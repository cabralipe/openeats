# Calculadora de Produção (Receitas + Cardápio)

## 1) Criar receitas

Endpoint:

- `POST /api/recipes/`

Exemplo:

```json
{
  "name": "Arroz cozido",
  "category": "Almoco",
  "servings_base": 100,
  "instructions": "Cozinhar normalmente.",
  "ingredients": [
    {
      "supply": "UUID_DO_ARROZ",
      "qty_base": "5.00",
      "unit": "kg",
      "optional": false,
      "notes": ""
    }
  ]
}
```

## 2) Vincular receita em item do cardápio

No `Editor de Cardápio` (`/admin/editor`):

- selecione o slot (dia + refeição)
- escolha uma opção no campo `Receita vinculada (opcional)`
- ao salvar/publicar, o item será enviado com:
  - `recipe`
  - `calc_mode = "RECIPE"`

Sem receita, o sistema mantém `FREE_TEXT` (compatível com menus antigos).

## 3) Configurar aliases e regras (fallback)

### Aliases de insumo (texto -> Supply)

- `POST /api/production/aliases/`

Exemplo:

```json
{
  "supply": "UUID_DO_ARROZ",
  "alias": "arroz"
}
```

### Regras de consumo por aluno

- `POST /api/production/rules/`

Exemplo:

```json
{
  "school": "UUID_DA_ESCOLA",
  "supply": "UUID_DO_ARROZ",
  "meal_type": "LUNCH",
  "qty_per_student": "0.0500",
  "unit": "kg",
  "active": true,
  "notes": "50g por aluno no almoço"
}
```

## 4) Cálculo interno (gestão)

Endpoint:

- `POST /api/menus/{menu_id}/production/calculate/`

Exemplo `curl`:

```bash
curl -X POST "https://SEU_HOST/api/menus/MENU_ID/production/calculate/" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "students_by_meal_type": {
      "DEFAULT": 300,
      "LUNCH": 350
    },
    "waste_percent": 5,
    "include_stock": true
  }'
```

Tela interna:

- `/admin/production-calculator`

## 5) Token público da calculadora

Crie um link/token:

- `POST /api/production/public-links/`

Exemplo:

```json
{
  "school": "UUID_DA_ESCOLA",
  "allowed_scope": "MENU_WEEK",
  "is_active": true
}
```

Resposta incluirá `token`.

## 6) Endpoints públicos (sem login)

### Meta

- `GET /public/calculator/{token}/meta/`

### Calcular menu publicado

- `POST /public/calculator/{token}/calculate/`

Exemplo `curl`:

```bash
curl -X POST "https://SEU_HOST/public/calculator/TOKEN_UUID/calculate/" \
  -H "Content-Type: application/json" \
  -d '{
    "week_start": "2026-02-23",
    "students_by_meal_type": {
      "DEFAULT": 280,
      "LUNCH": 320
    },
    "waste_percent": 5,
    "include_stock": true
  }'
```

Tela pública (frontend):

- `/#/public/calculator/{token}`

