# Direcao Visual do /totem

## Objetivo visual
Fazer o `/totem` parecer simples, confiavel e acolhedor desde o primeiro olhar, com leitura facil mesmo em uso rapido, por pessoas idosas ou com baixa visao, em ambiente de saude.

## Principios de UX
- Reduzir carga cognitiva: poucas escolhas por vez e leitura imediata do que fazer.
- Priorizar acao principal: os botoes de retirada de senha devem ser grandes e inequivocos.
- Reforcar resultado: depois da emissao, a senha precisa dominar a tela sem disputa visual.
- Evitar ruido: remover blocos, ornamentos ou textos que nao ajudem a decidir ou confirmar a acao.
- Preservar calma: usar composicao limpa, espacamento generoso e sensacao de confianca.

## Linguagem visual desejada
- Clean, moderna e acolhedora
- Contraste forte o suficiente para leitura imediata
- Tipografia com hierarquia clara e numeros muito legiveis
- Cartoes e areas de acao com boa separacao visual
- Cores e superficies que remetam a cuidado e organizacao, nao a interface promocional

## Criterios visuais da senha gerada
- A senha deve ser o ponto focal absoluto apos a emissao.
- Prefixo e numero devem ser lidos em menos de um segundo.
- O bloco da senha deve parecer importante sem parecer agressivo.
- A distancia entre a senha e as instrucoes seguintes deve ser curta e clara.
- A tela precisa continuar funcionando bem em largura pequena.
- O contraste do bloco da senha deve continuar forte em modo normal e alto contraste.

## Guardrails de implementacao
- Melhorar apresentacao sem mudar desnecessariamente o fluxo funcional.
- Nao criar efeitos visuais que atrapalhem leitura, foco ou percepcao da senha.
- Evitar multiplos destaques concorrendo com o cartao da senha.
