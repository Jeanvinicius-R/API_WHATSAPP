# Integração com WhatsApp — limitações, riscos e alternativas

## O que está implementado

[`src/services/whatsapp.js`](../src/services/whatsapp.js) usa o **whatsapp-web.js**, que controla uma instância do **WhatsApp Web** dentro de um Chromium (Puppeteer). A autenticação usa `LocalAuth` (sessão salva em `.wwebjs_auth/`).

Fluxo de envio ([`sender.js`](../src/services/sender.js)): validações → `client.getNumberId()` (confirma que o número existe e resolve o 9º dígito) → `client.sendMessage()`. A interface só marca "Integração acionada" depois que `sendMessage` resolve, e só mostra **entrega** quando chega o evento `message_ack` (≥ 2 = entregue ao aparelho).

> **"Envio aceito pela biblioteca" não é "mensagem entregue".** Por isso a tela diferencia as duas coisas e, sem `ack` em 20 s, diz "sem confirmação técnica de entrega".

## Limitações e riscos

| Risco | Detalhe | Mitigação adotada |
|---|---|---|
| **Biblioteca não oficial** | Não é suportada nem autorizada pela Meta; os Termos de Serviço do WhatsApp restringem automação não oficial. | Uso limitado, sob demanda do próprio visitante, sem mensagens em massa. |
| **Risco de bloqueio da conta** | Contas que automatizam podem ser restringidas/banidas, principalmente com volume, mensagens repetidas ou denúncias. | Consentimento explícito, 1 mensagem por pessoa, limites por número/hora/minuto, texto controlado, **use um chip exclusivo do evento**. |
| **Quebra por atualização** | Mudanças no WhatsApp Web podem quebrar a biblioteca sem aviso (envio falha, `ready` nunca chega). | Estados visíveis no `/admin`, envio bloqueado quando desconectado, **modo demonstração** como plano B, teste antes do evento. |
| **Desconexões** | O celular precisa permanecer ligado/online; a sessão pode expirar. | Reconexão automática (até 5 tentativas com espera crescente) e botão "Reiniciar WhatsApp". |
| **Consumo de recursos** | Roda um Chromium em segundo plano. | Headless; sem interface. |
| **Segurança da sessão** | `.wwebjs_auth/` dá acesso à conta. | No `.gitignore`; nunca servida pelo Express; QR só no admin local. |
| **Entrega não garantida** | `ack` depende do WhatsApp; pode atrasar ou não chegar. | Interface mostra "sem confirmação técnica" em vez de afirmar entrega. |

## Alternativa oficial: WhatsApp Business Platform (Cloud API)

Se o projeto for além de um evento pontual, recomenda-se migrar para a **API oficial da Meta**:

- Conformidade com os termos, sem risco de banimento por automação não oficial e com confirmações de entrega/leitura por *webhook*.
- Exige: conta Meta Business verificada, número dedicado, app na Meta, token de acesso e **templates de mensagem aprovados** para iniciar conversas fora da janela de 24 h.
- Tem custo por conversa/mensagem conforme a categoria, e configuração mais longa (dias, não minutos).

Como migrar com pouco esforço: apenas `services/whatsapp.js` conversa com o provedor. Trocar sua implementação por chamadas HTTP à Cloud API (mantendo `isReady()`, `resolveNumber()`, `sendText()` e o evento `ack`, que viria do webhook) não exige mudar `sender.js` nem a interface. **Não misture os dois serviços** na mesma execução: a tela descreve exatamente a tecnologia em uso.

## Boas práticas para o dia do evento

1. Chip/número exclusivo, WhatsApp atualizado no celular, celular carregado e no Wi-Fi.
2. Teste um envio real **antes** de abrir ao público.
3. Mantenha `MAX_SENDS_PER_NUMBER=1` e os limites padrão.
4. Deixe o **modo demonstração** a um clique no `/admin`.
5. Após o evento, desconecte o aparelho (WhatsApp → Aparelhos conectados) e apague `.wwebjs_auth/`.
