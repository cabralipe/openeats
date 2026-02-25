# Estrutura de Produtos, Entregas e Estoque (Geral e das Escolas)

Este documento descreve como o sistema organiza:

- produtos/insumos
- estoque geral (SEMED/central)
- estoque por escola
- recebimentos de fornecedores
- entregas para escolas
- conferência de entregas
- consumo nas escolas
- como os movimentos afetam os saldos

Observação: no sistema, "produto" é tratado principalmente como **insumo** (`Supply`).

## 1. Visão Geral do Fluxo

Fluxo principal de operação:

1. Cadastro de insumos (`Supply`)
2. Recebimento de fornecedor (`SupplierReceipt`)
3. Conferência do recebimento
4. Entrada em estoque:
   - estoque geral (`StockBalance`) ou
   - estoque da escola (`SchoolStockBalance`) se o recebimento for vinculado à escola
5. Criação de entrega para escola (`Delivery`)
6. Envio da entrega:
   - baixa do estoque geral
7. Conferência pública da entrega pela escola
8. Entrada no estoque da escola + ajustes no estoque geral (se houver divergência)
9. Consumo público da escola:
   - baixa no estoque da escola
10. Cálculo de produção:
   - usa cardápio + receitas + saldo da escola (opcional)

## 2. Entidades Principais (Dados)

## 2.1 Insumos / Produtos (`Supply`)

Representa cada item de estoque do sistema.

Campos principais:

- `id`
- `name` (nome do insumo)
- `category`
- `unit` (`kg`, `g`, `l`, `ml`, `unit`)
- `nova_classification`
- `nutritional_function`
- `min_stock` (mínimo global de referência)
- `is_active`

Resumo:

- É a base de tudo: recebimentos, entregas, consumo, receitas e cálculo de produção.

## 2.2 Estoque Geral (`StockBalance`)

Saldo central por insumo (SEMED / almoxarifado central).

Estrutura:

- 1 registro por `Supply` (`OneToOne`)
- campo `quantity`

Uso:

- recebe entradas de fornecedor **quando o recebimento não está vinculado a escola**
- sofre baixa ao enviar entrega para escola
- recebe ajustes após conferência de entrega (faltas/excessos)

## 2.3 Estoque por Escola (`SchoolStockBalance`)

Saldo por escola e por insumo.

Estrutura:

- `school`
- `supply`
- `quantity`
- `min_stock` (mínimo específico da escola)
- `last_updated`

Regra importante:

- existe restrição única por `(school, supply)`

Uso:

- entrada via conferência de entrega
- entrada via recebimento de fornecedor vinculado à escola
- saída via consumo público da escola
- usado na calculadora de produção (quando `include_stock=true`)

## 2.4 Movimentações (`StockMovement`)

Log/auditoria de movimentações de estoque.

Campos principais:

- `supply`
- `school` (opcional)
- `type` (`IN` / `OUT`)
- `quantity`
- `movement_date`
- `note`
- `created_by`

Papel:

- registra historicamente entradas e saídas
- pode representar movimento geral ou movimento associado a uma escola

## 2.5 Fornecedores (`Supplier`)

Cadastro de fornecedores.

Campos:

- `name`
- `document`
- `contact_name`
- `phone`
- `email`
- `address`
- `is_active`

## 2.6 Recebimento de Fornecedor (`SupplierReceipt`)

Documento/processo de recebimento de itens de fornecedor.

Campos principais:

- `supplier`
- `school` (opcional)
- `expected_date`
- `status` (`DRAFT`, `EXPECTED`, `IN_CONFERENCE`, `CONFERRED`, `CANCELLED`)
- assinaturas (`sender` / `receiver`)
- timestamps de conferência

Interpretação do campo `school`:

- `school = null`: entrada vai para **estoque geral**
- `school != null`: entrada vai para **estoque da escola**

### Itens do recebimento (`SupplierReceiptItem`)

Campos principais:

- `receipt`
- `supply` (opcional)
- `raw_name` (quando ainda não mapeado)
- `category`
- `unit`
- `expected_quantity`
- `received_quantity`
- `divergence_note`
- `supply_created` (insumo criado automaticamente na conferência)

