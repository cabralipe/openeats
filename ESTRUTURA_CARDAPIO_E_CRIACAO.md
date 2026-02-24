# Estrutura do Cardápio e Fluxo de Criação

Este documento descreve como o cardápio funciona na plataforma (`backend` + `frontend`), quais campos existem, como ele é criado/publicado e como é consumido pelas telas públicas.

## 1. Visão geral (conceito)

O cardápio é organizado por:

- `Escola`
- `Semana` (`week_start` até `week_end`)
- `Status` (`DRAFT` ou `PUBLISHED`)
- `Itens do cardápio` por:
  - dia da semana (`MON` a `FRI`)
  - tipo de refeição (ex.: desjejum, almoço, lanche)

Estrutura lógica:

1. Criar/atualizar o registro principal do cardápio (`Menu`)
2. Salvar os itens em lote (`MenuItem`) para a semana
3. Publicar (`publish`) quando estiver pronto
4. Exibir no público / exportar PDF / exportar CSV

## 2. Modelos de dados (Backend)

### 2.1 `Menu` (cabeçalho do cardápio semanal)

Arquivo: `backend/menus/models.py`

Campos principais:

- `id`: UUID
- `school`: escola vinculada
- `name`: nome do cardápio (opcional)
- `week_start`: início da semana
- `week_end`: fim da semana
- `status`: `DRAFT` | `PUBLISHED`
- `notes`: observações gerais da semana
- `author_name`: nome da nutricionista/autora
- `author_crn`: CRN da nutricionista
- `created_by`: usuário que criou
- `published_at`: data/hora de publicação
- `created_at` / `updated_at`

Regra importante:

- Existe restrição única por `school + week_start`
  - um cardápio por escola por semana

### 2.2 `MenuItem` (itens da semana)

Arquivo: `backend/menus/models.py`

Campos principais:

- `id`: UUID
- `menu`: referência ao `Menu`
- `day_of_week`: `MON`, `TUE`, `WED`, `THU`, `FRI`
- `meal_type`: tipo da refeição
- `meal_name`: nome da refeição
- `portion_text`: porção (texto livre)
- `image_url`: URL de imagem
- `image_data`: imagem em base64 (upload local)
- `description`: descrição/ingredientes/preparo (texto)
- `created_at`

Tipos de refeição suportados (atuais):

- `BREAKFAST1` (Desjejum)
- `SNACK1` (Lanche manhã)
- `LUNCH` (Almoço)
- `BREAKFAST2` (Desjejum 2)
- `SNACK2` (Lanche tarde)
- `DINNER_COFFEE` (Café da noite)

Legado ainda aceito:

- `BREAKFAST`
- `SNACK`

## 3. Serialização / formato retornado pela API

Arquivos:

- `backend/menus/serializers.py`

### 3.1 `MenuSerializer`

Retorna:

- dados do `Menu`
- `school_name` (somente leitura)
- `items` (lista de `MenuItem`)

Campos expostos:

- `id`, `school`, `school_name`
- `name`, `week_start`, `week_end`
- `status`, `notes`
- `author_name`, `author_crn`
- `created_by`, `published_at`, `created_at`, `updated_at`
- `items`

### 3.2 `MenuItemSerializer`

Cada item expõe:

- `id`
- `day_of_week`
- `meal_type`
- `meal_name`
- `portion_text`
- `image_url`
- `image_data`
- `description`
- `created_at`

## 4. Fluxo de criação no Frontend (Editor de Cardápio)

Arquivo: `pages/MenuEditor.tsx`

O editor é um wizard em 3 etapas:

1. `Identificação`
2. `Composição`
3. `Revisão`

### 4.1 Etapa 1: Identificação

Campos preenchidos:

- escola (`selectedSchool`)
- nome do cardápio (`menuName`)
- semana (`weekStart` / `weekEnd`)
- observações (`notes`)

Regras:

- ao escolher uma data, o sistema ajusta automaticamente para:
  - segunda-feira (`week_start`)
  - sexta-feira (`week_end`)

Também nesta etapa:

- busca cardápios existentes (biblioteca)
- carrega cardápio existente para edição
- exporta CSV/PDF

### 4.2 Etapa 2: Composição

Estrutura interna do editor:

- dias fixos: `MON..FRI`
- slots de refeição fixos por dia

Conteúdo de cada slot:

- `meal_name`
- `portion_text`
- `image_url`
- `image_data`
- `description`

Observações:

- o editor mantém uma matriz semanal em memória (`WeekContent`)
- somente slots preenchidos são enviados para a API
- há apoio visual com “ingredientes rápidos” baseado no estoque

