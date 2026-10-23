// Testes da Fase 7: relatórios, nuvem de palavras, compartilhar por link e cartões.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as Rel from '../js/core/relatorio.js';
import { contarPalavras, limparPalavra } from '../js/core/nuvem.js';
import { codificarAtividade, decodificarAtividade } from '../js/core/compartilhar.js';
import { letraPelaRotacao, numeroDoCartao, conteudoCartao, respostaDaLetra } from '../js/core/cartoes.js';
import * as Q from '../js/core/quiz.js';
import { quizExemplo } from '../js/core/exemplos.js';
import { validar } from '../js/core/activity.js';

function partidaJogada() {
  const a = quizExemplo();
  const P = [{ id: 'ana', nome: 'Ana' }, { id: 'bia', nome: 'Bia' }];
  let p = Q.criarPartida(a, P);
  let t = 0;
  for (let i = 0; i < 10; i++) {
    p = Q.proximaPergunta(p, t);
    const q = Q.perguntaAtual(p);
    const certa = q.tipo === 'multipla' ? q.opcoes.filter((o) => o.correta).map((o) => o.id) : q.tipo === 'vf' ? q.correta : q.tipo === 'numerica' ? String(q.valor) : q.aceitas[0];
    p = Q.responder(p, 'ana', certa, t + 1000);
    // Bia erra as 3 primeiras.
    p = Q.responder(p, 'bia', i < 3 ? 'errado' : certa, t + 2000);
    p = Q.encerrarPergunta(p);
    t += 30000;
  }
  return { a, resultado: Q.resumo(p, a, { data: 'x' }) };
}

describe('relatórios', () => {
  test('acertos por questão, desempenho e mais erradas', () => {
    const { resultado } = partidaJogada();
    const n = Rel.normalizarResultado(resultado);
    const porQ = Rel.acertosPorQuestao(n);
    assert.equal(porQ.length, 10);
    assert.deepEqual(porQ.slice(0, 4).map((q) => q.taxa), [0.5, 0.5, 0.5, 1]);
    const d = Rel.desempenho(n);
    assert.deepEqual(d.map((x) => [x.nome, x.certas, x.total]), [['Ana', 10, 10], ['Bia', 7, 10]]);
    assert.deepEqual(Rel.maisErradas(n).map((q) => q.id), ['q1', 'q2', 'q3']);
    assert.equal(Rel.resumoGeral(n).taxa, 17 / 20);
  });

  test('"refazer as erradas" cria atividade válida só com elas', () => {
    const { a, resultado } = partidaJogada();
    const nova = Rel.refazerErradas(a, Rel.normalizarResultado(resultado));
    assert.deepEqual(nova.conteudo.perguntas.map((q) => q.id), ['q1', 'q2', 'q3']);
    assert.notEqual(nova.id, a.id);
    assert.ok(nova.tags.includes('revisão'));
    assert.deepEqual(validar(nova).erros, []);
  });

  test('entende resultados de prova/espiral (grade) e de Passa ou Repassa', () => {
    const espiral = Rel.normalizarResultado({
      grade: [{ grupo: 'g1', nome: 'G1', pontos: 1, celulas: [{ prova: 'A', questoes: [{ qid: 'A1', enunciado: 'x', correta: true, emBranco: false }, { qid: 'A2', enunciado: 'y', correta: false, emBranco: true }] }] }],
    });
    assert.deepEqual(Rel.acertosPorQuestao(espiral).map((q) => [q.id, q.taxa]), [['A:A1', 1], ['A:A2', 0]]);
    const pr = Rel.normalizarResultado({ participantes: [{ id: 'e1', nome: 'E1', pontos: 2 }], historico: [{ equipe: 'e1', correta: true, pergunta: 'q1' }] });
    assert.equal(Rel.desempenho(pr)[0].certas, 1);
  });
});

describe('nuvem de palavras', () => {
  test('junta formas iguais, ignora repetição da mesma pessoa, vazias e ofensivas', () => {
    const nuvem = contarPalavras([
      { pid: 'a', palavras: ['Fotossíntese', 'fotossintese', 'Luz'] },
      { pid: 'b', palavras: ['FOTOSSÍNTESE', 'de', 'merda'] },
      { pid: 'c', palavras: ['luz', 'Água'] },
    ]);
    assert.deepEqual(nuvem.map((x) => [x.chave, x.quantos]), [['fotossintese', 2], ['luz', 2], ['agua', 1]]);
    assert.equal(nuvem[0].peso, 1);
    assert.equal(nuvem.at(-1).peso, 0);
    assert.equal(limparPalavra('  !!  '), null);
  });
});

describe('compartilhar por link', () => {
  test('codifica e decodifica a atividade (compactada)', async () => {
    const a = quizExemplo();
    const codigo = await codificarAtividade(a);
    assert.match(codigo, /^v1\.[A-Za-z0-9_-]+$/);
    assert.ok(codigo.length < JSON.stringify(a).length / 2, `compactou: ${codigo.length}`);
    const b = await decodificarAtividade(codigo);
    assert.equal(b.titulo, a.titulo);
    assert.notEqual(b.id, a.id, 'ganha id novo ao importar');
    assert.deepEqual(b.conteudo.perguntas, a.conteudo.perguntas);
    await assert.rejects(decodificarAtividade('v1.lixo!!'), /link-invalido/);
    await assert.rejects(decodificarAtividade('xyz'), /link-invalido/);
  });
});

describe('cartões de resposta', () => {
  const quadrado = (ang) => {
    const r = (ang * Math.PI) / 180;
    return { topLeftCorner: { x: 100, y: 100 }, topRightCorner: { x: 100 + 50 * Math.cos(r), y: 100 + 50 * Math.sin(r) } };
  };
  test('a rotação do QR diz a letra (com tolerância)', () => {
    assert.equal(letraPelaRotacao(quadrado(0)), 'A');
    assert.equal(letraPelaRotacao(quadrado(-90)), 'B');
    assert.equal(letraPelaRotacao(quadrado(180)), 'C');
    assert.equal(letraPelaRotacao(quadrado(90)), 'D');
    assert.equal(letraPelaRotacao(quadrado(25)), 'A');
    assert.equal(letraPelaRotacao(quadrado(-70)), 'B');
  });
  test('conteúdo do cartão e resposta pela letra', () => {
    assert.equal(numeroDoCartao(conteudoCartao(17)), 17);
    assert.equal(numeroDoCartao('outra coisa'), null);
    const q = quizExemplo().conteudo.perguntas[0];
    assert.deepEqual(respostaDaLetra(q, 'B'), ['b']);
    assert.equal(respostaDaLetra({ tipo: 'vf' }, 'B'), false);
    assert.equal(respostaDaLetra(q, 'Z'), null);
  });
});
