// Testes da Fase 5 (lógica pura): protocolo, relógio, nomes, sala, quiz conectado e ritmo.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { criarEmissor, decodificar, codificar, criarDeduplicador, VERSAO_PROTOCOLO } from '../js/net/protocol.js';
import { amostraSincronia, sincronizar } from '../js/core/clock.js';
import { gerarApelido, validarNome, nomeOfensivo, nomeUnico } from '../js/core/nomes.js';
import * as S from '../js/core/sala.js';
import * as Q from '../js/core/quiz.js';
import * as R from '../js/core/ritmo.js';
import { quizExemplo } from '../js/core/exemplos.js';

describe('protocolo', () => {
  test('mensagens têm v, id único, seq crescente e tipo', () => {
    const emitir = criarEmissor('c');
    const a = emitir('ping', { t0: 1 });
    const b = emitir('acao', { tipo2: 'x' });
    assert.equal(a.v, VERSAO_PROTOCOLO);
    assert.notEqual(a.id, b.id);
    assert.deepEqual([a.seq, b.seq], [1, 2]);
    assert.deepEqual(decodificar(codificar(a)), { ok: true, msg: a });
  });

  test('rejeita versão, tipo, JSON e tamanho inválidos', () => {
    assert.match(decodificar('{oi').erro, /JSON/);
    assert.match(decodificar({ v: 99, id: 'x', seq: 1, tipo: 'ping' }).erro, /versão/);
    assert.match(decodificar({ v: 1, id: 'x', seq: 1, tipo: 'hack' }).erro, /tipo/);
    assert.match(decodificar({ v: 1, seq: 1, tipo: 'ping' }).erro, /id/);
    assert.match(decodificar('x'.repeat(70000)).erro, /grande/);
  });

  test('deduplicador descarta ids repetidos', () => {
    const d = criarDeduplicador(3);
    assert.equal(d.jaVisto('a'), false);
    assert.equal(d.jaVisto('a'), true);
    ['b', 'c', 'd'].forEach((x) => d.jaVisto(x));
    assert.equal(d.tamanho, 3);
    assert.equal(d.jaVisto('a'), false, 'esquece os mais antigos');
  });
});

describe('sincronização de relógio', () => {
  test('calcula offset e RTT de uma amostra', () => {
    // Cliente 1000 ms atrás do host, 40 ms de ida e 40 de volta, host leva 2 ms.
    assert.deepEqual(amostraSincronia({ t0: 0, t1: 1040, t2: 1042, t3: 82 }), { offset: 1000, rtt: 80 });
  });

  test('mediana de 8 pings ignora um ping muito atrasado', () => {
    const amostras = Array.from({ length: 8 }, (_, i) => ({ t0: i * 100, t1: i * 100 + 520, t2: i * 100 + 521, t3: i * 100 + 41 }));
    amostras[3] = { t0: 300, t1: 1500, t2: 1501, t3: 1300 }; // Wi-Fi engasgou
    const s = sincronizar(amostras);
    assert.equal(s.offset, 500);
    assert.equal(s.rtt, 40);
    assert.equal(s.amostras, 8);
    assert.equal(sincronizar([]), null);
  });

  test('aparelho que engasga (resposta processada atrasada) não distorce o offset', () => {
    // Offset real = 2000. Metade dos pongs é processada 300 ms atrasada pelo aparelho.
    const amostras = Array.from({ length: 8 }, (_, i) => {
      const t0 = i * 200;
      const atraso = i % 2 ? 300 : 0;
      return { t0, t1: t0 + 2020, t2: t0 + 2021, t3: t0 + 41 + atraso };
    });
    const s = sincronizar(amostras);
    assert.ok(Math.abs(s.offset - 2000) <= 1, `offset ${s.offset}`);
  });
});

describe('nomes', () => {
  test('apelidos e nomes', () => {
    assert.match(gerarApelido(() => 0), /^Capivara Veloz$/);
    assert.equal(validarNome('  Ana   Clara ').nome, 'Ana Clara');
    assert.equal(validarNome('A').motivo, 'curto');
    assert.equal(validarNome('P0RR4 louca').motivo, 'ofensivo');
    assert.equal(validarNome('x'.repeat(50)).nome.length, 20);
    assert.equal(nomeUnico('Ana', ['ana', 'Ana 2']), 'Ana 3');
  });

  test('filtro não barra nomes reais parecidos', () => {
    for (const nome of ['Nazira', 'Carola', 'Deputado Silva', 'João Pinto', 'Cunha', 'Paulo']) assert.equal(nomeOfensivo(nome), false, nome);
    for (const nome of ['merda', 'Fdp', 'cu', 'b0sta', 'porrrra']) assert.equal(nomeOfensivo(nome), true, nome);
  });
});

