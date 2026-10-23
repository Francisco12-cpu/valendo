// Testes da Fase 2: placar, sorteador, cronômetro e equipes.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { criarPlacar, pontuar, desfazer, refazer, zerar, renomear, ranking } from '../js/core/scoring.js';
import { criarSorteio, sortear, disponiveis, desfazerSorteio, reiniciar, marcarAusente, historico } from '../js/core/sorteador.js';
import * as crono from '../js/core/timer.js';
import { dividir, mover, embaralhar, lerLista, somaNiveis, quantidadeDeEquipes } from '../js/core/teams.js';

// Gerador previsível (LCG) para os testes.
function semente(s = 42) {
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

describe('placar', () => {
  const base = () => criarPlacar([{ nome: 'Azul' }, { nome: 'Rosa' }]);

  test('soma, desfaz e refaz', () => {
    let p = pontuar(pontuar(base(), 'e1', 10), 'e2', 5);
    p = pontuar(p, 'e1', -3);
    assert.deepEqual(p.equipes.map((e) => e.pontos), [7, 5]);
    p = desfazer(p);
    assert.deepEqual(p.equipes.map((e) => e.pontos), [10, 5]);
    p = desfazer(desfazer(p));
    assert.deepEqual(p.equipes.map((e) => e.pontos), [0, 0]);
    assert.equal(desfazer(p), p, 'sem histórico não muda');
    p = refazer(p);
    assert.deepEqual(p.equipes.map((e) => e.pontos), [10, 0]);
  });

  test('nova ação apaga o refazer', () => {
    let p = desfazer(pontuar(base(), 'e1', 1));
    assert.equal(p.futuro.length, 1);
    p = pontuar(p, 'e2', 1);
    assert.equal(p.futuro.length, 0);
  });

  test('zerar pode ser desfeito', () => {
    let p = zerar(pontuar(pontuar(base(), 'e1', 4), 'e2', 9));
    assert.deepEqual(p.equipes.map((e) => e.pontos), [0, 0]);
    p = desfazer(p);
    assert.deepEqual(p.equipes.map((e) => e.pontos), [4, 9]);
  });

  test('ignora delta zero, inválido ou equipe desconhecida', () => {
    const p = base();
    assert.equal(pontuar(p, 'e1', 0), p);
    assert.equal(pontuar(p, 'e1', NaN), p);
    assert.equal(pontuar(p, 'zz', 1), p);
  });

  test('renomear não entra no histórico e o ranking divide empates', () => {
    let p = renomear(base(), 'e1', 'Verde');
    assert.equal(p.historico.length, 0);
    p = pontuar(pontuar(criarPlacar([{ nome: 'A' }, { nome: 'B' }, { nome: 'C' }]), 'e1', 5), 'e2', 5);
    assert.deepEqual(ranking(p).map((e) => e.posicao), [1, 1, 3]);
  });
});

describe('sorteador', () => {
  test('sorteia sem repetir até acabar', () => {
    let s = criarSorteio(['Ana', 'Bia', 'Caio', 'Duda']);
    const rng = semente();
    const nomes = [];
    for (let i = 0; i < 4; i++) {
      const r = sortear(s, rng);
      s = r.sorteio;
      nomes.push(r.item.nome);
    }
    assert.deepEqual([...nomes].sort(), ['Ana', 'Bia', 'Caio', 'Duda']);
    assert.equal(sortear(s, rng).item, null);
    assert.deepEqual(historico(s).map((i) => i.nome), nomes);
  });

  test('ausentes não são sorteados', () => {
    let s = criarSorteio(['Ana', 'Bia', 'Caio']);
    s = marcarAusente(s, 's2', true);
    assert.deepEqual(disponiveis(s).map((i) => i.nome), ['Ana', 'Caio']);
    for (let i = 0; i < 2; i++) s = sortear(s, semente(i)).sorteio;
    assert.equal(sortear(s).item, null);
    s = marcarAusente(s, 's2', false);
    assert.equal(sortear(s).item.nome, 'Bia');
  });

  test('desfazer devolve o último e reiniciar devolve todos', () => {
    let s = sortear(criarSorteio(['A', 'B']), () => 0).sorteio;
    assert.equal(disponiveis(s).length, 1);
    s = desfazerSorteio(s);
    assert.equal(disponiveis(s).length, 2);
    s = reiniciar(sortear(sortear(s).sorteio).sorteio);
    assert.equal(disponiveis(s).length, 2);
  });
});

describe('cronômetro', () => {
  test('regressivo: conta, pausa, retoma e termina', () => {
    let c = crono.criarCronometro({ duracaoMs: 10000 });
    c = crono.iniciar(c, 1000);
    assert.equal(crono.restante(c, 4000), 7000);
    c = crono.pausar(c, 4000);
    assert.equal(crono.restante(c, 99999), 7000, 'pausado não anda');
    c = crono.iniciar(c, 50000);
    assert.equal(crono.terminou(c, 56999), false);
    assert.equal(crono.terminou(c, 57000), true);
    assert.equal(crono.restante(c, 90000), 0);
    assert.equal(crono.iniciar(c, 90000), c, 'terminado não reinicia sozinho');
  });

  test('+30 s estende mesmo depois de terminar', () => {
    let c = crono.iniciar(crono.criarCronometro({ duracaoMs: 5000 }), 0);
    c = crono.adicionar(c, 30000, 9000);
    assert.equal(crono.restante(c, 9000), 30000);
    c = crono.iniciar(c, 9000);
    assert.equal(crono.restante(c, 19000), 20000);
  });

  test('progressivo conta para cima e nunca termina', () => {
    let c = crono.iniciar(crono.criarCronometro({ modo: 'progressivo' }), 0);
    assert.equal(crono.mostrador(c, 125000), 125000);
    assert.equal(crono.terminou(c, 1e9), false);
    c = crono.zerar(c);
    assert.equal(crono.mostrador(c, 5), 0);
  });

  test('formatação do relógio', () => {
    assert.equal(crono.formatarRelogio(65000), '01:05');
    assert.equal(crono.formatarRelogio(3725000), '1:02:05');
    assert.equal(crono.formatarRelogio(100, { paraCima: true }), '00:01');
    assert.equal(crono.formatarRelogio(0, { paraCima: true }), '00:00');
  });
});

describe('equipes', () => {
  const turma = (n) => Array.from({ length: n }, (_, i) => ({ id: `a${i}`, nome: `Aluno ${i}`, nivel: (i % 3) + 1 }));

  test('aleatório: todos entram uma vez e os tamanhos diferem no máximo 1', () => {
    const eq = dividir(turma(11), { quantidade: 3, rng: semente() });
    assert.equal(eq.length, 3);
    assert.equal(eq.flat().length, 11);
    assert.equal(new Set(eq.flat().map((a) => a.id)).size, 11);
    const tamanhos = eq.map((e) => e.length);
    assert.ok(Math.max(...tamanhos) - Math.min(...tamanhos) <= 1);
  });

  test('por tamanho calcula a quantidade de equipes', () => {
    assert.equal(quantidadeDeEquipes(10, { tamanho: 4 }), 3);
    assert.equal(dividir(turma(10), { tamanho: 4 }).length, 3);
  });

  test('equilibrado: somas de nível bem próximas', () => {
    const alunos = [3, 3, 2, 2, 2, 2, 1, 1].map((nivel, i) => ({ id: `x${i}`, nome: `X${i}`, nivel }));
    const eq = dividir(alunos, { quantidade: 2, modo: 'equilibrado', rng: semente(7) });
    const somas = eq.map(somaNiveis);
    assert.deepEqual(somas, [8, 8]);
    assert.deepEqual(eq.map((e) => e.length), [4, 4]);
  });

  test('mover um aluno de equipe', () => {
    const eq = [[{ id: 'a' }, { id: 'b' }], [{ id: 'c' }]];
    const novo = mover(eq, 'a', 1);
    assert.deepEqual(novo.map((e) => e.map((a) => a.id)), [['b'], ['c', 'a']]);
    assert.equal(mover(eq, 'zz', 1), eq);
  });

  test('embaralhar não perde ninguém', () => {
    assert.deepEqual(embaralhar([1, 2, 3, 4], semente()).sort(), [1, 2, 3, 4]);
  });

  test('lerLista: um por linha, vírgulas e nível opcional', () => {
    assert.deepEqual(lerLista('Ana\n  Bia;3 \n\nCaio;9').map((a) => [a.nome, a.nivel]), [['Ana', 2], ['Bia', 3], ['Caio', 2]]);
    assert.deepEqual(lerLista('Ana, Bia, Caio').map((a) => a.nome), ['Ana', 'Bia', 'Caio']);
    assert.deepEqual(lerLista(''), []);
  });
});
