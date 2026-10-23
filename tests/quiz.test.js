// Testes da Fase 4: motor do quiz e Passa ou Repassa.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as quiz from '../js/core/quiz.js';
import * as pr from '../js/core/passa-repassa.js';
import { quizExemplo, passaRepassaExemplo } from '../js/core/exemplos.js';
import { validar } from '../js/core/activity.js';

const P = [
  { id: 'azul', nome: 'Azul' },
  { id: 'rosa', nome: 'Rosa' },
  { id: 'verde', nome: 'Verde' },
];

// Resposta certa e errada para cada tipo do exemplo.
function respostaCerta(q) {
  if (q.tipo === 'multipla') return q.opcoes.filter((o) => o.correta).map((o) => o.id);
  if (q.tipo === 'vf') return q.correta;
  if (q.tipo === 'numerica') return String(q.valor);
  if (q.tipo === 'curta') return q.aceitas[0];
  return null;
}
function respostaErrada(q) {
  if (q.tipo === 'multipla') return [q.opcoes.find((o) => !o.correta).id];
  if (q.tipo === 'vf') return !q.correta;
  return 'nada a ver';
}

describe('quiz', () => {
  test('o exemplo tem 10 perguntas válidas', () => {
    const a = quizExemplo();
    assert.equal(a.conteudo.perguntas.length, 10);
    assert.deepEqual(validar(a).erros, []);
    assert.deepEqual(validar(passaRepassaExemplo()).erros, []);
  });

  test('✅ partida completa de 10 perguntas, do início ao pódio', () => {
    const a = quizExemplo();
    let p = quiz.criarPartida(a, P);
    assert.equal(p.fase, quiz.FASES.ABERTURA);
    let t = 0;
    for (let i = 0; i < 10; i++) {
      p = quiz.proximaPergunta(p, t);
      assert.equal(p.fase, quiz.FASES.PERGUNTA);
      const q = quiz.perguntaAtual(p);
      // Azul sempre acerta rápido; Rosa acerta devagar; Verde erra.
      p = quiz.responder(p, 'azul', respostaCerta(q), t + 1000);
      p = quiz.responder(p, 'rosa', respostaCerta(q), t + 15000);
      p = quiz.responder(p, 'verde', respostaErrada(q), t + 2000);
      assert.ok(quiz.todosResponderam(p));
      p = quiz.encerrarPergunta(p);
      assert.equal(p.fase, quiz.FASES.REVELACAO);
      p = quiz.mostrarRanking(p);
      t += 30000;
    }
    p = quiz.proximaPergunta(p, t);
    assert.equal(p.fase, quiz.FASES.FIM);
    const podio = quiz.podio(p);
    assert.deepEqual(podio.map((x) => x.id), ['azul', 'rosa', 'verde']);
    assert.ok(p.pontos.azul > p.pontos.rosa, 'velocidade conta');
    assert.equal(p.pontos.verde, 0);
    const r = quiz.resumo(p, a, { data: 'x' });
    assert.equal(r.perguntas.length, 10);
    assert.equal(r.participantes[0].nome, 'Azul');
  });

  test('pontos por velocidade: no limite vale metade; sem velocidade vale tudo', () => {
    const a = quizExemplo();
    a.regras.pontuacao.sequencia = false;
    const q = { ...a.conteudo.perguntas[0], pontos: 1000, tempo: 20 };
    const p = quiz.criarPartida(a, P);
    assert.equal(quiz.calcularPontos(p, q, 0, 1), 1000);
    assert.equal(quiz.calcularPontos(p, q, 10000, 1), 750);
    assert.equal(quiz.calcularPontos(p, q, 20000, 1), 500);
    p.regras.pontuacao.velocidade = false;
    assert.equal(quiz.calcularPontos(p, q, 19000, 1), 1000);
  });

  test('pergunta em dobro e pergunta que vale zero', () => {
    const a = quizExemplo();
    a.regras.pontuacao.velocidade = false;
    a.regras.pontuacao.sequencia = false;
    const p = quiz.criarPartida(a, P);
    const base = { ...a.conteudo.perguntas[0], pontos: 1000 };
    assert.equal(quiz.calcularPontos(p, { ...base, multiplicador: 2 }, 0, 1), 2000);
    assert.equal(quiz.calcularPontos(p, { ...base, multiplicador: 0 }, 0, 1), 0);
  });

  test('bônus de sequência cresce até o máximo', () => {
    const a = quizExemplo();
    a.regras.pontuacao.velocidade = false;
    const p = quiz.criarPartida(a, P);
    const q = { ...a.conteudo.perguntas[0], pontos: 1000 };
    assert.equal(quiz.calcularPontos(p, q, 0, 1), 1000);
    assert.equal(quiz.calcularPontos(p, q, 0, 3), 1200);
    assert.equal(quiz.calcularPontos(p, q, 0, 20), 1500);
  });

  test('errar tira pontos quando configurado; não responder não tira', () => {
    const a = quizExemplo();
    a.regras.pontuacao.erroTira = 300;
    let p = quiz.proximaPergunta(quiz.criarPartida(a, P), 0);
    const q = quiz.perguntaAtual(p);
    p = quiz.responder(p, 'verde', respostaErrada(q), 100);
    p = quiz.encerrarPergunta(p);
    assert.equal(p.pontos.verde, -300 * quiz.multiplicador(q));
    assert.equal(p.pontos.rosa, 0);
  });

  test('resposta depois do tempo, repetida ou de desconhecido é ignorada', () => {
    let p = quiz.proximaPergunta(quiz.criarPartida(quizExemplo(), P), 1000);
    const q = quiz.perguntaAtual(p);
    assert.equal(quiz.prazo(p), 1000 + q.tempo * 1000);
    const antes = p;
    p = quiz.responder(p, 'azul', respostaCerta(q), 1000 + q.tempo * 1000 + 1);
    assert.equal(p, antes);
    p = quiz.responder(p, 'azul', respostaCerta(q), 1500);
    const depois = quiz.responder(p, 'azul', respostaErrada(q), 1600);
    assert.equal(depois, p);
    assert.equal(quiz.responder(p, 'zzz', 'a', 1700), p);
  });

  test('distribuição das respostas', () => {
    let p = quiz.proximaPergunta(quiz.criarPartida(quizExemplo(), P), 0);
    p = quiz.responder(p, 'azul', ['b'], 10);
    p = quiz.responder(p, 'rosa', ['b'], 10);
    p = quiz.responder(p, 'verde', ['a'], 10);
    assert.deepEqual(quiz.distribuicao(p), { tipo: 'opcoes', contagem: { a: 1, b: 2, c: 0, d: 0 }, total: 3 });
  });

  test('ranking mostra quem subiu e ranking oculto pula a tela', () => {
    const a = quizExemplo();
    let p = quiz.proximaPergunta(quiz.criarPartida(a, P), 0);
    p = quiz.encerrarPergunta(quiz.responder(p, 'verde', respostaCerta(quiz.perguntaAtual(p)), 10));
    p = quiz.proximaPergunta(quiz.mostrarRanking(p), 1000);
    p = quiz.encerrarPergunta(quiz.responder(p, 'rosa', respostaCerta(quiz.perguntaAtual(p)), 1010));
    p = quiz.encerrarPergunta(p);
    const r = quiz.ranking(p);
    // Verde e Rosa empatam em 1º (1000 pts); Rosa veio do 2º lugar.
    assert.deepEqual(r.filter((x) => x.posicao === 1).map((x) => x.id).sort(), ['rosa', 'verde']);
    assert.equal(r.find((x) => x.id === 'rosa').subiu, 1);
    assert.equal(r.find((x) => x.id === 'verde').subiu, 0);
    a.exibicao.ranking = 'oculto';
    let o = quiz.encerrarPergunta(quiz.proximaPergunta(quiz.criarPartida(a, P), 0));
    assert.equal(quiz.mostrarRanking(o).fase, quiz.FASES.REVELACAO);
  });

  test('embaralhar perguntas e alternativas mantém tudo', () => {
    const a = quizExemplo();
    a.regras.embaralharPerguntas = true;
    a.regras.embaralharOpcoes = true;
    let s = 3;
    const rng = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    const p = quiz.criarPartida(a, P, { rng });
    assert.deepEqual(p.perguntas.map((q) => q.id).sort(), a.conteudo.perguntas.map((q) => q.id).sort());
    assert.notDeepEqual(p.perguntas.map((q) => q.id), a.conteudo.perguntas.map((q) => q.id));
    const q1 = p.perguntas.find((q) => q.id === 'q1');
    assert.equal(q1.opcoes.find((o) => o.correta).texto, 'Júpiter');
  });
});

