# AGENTS

## Como usar este repositorio
- Tratar `workflow/` como fonte de verdade para estado atual do produto, ultimo passo concluido e proximos passos.
- Usar este arquivo como guia operacional curto para colaborar neste repositorio sem perder regras importantes de UX e acessibilidade.
- Para tarefas visuais do `/totem`, ler tambem:
  - `design/totem-reference/README.md`
  - `design/totem-reference/visual-direction.md`
  - `design/totem-reference/accessibility-notes.md`
  - `.agents/skills/totem-ui/SKILL.md`

## Stack
- Next.js 14 App Router
- React 18
- TypeScript
- Tailwind CSS
- Supabase
- Recharts
- Vitest

## Como rodar localmente
- Instalar dependencias: `npm ci`
- Criar `.env.local` a partir de `.env.example`
- Preencher credenciais do Supabase
- Rodar ambiente local: `npm run dev`

## Comandos principais
- `npm run lint`
- `npm run test:run`
- `npm run build`
- `npm run typecheck`

## Regras de trabalho
- Preservar a logica funcional existente, salvo quando a tarefa pedir mudanca funcional explicita.
- Tratar `/totem` como a tela mais sensivel de UX do sistema.
- Priorizar mobile-first em layout, densidade visual e tamanho de toque.
- Manter acessibilidade como requisito central, nao como acabamento.
- Nao quebrar alto contraste, voz guiada do `/totem` nem audio do `/painel-chamada`.
- Fazer mudancas pequenas, revisaveis e faceis de validar.
- Evitar refatoracoes amplas quando um ajuste localizado resolver.

## Guardrails para UI do /totem
- Dar prioridade maxima para a clareza da senha gerada.
- Tratar a senha emitida como o elemento visual mais importante da tela apos a emissao.
- Preferir botoes grandes, tateis e legiveis.
- Manter visual clean, moderno e acolhedor, adequado a contexto de saude.
- Evitar poluicao visual, excesso de blocos competindo entre si e microdetalhes decorativos.
- Nao alterar o fluxo funcional do totem sem necessidade comprovada.

## Observacao de validacao local
- Neste workspace, `npm run typecheck` pode depender de `.next/types` atualizada.
- Se necessario, rodar `npm run build` antes de `npm run typecheck`.
