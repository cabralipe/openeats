# Plano de Melhoria de Relatórios

Este documento organiza os relatórios mais valiosos para evoluir o módulo atual, com foco em gestão operacional, prestação de contas e apoio à nutrição.

## 1. Estado atual

Hoje o sistema já possui exportações operacionais para:

- estoque detalhado;
- cardápios;
- entregas;
- consumo;
- recebimentos de fornecedores.

Esses relatórios resolvem bem a extração de dados, mas ainda faltam relatórios analíticos e gerenciais para apoiar decisão.

## 2. Prioridade recomendada

Ordem sugerida de implementação:

1. Relatório de divergências de entrega
2. Relatório de estoque crítico por escola
3. Relatório de consumo por escola e período
4. Relatório de refeições servidas
5. Relatório de execução do cardápio

Segunda onda:

6. Relatório de vencimento de lotes
7. Relatório de desempenho de fornecedores
8. Relatório de rastreabilidade por lote
9. Relatório nutricional / NOVA do cardápio

## 3. Top 5 relatórios para implementar

### 3.1 Divergências de entrega

Objetivo:
Identificar faltas, diferenças de recebimento e observações registradas na conferência.

Valor:

- reduz perda operacional;
- melhora cobrança de fornecedor e transportes;
- facilita auditoria e prestação de contas.

Filtros:

- escola;
- período;
- status da entrega;
- fornecedor, se houver vínculo indireto por lote/recebimento futuro;
- somente com divergência: sim/não.

Colunas principais:

- data da entrega;
- escola;
- entrega;
- insumo;
- quantidade planejada;
- quantidade recebida;
- falta;
- observação de divergência;
- entregador;
- recebedor;
- conferida em.

Fontes:

- `inventory.Delivery`
- `inventory.DeliveryItem`

Observação técnica:
Grande parte do dado já existe no export atual de entregas; o ganho aqui é separar um relatório específico de exceções.

### 3.2 Estoque crítico por escola

Objetivo:
Listar os itens abaixo do estoque mínimo por escola, ordenados por criticidade.

Valor:

- permite ação preventiva;
- melhora planejamento de reposição;
- reduz risco de falta de alimentação.

Filtros:

- escola;
- categoria do insumo;
- somente abaixo do mínimo;
- faixa de criticidade.

Colunas principais:

- escola;
- insumo;
- categoria;
- saldo atual;
- estoque mínimo;
- déficit;
- última atualização.

Indicadores úteis:

- total de itens críticos por escola;
- ranking de escolas com mais itens críticos;
- ranking de insumos mais críticos da rede.

Fontes:

- `inventory.SchoolStockBalance`
- `inventory.Supply`

### 3.3 Consumo por escola e período

Objetivo:
Transformar a movimentação de saída em um relatório comparativo entre escolas e insumos.

Valor:

- detecta consumo fora do padrão;
- ajuda no planejamento de compra e distribuição;
- apoia análise de desperdício.

Filtros:

- escola;
- insumo;
- categoria;
- período;
- agrupamento por dia, semana ou mês.

Colunas principais:

- escola;
- insumo;
- categoria;
- unidade;
- quantidade consumida;
- período;
- observação.

Visões recomendadas:

- detalhado por movimento;
- consolidado por escola;
- consolidado por insumo;
- ranking de maior consumo.

Fontes:

- `inventory.StockMovement`
- `inventory.Supply`
- `schools.School`

Observação técnica:
O sistema já possui exportação de consumo, mas falta consolidação explícita por escola no relatório final.

### 3.4 Refeições servidas

Objetivo:
Consolidar atendimento real por escola, data e tipo de refeição.

Valor:

- mede execução real do serviço;
- apoia prestação de contas;
- serve de base para comparação com cardápio e consumo.

Filtros:

- escola;
- período;
- tipo de refeição;
- cardápio vinculado.

Colunas principais:

