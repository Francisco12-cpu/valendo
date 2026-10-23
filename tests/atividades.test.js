// Testes da Fase 3: tipos de questão, schema/migração, colar texto, CSV e JSON.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { TIPOS, LISTA_TIPOS, novaQuestao, corrigir, validarQuestao } from '../js/core/questions/index.js';
import { lerNumero, normalizarTexto } from '../js/core/questions/base.js';
import {
  criarAtividade, validar, migrar, abrir, completar, duplicar, buscar, todasAsTags, SCHEMA_ATUAL, MIGRACOES,
} from '../js/core/activity.js';
import { converterTexto, exportarCSV, importarCSV, lerCSV, exportarJSON, importarJSON } from '../js/core/arquivos.js';

const multipla = (corretas = ['b']) => ({
  ...novaQuestao('multipla', 'q1'),
  enunciado: 'Qual organela produz energia?',
  opcoes: ['Ribossomo', 'Mitocôndria', 'Golgi', 'Lisossomo'].map((texto, i) => ({ id: 'abcd'[i], texto, correta: corretas.includes('abcd'[i]) })),
});

function atividadeCompleta() {
  const a = criarAtividade({ titulo: 'Revisão Citologia', modalidade: 'quiz', id: 'atv-1', agora: '2026-01-01T00:00:00.000Z' });
  a.disciplina = 'Biologia';
  a.tags = ['citologia'];
  a.conteudo.perguntas = [
    multipla(),
    { ...novaQuestao('vf', 'q2'), enunciado: 'A célula animal tem parede celular.', correta: false },
    { ...novaQuestao('curta', 'q3'), enunciado: 'Organela da fotossíntese?', aceitas: ['cloroplasto', 'cloroplastos'] },
    { ...novaQuestao('numerica', 'q4'), enunciado: 'Gravidade na Terra?', valor: 9.8, tolerancia: 0.1, unidade: 'm/s²' },
    { ...novaQuestao('enquete', 'q5'), enunciado: 'Gostou do tema?', opcoes: [{ id: 'a', texto: 'Sim' }, { id: 'b', texto: 'Não' }] },
    { ...novaQuestao('slide', 'q6'), enunciado: 'Parte 2: membrana', texto: 'Vamos lá!' },
  ];
  return a;
}

describe('tipos de questão (plugins)', () => {
  test('todo tipo exporta a interface do plugin', () => {
    assert.deepEqual(LISTA_TIPOS, ['multipla', 'vf', 'curta', 'numerica', 'enquete', 'slide']);
    for (const [nome, p] of Object.entries(TIPOS)) {
      assert.equal(p.tipo, nome);
      for (const f of ['novo', 'validar', 'corrigir']) assert.equal(typeof p[f], 'function', `${nome}.${f}`);
      assert.equal(typeof p.temResposta, 'boolean');
    }
  });

  test('múltipla escolha com uma ou várias corretas', () => {
    assert.equal(corrigir(multipla(), ['b']).correta, true);
    assert.equal(corrigir(multipla(), 'b').correta, true);
    assert.equal(corrigir(multipla(), ['a']).correta, false);
    const varias = multipla(['a', 'c']);
    assert.equal(corrigir(varias, ['c', 'a']).correta, true);
    assert.equal(corrigir(varias, ['a']).correta, false, 'faltou uma');
    assert.equal(corrigir(varias, ['a', 'c', 'd']).correta, false, 'marcou a mais');
  });

  test('verdadeiro ou falso', () => {
    const q = { ...novaQuestao('vf'), enunciado: 'x', correta: false };
    assert.equal(corrigir(q, false).correta, true);
    assert.equal(corrigir(q, true).correta, false);
    assert.equal(corrigir(q, undefined).correta, false);
  });

  test('resposta curta ignora acento, maiúsculas e espaços; aceita variações', () => {
    const q = { ...novaQuestao('curta'), enunciado: 'x', aceitas: ['Mitocôndria', 'mitocondrias'] };
    assert.equal(corrigir(q, '  MITOCONDRIA ').correta, true);
    assert.equal(corrigir(q, 'mitocondrias').correta, true);
    assert.equal(corrigir(q, 'ribossomo').correta, false);
    assert.equal(corrigir(q, '').correta, false);
  });

  test('numérica com tolerância, vírgula e unidade', () => {
    const q = { ...novaQuestao('numerica'), enunciado: 'g?', valor: 9.8, tolerancia: 0.1, unidade: 'm/s²' };
    assert.equal(corrigir(q, '9,8').correta, true);
    assert.equal(corrigir(q, '9.75 m/s²').correta, true);
    assert.equal(corrigir(q, '9,9').correta, true, 'no limite da tolerância');
    assert.equal(corrigir(q, '10').correta, false);
    assert.equal(corrigir(q, 'abc').correta, false);
    assert.equal(lerNumero('1.234,5'), 1234.5);
    assert.equal(lerNumero('1e3'), 1000);
  });

  test('enquete e slide não têm gabarito', () => {
    assert.equal(corrigir({ ...novaQuestao('enquete'), enunciado: 'x' }, 'a').correta, null);
    assert.equal(corrigir({ ...novaQuestao('slide'), enunciado: 'x' }).correta, null);
  });

  test('validação aponta problemas de cada tipo', () => {
    assert.ok(validarQuestao(novaQuestao('multipla')).includes('enunciado vazio'));
    const semCorreta = { ...multipla(), opcoes: multipla().opcoes.map((o) => ({ ...o, correta: false })) };
    assert.ok(validarQuestao(semCorreta).includes('marque pelo menos uma correta'));
    assert.deepEqual(validarQuestao(multipla()), []);
    assert.ok(validarQuestao({ tipo: 'xyz' })[0].includes('desconhecido'));
    assert.equal(normalizarTexto('  Árvore  Grande '), 'arvore grande');
  });
});

