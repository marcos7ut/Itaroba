# Templo Itarobá: app do acervo

App (PWA) com as palestras e os pontos cantados do Templo Itarobá, **exclusivo para membros**.

🔗 https://marcos7ut.github.io/Itaroba/

## Como funciona

- **Este repositório é público e tem só o código do app.** Nenhuma palestra, PDF ou áudio fica aqui.
- O conteúdo fica na **pasta privada `acervo` do Supabase**: só membros aprovados conseguem abrir, por links que vencem em 1 hora.
- Entrar com Google → pedido de acesso (nome, sobrenome, gira e WhatsApp) → o administrador aprova, nega ou remove pelo **Painel** (escudo no menu).
- As regras de segurança ficam no banco de dados, não só na tela.

## Onde fica cada coisa

| Repositório | O que tem |
|---|---|
| `Itaroba` (este, público) | O app: `index.html`, `config.js`, `assets/`, `sw.js`, `privacidade.html` |
| `Itaroba-acervo` (privado) | O conteúdo (`data/`, `pdfs/`, `audio/`), o banco (`supabase/*.sql`), o passo a passo (`supabase/COMO-CONFIGURAR.md`) e os robôs que enviam o acervo ao Supabase e o mantêm acordado |

Para adicionar palestras ou pontos: coloque no **Itaroba-acervo**. O robô envia sozinho para a pasta privada.

## Configuração

`config.js` → `acesso`: endereço do Supabase e a chave **pública** (anon). Nenhuma chave secreta fica neste repositório.

Biblioteca usada: `assets/vendor/supabase-2.117.3.js` (MIT).
