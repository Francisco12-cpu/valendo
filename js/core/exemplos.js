// Atividades de exemplo para experimentar o Valendo! na hora (sem precisar criar nada).
import { criarAtividade } from './activity.js';
import { novaQuestao } from './questions/index.js';

function multipla(id, enunciado, opcoes, certa, extra = {}) {
  return {
    ...novaQuestao('multipla', id),
    enunciado,
    opcoes: opcoes.map((texto, i) => ({ id: 'abcd'[i], texto, correta: i === certa })),
    ...extra,
  };
}

export function quizExemplo() {
  const a = criarAtividade({ titulo: 'Quiz de exemplo: conhecimentos gerais', modalidade: 'quiz' });
  a.disciplina = 'Geral';
  a.tags = ['exemplo'];
  a.nivelConfig = 'avancada';
  a.regras.pontuacao.sequencia = true;
  a.conteudo.perguntas = [
    multipla('q1', 'Qual é o maior planeta do Sistema Solar?', ['Terra', 'Júpiter', 'Saturno', 'Marte'], 1, { explicacao: 'Júpiter tem mais de 11 vezes o diâmetro da Terra.' }),
    { ...novaQuestao('vf', 'q2'), enunciado: 'A água ferve a 100 °C ao nível do mar.', correta: true },
    multipla('q3', 'Quantos lados tem um hexágono?', ['5', '6', '7', '8'], 1),
    multipla('q4', 'Quem pintou a Mona Lisa?', ['Michelangelo', 'Van Gogh', 'Leonardo da Vinci', 'Tarsila do Amaral'], 2),
    { ...novaQuestao('numerica', 'q5'), enunciado: 'Quanto é 12 × 12?', valor: 144, tolerancia: 0 },
    multipla('q6', 'Qual é a capital do Brasil?', ['Rio de Janeiro', 'São Paulo', 'Salvador', 'Brasília'], 3, { multiplicador: 2 }),
    { ...novaQuestao('vf', 'q7'), enunciado: 'O Sol gira em torno da Terra.', correta: false, explicacao: 'É a Terra que gira em torno do Sol.' },
    { ...novaQuestao('curta', 'q8'), enunciado: 'Qual gás as plantas absorvem na fotossíntese?', aceitas: ['gás carbônico', 'dióxido de carbono', 'CO2'] },
    multipla('q9', 'Qual destes é um mamífero?', ['Tubarão', 'Golfinho', 'Pinguim', 'Polvo'], 1),
    multipla('q10', 'Em que continente fica o Egito?', ['Ásia', 'Europa', 'África', 'Oceania'], 2),
  ];
  return a;
}

export function passaRepassaExemplo() {
  const a = quizExemplo();
  return { ...a, id: a.id.replace('atv-', 'atv-pr-'), titulo: 'Passa ou Repassa de exemplo', modalidade: 'passa-repassa' };
}
