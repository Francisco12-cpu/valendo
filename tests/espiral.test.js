// Testes da Fase 6: Prova em Espiral (rotação) e provas individuais.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../js/core/rotation.js';
import * as P from '../js/core/prova.js';
import * as S from '../js/core/sala.js';
import { novaQuestao } from '../js/core/questions/index.js';
import { criarAtividade } from '../js/core/activity.js';
import { perguntaSemGabarito } from '../js/core/quiz.js';

const MIN = 60000;

function provaFake(id, n = 4) {
  return {
    id,
    titulo: `Prova ${id}`,
    perguntas: Array.from({ length: n }, (_, i) => ({
      ...novaQuestao('multipla', `${id}q${i + 1}`),
      enunciado: `Pergunta ${i + 1} da prova ${id}`,
      pontos: 1,
      opcoes: [
        { id: 'a', texto: 'certa', correta: true },
        { id: 'b', texto: 'errada', correta: false },
      ],
    })),
  };
}
const grupos = (n) => Array.from({ length: n }, (_, i) => ({ id: `g${i + 1}`, nome: `Grupo ${i + 1}` }));
const provas = (m) => Array.from({ length: m }, (_, i) => provaFake(String.fromCharCode(65 + i)));

describe('rotação', () => {
  test('5×5: cada grupo passa uma vez por cada prova, sem dois grupos na mesma prova', () => {
    const r = R.criarRotacao({ grupos: grupos(5), provas: provas(5) });
    assert.equal(R.totalRodadas(r), 5);
    const visitas = {};
    for (let rodada = 0; rodada < 5; rodada++) {
      const a = R.atribuicao(r, rodada);
      const ocupadas = Object.values(a).filter(Boolean);
      assert.equal(new Set(ocupadas).size, ocupadas.length, `rodada ${rodada}: prova repetida`);
      for (const [g, p] of Object.entries(a)) (visitas[g] ??= new Set()).add(p);
    }
    for (const g of Object.keys(visitas)) assert.equal(visitas[g].size, 5, g);
  });

  test('mais grupos que provas: grupos em pausa e todos fazem tudo', () => {
    const r = R.criarRotacao({ grupos: grupos(6), provas: provas(4) });
    assert.equal(R.totalRodadas(r), 6);
    const visitas = {};
    for (let rodada = 0; rodada < 6; rodada++) {
      const a = R.atribuicao(r, rodada);
      assert.equal(Object.values(a).filter((p) => p === null).length, 2, 'dois em pausa por rodada');
      for (const [g, p] of Object.entries(a)) if (p) (visitas[g] ??= new Set()).add(p);
    }
    for (const g of Object.keys(visitas)) assert.equal(visitas[g].size, 4);
  });

  test('sentido do giro', () => {
    const horario = R.criarRotacao({ grupos: grupos(3), provas: provas(3) });
    const anti = R.criarRotacao({ grupos: grupos(3), provas: provas(3), sentido: -1 });
    assert.deepEqual(R.atribuicao(horario, 1), { g1: 'B', g2: 'C', g3: 'A' });
    assert.deepEqual(R.atribuicao(anti, 1), { g1: 'C', g2: 'A', g3: 'B' });
  });

  test('tempo: aviso, pausa geral, prorrogação e fim da rodada', () => {
    let r = R.iniciar(R.criarRotacao({ grupos: grupos(2), provas: provas(2), tempoRodadaMs: 5 * MIN, avisoMs: 30000 }), 0);
    assert.equal(R.restanteRodada(r, MIN), 4 * MIN);
    assert.equal(R.emAviso(r, 4.6 * MIN), true);
    r = R.pausar(r, MIN);
    assert.equal(R.restanteRodada(r, 3 * MIN), 4 * MIN, 'pausado não anda');
    assert.equal(R.responder(r, 'g1', 'A', 'Aq1', ['a'], 2 * MIN).motivo, 'pausado');
    r = R.retomar(r, 3 * MIN);
    assert.equal(R.restanteRodada(r, 4 * MIN), 3 * MIN);
    r = R.prorrogar(r, MIN, 4 * MIN);
    assert.equal(R.restanteRodada(r, 4 * MIN), 4 * MIN);
    r = R.verificarPrazos(r, 8 * MIN);
    assert.equal(r.status, R.STATUS.TROCA);
    assert.ok(r.travados['g1|A'] && r.travados['g2|B']);
  });

  test('fim do tempo trava, salva e marca em branco', () => {
    let r = R.iniciar(R.criarRotacao({ grupos: grupos(1), provas: provas(1), tempoRodadaMs: MIN }), 0);
    r = R.responder(r, 'g1', 'A', 'Aq1', ['a'], 1000).r;
    r = R.verificarPrazos(r, MIN);
    assert.equal(R.responder(r, 'g1', 'A', 'Aq2', ['a'], MIN + 1).ok, false);
    const cel = R.grade(r)[0].celulas[0];
    assert.deepEqual([cel.acertos, cel.emBranco, cel.total], [1, 3, 4]);
  });

  test('só responde a prova em que está, e o avanço manual trava o resto', () => {
    let r = R.iniciar(R.criarRotacao({ grupos: grupos(2), provas: provas(2) }), 0);
    assert.equal(R.responder(r, 'g1', 'B', 'Bq1', ['a'], 10).motivo, 'prova-errada');
    r = R.avancar(r, 1000);
    assert.equal(r.rodada, 1);
    assert.equal(r.status, R.STATUS.RODANDO);
    assert.ok(r.travados['g1|A']);
    assert.equal(R.responder(r, 'g1', 'B', 'Bq1', ['a'], 1100).ok, true);
    r = R.avancar(r, 2000);
    assert.equal(r.status, R.STATUS.FIM);
  });

  test('correção manual e comentários entram na grade', () => {
    let r = R.iniciar(R.criarRotacao({ grupos: grupos(1), provas: provas(1) }), 0);
    r = R.responder(r, 'g1', 'A', 'Aq1', ['b'], 10).r;
    r = R.avancar(r, 20);
    assert.equal(R.grade(r)[0].celulas[0].acertos, 0);
    r = R.corrigirManual(r, 'g1', 'A', 'Aq1', true);
    r = R.comentar(r, 'g1', 'A', 'Boa justificativa');
    const cel = R.grade(r)[0].celulas[0];
    assert.equal(cel.acertos, 1);
    assert.equal(cel.questoes[0].manual, true);
    assert.equal(cel.comentario, 'Boa justificativa');
  });

  test('o aparelho do grupo recebe a prova sem gabarito e recupera as respostas', () => {
    let r = R.iniciar(R.criarRotacao({ grupos: grupos(2), provas: provas(2) }), 0);
    r = R.responder(r, 'g1', 'A', 'Aq1', ['a'], 10).r;
    const e = R.paraGrupo(r, 'g1', 20);
    assert.doesNotMatch(JSON.stringify(e), /"correta"/);
    assert.deepEqual(e.respostas, { Aq1: ['a'] });
    assert.equal(e.proxima, 'Prova B');
    const est = R.paraEstacao(r, 'B', 20);
    assert.equal(est.grupo, 'Grupo 2');
  });

  test('✅ simulação 5×5 com 5 minutos gera a grade completa, mesmo com uma queda de conexão', () => {
    let r = R.criarRotacao({ grupos: grupos(5), provas: provas(5), tempoRodadaMs: 5 * MIN });
    let sala = S.criarSala({ codigo: 'ESP234' });
    for (const g of r.grupos) sala = S.entrar(sala, { clientId: g.id, nome: g.nome }, 0).sala;
    let t = 0;
    r = R.iniciar(r, t);
    const respostasPerdidas = [];
    for (let rodada = 0; rodada < 5; rodada++) {
      const atrib = R.atribuicao(r);
      for (const [g, provaId] of Object.entries(atrib)) {
        const prova = r.provas.find((p) => p.id === provaId);
        prova.perguntas.forEach((q, k) => {
          // O grupo 3 cai na rodada 2: duas respostas ficam "na fila" e são reenviadas
          // (duas vezes, com o mesmo id) quando ele volta, ainda dentro do tempo.
          const acao = { id: `${g}-${q.id}`, tipo: 'espiral' };
          const caido = g === 'g3' && rodada === 2 && k < 2;
          if (caido) return respostasPerdidas.push({ g, provaId, q, acao, resposta: [k % 2 ? 'b' : 'a'] });
          if (k === 3 && g === 'g5') return; // grupo 5 deixa a última em branco
          const ac = S.aceitarAcao(sala, g, acao, t + 1000);
          sala = ac.sala;
          if (ac.ok) r = R.responder(r, g, provaId, q.id, [k % 2 ? 'b' : 'a'], t + 1000 + k * 1000).r;
        });
      }
      if (rodada === 2) {
        sala = S.desconectar(sala, 'g3', t + 60000);
        const volta = S.entrar(sala, { clientId: 'g3', nome: 'Grupo 3' }, t + 90000);
        assert.equal(volta.resultado, 'reconectou');
        sala = volta.sala;
        // O aparelho recebe o estado completo de novo:
        assert.equal(R.paraGrupo(r, 'g3', t + 90000).prova.id, R.atribuicao(r).g3);
        for (const x of respostasPerdidas.splice(0)) {
          for (let k = 0; k < 2; k++) {
            const ac = S.aceitarAcao(sala, x.g, x.acao, t + 91000);
            sala = ac.sala;
            if (ac.ok) r = R.responder(r, x.g, x.provaId, x.q.id, x.resposta, t + 91000).r;
          }
        }
      }
      // O tempo acaba: trava todo mundo e troca de rodada.
      t += 5 * MIN;
      r = R.verificarPrazos(r, t);
      assert.equal(r.status, R.STATUS.TROCA);
      r = R.avancar(r, t);
    }
    assert.equal(r.status, R.STATUS.FIM);
    const g = R.grade(r);
    assert.equal(g.length, 5);
    for (const linha of g) {
      assert.equal(linha.celulas.length, 5, linha.nome);
      for (const c of linha.celulas) {
        assert.ok(c.visitou, `${linha.nome} × ${c.prova} sem registro`);
        assert.equal(c.total, 4);
      }
    }
    // Respostas "a" nas questões 1 e 3 de cada prova = 2 acertos por célula.
    const g3 = g.find((x) => x.grupo === 'g3');
    assert.ok(g3.celulas.every((c) => c.acertos === 2), 'a queda não fez o grupo 3 perder respostas');
    const g5 = g.find((x) => x.grupo === 'g5');
    assert.ok(g5.celulas.every((c) => c.emBranco === 1), 'em branco marcado');
    assert.equal(g.reduce((s, x) => s + x.total, 0), 100);
  });
});

