# Visão Geral do Projeto - Objetivo e Funcionalidades

## 1. Objetivo do projeto
O projeto **OpenEats / Merenda SEMED** é uma plataforma para gestão da alimentação escolar, com foco em:
- planejamento de cardápios por escola e semana;
- controle de estoque central e por escola;
- gestão de entregas e conferências;
- registro de consumo de insumos;
- exportação de relatórios operacionais;
- transparência com acesso público controlado por token.

A solução busca melhorar rastreabilidade, reduzir inconsistências de estoque e apoiar tomada de decisão da equipe gestora.

## 2. Funcionalidades principais

### 2.1 Autenticação e sessão
- Login por e-mail e senha.
- Autenticação JWT para API.
- Suporte adicional a sessão para navegação no Browsable API.
- Refresh automático de token no frontend.

### 2.2 Dashboard
- Indicadores gerais do sistema.
- Série/resumo para acompanhamento operacional.

### 2.3 Gestão de escolas
- CRUD de escolas (nome, endereço, cidade, status ativo/inativo).
- Geração de link público com token por escola.
- Regeneração de token público.
- Visualização de estoque por escola.

### 2.4 Estoque e insumos
- Cadastro de insumos (`Supply`) com categoria, unidade e estoque mínimo.
- Saldo de estoque central (`StockBalance`).
- Saldo por escola (`SchoolStockBalance`) com limite mínimo por escola.
- Movimentações de estoque (`StockMovement`) com filtros por período/tipo/escola/insumo.
- Ajuste de limites mínimos por escola (individual e em lote).

### 2.5 Entregas
- Criação de entregas com múltiplos itens planejados.
- Envio de entrega (dedução automática do estoque central).
- Geração de link de conferência para escola.
- Conferência com quantidades recebidas e divergências.
- Assinaturas digitais no fluxo de conferência.
- Atualização de estoque por escola após conferência.

### 2.6 Cardápios
- Criação e edição de cardápios por escola e semana.
- Estrutura por dia da semana e tipo de refeição.
- Inclusão de descrição, nome de refeição, porção e imagem.
- Publicação de cardápio.
- Cópia de cardápio para outra escola/período.
- Abertura de editor por deep-link com parâmetros de escola/semana.
- Suporte a **nome do cardápio**.

### 2.7 Registro de consumo
- Registro de consumo pelas escolas (via fluxo público com token).
- Baixa de estoque por escola conforme consumo informado.
- Bloqueio de consumo quando saldo é insuficiente.

### 2.8 Notificações
- Listagem de notificações.
- Contagem de não lidas.
- Marcar individual e marcar todas como lidas.
- Suporte a alertas de divergência/baixa de estoque.

### 2.9 Exportações e relatórios
- Exportação de estoque em CSV, PDF e XLSX.
- Exportação de cardápios em CSV e PDF.
- Exportação de entregas em PDF e XLSX.
- Exportação de consumo em PDF e XLSX.

### 2.10 Módulo de fornecedores (em implementação por etapas)
Já implementado:
- Cadastro de fornecedores (`Supplier`).
- Cadastro de recebimentos de fornecedor (`SupplierReceipt`) com itens (`SupplierReceiptItem`).
- Início e conclusão de conferência de recebimento.
- Atualização automática de estoque na conferência (itens existentes).
- Criação automática de insumo quando item novo é conferido.
- Assinaturas obrigatórias do entregador e recebedor no fechamento da conferência.

## 3. Funcionalidades públicas (tokenizadas)
- Consulta pública de dados da escola por slug/token.
- Consulta de cardápio vigente por escola.
- Consulta/conferência de entrega via link público.
- Registro de consumo pela escola em endpoint público autenticado por token.

## 4. Perfis de uso (visão funcional)
- **Admin/SEMED:** gestão completa (escolas, estoque, cardápio, entregas, relatórios).
- **Unidade escolar (fluxo público tokenizado):** conferência de entrega e registro de consumo.
- **Fornecedor (fluxo de recebimento/conferência):** assinatura e confirmação de entrega (em evolução).

## 5. Arquitetura resumida
- **Frontend:** React + Vite.
- **Backend:** Django + Django REST Framework.
- **Banco:** PostgreSQL.
- **Execução local:** Docker Compose.
- **Deploy:** Render (configurado com `render.yaml`).

## 6. Objetivo operacional esperado
Com o uso completo da plataforma, a gestão da merenda escolar passa a ter:
- previsibilidade de cardápio e distribuição;
- controle auditável de estoque;
- redução de perdas e divergências não rastreadas;
- evidência formal de recebimento por assinatura;
- dados consolidados para planejamento e prestação de contas.
