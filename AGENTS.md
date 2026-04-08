# AGENTS.md

Este repositório contém o projeto FilaFácil Acessível, um sistema web de gestão de filas para unidades de saúde com foco em acessibilidade multimodal.

## Objetivo do projeto
- permitir geração de senhas por autoatendimento
- exibir painel público de chamadas
- operar fila inicial no painel do atendente
- operar fila médica no painel do médico
- exibir dashboard administrativo com métricas reais
- garantir acessibilidade visual e auditiva

## Stack principal
- Next.js
- React
- TypeScript
- Tailwind CSS
- Supabase
- PostgreSQL
- Vercel
- GitHub

## Como rodar localmente
- npm install
- npm run dev

## Comandos principais
- npm run lint
- npm run typecheck
- npm run test:run
- npm run build

## Variáveis de ambiente esperadas
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY

## Regras gerais de trabalho
- preservar a lógica funcional existente sempre que possível
- fazer mudanças pequenas, seguras e revisáveis
- não refatorar desnecessariamente
- não quebrar rotas já funcionais
- não usar chaves sensíveis no frontend
- qualquer uso de service role deve ficar apenas no server-side
- sempre manter compatibilidade com TypeScript, lint, tests e build
- sempre priorizar mobile-first nas telas de uso operacional
- sempre preservar acessibilidade existente

## Regras de UX do projeto
- o /totem é a tela mais sensível de UX do sistema
- a senha gerada deve ser o elemento visual mais importante do /totem
- botões precisam ser grandes, táteis e legíveis
- a interface deve ser clara, limpa e previsível
- evitar poluição visual
- priorizar leitura rápida e entendimento imediato
- em qualquer ajuste visual, preservar alto contraste e modo de voz guiado

## Recursos de acessibilidade já implementados
- modo alto contraste
- áudio automático no painel de chamada
- modo de voz guiado no /totem

## Ao trabalhar em UI
- priorizar legibilidade
- priorizar contraste
- priorizar responsividade mobile
- preservar hierarquia visual
- não quebrar acessibilidade já implementada

## Ao trabalhar em lógica
- preservar fluxo funcional do ticket
- evitar alterar regras de negócio sem necessidade
- manter consistência com os estágios do ticket:
  - waiting_attendant
  - called_attendant
  - waiting_doctor
  - called_doctor
  - finished

## Ao trabalhar com banco e Supabase
- preferir mudanças compatíveis com a modelagem atual
- documentar novas tabelas, RPCs ou policies
- não quebrar consultas já usadas pelas telas

## Definição de pronto
Uma tarefa só deve ser considerada pronta quando:
- a mudança funciona
- TypeScript passa
- lint passa
- tests passam
- build passa
- o comportamento existente não foi quebrado