Comportamento importante:

- se item não estiver vinculado a `supply`, o sistema pode criar automaticamente um novo `Supply` na conferência (se houver `raw_name`, `category`, `unit`)

## 2.7 Entregas para Escola (`Delivery`)

Representa uma remessa enviada da central para uma escola.

Campos principais:

- `school`
- `delivery_date`
- `status` (`DRAFT`, `SENT`, `CONFERRED`)
- `conference_enabled`
- `sent_at`
- `conference_submitted_at`
- assinaturas de envio/recebimento

### Itens da entrega (`DeliveryItem`)

Campos principais:

- `delivery`
- `supply`
- `planned_quantity`
- `received_quantity`
- `divergence_note`

Regras:

- um mesmo insumo não pode se repetir na mesma entrega (`unique_supply_per_delivery`)

## 2.8 Notificações (`Notification`)

Usadas para eventos operacionais (principalmente entregas e alertas).

Tipos observados:

- `DELIVERY_CONFERRED`
- `DELIVERY_WITH_NOTE`
- `DELIVERY_DIVERGENCE` (também reaproveitado para alerta de estoque baixo)

## 3. Como o Estoque Funciona (Regras de Negócio)

## 3.1 Regra geral de saldos

O sistema mantém **dois níveis de saldo**:

- **Estoque geral** (`StockBalance`): saldo central
- **Estoque da escola** (`SchoolStockBalance`): saldo local na unidade escolar

Eles não são automaticamente sincronizados por soma. Cada um é atualizado por fluxos específicos.

## 3.2 Entrada por recebimento de fornecedor (conferência)

Ao concluir a conferência de `SupplierReceipt`:

1. cada item recebe `received_quantity`
2. se necessário, cria `Supply` automaticamente
3. atualiza saldo:
   - com `receipt.school`: soma no `SchoolStockBalance`
   - sem `receipt.school`: soma no `StockBalance`
4. cria `StockMovement` tipo `IN`
5. marca o recebimento como `CONFERRED`

## 3.3 Envio de entrega para escola (`Delivery.send`)

Ao enviar uma entrega:

1. valida que está em `DRAFT`
2. valida que existem itens
3. verifica saldo suficiente no **estoque geral**
4. baixa `planned_quantity` do `StockBalance`
5. cria `StockMovement` tipo `OUT` (associado à escola)
6. marca entrega como `SENT`
7. habilita conferência pública (`conference_enabled=true`)

Importante:

- nesse momento o estoque da escola **ainda não** aumenta
- a entrada na escola acontece somente após a conferência

## 3.4 Conferência pública da entrega (escola)

Na conferência pública da entrega:

1. usuário da escola informa quantidades recebidas + observações
2. sistema grava `received_quantity` em cada `DeliveryItem`
3. soma `received_quantity` no `SchoolStockBalance`
4. cria `StockMovement` tipo `IN` para a escola
5. ajusta estoque geral conforme divergência entre `planned_quantity` e `received_quantity`

Ajuste do estoque geral:

- se recebeu **menos** do que o planejado:
  - devolve a diferença para o estoque geral (`IN`)
- se recebeu **mais** do que o planejado:
  - retira a diferença do estoque geral (`OUT`)

Depois:

- entrega vira `CONFERRED`
- assinaturas são armazenadas
- notificações são geradas

## 3.5 Consumo público da escola

No registro de consumo:

1. a escola seleciona insumos com saldo
2. informa quantidades consumidas
3. sistema valida saldo suficiente em `SchoolStockBalance`
4. baixa o saldo da escola
5. cria `StockMovement` tipo `OUT`
6. se ficar abaixo do mínimo (escola ou global), cria notificação de alerta

Prioridade de mínimo para alerta:

1. `SchoolStockBalance.min_stock` (se > 0)
2. `Supply.min_stock` (global)

## 4. Estrutura Operacional por Módulo

## 4.1 Produtos / Insumos

Objetivo:

- manter catálogo padronizado de insumos
- unidade de medida correta
- classificação nutricional/NOVA
- mínimo global

