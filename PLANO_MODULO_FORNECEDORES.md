# Plano de Implementação - Módulo de Fornecedores Integrado ao Estoque

## 1. Objetivo
Implementar um módulo de fornecedores que permita:
- cadastrar pedidos/previsões de recebimento por fornecedor;
- registrar conferência de entrega por item;
- coletar assinatura do entregador e do responsável pelo recebimento;
- atualizar estoque automaticamente ao confirmar a conferência;
- criar insumo automaticamente quando o item recebido ainda não existir no cadastro.

## 2. Escopo funcional

### 2.1 Cadastro de fornecedores
- Cadastro completo: razão social/nome, CNPJ/CPF, contato, telefone, e-mail, endereço.
- Status ativo/inativo.
- Histórico de entregas por fornecedor.

### 2.2 Planejamento de recebimento
- Criar documento de recebimento (pré-nota) com:
  - fornecedor;
  - escola destino (quando aplicável);
  - data prevista;
  - itens esperados (nome, unidade, quantidade prevista, observações).
- Permitir itens já cadastrados ou itens novos (somente nome/unidade/categoria inicial).

### 2.3 Conferência de recebimento
- Tela de conferência por item:
  - quantidade prevista x recebida;
  - marcação de divergência;
  - observações por item e observação geral.
- Estados do fluxo:
  - `DRAFT` (rascunho),
  - `SENT/EXPECTED` (aguardando entrega),
  - `IN_CONFERENCE` (conferência em andamento),
  - `CONFERRED` (conferida e assinada),
  - `CANCELLED`.

### 2.4 Assinaturas obrigatórias
- Assinatura do entregador (fornecedor).
- Assinatura de quem recebeu (escola/SEMED).
- Nome legível de ambos.
- Data/hora de assinatura.
- Bloquear conclusão da conferência sem as duas assinaturas.

### 2.5 Atualização automática de estoque
Ao confirmar conferência:
- Para item existente:
  - atualizar `SchoolStockBalance` (estoque da escola) e/ou estoque central conforme regra do negócio;
  - criar `StockMovement` de entrada.
- Para item novo:
  - criar `Supply` com dados mínimos;
  - criar saldo inicial (`StockBalance` / `SchoolStockBalance`);
  - registrar `StockMovement` de entrada;
  - vincular item criado ao documento de recebimento.

## 3. Regras de negócio principais
- Apenas usuários autenticados e com permissão de recebimento podem conferir.
- Conferência final deve ser transacional (`transaction.atomic`) para evitar inconsistência parcial.
- Não permitir quantidade negativa.
- Divergência deve ficar auditável (previsto, recebido, diferença, justificativa).
- Itens novos devem exigir categoria/unidade válidas no ato da conferência.
- Reprocessamento idempotente: evitar aplicar entrada em estoque duas vezes para a mesma conferência.

## 4. Modelo de dados (proposta)

### 4.1 Novas entidades
- `Supplier`
  - id, name, document, contact_name, phone, email, address, is_active, created_at, updated_at.
- `SupplierReceipt`
  - id, supplier(FK), school(FK opcional), expected_date, status,
  - notes,
  - sender_signature, sender_signed_by,
  - receiver_signature, receiver_signed_by,
  - conference_started_at, conference_finished_at,
  - created_by(FK), created_at, updated_at.
- `SupplierReceiptItem`
  - id, receipt(FK), supply(FK opcional),
  - raw_name (quando item novo), category, unit,
  - expected_quantity, received_quantity,
  - divergence_note,
  - supply_created(FK opcional para novo insumo gerado),
  - created_at.

### 4.2 Relacionamentos com o módulo atual
- Reutilizar `Supply`, `StockBalance`, `SchoolStockBalance`, `StockMovement`.
- Opcional: integrar com `Notification` para alertas de divergência/itens críticos.

## 5. API (proposta)
- `GET/POST /api/suppliers/`
- `GET/PATCH /api/suppliers/{id}/`
- `GET/POST /api/supplier-receipts/`
- `GET/PATCH/DELETE /api/supplier-receipts/{id}/`
- `POST /api/supplier-receipts/{id}/start_conference/`
- `POST /api/supplier-receipts/{id}/submit_conference/`
  - payload com itens conferidos + assinaturas.
- `POST /api/supplier-receipts/{id}/cancel/`
- `GET /api/supplier-receipts/{id}/conference_link/` (se houver fluxo público controlado por token).

## 6. Fluxo técnico da conferência
1. Carregar recibo e itens com `select_for_update`.
2. Validar estado e permissões.
3. Validar payload de itens e assinaturas.
4. Para cada item:
   - resolver `Supply` (existente ou criar novo);
   - atualizar estoques;
   - registrar `StockMovement` de entrada;
   - registrar divergência quando houver.
5. Salvar assinaturas e nomes.
6. Marcar recibo como `CONFERRED`.
7. Emitir notificação/evento.

## 7. Frontend (proposta)

### 7.1 Telas
- Cadastro de fornecedores.
- Lista de recebimentos por fornecedor/status/período.
- Detalhe do recebimento com itens e progresso da conferência.
- Tela de assinatura (canvas) para entregador e recebedor.

### 7.2 UX essencial
- Permitir adicionar item novo no ato da conferência.
- Destacar visualmente divergências.
- Exibir resumo final: itens conferidos, itens novos criados, total recebido.
- Bloquear botão “Concluir Conferência” enquanto faltarem assinaturas.

## 8. Migrações e compatibilidade
- Criar migrações incrementais para entidades novas.
- Backfill opcional para relacionar entregas antigas, se necessário.
- Não quebrar endpoints existentes de `deliveries`.

## 9. Segurança e auditoria
- Controle de permissão por papel (admin, conferente, visualizador).
- Armazenar trilha de auditoria:
  - quem criou, quem conferiu, quando, alterações de status.
- Evitar aceitar token em query para endpoints sensíveis internos (preferir JWT em header).

## 10. Testes mínimos
- Criação de fornecedor e recebimento.
- Conferência com item existente atualizando estoque.
- Conferência com item novo criando `Supply` e saldo.
- Bloqueio sem assinaturas.
- Idempotência (não duplicar movimento em reenvio).
- Permissões e autenticação.

## 11. Fases sugeridas
- **Fase 1:** estrutura de dados + CRUD fornecedores/recebimentos.
- **Fase 2:** conferência com atualização de estoque para itens existentes.
- **Fase 3:** criação automática de itens novos durante conferência.
- **Fase 4:** assinaturas e validações obrigatórias.
- **Fase 5:** notificações, relatórios e melhorias de UX.

## 12. Critérios de aceite
- Recebimento pode ser criado e conferido ponta a ponta.
- Estoque atualizado automaticamente na conclusão.
- Item novo recebido é criado automaticamente e aparece no inventário.
- Assinaturas de entregador e recebedor são obrigatórias e persistidas.
- Divergências ficam registradas e consultáveis.