describe('sala (host com autoridade)', () => {
  test('código de 6 caracteres sem 0/O/1/I', () => {
    for (let i = 0; i < 200; i++) {
      const c = S.gerarCodigo();
      assert.ok(S.codigoValido(c), c);
      assert.doesNotMatch(c, /[01OI]/);
    }
    assert.equal(S.normalizarCodigo(' abc-234 '), 'ABC234');
  });

  test('entra, reconecta com o mesmo clientId e não duplica', () => {
    let sala = S.criarSala({ codigo: 'ABC234' });
    let r = S.entrar(sala, { clientId: 'c1', nome: 'Ana' }, 0);
    assert.equal(r.resultado, 'ok');
    sala = S.desconectar(r.sala, 'c1', 10);
    assert.equal(S.conectados(sala).length, 0);
    r = S.entrar(sala, { clientId: 'c1', nome: 'Outro nome' }, 20);
    assert.equal(r.resultado, 'reconectou');
    assert.equal(r.cliente.nome, 'Ana');
    assert.equal(Object.keys(r.sala.clientes).length, 1);
  });

  test('sala trancada barra novos, mas deixa reconectar; removido não volta', () => {
    let sala = S.entrar(S.criarSala({ codigo: 'X' }), { clientId: 'c1', nome: 'Ana' }, 0).sala;
    sala = S.trancar(sala, true, 1);
    assert.equal(S.entrar(sala, { clientId: 'c2', nome: 'Bia' }, 2).resultado, 'trancada');
    assert.equal(S.entrar(sala, { clientId: 'c1', nome: 'Ana' }, 3).resultado, 'reconectou');
    sala = S.remover(sala, 'c1', 4);
    assert.equal(S.entrar(sala, { clientId: 'c1', nome: 'Ana' }, 5).resultado, 'removido');
    assert.ok(sala.log.some((e) => e.tipo === 'removido'));
  });

  test('nomes ofensivos e repetidos', () => {
    let sala = S.criarSala({ codigo: 'X' });
    assert.equal(S.entrar(sala, { clientId: 'c1', nome: 'merda' }, 0).resultado, 'nome-ofensivo');
    sala = S.entrar(sala, { clientId: 'c1', nome: 'Ana' }, 0).sala;
    assert.equal(S.entrar(sala, { clientId: 'c2', nome: 'ana' }, 0).cliente.nome, 'ana 2');
  });

  test('sinal verde, amarelo e vermelho', () => {
    const c = { conectado: true, ultimoContato: 0, rtt: 40 };
    assert.equal(S.sinal(c, 1000), 'verde');
    assert.equal(S.sinal({ ...c, rtt: 600 }, 1000), 'amarelo');
    assert.equal(S.sinal(c, 7000), 'amarelo');
    assert.equal(S.sinal(c, 12000), 'vermelho');
    assert.equal(S.sinal({ ...c, conectado: false }, 1000), 'vermelho');
  });

  test('ação repetida (mesmo id) ou de desconhecido é recusada', () => {
    let sala = S.entrar(S.criarSala({ codigo: 'X' }), { clientId: 'c1', nome: 'Ana' }, 0).sala;
    const r1 = S.aceitarAcao(sala, 'c1', { id: 'a1', tipo: 'responder' }, 1);
    assert.equal(r1.ok, true);
    assert.equal(S.aceitarAcao(r1.sala, 'c1', { id: 'a1', tipo: 'responder' }, 2).motivo, 'duplicada');
    assert.equal(S.aceitarAcao(r1.sala, 'zz', { id: 'a2' }, 2).motivo, 'desconhecido');
  });

  test('tempo no host: usa o offset, mas nunca no futuro nem cedo demais', () => {
    const c = { offset: 1000, rtt: 50 };
    assert.equal(S.tempoNoHost(c, 4000, 5030), 5000);
    assert.equal(S.tempoNoHost(c, 9000, 5030), 5030, 'não pode ter respondido depois de chegar');
    assert.equal(S.tempoNoHost(c, 0, 5030), 4530, 'nem muito antes de chegar');
    assert.equal(S.tempoNoHost(c, undefined, 5030), 5030);
  });
});