- data;
- escola;
- tipo de refeição;
- nome da refeição;
- quantidade servida;
- cardápio relacionado.

Indicadores úteis:

- total servido no período;
- média diária por escola;
- composição por tipo de refeição.

Fontes:

- `menus.MealServiceReport`
- `menus.MealServiceEntry`
- `menus.Menu`

Observação técnica:
Parte desse agregado já aparece no dashboard, mas ainda não existe como relatório exportável.

### 3.5 Execução do cardápio

Objetivo:
Cruz ar o planejado com o executado.

Perguntas que responde:

- o que foi planejado foi servido?
- houve troca de refeição?
- houve consumo incompatível com o cardápio?

Valor:

- entrega visão de conformidade;
- fortalece o acompanhamento da nutricionista;
- diferencia a aplicação como sistema de gestão, não só cadastro.

Filtros:

- escola;
- semana;
- status do cardápio;
- tipo de refeição.

Colunas principais:

- escola;
- semana;
- dia;
- refeição planejada;
- refeição servida;
- quantidade servida;
- observações;
- status de aderência.

Fontes:

- `menus.Menu`
- `menus.MenuItem`
- `menus.MealServiceReport`
- `menus.MealServiceEntry`
- opcionalmente `inventory.StockMovement`

Observação técnica:
Esse é o relatório mais estratégico, mas depende de regra de negócio para definir o que conta como “aderência”.

## 4. Segunda onda de alto valor

### 4.1 Vencimento de lotes

Com base em lotes e saldos:

- vencidos;
- vencendo em 7 dias;
- vencendo em 15 dias;
- vencendo em 30 dias.

Fontes:

- `inventory.SupplyLot`
- `inventory.LotBalanceCentral`
- `inventory.LotBalanceSchool`

### 4.2 Desempenho de fornecedores

Indicadores:

- total de recebimentos;
- taxa de conferência;
- taxa de divergência;
- volume entregue;
- atrasos e faltas.

Fontes:

- `inventory.SupplierReceipt`
- `inventory.SupplierReceiptItem`
- `inventory.Supplier`

### 4.3 Rastreabilidade por lote

Permite responder:

- de qual fornecedor veio;
- quando entrou;
- para quais escolas foi enviado;
- saldo restante;
- validade.

Fontes:

- `inventory.SupplyLot`
- `inventory.SupplierReceiptItemLot`
- `inventory.DeliveryItemLot`
- `inventory.LotBalanceCentral`
- `inventory.LotBalanceSchool`

### 4.4 Relatório nutricional / NOVA

Possível porque os insumos já têm classificação nutricional e NOVA.

Indicadores:

- percentual do cardápio por classificação NOVA;
- distribuição por função nutricional;
- presença de ultraprocessados por semana ou escola.

Fontes:

- `inventory.Supply`
- `menus.Menu`
- `menus.MenuItem`
- `recipes.Recipe`, se o cálculo usar receitas associadas.

## 5. Formatos recomendados

Para cada novo relatório:

- `Tela analítica`: resumo, filtros, cards e ranking;
- `XLSX`: para auditoria e manipulação;
- `PDF`: para apresentação e prestação de contas.

Regra prática:

- relatórios operacionais: detalhados;
- relatórios gerenciais: consolidados e comparativos.

## 6. Melhor sequência de implementação

### Fase 1

- divergências de entrega;
- estoque crítico por escola;
- consumo por escola e período.

### Fase 2

- refeições servidas;
- vencimento de lotes;
- desempenho de fornecedores.

### Fase 3

- execução do cardápio;
- rastreabilidade por lote;
- nutricional / NOVA.

## 7. Recomendação final

Se o objetivo for melhorar a aplicação com maior impacto imediato, os 3 primeiros relatórios a construir devem ser:

1. divergências de entrega;
2. estoque crítico por escola;
3. refeições servidas.

Esses três entregam valor operacional rápido, usam dados que já existem e criam base para o relatório mais valioso depois: execução do cardápio.