describe('passa ou repassa', () => {
  const E = [
    { id: 'a', nome: 'Equipe A' },
    { id: 'b', nome: 'Equipe B' },
  ];

  test('responde direto e acerta: ganha os pontos de acerto', () => {
    let j = pr.criarJogo(passaRepassaExemplo(), E);
    assert.equal(j.respondendo, 'a');
    j = pr.julgar(j, { correta: true });
    assert.equal(j.pontos.a, 2);
    assert.equal(j.ultimo.torta, false);
  });

  test('passa, a outra erra: torta nela, sem pontos', () => {
    let j = pr.passar(pr.criarJogo(passaRepassaExemplo(), E));
    assert.equal(j.respondendo, 'b');
    j = pr.julgar(j, { correta: false });
    assert.deepEqual(j.pontos, { a: 0, b: 0 });
    assert.equal(j.tortas.b, 1);
  });

  test('passa e repassa: quem passou responde; erro tira ponto e leva torta', () => {
    let j = pr.repassar(pr.passar(pr.criarJogo(passaRepassaExemplo(), E)));
    assert.equal(j.respondendo, 'a');
    assert.equal(pr.repassar(j), j, 'só repassa uma vez');
    j = pr.julgar(j, { correta: false });
    assert.equal(j.pontos.a, -1);
    assert.equal(j.tortas.a, 1);
  });

  test('acertar no repassa vale os pontos de repassa', () => {
    let j = pr.repassar(pr.passar(pr.criarJogo(passaRepassaExemplo(), E)));
    j = pr.julgar(j, { correta: true });
    assert.equal(j.pontos.a, 1);
  });

  test('julgar pela opção tocada usa a correção da questão', () => {
    let j = pr.criarJogo(passaRepassaExemplo(), E);
    j = pr.julgar(j, { resposta: ['b'] }); // q1: Júpiter é a "b"
    assert.equal(j.ultimo.correta, true);
  });

  test('a vez alterna e o jogo termina com placar e tortas', () => {
    let j = pr.criarJogo(passaRepassaExemplo(), E);
    const total = j.perguntas.length;
    for (let i = 0; i < total; i++) {
      assert.equal(j.daVez, i % 2 === 0 ? 'a' : 'b');
      j = pr.proxima(pr.julgar(j, { correta: i % 3 !== 0 }));
    }
    assert.equal(j.etapa, pr.ETAPAS.FIM);
    const final = pr.placarFinal(j);
    assert.equal(final.length, 2);
    assert.ok(final[0].pontos >= final[1].pontos);
  });

  test('regras configuráveis e mínimo de 2 equipes', () => {
    const a = passaRepassaExemplo();
    a.regras.pontuacao.passaRepassa = { acerto: 5, repassa: 3, erroRepassa: -2, torta: false };
    let j = pr.julgar(pr.repassar(pr.passar(pr.criarJogo(a, E))), { correta: false });
    assert.equal(j.pontos.a, -2);
    assert.equal(j.ultimo.torta, false);
    assert.throws(() => pr.criarJogo(a, [E[0]]), RangeError);
  });
});
