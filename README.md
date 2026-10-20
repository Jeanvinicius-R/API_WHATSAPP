# BACK-END EXPERIENCE · Feira de Profissões 2026

> **O que acontece por trás de cada clique?**
> Apresentação curta e interativa sobre desenvolvimento **back-end**, com quatro partes: **Início**, **Linguagens**, **Salários** e **Mensagem** — nesta última, o visitante lê um **QR Code**, envia a mensagem que já vem escrita no WhatsApp e o servidor responde explicando o back-end com a analogia do **motor do carro**.

**Versão online (só visualização):** https://jeanvinicius-r.github.io/API_WHATSAPP/ — veja a seção [Versão online](#versão-online-github-pages).

> O projeto já teve também quiz, rotina e seção "o que é back-end". Foram removidos para deixar a apresentação curta; continuam no histórico do Git (commit `e0990c0`).

---

## 1. Como a apresentação funciona

| Seção | O que mostra |
|---|---|
| **Início** | Título e uma animação de uma requisição indo do dispositivo ao servidor e voltando. |
| **Linguagens** | JavaScript/TypeScript, Python, Java, C#, PHP e Go, com descrição e exemplo de uso (cartões que viram ao toque). |
| **Salários** | Brasil, EUA, Canadá e Alemanha, com fontes e links; Portugal aparece como "dado confiável não encontrado". |
| **Mensagem** | Um **QR Code** abre o WhatsApp do evento com a mensagem pronta. Quem enviar recebe, em sequência, 3 respostas do servidor (o back-end é o motor do carro: painel = front-end, acelerador = requisição, motor = back-end, tanque = banco de dados). Ao lado, a animação **"O caminho até o motor"** e um contador ao vivo de pessoas atendidas. |

Regras: o texto é **sempre escolhido pelo servidor** (`src/data/motor.js`); só responde a mensagens com "back-end" ou "motor" (o QR já traz o texto); **1 resposta por pessoa** e limite por hora; o contato é guardado só como hash em memória e a tela mostra apenas "Visitante #N"; nada vai para disco. Muitas pessoas podem ler o mesmo QR Code.

## 2. Tecnologias

Node.js 20+ · Express 4 · helmet · express-rate-limit · [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js) (biblioteca **não oficial**) · front-end em HTML/CSS/JavaScript puro (sem build) · testes com `node:test`.

## 3. Requisitos

