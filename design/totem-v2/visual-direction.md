Visual Direction — Totem v2

Objetivo
Este diretório reúne referências visuais para a evolução da tela /totem do projeto FilaFácil Acessível.

A intenção não é copiar literalmente o HTML exportado ou substituir a arquitetura atual do sistema.
O objetivo é usar essas referências para guiar a implementação visual dentro do projeto atual em Next.js, TypeScript e Tailwind, preservando toda a lógica já existente.

Princípios visuais principais

Visual clean, moderno e acolhedor
Estética inspirada em ambiente hospitalar e digital de autoatendimento
Aparência profissional, simples e confiável
Hierarquia visual muito clara
Uso predominante de tons claros com azul como cor principal de destaque
Layout com boa respiração, espaçamento generoso e baixa poluição visual
Interface pensada primeiro para mobile, mas funcionando bem em telas maiores

Prioridade máxima de UX
O elemento mais importante da tela é a senha gerada.
Ela deve ser o maior ponto de atenção visual do /totem.

A senha gerada precisa ter:

Tipografia grande
Peso visual forte
Excelente contraste
Leitura imediata
Destaque visual superior a qualquer outro bloco da tela

Direção visual do ticket/senha gerada

O card da senha gerada deve ter presença forte na tela
A área da senha deve parecer “o centro” da experiência
O número/letra principal da senha deve usar tipografia mais encorpada, pesada e impactante
A leitura da senha precisa ser fácil para pessoas com baixa visão
O bloco deve transmitir sensação de confirmação, clareza e segurança
Os botões de ação ligados à senha gerada devem parecer grandes, táteis e evidentes

Direção para botões

Botões grandes e fáceis de tocar
Bordas suaves e acabamento moderno
Boa distinção entre botão principal e secundário
Visual consistente em mobile
Estados visuais claros para hover, focus, active e disabled
O foco precisa ficar visível para acessibilidade

Direção para a área de seleção de atendimento

Os cards ou botões das opções de atendimento devem ser visualmente limpos e fáceis de entender
As opções precisam parecer simples, rápidas e confiáveis
O texto de cada opção deve ter boa legibilidade
Ícones podem existir, mas não devem competir com a senha gerada
O visual deve priorizar entendimento imediato e facilidade de toque

Paleta visual desejada

Base clara
Azul principal mais vivo e moderno
Tons neutros suaves para fundo e superfícies
Contraste suficiente para acessibilidade
Evitar excesso de cores concorrentes
O azul deve ser usado para reforçar ações, destaques e identidade principal da tela

Tipografia

Tipografia clara, moderna e altamente legível
Títulos com presença forte
Senha gerada com peso visual ainda maior que os títulos
Hierarquia tipográfica bem definida entre:
título principal
instrução
opções de atendimento
senha gerada
ações

Responsividade

O /totem deve ser tratado como mobile-first
O layout precisa funcionar muito bem em largura de celular
O conteúdo não deve parecer apertado ou improvisado em telas pequenas
Em telas maiores, a interface pode respirar mais, mas sem perder o foco do fluxo principal
A experiência deve continuar fluida em tablets e monitores

Acessibilidade
A evolução visual nunca pode quebrar os recursos de acessibilidade já implementados.

É obrigatório preservar:

modo alto contraste
modo de voz guiado no /totem
foco visível
boa legibilidade
bom contraste entre texto e fundo
botões acessíveis e fáceis de localizar

Regras importantes para implementação

Não alterar a lógica funcional do /totem
Não quebrar a geração de senha
Não quebrar o modo de alto contraste
Não quebrar o modo de voz guiado
Não substituir a arquitetura atual por HTML bruto exportado
Implementar o novo visual diretamente no projeto atual
Usar as referências desta pasta apenas como guia visual e estrutural
Priorizar mudanças visuais seguras, limpas e revisáveis

O que deve ser preservado

Estrutura funcional existente
Fluxo de emissão de senha
Comportamento de acessibilidade já implementado
Compatibilidade com Tailwind
Compatibilidade com mobile
Clareza da interface

O que deve ser melhorado

Aparência geral do /totem
Destaque da senha gerada
Qualidade visual do card principal
Acabamento dos botões
Hierarquia visual
Sensação de produto real e profissional
Experiência mobile

Resumo da intenção
O /totem deve parecer um produto real de autoatendimento para saúde:
moderno,
limpo,
confiável,
acolhedor,
acessível
e extremamente claro na hora de mostrar a senha gerada.