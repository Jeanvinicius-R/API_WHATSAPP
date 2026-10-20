'use strict';

/** Texto que o QR Code deixa pré-escrito no WhatsApp do visitante (precisa casar com GATILHO). */
const TEXTO_INICIAL = 'Oi! Quero entender o que é back-end 🚗';

/** Palavras que disparam a resposta automática. Mensagens sem isso são ignoradas. */
const GATILHO = /back-?end|motor/i;

/** Respostas enviadas em sequência (o texto é sempre escolhido pelo servidor). */
const MENSAGENS_MOTOR = [
  [
    'Oi! 👋 Aqui é a *BACK-END EXPERIENCE* — Feira de Profissões 2026.',
    '',
    'Você acabou de ver o back-end funcionando: sua mensagem chegou ao nosso servidor, que decidiu responder na hora.',
  ].join('\n'),
  [
    '🚗 *O back-end é o motor do carro.*',
    '',
    'Você vê o painel, o volante e os bancos (isso é o *front-end*). Mas quem faz o carro andar fica escondido sob o capô:',
    '',
    '🕹️ Volante e painel → telas e botões (front-end)',
    '🦶 Pisar no acelerador → a requisição que você envia',
    '⚙️ Motor → as regras e a lógica que decidem tudo (back-end)',
    '⛽ Tanque de combustível → o banco de dados, onde ficam os dados',
    '📟 Velocímetro → a resposta que volta para você',
  ].join('\n'),
  [
    '⚙️ E o que você fez agora? *Pisou no acelerador!*',
    '',
    'Seu WhatsApp enviou um pedido, o nosso "motor" (um servidor) recebeu, conferiu as regras e devolveu esta resposta — tudo em segundos.',
    '',
    'Todo app que você usa tem um motor assim por trás. Que tal aprender a construir o seu? 🚀',
    '',
    '_Esta é a única sequência que você receberá. Obrigado pela visita!_',
  ].join('\n'),
];

module.exports = { TEXTO_INICIAL, GATILHO, MENSAGENS_MOTOR };
