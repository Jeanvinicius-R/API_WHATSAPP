'use strict';

/**
 * Classificações do quiz (8 perguntas). Os títulos são lúdicos e NÃO avaliam ninguém profissionalmente.
 */
const CLASSIFICACOES = [
  { min: 0, max: 2, id: 'explorador', titulo: 'Explorador da Tecnologia', emoji: '🧭',
    resumo: 'Todo mundo começa em algum lugar — e você acabou de entrar no mapa!' },
  { min: 3, max: 4, id: 'aprendiz', titulo: 'Aprendiz de Back-end', emoji: '🌱',
    resumo: 'Você já pegou o jeito! Mais um pouco de prática e vem muito mais por aí.' },
  { min: 5, max: 6, id: 'evolucao', titulo: 'Desenvolvedor em Evolução', emoji: '⚙️',
    resumo: 'Impressionante! Você já entende bem como as coisas funcionam por trás da tela.' },
  { min: 7, max: 8, id: 'mestre', titulo: 'Futuro Mestre das APIs', emoji: '🏆',
    resumo: 'Uau! Se isso é o começo, imagina quando você colocar a mão na massa!' },
];

/** Mensagens motivadoras gerais (sorteadas pelo servidor). */
const MENSAGENS_ALEATORIAS = [
  '🚀 Você acaba de dar seu primeiro passo no universo Back-end! Continue explorando a tecnologia!',
  '💻 Enquanto você lê esta mensagem, milhares de servidores estão processando informações pelo mundo. Quem sabe você não será responsável por um deles?',
  '🔥 Missão concluída! Você participou da nossa experiência de Back-end. Seu próximo desafio pode ser desenvolver sua primeira API!',
  '🧠 Todo grande desenvolvedor começou aprendendo o básico. Continue estudando e construindo!',
  '🛠️ Cada app que você usa tem um back-end trabalhando em silêncio. Que tal aprender a construir o seu?',
  '🌐 Login, pedido, mensagem, pagamento… por trás de cada clique existe alguém que programou o caminho. Pode ser você!',
  '📡 Você acabou de ver uma requisição sair do navegador, passar por uma API e chegar ao seu celular. Isso é back-end na prática!',
  '🗄️ Dados bem organizados movem o mundo. Bancos de dados são um ótimo ponto de partida na sua jornada!',
  '⚡ Curiosidade é a melhor ferramenta de um desenvolvedor. A sua já está funcionando a todo vapor!',
  '🔐 Segurança também é coisa de back-end: proteger dados e pessoas faz parte da profissão. Bora aprender mais?',
  '🧩 Programar é resolver quebra-cabeças com lógica e criatividade. Comece pequeno, erre, corrija e evolua!',
  '🎯 Primeiro projeto: uma API simples com três rotas. Parece pouco, mas é como muita gente começou!',
  '🤝 Back-end também é trabalho em equipe: revisar código, conversar e aprender com os outros. Venha fazer parte!',
  '🌱 Não existe "nasci para isso" na tecnologia: existe estudo, prática e persistência. E você já começou!',
  '☁️ Seus próximos apps podem rodar na nuvem e atender milhares de pessoas ao mesmo tempo. Vale a pena tentar!',
  '🧪 Testar, errar, ajustar, repetir. Esse é o ciclo que transforma estudantes em desenvolvedores. Boa jornada!',
  '📚 Lógica de programação → linguagem → HTTP e APIs → banco de dados → Git → primeiro projeto. A trilha está aí, é só começar!',
];

/** Mensagens específicas para cada classificação. */
const MENSAGENS_POR_CLASSIFICACAO = {
  explorador: [
    'Todo mestre já foi explorador. Você acabou de descobrir um mundo novo — volte a ele quando bater a curiosidade!',
    'Sem pressa: ninguém nasce sabendo o que é uma API. O importante é que você começou a explorar!',
    'Pontuação é só o ponto de partida. A diferença entre quem sabe e quem não sabe é só a vontade de aprender.',
  ],
  aprendiz: [
    'Você já tem uma boa base! Um pouco de prática com APIs e bancos de dados e você sobe de nível rapidinho.',
    'Bom resultado! Já dá para imaginar você criando sua primeira API em breve.',
    'Está no caminho certo: entendeu parte da lógica por trás da tela. Falta só praticar mais!',
  ],
  evolucao: [
    'Ótimo desempenho! Você já pensa como quem constrói sistemas. Que tal um projeto próprio agora?',
    'Você demonstrou conhecimento sólido. Continue assim e logo estará resolvendo problemas reais!',
    'Muito bem! Falta pouco para dominar os conceitos centrais do back-end. Continue estudando!',
  ],
  mestre: [
    'Desempenho de dar orgulho! Você entende bem o que acontece por trás de cada clique. O mundo precisa de gente assim!',
    'Quase perfeito! Se você já sabe tanto antes de programar, imagina depois da primeira API no ar.',
    'Parabéns pelo resultado! Já pode dizer que tem uma bela vocação para o back-end.',
  ],
};

module.exports = { CLASSIFICACOES, MENSAGENS_ALEATORIAS, MENSAGENS_POR_CLASSIFICACAO };
