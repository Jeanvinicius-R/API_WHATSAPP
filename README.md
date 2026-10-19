# BACK-END EXPERIENCE · Feira de Profissões 2026

> **O que acontece por trás de cada clique?**
> Experiência web interativa que apresenta a profissão de **Desenvolvedor Back-end** e demonstra, na prática, como uma API funciona: o visitante faz um quiz e recebe o resultado em uma **mensagem real de WhatsApp**, enquanto a tela mostra o caminho da requisição (navegador → API Express → validação → integração WhatsApp → destinatário).

---

## 1. Objetivo

- Ensinar, com linguagem simples, o que faz quem trabalha com back-end (servidores, APIs, bancos de dados, segurança…).
- Mostrar dados reais e **verificáveis** do mercado (salários no Brasil e no exterior, com fontes e links).
- Divertir com um quiz (8 perguntas sorteadas de um banco de 25).
- Demonstrar o back-end funcionando de verdade: o envio de WhatsApp é real, e os estados exibidos na tela vêm do servidor (nada é "encenado" no front-end).

## 2. Tecnologias

| Camada | Tecnologia |
|---|---|
| Servidor | Node.js 20+ · Express 4 · helmet · express-rate-limit |
| WhatsApp | [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js) (biblioteca **não oficial**) · LocalAuth · qrcode |
| Front-end | HTML + CSS + JavaScript puro (ES Modules) — sem build, sem framework, funciona offline na rede local |
| Testes | `node:test` (embutido no Node, sem dependência extra) |

Decisão: **não foi usado React/Vite/etc.** — o ganho não compensaria a complexidade para um projeto que precisa ser estável e simples de rodar na feira.

## 3. Requisitos