describe('prova individual', () => {
  const atividade = () => {
    const a = criarAtividade({ titulo: 'Prova de Ciências', modalidade: 'prova', id: 'atv-prova' });
    a.conteudo.perguntas = provaFake('X', 6).perguntas.concat([{ ...novaQuestao('curta', 'c1'), enunciado: 'Organela?', aceitas: ['mitocondria'], pontos: 2 }]);
    return a;
  };

  test('horário de início, limite de tempo e entrega', () => {
    let p = P.criarProva(atividade(), { duracaoMs: 10 * MIN, inicioEm: 5 * MIN });
    p = P.entrarNaProva(p, 'ana');
    assert.equal(P.statusDe(p, 'ana', MIN), P.STATUS_ALUNO.AGUARDANDO);
    assert.equal(P.responderProva(p, 'ana', 'Xq1', ['a'], MIN).ok, false);
    assert.equal(P.statusDe(p, 'ana', 6 * MIN), P.STATUS_ALUNO.FAZENDO);
    p = P.responderProva(p, 'ana', 'Xq1', ['a'], 6 * MIN).p;
    assert.equal(P.statusDe(p, 'ana', 15 * MIN), P.STATUS_ALUNO.ENCERRADA);
    p = P.entregar(p, 'ana', 7 * MIN);
    assert.equal(P.statusDe(p, 'ana', 8 * MIN), P.STATUS_ALUNO.ENTREGUE);
    assert.equal(P.responderProva(p, 'ana', 'Xq2', ['a'], 8 * MIN).ok, false);
  });

  test('tempo extra individual', () => {
    let p = P.entrarNaProva(P.entrarNaProva(P.criarProva(atividade(), { duracaoMs: 10 * MIN }), 'ana'), 'bia');
    p = P.darTempoExtra(p, 'bia', 5 * MIN);
    assert.equal(P.statusDe(p, 'ana', 12 * MIN), P.STATUS_ALUNO.ENCERRADA);
    assert.equal(P.statusDe(p, 'bia', 12 * MIN), P.STATUS_ALUNO.FAZENDO);
    assert.equal(P.responderProva(p, 'bia', 'Xq1', ['a'], 14 * MIN).ok, true);
  });

  test('embaralhamento por aluno: diferente entre alunos, igual para o mesmo aluno', () => {
    const p = P.criarProva(atividade());
    const ana1 = P.perguntasDoAluno(p, 'ana').map((q) => q.id).join();
    const ana2 = P.perguntasDoAluno(p, 'ana').map((q) => q.id).join();
    const bia = P.perguntasDoAluno(p, 'bia').map((q) => q.id).join();
    assert.equal(ana1, ana2);
    assert.notEqual(ana1, bia);
    assert.equal(P.perguntasDoAluno(p, 'bia').length, 7);
  });

  test('grade com em branco, correção manual e o aluno não recebe gabarito', () => {
    let p = P.entrarNaProva(P.criarProva(atividade(), { duracaoMs: 10 * MIN }), 'ana');
    p = P.responderProva(p, 'ana', 'Xq1', ['a'], 1000).p;
    p = P.responderProva(p, 'ana', 'c1', 'Mitocôndria', 2000).p;
    p = P.responderProva(p, 'ana', 'Xq2', ['b'], 3000).p;
    let g = P.gradeProva(p, { ana: 'Ana' })[0];
    assert.deepEqual([g.acertos, g.emBranco, g.total, g.pontos], [2, 4, 7, 3]);
    p = P.corrigirManualProva(p, 'ana', 'Xq2', true);
    p = P.comentarProva(p, 'ana', 'Revise frações');
    g = P.gradeProva(p, { ana: 'Ana' })[0];
    assert.equal(g.acertos, 3);
    assert.equal(g.comentario, 'Revise frações');
    const e = P.paraAlunoProva(p, 'ana', 4000, perguntaSemGabarito);
    assert.doesNotMatch(JSON.stringify(e), /"correta"|"aceitas"/);
    assert.equal(e.respostas.Xq1[0], 'a');
  });
});