### 4.3 Etapa 3: Revisão

Resumo antes de salvar/publicar, com:

- progresso de preenchimento
- dados da escola e semana
- status do cardápio

## 5. Fluxo técnico de salvar (rascunho)

Ao salvar no editor:

1. Garante que exista um `Menu` (`ensureMenu`)
   - se já existe: `updateMenu(...)`
   - se não existe: `createMenu(...)`
2. Monta os itens preenchidos (`buildPayloadItems`)
3. Envia em lote para `POST /api/menus/{id}/items/bulk/`
   - a API apaga os itens antigos do menu
   - recria todos os itens recebidos

Isso significa:

- o salvamento dos itens é do tipo “substituição completa” do conteúdo semanal

## 6. Fluxo técnico de publicação

Ao publicar:

1. Garante/salva o `Menu` em `DRAFT`
2. Salva os itens em lote
3. Atualiza autoria (`author_name`, `author_crn`)
4. Chama ação de publicação:
   - `POST /api/menus/{id}/publish/`
5. Backend define:
   - `status = PUBLISHED`
   - `published_at = now`

Após publicar no frontend:

- há modal para selecionar/cadastrar nutricionista (salvo em `localStorage`)
- a tela tenta redirecionar para a visualização pública do cardápio

## 7. Endpoints principais (Cardápio)

Arquivo: `backend/menus/views.py`

### CRUD de cardápios

- `GET /api/menus/`
- `POST /api/menus/`
- `GET /api/menus/{id}/`
- `PATCH /api/menus/{id}/`
- `DELETE /api/menus/{id}/`

Filtros suportados em `GET /api/menus/`:

- `school`
- `week_start`
- `week_end`
- `date_from`
- `date_to`
- `status`

### Ações customizadas

- `POST /api/menus/{id}/items/bulk/`
  - substitui todos os itens do menu
- `POST /api/menus/{id}/publish/`
  - publica o cardápio
- `POST /api/menus/{id}/copy/`
  - copia cardápio para uma ou mais escolas (novo menu em `DRAFT`)

### Exportações

- `GET /api/exports/menus/` (CSV)
- `GET /api/exports/menus/pdf/?school={id}&week_start={yyyy-mm-dd}` (PDF)

## 8. Exemplo de payloads

### 8.1 Criar cardápio (cabeçalho)

```json
{
  "school": "UUID_DA_ESCOLA",
  "name": "Cardapio Semana 1",
  "week_start": "2026-02-23",
  "week_end": "2026-02-27",
  "status": "DRAFT",
  "notes": "Observacoes gerais da semana."
}
```

### 8.2 Salvar itens em lote

```json
{
  "items": [
    {
      "day_of_week": "MON",
      "meal_type": "BREAKFAST1",
      "meal_name": "Desjejum",
      "portion_text": "1 copo + 1 unidade",
      "image_url": "",
      "image_data": "",
      "description": "Leite integral, biscoito integral"
    },
    {
      "day_of_week": "MON",
      "meal_type": "LUNCH",
      "meal_name": "Almoco",
      "portion_text": "250g",
      "image_url": "",
      "image_data": "",
      "description": "Arroz, feijao, frango, cenoura"
    }
  ]
}
```

### 8.3 Publicar

```json
POST /api/menus/{menu_id}/publish/
```

### 8.4 Copiar para outras escolas

```json
{
  "target_schools": ["UUID_ESCOLA_1", "UUID_ESCOLA_2"]
}
```

## 9. Consumo público do cardápio

O cardápio publicado é consumido pelas rotas públicas (sem fluxo de edição), incluindo:

- cardápio atual por escola
- cardápio por semana
- PDF público

Rotas públicas (backend):

- `/public/schools/<slug>/menu/current/`
- `/public/schools/<slug>/menu/`
- `/public/schools/<slug>/menu/pdf/`

## 10. Regras e pontos de atenção

- Um cardápio por escola/semana (`school + week_start`)
- Publicar não recria itens; apenas altera status/data de publicação
- `items/bulk` substitui todos os itens existentes do menu
- Editor trata tipos legados `BREAKFAST`/`SNACK` ao carregar menus antigos
- `week_end` é derivado no frontend para sexta-feira
- `author_name` e `author_crn` são importantes para rastreabilidade da publicação

## 11. Arquivos de referência no projeto

- `backend/menus/models.py`
- `backend/menus/serializers.py`
- `backend/menus/views.py`
- `pages/MenuEditor.tsx`
- `api.ts`