describe('atividade: schema e migração', () => {
  test('atividade nova é válida e completa', () => {
    const a = atividadeCompleta();
    assert.equal(a.schema, SCHEMA_ATUAL);
    assert.deepEqual(validar(a), { ok: true, erros: [] });
  });

  test('✅ atividade do schema 1 continua abrindo após uma migração simulada (1 → 2)', () => {
    const v1 = atividadeCompleta();
    // Simula uma versão futura do app: schema 2 renomeia "titulo" para "nome" e
    // guarda o tempo das perguntas em milissegundos.
    const migracoes = {
      ...MIGRACOES,
      1: (a) => ({
        ...a,
        schema: 2,
        nome: a.titulo,
        conteudo: { perguntas: a.conteudo.perguntas.map((q) => ({ ...q, tempoMs: q.tempo * 1000 })) },
      }),
    };
    const v2 = migrar(v1, { migracoes, ate: 2 });
    assert.equal(v2.schema, 2);
    assert.equal(v2.nome, 'Revisão Citologia');
    assert.equal(v2.conteudo.perguntas.length, 6);
    assert.equal(v2.conteudo.perguntas[0].tempoMs, 20000);
    // As respostas continuam corrigindo igual depois da migração.
    assert.equal(corrigir(v2.conteudo.perguntas[0], ['b']).correta, true);
    assert.equal(corrigir(v2.conteudo.perguntas[3], '9,8').correta, true);
    // O original não foi alterado.
    assert.equal(v1.schema, 1);
    assert.equal(v1.titulo, 'Revisão Citologia');
  });

  test('atividade do schema atual passa por abrir() sem mudar nada', () => {
    const a = atividadeCompleta();
    assert.deepEqual(abrir(a), a);
  });

  test('migra o rascunho antigo (schema 0) para o atual', () => {
    const antiga = { nome: 'Velha', questoes: [{ pergunta: '2+2?', alternativas: ['3', '4'], certa: 1 }, { pergunta: 'Intervalo' }] };
    const a = abrir(antiga);
    assert.equal(a.schema, SCHEMA_ATUAL);
    assert.equal(a.titulo, 'Velha');
    assert.equal(a.conteudo.perguntas[0].tipo, 'multipla');
    assert.equal(corrigir(a.conteudo.perguntas[0], ['b']).correta, true);
    assert.equal(a.conteudo.perguntas[1].tipo, 'slide');
    assert.ok(validar(a).ok, validar(a).erros.join());
  });

  test('atividade de versão mais nova que o app dá erro claro', () => {
    assert.throws(() => abrir({ ...atividadeCompleta(), schema: 99 }), /versão mais nova/);
  });

  test('migração sem passo conhecido dá erro claro', () => {
    assert.throws(() => migrar({ schema: 1 }, { migracoes: {}, ate: 2 }), /Não sei migrar/);
  });

  test('completar preenche campos faltando e corrige ids repetidos', () => {
    const a = completar({ titulo: 'X', conteudo: { perguntas: [{ ...multipla(), id: 'q1' }, { ...multipla(), id: 'q1' }] } });
    assert.equal(a.regras.pontuacao.porAcerto, 1000);
    assert.notEqual(a.conteudo.perguntas[0].id, a.conteudo.perguntas[1].id);
    assert.ok(validar(a).ok, validar(a).erros.join());
  });

  test('duplicar cria outra atividade independente', () => {
    const a = atividadeCompleta();
    a.favorita = true;
    const b = duplicar(a);
    assert.notEqual(b.id, a.id);
    assert.equal(b.titulo, 'Revisão Citologia (cópia)');
    assert.equal(b.favorita, false);
    b.conteudo.perguntas[0].enunciado = 'mudou';
    assert.equal(a.conteudo.perguntas[0].enunciado, 'Qual organela produz energia?');
  });

  test('busca por texto, tag, disciplina, dificuldade e favoritas', () => {
    const a = atividadeCompleta();
    const b = { ...criarAtividade({ titulo: 'Frações', id: 'atv-2' }), disciplina: 'Matemática', dificuldade: 'facil', tags: ['frações'], favorita: true };
    const todas = [a, b];
    assert.deepEqual(buscar(todas, { texto: 'citologia' }).map((x) => x.id), ['atv-1']);
    assert.deepEqual(buscar(todas, { texto: 'mitocondria' }).map((x) => x.id), [], 'opções não entram, só enunciados');
    assert.deepEqual(buscar(todas, { texto: 'organela energia' }).map((x) => x.id), ['atv-1']);
    assert.deepEqual(buscar(todas, { tag: 'Frações' }).map((x) => x.id), ['atv-2']);
    assert.deepEqual(buscar(todas, { disciplina: 'biologia' }).map((x) => x.id), ['atv-1']);
    assert.deepEqual(buscar(todas, { dificuldade: 'facil' }).map((x) => x.id), ['atv-2']);
    assert.deepEqual(buscar(todas, { favoritas: true }).map((x) => x.id), ['atv-2']);
    assert.equal(buscar(todas)[0].id, 'atv-2', 'favoritas primeiro');
    assert.deepEqual(todasAsTags(todas), ['citologia', 'frações']);
  });
});

