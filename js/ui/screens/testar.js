// #/atividades/testar?id=...[&modo=previa] — pré-visualização (com gabarito) e modo de teste
// (o professor responde como aluno e vê a correção). Nada é salvo como resultado.
import { h, svg } from '../dom.js';
import { t } from '../../i18n/i18n.js';
import { corrigir, tipoDe } from '../../core/questions/index.js';
import { embaralhar } from '../../core/teams.js';
import { lerAtividade } from '../../storage/atividades.js';
import { VisorQuestao, NOMES_TIPOS } from '../questoes.js';
import { Botao } from '../components/botao.js';
import { Mascote } from '../components/mascote.js';
import { icones } from '../components/icones.js';
import { sons, desbloquear } from '../../audio/sons.js';

export const titulo = () => t('testar.titulo');

export function render(alvo, params) {
  const id = params.get('id');
  const previa = params.get('modo') === 'previa';
  const palco = h('div', { class: 'teste' });

  lerAtividade(id).then((a) => {
    if (!a || a.erro) {
      alvo.append(h('div', { class: 'vazio cartao' }, h('h1', { tabindex: '-1' }, t('editor.naoAchou')), h('a', { class: 'botao', href: '#/atividades' }, t('editor.voltar'))));
      return;
    }
    alvo.append(
      h('p', null, h('a', { href: `#/atividades/editar?id=${a.id}`, class: 'voltar' }, svg(icones.voltar), t('testar.voltarEditor'))),
      h(
        'div',
        { class: 'tela__topo buzzer-topo' },
        h('div', null, h('h1', { tabindex: '-1' }, a.titulo), h('p', { class: 'tela__subtitulo' }, previa ? t('testar.previaDica') : t('testar.testeDica'))),
        h('a', { class: 'botao', href: previa ? `#/atividades/testar?id=${a.id}` : `#/atividades/testar?id=${a.id}&modo=previa` }, previa ? t('editor.testar') : t('editor.previa'))
      ),
      palco
    );
    if (!a.conteudo.perguntas.length) {
      palco.append(h('div', { class: 'vazio cartao' }, Mascote({ humor: 'neutro', tamanho: '6rem' }), h('p', null, t('editor.semPerguntas'))));
      return;
    }
    if (previa) mostrarPrevia(a);
    else iniciarTeste(a);
  });

  function mostrarPrevia(a) {
    const nomes = NOMES_TIPOS();
    palco.append(
      h(
        'ol',
        { class: 'previa', role: 'list' },
        a.conteudo.perguntas.map((q, i) =>
          h(
            'li',
            { class: 'cartao previa__item' },
            h('div', { class: 'pergunta__topo' }, h('span', { class: 'pergunta__numero manuscrito' }, `${i + 1}`), h('span', { class: 'etiqueta' }, nomes[q.tipo]), q.tempo ? h('span', { class: 'etiqueta' }, `${q.tempo} s`) : null, tipoDe(q).temResposta ? h('span', { class: 'etiqueta' }, t('testar.pontos', { n: q.pontos })) : null),
            VisorQuestao(q, { modo: 'previa' })
          )
        )
      )
    );
  }

  function iniciarTeste(a) {
    // Embaralha como no jogo de verdade, se a atividade pedir.
    let perguntas = a.regras.embaralharPerguntas ? embaralhar(a.conteudo.perguntas) : [...a.conteudo.perguntas];
    if (a.regras.embaralharOpcoes) perguntas = perguntas.map((q) => (q.opcoes ? { ...q, opcoes: embaralhar(q.opcoes) } : q));
    const respostas = [];
    let i = 0;

    const progresso = h('p', { class: 'etiqueta teste__progresso' });
    const area = h('div', { class: 'cartao teste__cartao' });
    const retorno = h('div', { class: 'teste__retorno', 'aria-live': 'polite' });
    palco.append(progresso, area);

    function mostrar() {
      const q = perguntas[i];
      progresso.textContent = t('testar.progresso', { i: i + 1, n: perguntas.length });
      retorno.replaceChildren();
      area.replaceChildren(
        VisorQuestao(q, {
          modo: 'teste',
          aoResponder: (resposta) => {
            desbloquear();
            const r = corrigir(q, resposta);
            respostas.push({ q, resposta, ...r });
            if (r.correta === true) sons.vitoria();
            else if (r.correta === false) sons.queima();
            retorno.dataset.resultado = r.correta === null ? 'neutro' : String(r.correta);
            retorno.replaceChildren(...[
              h('p', { class: 'teste__veredito manuscrito' }, r.correta === null ? t('testar.registrado') : r.correta ? t('testar.certo') : t('testar.errado')),
              r.correta === false ? h('p', null, t('testar.gabarito'), ' ', textoGabarito(q)) : null,
              q.explicacao && a.regras.mostrarExplicacao ? h('p', { class: 'visor__explicacao' }, h('strong', null, t('questao.explicacao')), ' ', q.explicacao) : null,
              Botao({ texto: i + 1 < perguntas.length ? t('testar.proxima') : t('testar.verResultado'), variante: 'primario', aoClicar: avancar }),
            ].filter(Boolean)); // append nativo escreveria "null"
            retorno.querySelector('.botao')?.focus();
          },
        }),
        retorno
      );
      area.querySelector('button, input')?.focus();
    }

    function avancar() {
      i += 1;
      if (i < perguntas.length) mostrar();
      else fim();
    }

    function fim() {
      const corrigidas = respostas.filter((r) => r.correta !== null);
      const certas = corrigidas.filter((r) => r.correta).length;
      const pontos = corrigidas.filter((r) => r.correta).reduce((s, r) => s + r.q.pontos, 0);
      progresso.textContent = t('testar.fim');
      area.replaceChildren(
        h(
          'div',
          { class: 'teste__fim' },
          Mascote({ humor: certas === corrigidas.length ? 'feliz' : certas ? 'neutro' : 'triste', tamanho: '7rem' }),
          h('p', { class: 'teste__placar manuscrito' }, t('testar.acertos', { n: certas, total: corrigidas.length })),
          h('p', { class: 'texto-suave' }, t('testar.pontosTotal', { n: pontos })),
          h(
            'ol',
            { class: 'teste__lista' },
            respostas.map((r) => h('li', { 'data-certo': String(r.correta) }, h('span', { 'aria-hidden': 'true' }, r.correta === null ? '•' : r.correta ? '✓ ' : '✕ '), h('span', { class: 'sr-only' }, r.correta === null ? '' : r.correta ? t('testar.certo') : t('testar.errado')), r.q.enunciado))
          ),
          h(
            'div',
            { class: 'linha' },
            Botao({
              texto: t('testar.denovo'),
              variante: 'primario',
              aoClicar: () => {
                palco.replaceChildren();
                iniciarTeste(a);
              },
            }),
            h('a', { class: 'botao', href: `#/atividades/editar?id=${a.id}` }, t('testar.voltarEditor'))
          )
        )
      );
    }

    mostrar();
  }
}

function textoGabarito(q) {
  if (q.tipo === 'multipla') return q.opcoes.filter((o) => o.correta).map((o) => o.texto).join(' + ');
  if (q.tipo === 'vf') return q.correta ? t('questao.verdadeiro') : t('questao.falso');
  if (q.tipo === 'curta') return q.aceitas.filter(Boolean).join(' / ');
  if (q.tipo === 'numerica') return `${String(q.valor).replace('.', ',')}${q.unidade ? ` ${q.unidade}` : ''}`;
  return '';
}