- **Windows 10/11** com **[Node.js LTS](https://nodejs.org) 20+** (inclui o `npm`).
- Para o WhatsApp real: Google Chrome ou Edge e um celular com WhatsApp para ler o QR Code.
- Internet na instalação e, na feira, para o envio real. **O modo demonstração funciona sem internet.**

## 4. Instalação

```powershell
npm install
copy .env.example .env
notepad .env      # defina ADMIN_TOKEN (valor longo e aleatório)
```

> A primeira instalação baixa o Chromium do Puppeteer (~170 MB). Se a rede bloquear, rode com `PUPPETEER_SKIP_DOWNLOAD=1` e informe o caminho do Chrome em `CHROME_PATH` no `.env`.

## 5. Iniciar e acessar

```powershell
npm start            # WhatsApp real
npm run start:demo   # modo demonstração (nenhuma mensagem real)
```

| O quê | Endereço |
|---|---|
| Apresentação (visitantes) | http://localhost:3000 |
| Administração (só neste computador) | http://localhost:3000/admin |

Na TV: abra a apresentação e aperte **F** (tela cheia + textos maiores). Atalhos: `←`/`→` navegam · `Alt+1…4` vai direto a uma seção · `R` reinicia para o próximo visitante · `Home` volta ao início.

## 6. Conectar o WhatsApp

1. Rode `npm start`. O terminal mostrará `WhatsApp aguardando leitura do QR Code`.
2. No notebook, abra `http://localhost:3000/admin` e entre com o `ADMIN_TOKEN`.
3. Leia o **QR Code** do painel: WhatsApp → **Aparelhos conectados** → **Conectar um aparelho**.
4. Quando o painel mostrar **Conectado** e "Envio real possível? **Sim**", está pronto.

A sessão fica em `.wwebjs_auth/` (no `.gitignore`); nas próximas execuções normalmente não é preciso ler o QR de novo. **Nunca** envie essa pasta ao Git. Use, de preferência, um **chip exclusivo do evento** — riscos e alternativa oficial em [docs/WHATSAPP.md](docs/WHATSAPP.md).

## 7. Área administrativa e modo demonstração

`/admin` só responde a conexões do próprio computador e exige o token do `.env`. Permite ver o estado do WhatsApp, ler o QR Code, reiniciar a conexão, ver erros e contadores, **ativar/desativar o modo demonstração** e **reiniciar a apresentação** (as telas abertas voltam ao início em até 5 s).

O **modo demonstração** não envia nem responde nada real (o QR Code fica desligado e a animação do motor continua disponível). Fica identificado na tela. Ative pelo `/admin`, por `npm run start:demo` ou `DEMO_MODE=true`.

## 8. Problemas comuns

| Sintoma | O que fazer |
|---|---|
| `node` não é reconhecido | Instale o Node.js LTS e **reabra** o terminal/VS Code. |
| Falha ao baixar o Chromium | `PUPPETEER_SKIP_DOWNLOAD=1 npm install` e defina `CHROME_PATH`. |
| `A porta 3000 já está em uso` | Feche o outro programa ou mude `PORT` no `.env`. |
| QR Code não aparece | Aguarde ~1 min; veja o estado no `/admin`; use **Reiniciar WhatsApp**. |
| "Desconectado" / "Falha de autenticação" | Reinicie o WhatsApp pelo painel. Se persistir, apague `.wwebjs_auth/` com o servidor **parado** e leia o QR de novo. |
| "WhatsApp indisponível" | O envio é bloqueado de propósito. Resolva a conexão ou ative o **modo demonstração**. |
| "Esse número já recebeu o limite…" | Esperado (`MAX_SENDS_PER_NUMBER=1`). Reiniciar o servidor zera os limites. |
| `/admin` diz "Rota não encontrada" | Acesse pelo próprio notebook (`localhost`). |

## 9. Roteiro para a feira

**Antes:** `npm start` → `/admin` → conectar o WhatsApp → **ler o QR da apresentação com o seu celular e conferir a resposta** → abrir a apresentação em tela cheia (`F`).
**Durante:** deixe no *Início*; entre visitantes aperte **R**. Conte sobre *Linguagens* e *Salários* e, na *Mensagem*, peça a um voluntário para receber o WhatsApp enquanto você explica cada etapa na tela.
**Plano B:** WhatsApp ou internet falhou? Ative o **modo demonstração** no `/admin` e continue.
**Depois:** `Ctrl+C`. Nada é gravado em disco além da sessão do WhatsApp; números existem só em memória durante o envio.

---

## Versão online (GitHub Pages)

O Pages só serve arquivos estáticos: **não há servidor Node nem WhatsApp lá.** A versão online usa o mesmo front-end com um **back-end simulado dentro do navegador** ([`public/js/static-api.js`](public/js/static-api.js)): as etapas do envio funcionam, mas **nenhuma mensagem é enviada** e nenhum dado sai do aparelho do visitante (a tela avisa: "VERSÃO ONLINE · BACK-END SIMULADO"). O envio real só existe com `npm start`.

- O site é gerado por `node scripts/build-pages.js` (pasta `_site/`, ignorada pelo Git) e publicado por [`.github/workflows/pages.yml`](.github/workflows/pages.yml) a cada push na `main`.
- **Configuração única:** em **Settings → Pages → Build and deployment → Source**, escolha **GitHub Actions** (a opção "Deploy from a branch" mostra apenas este README).
- A área `/admin` nunca é publicada.

## Segurança e privacidade

- **Consentimento explícito** exigido pelo servidor; envio **apenas** ao número informado, sem disparo em massa.
- **Texto fixo no servidor**: o visitante só pode informar um apelido (letras, até 20 caracteres).
- **Limites**: por número, por hora (global) e por minuto (rate limit); pedido duplicado em andamento é barrado.
- **Números não são persistidos** nem aparecem inteiros nos logs (`+5516*******67`); os limites usam um hash HMAC com chave aleatória que só existe em memória.
- **QR Code** nunca é público nem vai para o log; só no `/admin` autenticado e local.
- **Admin** restrito a localhost + token do `.env` + cookie `HttpOnly; SameSite=Strict` + checagem de `Origin`.
- helmet/CSP restritiva, corpo JSON limitado a 2 KB, erros sem detalhes internos; `.env` e `.wwebjs_auth/` no `.gitignore`.
- Por padrão o servidor escuta **apenas em 127.0.0.1**. `HOST=0.0.0.0` expõe a apresentação na rede (o `/admin` continua restrito ao computador local).

## Dados salariais

Ficam em [`src/data/salarios.json`](src/data/salarios.json) (servidos em `/api/salarios`): fonte, **link**, período, cargo/categoria, moeda, periodicidade (mensal/anual/hora), cobertura e limitações. Não se mistura mensal com anual, não se trata "desenvolvedor de software" como exclusivo de back-end sem avisar, e **não se inventa**: Portugal aparece como "dado confiável não encontrado". A conversão para reais mostra valor original, câmbio e data, com o aviso de que não considera impostos nem custo de vida.

Fontes (consultadas em **19/10/2026**): Portal Salário (CAGED, CBO 3171-10) · Robert Half Brasil (São Paulo e Curitiba) · U.S. Bureau of Labor Statistics (maio/2025) · Stack Overflow Developer Survey 2025 · Job Bank Canadá/Statistics Canada · câmbio do Banco Central Europeu via Frankfurter. Para atualizar, edite o JSON (e `cambio`) e reinicie.

> ⚠️ A Robert Half não rotula moeda e periodicidade nas páginas consultadas; os valores são compatíveis com salário mensal em reais (a interface diz isso). A pesquisa do Stack Overflow 2026 já saiu, mas sua tabela salarial não estava acessível.

## Estrutura

```
src/
  server.js  app.js  config.js  validation.js  logger.js
  routes/public.js       API pública (/api/…)
  routes/admin.js        área administrativa (/admin/…)
  services/whatsapp.js   integração whatsapp-web.js (estados, QR, envio, acks)
  services/sender.js     validações, limites e pipeline de envio com estados reais
  data/                  mensagens.js, salarios.json
  admin/                 tela administrativa
public/                  apresentação (index.html, css/, js/)
scripts/build-pages.js   gera a versão estática (GitHub Pages)
test/                    testes automatizados
docs/WHATSAPP.md         riscos e alternativas da integração
```

## Testes

```powershell
npm test
```

**Efetivamente testado (19/10/2026): 42 testes automatizados, todos passando**, mais verificação manual no Chrome:

- Validação de celulares, máscaras e apelido; mensagens (≥ 15, personalização, variedade).
- Envio: consentimento, limites por número/hora, duplo clique, WhatsApp desconectado (503), número sem WhatsApp, falha e timeout da biblioteca, modo demonstração, ausência de número completo em logs/JSON, etapas só "ok" após confirmação, confirmações `ack`.
- API HTTP real (Express + helmet + rate limit): rotas, CSP, JSON inválido, bloqueio de dotfiles, admin (401 sem login, cookie, Origin, QR nunca público).
- Serviço de WhatsApp com cliente falso (estados, falhas, QR fora de logs); dados salariais (fontes https, período, moeda, periodicidade).
- Versão estática: build correto e back-end simulado.
- `npm install` resolve as dependências e o `whatsapp-web.js` abre o Chrome e gera o QR Code.
- **Navegador (Chrome headless, 1920×1080 e celular):** as quatro seções, formulário e validações, pipeline em tempo real, modo demonstração, versão servida em subpasta como no Pages, sem rolagem horizontal e sem erros de console.

**Ainda exige validação manual:** o **envio com um WhatsApp de verdade** (os testes usam um cliente falso — faça um envio de teste antes da feira), a instalação limpa no notebook da feira, o visual na **TV real** e em outros navegadores, e o **deploy no GitHub Pages** (depende de ativar a fonte "GitHub Actions").
