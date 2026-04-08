---
name: totem-ui
description: Melhorias visuais, refinamento de UX, responsividade, hierarquia visual e ajustes de styling da tela /totem do FilaFacil. Use quando a tarefa envolver layout, aparencia, copy visual, componentes, estados visuais ou organizacao da interface do /totem, especialmente quando for importante preservar acessibilidade e nao alterar desnecessariamente a logica funcional.
---

# Totem UI

## Antes de editar
- Ler `AGENTS.md`.
- Ler `workflow/SESSION_START.md` e validar o estado atual do repositorio.
- Ler `design/totem-reference/README.md`.
- Ler `design/totem-reference/visual-direction.md`.
- Ler `design/totem-reference/accessibility-notes.md`.
- Inspecionar o estado atual de `src/features/totem/TotemScreen.tsx`.
- Inspecionar os componentes de acessibilidade relevantes antes de tocar em contraste ou feedback de voz.

## Prioridades de design
- Dar prioridade maxima para a clareza da senha gerada.
- Tratar a senha como o elemento visual mais importante da tela depois da emissao.
- Tornar acoes principais grandes, tateis e legiveis.
- Priorizar uso mobile e toque antes de pensar em telas largas.
- Manter aparencia clean, moderna e acolhedora.
- Reduzir ruido visual e competicao entre blocos.

## Guardrails
- Preservar o fluxo funcional existente salvo pedido explicito.
- Nao quebrar alto contraste.
- Nao quebrar modo de voz guiada.
- Nao piorar legibilidade para idosos, baixa visao ou contexto de saude.
- Nao esconder a acao principal atras de decoracao, textos longos ou layouts densos.

## Como implementar
- Trabalhar com mudancas pequenas e revisaveis.
- Melhorar primeiro hierarquia, espacamento, contraste, tipografia e tamanho de toque.
- Favorecer solucoes simples antes de introduzir novos padroes visuais.
- Validar estados principais: selecao de fila, carregamento, sucesso com senha emitida, erro, alto contraste e suporte ou ausencia de voz.
- Evitar mexer em arquivos fora do `/totem` a menos que o ajuste seja claramente compartilhado e necessario.

## Resultado esperado
- A tela deve ficar mais facil de entender no primeiro olhar.
- A emissao de senha deve parecer segura e importante.
- O bloco da senha deve ser memoravel, legivel e dominante sem poluicao visual.