- **Windows 10/11** com **[Node.js LTS](https://nodejs.org) 20 ou superior** (inclui o `npm`).
- Para o WhatsApp real: Google Chrome ou Edge instalado (o `whatsapp-web.js` usa o Puppeteer) e um celular com WhatsApp para ler o QR Code.
- Internet no momento de instalar as dependências e, na feira, para o envio real. **O modo demonstração funciona sem internet.**

## 4. Instalação

```powershell
npm install
```

> A primeira instalação baixa o Chromium do Puppeteer (~170 MB). Se a rede da faculdade bloquear, defina `PUPPETEER_SKIP_DOWNLOAD=1` antes do `npm install` e informe o caminho do Chrome em `CHROME_PATH` (veja abaixo).

Configuração (opcional, mas recomendada):

```powershell
copy .env.example .env
notepad .env
```

Defina pelo menos `ADMIN_TOKEN` com um valor longo e aleatório. Se ficar vazio, um token temporário é gerado a cada início e mostrado no terminal.

## 5. Como iniciar

```powershell
npm start            # modo normal (WhatsApp real)
npm run start:demo   # modo demonstração (nenhuma mensagem real)
```

## 6. Como acessar

| O quê | Endereço |
|---|---|
| Experiência (para os visitantes) | http://localhost:3000 |
| Área administrativa (apenas neste computador) | http://localhost:3000/admin |

Para exibir em uma TV: conecte o notebook, abra a experiência no navegador e clique em **⛶ (modo apresentação)** ou aperte **F**.

Atalhos: `←`/`→` navegam entre seções · `Alt+1…7` vai direto a uma seção · `F` tela cheia + textos maiores · `R` reinicia para o próximo visitante · `Home` volta ao início · no quiz, `A–D` ou `1–4` respondem.

## 7. Como conectar o WhatsApp

1. Rode `npm start`. O terminal mostrará `WhatsApp aguardando leitura do QR Code`.
2. No **notebook**, abra `http://localhost:3000/admin` e entre com o `ADMIN_TOKEN`.
3. O **QR Code** aparece no painel (nunca na tela pública). No celular: **WhatsApp → Aparelhos conectados → Conectar um aparelho** e leia o código.
4. Quando o painel mostrar **Conectado** e "Envio real possível? **Sim**", está pronto.

A sessão fica salva em `.wwebjs_auth/` (já no `.gitignore`), então nas próximas execuções normalmente **não é preciso ler o QR de novo**. **Nunca** envie essa pasta ao Git nem a compartilhe: ela dá acesso à conta conectada.

> 💡 Recomendação: use um **número/chip exclusivo do evento**, não o seu WhatsApp pessoal (veja os riscos em [docs/WHATSAPP.md](docs/WHATSAPP.md)).

## 8. Como usar o quiz

1. **Quiz → Começar.** São 8 perguntas (3 fáceis, 3 médias, 2 difíceis), uma por vez, com 4 alternativas, feedback imediato, explicação e barra de progresso. Não há cronômetro.
2. Ao final aparecem pontuação, percentual e um título lúdico: 0–2 *Explorador da Tecnologia* · 3–4 *Aprendiz de Back-end* · 5–6 *Desenvolvedor em Evolução* · 7–8 *Futuro Mestre das APIs*.
3. **Receber no WhatsApp:** o visitante informa o celular (e, se quiser, um apelido), marca o **consentimento explícito** e envia. A seção **"O que acontece por trás do botão?"** mostra cada etapa conforme o servidor a reporta, a requisição `POST /api/quiz/enviar-resultado`, o JSON (sem dados sensíveis) e o código HTTP devolvido.

Regras do servidor: o texto da mensagem é **sempre escolhido pelo servidor** (≥ 15 mensagens motivadoras + mensagens por classificação); a pontuação é **calculada no servidor** (o navegador não consegue "inventar" uma nota); 1 envio por partida; limite de envios por número, por hora e por minuto; números só do Brasil (celular com DDD válido).

## 9. Área administrativa

`http://localhost:3000/admin` — só responde a conexões vindas **do próprio computador**, exige o token do `.env` (trocado por cookie HttpOnly/SameSite=Strict) e nunca é carregada pela interface pública. Permite:

- ver o estado do WhatsApp, ler o QR Code, reiniciar a conexão;
- ver erros operacionais recentes (sem números completos) e os contadores da execução (enviadas, simuladas, falhas, bloqueadas);
- **Ativar/desativar o modo demonstração**;
- **Reiniciar a experiência visual** — todas as telas abertas voltam ao início em até 5 s.

## 10. Modo demonstração

Simula todo o fluxo **sem tocar no WhatsApp** (ideal se a internet ou a conexão cair). Fica claramente identificado na tela (selo "SIMULADO — nenhuma mensagem real" e faixa "MODO DEMONSTRAÇÃO"). Ative por:

- painel `/admin` (checkbox, vale na hora), ou
- `npm run start:demo`, ou `DEMO_MODE=true` no `.env`.

A seção **Demonstração** do menu roda o mesmo fluxo sempre simulado, sem pedir número — ótima para explicar a API sem enviar nada.

## 11. Solução de problemas

| Sintoma | O que fazer |
|---|---|
| `node` não é reconhecido | Instale o Node.js LTS e **reabra** o terminal/VS Code. |
| Falha ao baixar o Chromium | Use `PUPPETEER_SKIP_DOWNLOAD=1 npm install` e defina `CHROME_PATH` no `.env`. |
| `A porta 3000 já está em uso` | Feche o outro programa ou mude `PORT` no `.env`. |
| QR Code não aparece | Aguarde ~1 min na primeira vez; veja o estado no `/admin`; use **Reiniciar WhatsApp**. |
| "Desconectado" / "Falha de autenticação" | Reinicie o WhatsApp pelo painel. Se persistir, apague a pasta `.wwebjs_auth/` com o servidor **parado** e leia o QR de novo. |
| Visitante vê "WhatsApp indisponível" | O envio é bloqueado de propósito. Resolva a conexão ou ative o **modo demonstração**. |
| "Esse número já recebeu o limite…" | Esperado (1 envio por número por execução, `MAX_SENDS_PER_NUMBER`). Reiniciar o servidor zera os limites. |
| "Não encontramos WhatsApp nesse número" | O número não tem WhatsApp ou foi digitado errado. |
| Admin abre "Rota não encontrada" | Acesse pelo próprio notebook (`localhost`); de outros dispositivos o `/admin` é bloqueado de propósito. |

## 12. Roteiro para usar na feira

**Antes (30 min antes):** `npm start` → `/admin` → conectar o WhatsApp → fazer **um envio de teste para o seu próprio número** → conferir o painel (Conectado, 0 erros) → abrir a experiência em tela cheia (`F`) na TV.

**Durante:** deixe a experiência na tela inicial. Entre visitantes, aperte **R** (ou o botão ⟲) para reiniciar. Use *Rotina*, *Salários* e *Tecnologias* para conversar; leve o visitante ao *Quiz* e, no final, mostre a *Demonstração* do que aconteceu por trás do botão.

**Plano B:** se o WhatsApp ou a internet falhar, ative o **modo demonstração** no `/admin` e continue — a experiência inteira segue funcionando. Mantenha o celular conectado ao Wi-Fi e com bateria.

**Depois:** encerre com `Ctrl+C`. Nada é gravado em disco além da sessão do WhatsApp; os números de telefone existem apenas em memória durante o envio.

---

## Segurança e privacidade (resumo)

- **Consentimento explícito** (caixa marcada) é exigido pelo servidor; envio **apenas** ao número informado, sem disparo em massa.
- **Texto fixo no servidor**: o visitante só pode informar um apelido (apenas letras, até 20 caracteres).
- **Limites**: por número, por hora (global), por minuto (rate limit) e 1 envio por partida; verificação de duplicidade.
- **Números não são persistidos** nem aparecem inteiros nos logs (`+5516*******67`); para limites usa-se um hash HMAC com chave aleatória que só existe em memória.
- **QR Code** nunca é exposto publicamente nem registrado no log; só no `/admin` autenticado e local.
- **Admin** restrito a localhost + token do `.env` (nunca no front-end) + cookie `HttpOnly; SameSite=Strict` + checagem de `Origin`.
- Cabeçalhos de segurança (helmet/CSP restritiva: scripts apenas do próprio servidor), corpo JSON limitado a 2 KB, erros sem detalhes internos.
- `.env`, `.wwebjs_auth/` e `.wwebjs_cache/` estão no `.gitignore`.
- Por padrão o servidor escuta **apenas em 127.0.0.1**. Mudar `HOST` para `0.0.0.0` expõe a experiência na rede (o `/admin` continua restrito ao computador local).

## Sobre o whatsapp-web.js

É uma biblioteca **não oficial** que automatiza o WhatsApp Web. Foi mantida porque o projeto já a usava e atende bem a um evento curto, mas tem limitações e riscos (desconexões, quebra por mudanças do WhatsApp, possível restrição da conta). Detalhes, mitigação e a alternativa oficial (WhatsApp Business Platform / Cloud API) em **[docs/WHATSAPP.md](docs/WHATSAPP.md)**.

## Dados salariais

Tudo fica em [`src/data/salarios.json`](src/data/salarios.json) (servido em `/api/salarios`). Cada série traz fonte, **link**, período, cargo/categoria, moeda, periodicidade (mensal/anual/hora), cobertura e limitações. Regras seguidas: não misturar mensal com anual; não tratar "engenheiro de software" como exclusivo de back-end sem avisar; **não inventar** — Portugal aparece como "dado confiável não encontrado". Conversão para reais mostra valor original, câmbio e data de referência, com o aviso de que não considera impostos nem custo de vida.

Fontes usadas (consultadas em **19/10/2026**): Portal Salário (CAGED, CBO 3171-10) · Robert Half Brasil (Guia Salarial 2026, páginas de São Paulo e Curitiba) · U.S. Bureau of Labor Statistics (maio/2025) · Stack Overflow Developer Survey 2025 · Job Bank Canadá/Statistics Canada · câmbio do Banco Central Europeu via Frankfurter. Para atualizar, edite o JSON (e `cambio.reaisPorUnidade`/`dataReferencia`) e reinicie.

> ⚠️ A Robert Half não rotula explicitamente moeda e periodicidade nas páginas consultadas; os valores são compatíveis com salário mensal em reais (isso é dito na própria interface). Os dados do Stack Overflow 2025 são os últimos que conseguimos ler com salário por país; a pesquisa de 2026 já foi publicada, mas sua tabela salarial não estava acessível.

## Estrutura do projeto

```
src/
  server.js            inicialização (porta, WhatsApp em segundo plano, encerramento)
  app.js               monta o Express (helmet, limites, rotas, estáticos, erros)
  config.js            variáveis de ambiente
  validation.js        celular brasileiro, máscaras, apelido
  logger.js            logs + buffer de erros (sem dados sensíveis)
  routes/public.js     API pública (/api/…)
  routes/admin.js      área administrativa (/admin/…)
  services/whatsapp.js integração whatsapp-web.js (estados, QR, envio, acks)
  services/quiz.js     sorteio, correção e pontuação no servidor
  services/sender.js   validações, limites e pipeline de envio com estados reais
  data/                perguntas, mensagens, salarios.json
  admin/               tela administrativa
public/                experiência (index.html, css/, js/ — um módulo por seção)
test/                  testes automatizados
docs/WHATSAPP.md       riscos e alternativas da integração
```

## Testes

```powershell
npm test
```

### O que foi efetivamente testado (em 19/10/2026)

Executado com **45 testes automatizados, todos passando**, mais verificação manual assistida no Chrome:

- Validação de celulares (formatos, DDDs, fixos, repetidos, DDD 55), máscaras e apelido.
- Quiz: banco (≥ 20 perguntas, 4 alternativas, 3 níveis), pontuação e classificação de 0 a 8 acertos, respostas duplicadas/inválidas, expiração de sessão, não vazamento da resposta correta.
- Mensagens: ≥ 15 aleatórias + por classificação, personalização e variedade do sorteio.
- Envio: consentimento, sessão/quiz incompleto, uma partida = um envio, limite por número (formatos diferentes), limite por hora, WhatsApp desconectado (503), número sem WhatsApp, falha e timeout da biblioteca, modo demonstração, ausência de número completo em logs/JSON, estados só "ok" após confirmação, confirmações `ack` (entregue/lida).
- API HTTP real (Express + helmet + rate limit): rotas, CSP, rate limit do envio, JSON inválido, bloqueio de dotfiles, admin (401 sem login, token, cookie HttpOnly/SameSite, Origin, QR nunca público).
- Serviço de WhatsApp com cliente falso: estados qr → authenticated → ready → disconnected, falha ao iniciar, `auth_failure`, `WHATSAPP_ENABLED=false`, QR fora de logs/status.
- Dados salariais: todas as séries com fonte https, período, cargo, moeda e periodicidade; Portugal sinalizado como indisponível.
- `npm install` resolveu todas as dependências (express 4.22, whatsapp-web.js 1.34.7) e a biblioteca carrega.
- **Navegador (Chrome headless, 1920×1080 e 390×844):** navegação por todas as seções, simulador de login, linha do tempo, gráficos salariais (com e sem conversão), cartões de tecnologia, quiz completo, formulário e validações, pipeline com estados em tempo real (envio de WhatsApp com cliente **falso**, falha por limite, indisponibilidade, modo demo), reinício remoto pelo admin, painel admin, atalhos de teclado, ausência de rolagem horizontal no celular e **zero erros inesperados de console** contra o servidor real com a CSP ativa.

### O que ainda exige validação manual

- **Envio com um WhatsApp de verdade** (leitura do QR, `getNumberId`, `sendMessage`, recebimento no celular e as confirmações de entrega): os testes usam um cliente falso. **Faça um envio de teste antes da feira.**
- Instalação limpa no notebook da feira (Node + `npm install` + download do Chromium na rede da faculdade).
- Visual na **TV real** (legibilidade à distância, proporção, tela cheia — o headless não testa a Fullscreen API) e em celular/tablet físicos.
- Navegadores além do Chrome (Edge/Firefox/Safari) e leitores de tela.
- Conferir se os valores e links das fontes salariais ainda são os mesmos no dia (sites mudam).
