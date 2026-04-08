# Visual Direction — Totem v2

## Objetivo
Este arquivo define a direção visual desejada para a próxima evolução da tela `/totem` do projeto FilaFácil Acessível.

A intenção é usar referências visuais como guia, mas implementar tudo diretamente na arquitetura atual do projeto, sem copiar HTML bruto e sem alterar a lógica funcional já existente.

## Princípio central
O `/totem` deve ser uma tela de ação rápida.

O usuário deve bater o olho e entender imediatamente:
- onde tocar
- quais opções existem
- onde está sua senha gerada
- como acessar recursos de acessibilidade

A tela deve parecer um produto real de autoatendimento em saúde:
- moderno
- limpo
- confiável
- acessível
- rápido de entender

## Prioridade máxima de UX
As opções de atendimento precisam aparecer logo de cara.

No mobile, o usuário não deve precisar rolar para encontrar as principais ações do totem, sempre que isso for visualmente viável.

A senha gerada continua sendo o elemento visual mais importante quando existir, mas a tela inicial deve priorizar ação rápida.

## Direção visual geral
- visual clean e moderno
- clima hospitalar/digital
- aparência profissional e acolhedora
- menos texto e mais ação
- hierarquia visual imediata
- mobile-first
- baixa poluição visual
- foco em toque rápido

## O que deve mudar na nova versão
- reduzir blocos textuais grandes no topo
- remover textos descritivos longos e institucionais
- evitar subtítulos ou explicações que atrasem a ação principal
- mostrar as opções de atendimento o mais cedo possível na tela
- tornar a acessibilidade mais compacta e visual
- substituir excesso de texto por ícones, rótulos curtos e botões claros
- reforçar ícones reais nos cards de atendimento, no estilo das referências do Stitch

## O que não quero no topo
- blocos grandes com descrição institucional
- textos longos explicando o fluxo
- painéis grandes de acessibilidade com frases
- elementos que empurrem as opções de atendimento para baixo

## Acessibilidade no visual
A área de acessibilidade deve existir, mas de forma compacta.

Direção desejada:
- acessibilidade representada por botões/controles com ícones
- rótulos curtos
- leitura rápida
- aparência discreta, mas clara
- sem painéis textuais grandes

Exemplos de elementos desejados:
- botão de alto contraste com ícone
- botão de voz guiada com ícone
- botões compactos e fáceis de localizar

## Cards de atendimento
Os cards de atendimento são parte central da tela e precisam parecer clicáveis, claros e confiáveis.

Eles devem:
- usar ícones reais e consistentes
- ter aparência mais próxima da referência do Stitch
- parecer grandes e táteis
- ter leitura simples
- evitar depender de siglas como elemento principal

As siglas podem continuar existindo como apoio, mas não devem ser a identidade visual dominante do card.

O foco principal do card deve ser:
- ícone
- nome do atendimento
- ação clara de toque

## Senha gerada
Quando a senha for emitida, ela deve continuar sendo o ponto de maior destaque visual da tela.

A senha gerada precisa ter:
- tipografia muito forte
- escala grande
- contraste alto
- leitura imediata
- aparência de confirmação clara e segura

O card da senha deve parecer mais importante do que qualquer outro bloco da tela.

## Botões
- botões devem ser grandes e táteis
- o botão principal deve ter destaque real
- foco visível sempre
- boa legibilidade em mobile
- hierarquia clara entre botão principal e secundário
- evitar botões pequenos ou visualmente fracos

## Tipografia
- títulos curtos e fortes
- menos texto corrido
- leitura rápida
- tipografia principal da senha mais pesada e impactante
- boa distinção entre título, opções, ações e confirmação

## Paleta visual
- base clara
- azul principal mais vivo
- superfícies suaves
- contraste suficiente para acessibilidade
- aparência leve e moderna
- evitar excesso de cores concorrentes

## Responsividade
A tela deve ser pensada primeiro para celular.

Metas:
- opções de atendimento visíveis sem rolagem inicial sempre que possível
- boa leitura entre 360px e 430px
- boa distribuição vertical
- layout compacto sem parecer apertado
- expansão limpa em telas maiores

## Acessibilidade obrigatória a preservar
Nenhuma mudança visual pode quebrar:
- modo alto contraste
- modo de voz guiado
- legibilidade forte
- foco visível
- botões acessíveis
- leitura clara da senha gerada

## Regras de implementação
- não alterar a lógica funcional do `/totem`
- não quebrar emissão de senha
- não quebrar alto contraste
- não quebrar modo de voz guiado
- não substituir a arquitetura atual por HTML exportado
- implementar o visual diretamente no projeto atual
- usar referências desta pasta apenas como guia visual e estrutural

## O que deve ser preservado
- fluxo funcional existente
- responsividade
- acessibilidade
- compatibilidade com Tailwind
- compatibilidade com mobile
- clareza da emissão de senha

## O que deve ser melhorado
- clareza da primeira dobra no mobile
- compactação do topo
- presença dos ícones nos cards
- redução de texto desnecessário
- velocidade de entendimento da tela
- destaque das ações principais
- sensação de produto real e maduro

## Resumo final
O `/totem` deve ser uma tela de autoatendimento rápida e óbvia.

Na primeira dobra, o usuário deve ver com clareza:
- navegação compacta
- recursos de acessibilidade em formato curto
- opções de atendimento
- e, quando existir, a senha gerada com destaque máximo

A nova versão deve parecer mais próxima de um produto real de saúde digital:
mais limpa,
mais direta,
mais visual,
mais acessível,
e menos dependente de texto explicativo.