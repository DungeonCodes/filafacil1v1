---
name: totem-ui
description: Use esta skill para melhorias visuais, responsivas e de acessibilidade na tela /totem do projeto FilaFácil Acessível.
---

# Totem UI Skill

## Objetivo
Esta skill orienta melhorias de interface na tela /totem do projeto FilaFácil Acessível.

Use esta skill quando a tarefa envolver:
- refinamento visual do /totem
- responsividade do /totem
- hierarquia visual do ticket
- melhoria de botões e cards
- acessibilidade visual
- evolução da experiência mobile do autoatendimento

## Prioridade máxima
A senha gerada é o elemento visual mais importante da tela.
Ela deve sempre ser o ponto de maior destaque visual.

## Direção visual esperada
- visual clean
- moderno
- acolhedor
- contexto hospitalar/digital
- aparência confiável
- baixa poluição visual
- mobile-first

## Regras obrigatórias
- não alterar a lógica funcional do /totem sem necessidade
- não quebrar a geração de senha
- não quebrar o modo alto contraste
- não quebrar o modo de voz guiado
- não reduzir legibilidade em nome da estética
- não diminuir áreas de toque importantes
- não criar layout confuso em celular

## Regras de UI
- a senha gerada deve ter tipografia grande e forte
- o card da senha deve ter presença visual dominante
- botões devem ser grandes, claros e táteis
- a hierarquia visual deve ser óbvia
- o título, instrução, opções e ações devem ter contraste claro entre si
- elementos principais devem ter espaçamento suficiente
- o fluxo deve parecer simples e seguro

## Botões
- devem ser fáceis de tocar
- devem ter foco visível
- devem ter contraste suficiente
- devem manter clareza no mobile
- o botão principal deve ter destaque real

## Acessibilidade
- sempre respeitar o modo alto contraste
- sempre respeitar o modo de voz guiado
- manter legibilidade forte
- manter contraste entre texto, fundo, bordas e botões
- evitar textos pequenos
- evitar elementos muito próximos

## Responsividade
- projetar primeiro para celular
- funcionar bem entre 360px e 430px de largura
- em telas maiores, expandir sem perder foco visual
- evitar densidade excessiva de informação

## Como implementar
- trabalhar com mudanças pequenas e revisáveis
- melhorar primeiro hierarquia, espaçamento, contraste, tipografia e tamanho de toque
- favorecer soluções simples antes de introduzir novos padrões visuais
- validar estados principais: seleção de fila, carregamento, sucesso com senha emitida, erro, alto contraste e suporte ou ausência de voz
- evitar mexer em arquivos fora do /totem, a menos que o ajuste seja claramente compartilhado e necessário

## O que evitar
- excesso de ornamentos
- gradientes exagerados
- cards fracos demais
- senha com pouco destaque
- botões pequenos
- elementos competindo com o ticket
- soluções bonitas mas pouco acessíveis

## Resultado esperado
- a tela deve ficar mais fácil de entender no primeiro olhar
- a emissão da senha deve parecer segura e importante
- o bloco da senha deve ser memorável, legível e dominante sem poluição visual

## Checklist antes de concluir
- a senha ficou mais destacada?
- o mobile ficou melhor?
- os botões continuam grandes e claros?
- o alto contraste continua funcionando?
- o modo de voz guiado continua funcionando?
- a tela ficou mais limpa sem perder clareza?
- TypeScript, lint, tests e build continuam ok?