describe('quiz conectado', () => {
  const respostaCerta = (q) => (q.tipo === 'multipla' ? q.opcoes.filter((o) => o.correta).map((o) => o.id) : q.tipo === 'vf' ? q.correta : q.tipo === 'numerica' ? String(q.valor) : q.aceitas[0]);

  test('✅ 30 clientes, com reenvios duplicados, sem pontos duplicados', () => {
    const a = quizExemplo();
    let sala = S.criarSala({ codigo: 'ABC234' });
    const ids = Array.from({ length: 30 }, (_, i) => `cli${i}`);
    for (const id of ids) sala = S.entrar(sala, { clientId: id, nome: `Aluno ${id}` }, 0).sala;
    let p = Q.criarPartida(a, ids.map((id) => ({ id, nome: sala.clientes[id].nome })));
    let t = 0;
    for (let i = 0; i < a.conteudo.perguntas.length; i++) {
      p = Q.proximaPergunta(p, t);
      const q = Q.perguntaAtual(p);
      for (const id of ids) {
        // Cada resposta chega 3 vezes (reconexão/reenvio) com o mesmo id de ação.
        for (let k = 0; k < 3; k++) {
          const r = S.aceitarAcao(sala, id, { id: `${id}-q${i}`, tipo: 'responder' }, t);
          sala = r.sala;
          if (r.ok) p = Q.responder(p, id, respostaCerta(q), t + 1000);
        }
      }
      p = Q.encerrarPergunta(p);
      t += 60000;
    }
    const esperado = Q.calcularPontos(Q.criarPartida(a, [{ id: 'x', nome: 'x' }]), a.conteudo.perguntas[0], 1000, 1);
    assert.ok(esperado > 0);
    const pontos = ids.map((id) => p.pontos[id]);
    assert.equal(new Set(pontos).size, 1, 'todos com a mesma pontuação');
    // Soma igual à de quem respondeu uma vez só (sem duplicar).
    let unico = Q.criarPartida(a, [{ id: 'u', nome: 'u' }]);
    t = 0;
    for (let i = 0; i < a.conteudo.perguntas.length; i++) {
      unico = Q.proximaPergunta(unico, t);
      unico = Q.encerrarPergunta(Q.responder(unico, 'u', respostaCerta(Q.perguntaAtual(unico)), t + 1000));
      t += 60000;
    }
    assert.equal(pontos[0], unico.pontos.u);
  });

  test('✅ o gabarito não aparece no que vai para o aluno antes da revelação', () => {
    const a = quizExemplo();
    let p = Q.criarPartida(a, [{ id: 'c1', nome: 'Ana' }]);
    for (let i = 0; i < a.conteudo.perguntas.length; i++) {
      p = Q.proximaPergunta(p, i * 1000);
      const json = JSON.stringify(Q.paraAluno(p, 'c1', i * 1000));
      assert.doesNotMatch(json, /"correta"|"aceitas"|"valor"|"tolerancia"|"gabarito"|"explicacao"/, `pergunta ${i + 1}: ${json}`);
      const q = Q.perguntaAtual(p);
      if (q.tipo === 'curta') assert.ok(!json.includes(q.aceitas[0]), 'texto da resposta curta não vaza');
      p = Q.encerrarPergunta(p);
      const depois = Q.paraAluno(p, 'c1', i * 1000);
      assert.ok('gabarito' in depois, 'na revelação o gabarito vai');
    }
  });

  test('✅ quem cai e volta recebe o estado completo (pergunta e se já respondeu)', () => {
    const a = quizExemplo();
    let p = Q.proximaPergunta(Q.criarPartida(a, [{ id: 'c1', nome: 'Ana' }, { id: 'c2', nome: 'Bia' }]), 0);
    p = Q.responder(p, 'c1', ['b'], 500);
    // c1 caiu e voltou: o host manda paraAluno() de novo.
    const estado = Q.paraAluno(p, 'c1', 2000);
    assert.equal(estado.fase, 'pergunta');
    assert.equal(estado.respondeu, true);
    assert.equal(estado.pergunta.id, Q.perguntaAtual(p).id);
    assert.equal(estado.restaMs, Q.tempoLimite(p) - 2000);
    assert.equal(Q.paraAluno(p, 'c2', 2000).respondeu, false);
  });
});

describe('quiz no seu ritmo', () => {
  test('cada um avança sozinho; gabarito só da pergunta já respondida', () => {
    const a = quizExemplo();
    let r = R.criarRitmo(a);
    r = R.entrarNoRitmo(R.entrarNoRitmo(r, 'c1', 0), 'c2', 0);
    let e = R.paraAlunoRitmo(r, 'c1');
    assert.doesNotMatch(JSON.stringify(e), /"correta"|"aceitas"|"valor"/);
    r = R.responderNoRitmo(r, 'c1', e.pergunta.id, ['b'], 3000);
    e = R.paraAlunoRitmo(r, 'c1');
    assert.equal(e.indice, 1);
    assert.equal(e.ultimo.correta, true);
    assert.ok(e.ultimo.pontos > 0);
    assert.equal(R.paraAlunoRitmo(r, 'c2').indice, 0, 'o outro não andou');
    // Resposta repetida ou fora de ordem não conta.
    const antes = r;
    r = R.responderNoRitmo(r, 'c1', 'q1', ['b'], 4000);
    assert.equal(r, antes);
    // Reconexão continua de onde parou.
    assert.equal(R.paraAlunoRitmo(R.entrarNoRitmo(r, 'c1', 9999), 'c1').indice, 1);
    assert.deepEqual(R.progresso(r).map((x) => x.respondidas), [1, 0]);
  });
});