Impacta:

- estoque
- receitas
- entregas
- cálculo de produção

## 4.2 Recebimentos de Fornecedor

Objetivo:

- registrar entrada de itens comprados
- conferir quantidade real recebida
- gerar entrada de estoque e trilha de auditoria

Pode abastecer:

- estoque geral
- estoque diretamente em escola (se o recebimento for vinculado a uma escola)

## 4.3 Entregas para Escolas

Objetivo:

- transferir insumos do estoque geral para as escolas
- controlar remessa planejada x recebida
- obter assinatura de envio e recebimento

Etapas:

1. criar entrega (`DRAFT`)
2. adicionar itens
3. enviar (`SENT`) -> baixa central
4. conferir pela escola (`CONFERRED`) -> entrada na escola + ajustes

## 4.4 Estoque Geral

É o estoque central da SEMED.

Entradas:

- recebimento de fornecedor sem escola vinculada
- ajuste de conferência (quando escola recebeu menos que o planejado)

Saídas:

- envio de entrega
- ajuste de conferência (quando escola recebeu mais que o planejado)

## 4.5 Estoque da Escola

É o saldo físico/operacional por unidade escolar.

Entradas:

- conferência de entrega
- recebimento de fornecedor vinculado à escola

Saídas:

- consumo lançado pela escola

Uso analítico:

- cálculo de produção pode considerar esse saldo para informar faltas (`stock_shortage`)

## 5. Relação com Cardápio, Receitas e Cálculo de Produção

Embora este documento foque em estoque/entregas, o cálculo de produção usa essas informações.

### Base de cálculo

- Cardápio (`Menu` / `MenuItem`)
- Receita associada ao item do cardápio (preferencial)
- Regras por aluno / aliases (fallback)
- Estoque da escola (`SchoolStockBalance`) quando habilitado

### Resultado esperado

- insumos necessários por refeição/dia/semana
- saldo disponível na escola
- falta a comprar (`stock_shortage`)

Observação importante:

- para cálculo mais confiável, o item do cardápio deve ter **receita associada**, pois a receita define:
  - ingredientes
  - quantidades base
  - rendimento (porções)

## 6. Endpoints (Visão Funcional)

## 6.1 Administração (autenticado)

Rotas principais (prefixo `/api/`):

- `supplies` (insumos)
- `stock` (estoque geral)
- `stock/movements` (movimentações)
- `deliveries` (entregas)
- `supplier-receipts` (recebimentos de fornecedor)
- `school-stock-config` (saldos/config por escola)
- `menus`, `recipes`, `production` (cálculo/regras auxiliares)

## 6.2 Público (sem login, com ou sem token dependendo do recurso)

Rotas relevantes:

- `GET /public/schools/` (lista escolas com cardápio publicado)
- `GET /public/schools/<slug>/menu/current/` (cardápio atual; agora aceita `?date=YYYY-MM-DD`)
- `POST /public/schools/<slug>/production/calculate/` (cálculo público por escola/data)
- `GET/POST /public/schools/<slug>/delivery/current/?token=...` (conferência pública de entrega)
- `GET/POST /public/schools/<slug>/consumption/?token=...` (consumo público da escola)

## 7. Regras e Cuidados Importantes

- Não excluir entrega fora de `DRAFT`
- Envio de entrega exige saldo suficiente no estoque geral
- Conferência exige informar todos os itens da entrega/recebimento
- Consumo público exige saldo suficiente no estoque da escola
- Saldos são atualizados dentro de transações (`transaction.atomic`) em fluxos críticos
- `StockMovement` deve sempre refletir a operação de saldo para rastreabilidade

## 8. Resumo Rápido (Mental Model)

- `Supply` = catálogo de insumos
- `StockBalance` = saldo central
- `SchoolStockBalance` = saldo local da escola
- `SupplierReceipt` = entrada de compra (gera `IN`)
- `Delivery.send` = saída da central (gera `OUT`)
- Conferência pública de entrega = entrada na escola + ajuste central
- Consumo público = saída da escola
- Calculadora de produção = usa cardápio/receita e compara com saldo da escola

