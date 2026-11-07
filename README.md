# Templo Itarobá: app do acervo

App (PWA) com as palestras e os pontos cantados do Templo Itarobá, **exclusivo para membros**.

🔗 https://marcos7ut.github.io/Itaroba/

## Como funciona

- **Este repositório é público e tem só o código do app.** Nenhuma palestra, PDF ou áudio fica aqui.
- O conteúdo fica na **pasta privada `acervo` do Supabase**: só membros aprovados conseguem abrir, por links que vencem em 1 hora.
- Entrar com Google → pedido de acesso (nome, sobrenome, gira e WhatsApp) → o administrador aprova, nega ou remove pelo **Painel** (escudo no menu).
- As regras de segurança ficam no banco de dados, não só na tela.
- **Segurança do acesso**: pedido só com código de convite de uso único (gerado no Painel, vale 7 dias); um cadastro por WhatsApp; cada membro usa 1 aparelho (o administrador libera +1, máximo 2, e pode desconectar); 3 meses sem entrar exige nova aprovação. A trava de aparelho é no servidor.
- Pode haver mais de um administrador (Painel → Aprovados → Tornar administrador).
- **Estudos**: cada palestra tem um questionário (aba "Questionário"); a cada 5 palestras estudadas, um simulado de 10 perguntas (7 para passar) libera as próximas. "Meus estudos" mostra o progresso; o Painel mostra o de todos ("Estudos dos membros"). O gabarito fica só no banco. "Pontos principais" só para administradores.
- **PDFs só para leitura**, num leitor dentro do app (`assets/leitor-pdf.js`, com PDF.js 3.11.174, Apache-2.0). Baixar só para administradores e para quem foi liberado no Painel ("Pode baixar PDFs").

## Onde fica cada coisa

| Repositório | O que tem |
|---|---|
| `Itaroba` (este, público) | O app: `index.html`, `config.js`, `assets/`, `sw.js`, `privacidade.html` |
| `Itaroba-acervo` (privado) | O conteúdo (`data/`, `pdfs/`, `audio/`), o banco (`supabase/*.sql`), o passo a passo (`supabase/COMO-CONFIGURAR.md`) e os robôs que enviam o acervo ao Supabase e o mantêm acordado |

Para adicionar palestras ou pontos: coloque no **Itaroba-acervo**. O robô envia sozinho para a pasta privada.

## Configuração

`config.js` → `acesso`: endereço do Supabase e a chave **pública** (anon). Nenhuma chave secreta fica neste repositório.

Biblioteca usada: `assets/vendor/supabase-2.117.3.js` (MIT).
