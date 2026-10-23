// Testes da máquina de estados do buzzer (Fase 1): queima, empate e multitoque.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { criarBuzzer, normalizarConfig, ESTADOS, PADRAO } from '../js/core/buzzer.js';
import { formatarMs } from '../js/core/clock.js';

const J = ['ana', 'bia', 'caio'];
const novo = (config = {}, jogadores = J.slice(0, 2)) => criarBuzzer(jogadores, config, { rng: () => 0.5 });

// Leva um buzzer do método B até o VALENDO com largada em t0.
function ateValendo(b, t0 = 1000) {
  b.iniciar();
  assert.equal(b.estado, ESTADOS.ARMADO);
  b.disparar(t0);
  assert.equal(b.estado, ESTADOS.VALENDO);
  return b;
}

describe('fluxo básico', () => {
  test('método B: OCIOSO → ARMADO → VALENDO → RESULTADO com o vencedor certo', () => {
    const b = ateValendo(novo());
    b.pressionar('bia', 1, 1180);
    b.pressionar('ana', 2, 1250);
    const r = b.instantaneo().resultado;
    assert.equal(b.estado, ESTADOS.RESULTADO);
    assert.equal(r.tipo, 'vencedor');
    assert.deepEqual(r.vencedores, ['bia']);
    assert.equal(r.ordem[0].tempo, 180);
    assert.equal(r.ordem[1].diferenca, 70);
  });

  test('espera aleatória fica entre o mínimo e o máximo', () => {
    const b = criarBuzzer(J, { gatilho: 'aleatorio', esperaMin: 1000, esperaMax: 3000 }, { rng: () => 0.25 });
    b.iniciar();
    assert.equal(b.instantaneo().esperaMs, 1500);
  });

  test('contagem usa segundos e manual não tem espera', () => {
    const c = novo({ gatilho: 'contagem', contagem: 3 });
    c.iniciar();
    assert.equal(c.instantaneo().esperaMs, 3000);
    const m = novo({ gatilho: 'manual' });
    m.iniciar();
    assert.equal(m.instantaneo().esperaMs, null);
  });

  test('método A: arma só quando todos seguram e vence quem solta primeiro', () => {
    const b = novo({ metodo: 'A' });
    b.iniciar();
    assert.equal(b.estado, ESTADOS.PREPARANDO);
    b.pressionar('ana', 1, 100);
    assert.equal(b.estado, ESTADOS.PREPARANDO);
    b.pressionar('bia', 2, 120);
    assert.equal(b.estado, ESTADOS.ARMADO);
    b.disparar(2000);
    b.soltar('ana', 1, 2210);
    b.soltar('bia', 2, 2195);
    assert.deepEqual(b.instantaneo().resultado.vencedores, ['bia']);
  });

  test('método A: soltar durante o PREPARANDO não é queima', () => {
    const b = novo({ metodo: 'A' });
    b.iniciar();
    b.pressionar('ana', 1, 100);
    const eventos = b.soltar('ana', 1, 150);
    assert.ok(!eventos.some((e) => e.tipo === 'queima'));
    assert.equal(b.estado, ESTADOS.PREPARANDO);
  });

  test('sem ninguém agir, o prazo máximo encerra com "ninguem"', () => {
    const b = ateValendo(novo({ tempoMaximoMs: 5000 }), 1000);
    assert.equal(b.prazo(), 6000);
    b.verificarPrazo(5999);
    assert.equal(b.estado, ESTADOS.VALENDO);
    b.verificarPrazo(6000);
    assert.equal(b.instantaneo().resultado.tipo, 'ninguem');
  });

  test('depois da 1ª ação, a janela espera os demais e então encerra', () => {
    const b = ateValendo(criarBuzzer(J, { janelaMs: 1000 }), 0);
    b.pressionar('ana', 1, 200);
    assert.equal(b.prazo(), 1200);
    b.verificarPrazo(1200);
    const r = b.instantaneo().resultado;
    assert.deepEqual(r.vencedores, ['ana']);
    assert.deepEqual(r.naoAgiram.sort(), ['bia', 'caio']);
  });

  test('reinício rápido começa nova rodada com todos', () => {
    const b = ateValendo(novo());
    b.pressionar('ana', 1, 1100);
    b.pressionar('bia', 2, 1200);
    b.iniciar();
    assert.equal(b.estado, ESTADOS.ARMADO);
    assert.equal(b.instantaneo().rodada, 2);
    assert.deepEqual(b.instantaneo().acoes, {});
  });

  test('exige de 2 a 8 jogadores, sem ids repetidos', () => {
    assert.throws(() => criarBuzzer(['a']), RangeError);
    assert.throws(() => criarBuzzer(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']), RangeError);
    assert.throws(() => criarBuzzer(['a', 'a']));
  });
});

describe('queima de largada', () => {
  test('B: apertar no ARMADO é queima; com "aviso" o jogador ainda pode jogar', () => {
    const b = novo({ queima: 'aviso' });
    b.iniciar();
    const eventos = b.pressionar('ana', 1, 500);
    assert.ok(eventos.some((e) => e.tipo === 'queima' && e.jogador === 'ana'));
    b.soltar('ana', 1, 520);
    b.disparar(1000);
    b.pressionar('ana', 2, 1150);
    b.pressionar('bia', 3, 1200);
    assert.deepEqual(b.instantaneo().resultado.vencedores, ['ana']);
    assert.equal(b.instantaneo().resultado.queimas.length, 1);
  });

  test('toque com timeStamp anterior ao frame da largada conta como queima', () => {
    const b = ateValendo(novo({ queima: 'eliminar' }), 1000);
    const eventos = b.pressionar('ana', 1, 995);
    assert.ok(eventos.some((e) => e.tipo === 'queima'));
    assert.deepEqual(b.instantaneo().eliminados, ['ana']);
  });

  test('A: soltar no ARMADO é queima', () => {
    const b = novo({ metodo: 'A' });
    b.iniciar();
    b.pressionar('ana', 1, 0);
    b.pressionar('bia', 2, 0);
    const eventos = b.soltar('bia', 2, 400);
    assert.ok(eventos.some((e) => e.tipo === 'queima' && e.jogador === 'bia'));
  });

  test('"anular" recomeça a rodada', () => {
    const b = novo({ queima: 'anular' });
    b.iniciar();
    const eventos = b.pressionar('bia', 1, 300);
    assert.ok(eventos.some((e) => e.tipo === 'anulada'));
    assert.equal(b.estado, ESTADOS.ARMADO);
    assert.equal(b.instantaneo().rodada, 2);
  });

  test('"penalidade" soma o tempo extra e pode mudar o vencedor', () => {
    const b = novo({ queima: 'penalidade', penalidadeMs: 500 });
    b.iniciar();
    b.pressionar('ana', 1, 100);
    b.soltar('ana', 1, 110);
    b.disparar(1000);
    b.pressionar('ana', 2, 1100); // 100 ms + 500 de penalidade
    b.pressionar('bia', 3, 1300); // 300 ms
    const r = b.instantaneo().resultado;
    assert.deepEqual(r.vencedores, ['bia']);
    const ana = r.ordem.find((o) => o.jogador === 'ana');
    assert.equal(ana.tempo, 600);
    assert.equal(ana.bruto, 100);
    assert.ok(ana.penalizado);
  });

  test('"eliminar" tira o jogador; se todos saem, ninguém vence', () => {
    const b = novo({ queima: 'eliminar' });
    b.iniciar();
    b.pressionar('ana', 1, 100);
    assert.equal(b.estado, ESTADOS.ARMADO);
    b.pressionar('bia', 2, 200);
    assert.equal(b.estado, ESTADOS.RESULTADO);
    assert.equal(b.instantaneo().resultado.tipo, 'ninguem');
  });

  test('"eliminar": o jogador eliminado não vence mesmo sendo o mais rápido', () => {
    const b = criarBuzzer(J, { queima: 'eliminar' });
    b.iniciar();
    b.pressionar('ana', 1, 100);
    b.soltar('ana', 1, 120);
    b.disparar(1000);
    b.pressionar('ana', 2, 1010);
    b.pressionar('bia', 3, 1200);
    b.pressionar('caio', 4, 1300);
    const r = b.instantaneo().resultado;
    assert.deepEqual(r.vencedores, ['bia']);
    assert.ok(!r.ordem.some((o) => o.jogador === 'ana'));
  });

  test('"professor" para a rodada e espera a decisão', () => {
    const b = criarBuzzer(J, { queima: 'professor' });
    b.iniciar();
    b.pressionar('caio', 1, 100);
    const r = b.instantaneo().resultado;
    assert.equal(b.estado, ESTADOS.RESULTADO);
    assert.equal(r.tipo, 'queima');
    assert.equal(r.jogador, 'caio');
    b.soltar('caio', 1, 150);
    b.decidir('eliminar');
    assert.equal(b.estado, ESTADOS.ARMADO);
    assert.deepEqual(b.instantaneo().participantes, ['ana', 'bia']);
  });
});

describe('empate', () => {
  test('diferença menor que a margem (padrão 10 ms) é empate técnico', () => {
    assert.equal(PADRAO.margemEmpateMs, 10);
    const b = ateValendo(novo());
    b.pressionar('ana', 1, 1200);
    b.pressionar('bia', 2, 1209.5);
    const r = b.instantaneo().resultado;
    assert.equal(r.tipo, 'empate');
    assert.deepEqual(r.vencedores, ['ana', 'bia']);
  });

  test('diferença igual ou maior que a margem não é empate', () => {
    const b = ateValendo(novo());
    b.pressionar('ana', 1, 1200);
    b.pressionar('bia', 2, 1210);
    assert.equal(b.instantaneo().resultado.tipo, 'vencedor');
  });

  test('margem configurável', () => {
    const b = ateValendo(novo({ margemEmpateMs: 30 }));
    b.pressionar('ana', 1, 1200);
    b.pressionar('bia', 2, 1225);
    assert.equal(b.instantaneo().resultado.tipo, 'empate');
  });

  test('desempate joga uma nova rodada só com os empatados', () => {
    const b = ateValendo(criarBuzzer(J, {}), 0);
    b.pressionar('ana', 1, 200);
    b.pressionar('bia', 2, 200);
    b.pressionar('caio', 3, 400);
    assert.equal(b.instantaneo().resultado.tipo, 'empate');
    [1, 2, 3].forEach((p, i) => b.soltar(J[i], p, 500)); // tiram os dedos da tela
    b.desempatar();
    assert.deepEqual(b.instantaneo().participantes, ['ana', 'bia']);
    b.disparar(1000);
    b.pressionar('bia', 4, 1150);
    b.pressionar('ana', 5, 1300);
    assert.deepEqual(b.instantaneo().resultado.vencedores, ['bia']);
  });
});

describe('multitoque', () => {
  test('dois jogadores ao mesmo tempo (mesmo timeStamp) empatam', () => {
    const b = ateValendo(novo());
    b.pressionar('ana', 7, 1150);
    b.pressionar('bia', 8, 1150);
    assert.equal(b.instantaneo().resultado.tipo, 'empate');
  });

  test('a ordem de chegada dos eventos não importa, só o timeStamp', () => {
    const b = ateValendo(novo());
    b.pressionar('ana', 1, 1300); // processado primeiro, mas aconteceu depois
    b.pressionar('bia', 2, 1250);
    assert.deepEqual(b.instantaneo().resultado.vencedores, ['bia']);
  });

  test('B: segundo dedo do mesmo jogador é ignorado', () => {
    const b = ateValendo(criarBuzzer(J, {}), 0);
    b.pressionar('ana', 1, 100);
    const eventos = b.pressionar('ana', 2, 50);
    assert.equal(eventos.length, 0);
    assert.equal(b.instantaneo().acoes.ana.tempo, 100);
  });

  test('B: pointerdown repetido do mesmo dedo é ignorado', () => {
    const b = novo();
    b.iniciar();
    b.pressionar('ana', 1, 100);
    const eventos = b.pressionar('ana', 1, 101);
    assert.equal(eventos.length, 0);
    assert.equal(b.instantaneo().queimas.length, 1);
  });

  test('A: com dois dedos, só conta quando o último sai', () => {
    const b = novo({ metodo: 'A' });
    b.iniciar();
    b.pressionar('ana', 1, 0);
    b.pressionar('ana', 2, 0);
    b.pressionar('bia', 3, 0);
    assert.equal(b.estado, ESTADOS.ARMADO);
    assert.equal(b.soltar('ana', 1, 500).length, 0); // ainda segura com o outro dedo: sem queima
    b.disparar(1000);
    b.soltar('ana', 2, 1300);
    b.soltar('bia', 3, 1200);
    const r = b.instantaneo().resultado;
    assert.deepEqual(r.vencedores, ['bia']);
    assert.equal(r.ordem[1].tempo, 300);
  });

  test('A: pointercancel não vira queima nem ação', () => {
    const b = novo({ metodo: 'A' });
    b.iniciar();
    b.pressionar('ana', 1, 0);
    b.pressionar('bia', 2, 0);
    const eventos = b.soltar('ana', 1, 300, { cancelado: true });
    assert.ok(!eventos.some((e) => e.tipo === 'queima'));
    assert.deepEqual(b.instantaneo().prontos, ['bia']);
  });

  test('dedos de jogadores desconhecidos são ignorados', () => {
    const b = ateValendo(novo());
    assert.equal(b.pressionar('zeca', 1, 1100).length, 0);
    assert.equal(b.estado, ESTADOS.VALENDO);
  });

  test('8 jogadores juntos: todos registram e a ordem sai pelo tempo', () => {
    const ids = ['j1', 'j2', 'j3', 'j4', 'j5', 'j6', 'j7', 'j8'];
    const b = ateValendo(criarBuzzer(ids, {}), 0);
    const tempos = [400, 230, 610, 180, 520, 300, 450, 260];
    ids.forEach((id, i) => b.pressionar(id, i, tempos[i]));
    const r = b.instantaneo().resultado;
    assert.equal(r.ordem.length, 8);
    assert.deepEqual(r.ordem.map((o) => o.jogador).slice(0, 3), ['j4', 'j2', 'j8']);
  });
});

describe('utilidades', () => {
  test('normalizarConfig corrige valores inválidos', () => {
    const c = normalizarConfig({ metodo: 'Z', queima: 'xx', margemEmpateMs: -5, esperaMin: 5000, esperaMax: 1000 });
    assert.equal(c.metodo, 'B');
    assert.equal(c.queima, 'aviso');
    assert.equal(c.margemEmpateMs, 0);
    assert.ok(c.esperaMax >= c.esperaMin);
  });

  test('formatarMs', () => {
    assert.equal(formatarMs(183.4), '183 ms');
    assert.equal(formatarMs(1240), '1,24 s');
    assert.equal(formatarMs(12, { sinal: true }), '+12 ms');
  });
});