describe('colar texto e converter', () => {
  test('formato do professor: número, letras e * na correta', () => {
    const { perguntas, avisos } = converterTexto(`1) Qual organela produz energia?
a) Ribossomo
*b) Mitocôndria
c) Complexo de Golgi

2) Quanto é 7 x 8?
a) 54
b) 56 *
c) 58
Explicação: tabuada do 7.`);
    assert.equal(perguntas.length, 2);
    assert.deepEqual(avisos, []);
    assert.equal(perguntas[0].enunciado, 'Qual organela produz energia?');
    assert.deepEqual(perguntas[0].opcoes.map((o) => o.correta), [false, true, false]);
    assert.equal(perguntas[1].opcoes[1].texto, '56');
    assert.equal(corrigir(perguntas[1], ['b']).correta, true);
    assert.equal(perguntas[1].explicacao, 'tabuada do 7.');
  });

  test('V/F, resposta curta e numérica', () => {
    const { perguntas } = converterTexto(`1. O Sol é uma estrela.
Resposta: V
2. Capital do Brasil?
Resposta: Brasília | Brasilia
3. Gravidade na Terra?
R: 9,8 ±0,2 m/s²
4. A água ferve a 50 °C ao nível do mar.
a) Verdadeiro
b) Falso *`);
    assert.deepEqual(perguntas.map((q) => q.tipo), ['vf', 'curta', 'numerica', 'vf']);
    assert.equal(perguntas[0].correta, true);
    assert.equal(corrigir(perguntas[1], 'brasilia').correta, true);
    assert.equal(perguntas[2].unidade, 'm/s²');
    assert.equal(corrigir(perguntas[2], '9.9').correta, true);
    assert.equal(perguntas[3].correta, false);
  });

  test('"Resposta: c" marca a alternativa e enunciado em várias linhas', () => {
    const { perguntas } = converterTexto(`1) Leia o trecho:
"O tempo é o senhor da razão."
Qual a figura de linguagem?
a) Metáfora
b) Ironia
c) Personificação
Resposta: c`);
    assert.match(perguntas[0].enunciado, /^Leia o trecho: "O tempo.*Qual a figura/);
    assert.deepEqual(perguntas[0].opcoes.map((o) => o.correta), [false, false, true]);
  });

  test('"Resposta: e" e "Resposta: a e c" pelas letras', () => {
    const um = converterTexto(`1) X?
a) 1
b) 2
c) 3
d) 4
e) 5
Resposta: e`).perguntas[0];
    assert.deepEqual(um.opcoes.filter((o) => o.correta).map((o) => o.id), ['e']);
    const dois = converterTexto(`1) X?
a) 1
b) 2
c) 3
Resposta: a e c`).perguntas[0];
    assert.deepEqual(dois.opcoes.filter((o) => o.correta).map((o) => o.id), ['a', 'c']);
  });

  test('sem numeração, separa por linha em branco; avisa quando falta a correta', () => {
    const { perguntas, avisos } = converterTexto(`Primeira?
a) x
b) y

Segunda pergunta sem resposta`);
    assert.equal(perguntas.length, 2);
    assert.deepEqual(avisos.map((a) => a.pergunta), [1, 2]);
    assert.equal(perguntas[1].tipo, 'slide');
  });
});

describe('CSV e .valendo.json', () => {
  test('CSV: exportar e importar de volta preserva as perguntas', () => {
    const a = atividadeCompleta();
    const csv = exportarCSV(a);
    assert.ok(csv.startsWith('﻿tipo;enunciado'));
    const { perguntas, avisos } = importarCSV(csv);
    assert.deepEqual(avisos, []);
    assert.deepEqual(perguntas.map((q) => q.tipo), a.conteudo.perguntas.map((q) => q.tipo));
    assert.equal(corrigir(perguntas[0], ['b']).correta, true);
    assert.equal(perguntas[1].correta, false);
    assert.deepEqual(perguntas[2].aceitas, ['cloroplasto', 'cloroplastos']);
    assert.equal(perguntas[3].valor, 9.8);
    assert.equal(perguntas[3].tolerancia, 0.1);
    assert.equal(perguntas[3].unidade, 'm/s²');
    assert.equal(perguntas[5].texto, 'Vamos lá!');
  });

  test('CSV com vírgula, aspas e quebra de linha (planilha)', () => {
    const linhas = lerCSV('enunciado,a,b,resposta\n"Diga ""oi"", por favor",x,"y\nz",b\n');
    assert.equal(linhas[1][0], 'Diga "oi", por favor');
    assert.equal(linhas[1][2], 'y\nz');
    const { perguntas } = importarCSV('enunciado,a,b,resposta\nQuanto é 1+1?,1,2,b\n');
    assert.equal(perguntas[0].tipo, 'multipla');
    assert.equal(corrigir(perguntas[0], ['b']).correta, true);
  });

  test('.valendo.json: exporta e importa várias atividades', () => {
    const a = atividadeCompleta();
    const b = criarAtividade({ titulo: 'Vazia', id: 'atv-2' });
    const { atividades, problemas } = importarJSON(exportarJSON([a, b]));
    assert.equal(atividades.length, 2);
    assert.deepEqual(atividades[0], a);
    assert.deepEqual(problemas, []);
  });

  test('importa atividade solta, antiga, com pendências e rejeita lixo', () => {
    assert.equal(importarJSON(JSON.stringify(atividadeCompleta())).atividades.length, 1);
    assert.equal(importarJSON(JSON.stringify({ nome: 'Velha', questoes: [{ pergunta: '1+1?', alternativas: ['1', '2'], certa: 1 }] })).atividades[0].titulo, 'Velha');
    const pend = importarJSON(JSON.stringify({ ...atividadeCompleta(), conteudo: { perguntas: [{ tipo: 'multipla', enunciado: '' }] } }));
    assert.equal(pend.atividades.length, 1);
    assert.match(pend.problemas[0].erro, /pendências/);
    assert.match(importarJSON('isto não é json').problemas[0].erro, /JSON/);
    assert.match(importarJSON(JSON.stringify({ ...atividadeCompleta(), schema: 7 })).problemas[0].erro, /versão mais nova/);
  });
});
