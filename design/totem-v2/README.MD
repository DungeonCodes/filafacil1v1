# Totem v2 — Design References

Esta pasta reúne materiais de referência para futuras melhorias visuais da tela `/totem` do projeto FilaFácil Acessível.

## Objetivo
O objetivo desta pasta não é substituir o código atual do sistema nem servir como fonte para copiar HTML bruto.

O objetivo é:
- guardar referências visuais
- registrar direção de design
- documentar prioridades de UX e acessibilidade
- orientar futuras implementações feitas no projeto real

## Como usar esta pasta
Sempre que houver uma nova iteração visual do `/totem`, o ideal é que o Codex leia:
- `AGENTS.md`
- `.agents/skills/totem-ui/SKILL.md`
- `design/totem-v2/visual-direction.md`
- `design/totem-v2/accessibility-notes.md`
- `design/totem-v2/future-references.md`

Além disso, pode usar como apoio:
- prints
- exports do Stitch
- zips
- mockups
- referências visuais salvas aqui

## Regra importante
As referências desta pasta devem ser usadas apenas como guia visual e estrutural.

Não usar esta pasta para:
- copiar HTML bruto diretamente para o projeto
- substituir a arquitetura atual
- quebrar lógica já implementada
- remover recursos de acessibilidade existentes

## O que deve ser preservado ao implementar mudanças
- geração de senha
- modo alto contraste
- modo de voz guiado no `/totem`
- responsividade mobile
- clareza da interface
- acessibilidade já implementada

## Prioridade máxima de UX
A senha gerada deve continuar sendo o elemento visual mais importante do `/totem`.

Toda melhoria visual deve reforçar:
- destaque da senha
- legibilidade
- facilidade de toque
- clareza do fluxo
- aparência profissional e confiável

## Conteúdo esperado nesta pasta
- `visual-direction.md`
- `accessibility-notes.md`
- `future-references.md`
- exports do Stitch
- prints de referência
- materiais visuais para futuras versões

## Fluxo recomendado com o Codex
Ao pedir melhorias visuais do `/totem`, usar prompts que orientem o Codex a:
1. ler o `AGENTS.md`
2. ler a skill do `/totem`
3. ler esta pasta de referência
4. implementar o visual diretamente no projeto atual
5. preservar lógica e acessibilidade

## Resumo
Esta pasta existe para organizar a direção visual do `/totem` e evitar decisões soltas ao longo do projeto.

Ela deve servir como base persistente para futuras melhorias de UI, sempre respeitando a arquitetura atual do sistema.