// Passa ou Repassa no projetor: equipe da vez responde ou passa; quem recebe responde ou
// repassa. O professor julga tocando na opção dita (corrige sozinho) ou em Acertou/Errou.
// Errou? Torta! (animada; com movimento reduzido, só aparece parada).
import { h, svg } from '../dom.js';
import { t } from '../../i18n/i18n.js';
import * as PR from '../../core/passa-repassa.js';
import { salvar } from '../../storage/db.js';
import { novoId } from '../../core/ids.js';
import { sons, desbloquear } from '../../audio/sons.js';
import { MARCAS } from '../questoes.js';
import { Botao } from '../components/botao.js';
import { Mascote } from '../components/mascote.js';
import { icones } from '../components/icones.js';

const TORTA = `<svg viewBox="0 0 120 80" aria-hidden="true" focusable="false">
  <ellipse cx="60" cy="58" rx="54" ry="16" fill="#E9C46A" stroke="#141414" stroke-width="4"/>
  <path d="M10 52 Q60 10 110 52 Q60 70 10 52z" fill="#FFF7E8" stroke="#141414" stroke-width="4"/>
  <circle cx="44" cy="38" r="6" fill="#FF5C8A" stroke="#141414" stroke-width="3"/>
  <circle cx="72" cy="34" r="6" fill="#FF5C8A" stroke="#141414" stroke-width="3"/>
</svg>`;

export function jogarPassaRepassa(alvo, atividade, equipes) {
  let j = PR.criarJogo(atividade, equipes);
  let salvo = false;
  document.body.classList.add('modo-palco');

  const palco = h('div', { class: 'palco palco--passa' });
  const placar = h('ol', { class: 'pr-placar', role: 'list' });
  const corpo = h('div', { class: 'palco__corpo' });
  const anuncio = h('p', { class: 'sr-only', 'aria-live': 'assertive' });
  const progresso = h('span', { class: 'etiqueta palco__progresso' });
  const telaCheia = document.fullscreenEnabled
    ? Botao({ icone: 'telaCheia', rotulo: t('buzzer.telaCheia'), aoClicar: () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {}) })
    : null;
  palco.append(
    h('div', { class: 'palco__topo' }, h('a', { class: 'botao botao--icone', href: '#/atividades', 'aria-label': t('jogar.sair'), title: t('jogar.sair') }, svg(icones.fechar)), h('span', { class: 'palco__titulo manuscrito' }, atividade.titulo), progresso, telaCheia),
    placar,
    corpo,
    anuncio
  );
  alvo.append(palco);

  const nome = (id) => j.equipes.find((e) => e.id === id).nome;

  function acao(fn) {
    desbloquear();
    const antes = j;
    j = fn(j);
    if (j === antes) return;
    if (j.etapa === PR.ETAPAS.RESULTADO && antes.etapa !== PR.ETAPAS.RESULTADO) {
      if (j.ultimo.correta) sons.vitoria();
      else sons.queima();
    }
    if (j.etapa === PR.ETAPAS.FIM) sons.vitoria();
    desenhar();
  }

  function desenharPlacar() {
    placar.replaceChildren(
      ...j.equipes.map((e) => {
        const tortaNova = j.etapa === PR.ETAPAS.RESULTADO && j.ultimo?.torta && j.ultimo.equipe === e.id;
        return h(
          'li',
          { class: 'pr-equipe', style: { '--cor': e.cor }, 'data-vez': String(j.respondendo === e.id && j.etapa !== PR.ETAPAS.FIM), 'data-torta': String(tortaNova) },
          h('span', { class: 'pr-equipe__nome manuscrito' }, e.nome),
          h('span', { class: 'pr-equipe__pts' }, String(j.pontos[e.id])),
          j.tortas[e.id] ? h('span', { class: 'pr-equipe__tortas', title: t('passa.tortas', { n: j.tortas[e.id] }) }, `🥧 ${j.tortas[e.id]}`) : null,
          tortaNova ? h('span', { class: 'pr-torta' }, h('span', { class: 'pr-torta__voo', html: TORTA }), h('span', { class: 'pr-torta__creme', 'aria-hidden': 'true' })) : null
        );
      })
    );
  }

  function opcoesJulgaveis(q) {
    if (q.tipo === 'multipla' && q.opcoes.filter((o) => o.correta).length === 1) {
      return q.opcoes.map((o, i) => ({ rotulo: o.texto, marca: MARCAS[i % 8], resposta: [o.id] }));
    }
    if (q.tipo === 'vf') return [true, false].map((v, i) => ({ rotulo: v ? t('questao.verdadeiro') : t('questao.falso'), marca: MARCAS[i === 0 ? 3 : 0], resposta: v }));
    return null;
  }

  function textoGabarito(q) {
    if (q.tipo === 'multipla') return q.opcoes.filter((o) => o.correta).map((o) => o.texto).join(' + ');
    if (q.tipo === 'vf') return q.correta ? t('questao.verdadeiro') : t('questao.falso');
    if (q.tipo === 'curta') return q.aceitas.filter(Boolean).join(' / ');
    if (q.tipo === 'numerica') return `${String(q.valor).replace('.', ',')} ${q.unidade ?? ''}`;
    return '';
  }

  function desenhar() {
    desenharPlacar();
    corpo.replaceChildren();
    progresso.textContent = j.etapa === PR.ETAPAS.FIM ? t('testar.fim') : t('testar.progresso', { i: j.indice + 1, n: j.perguntas.length });
    if (j.etapa === PR.ETAPAS.FIM) return telaFim();
    const q = PR.perguntaAtual(j);
    const julgaveis = opcoesJulgaveis(q);
    const emJulgamento = [PR.ETAPAS.VEZ, PR.ETAPAS.PASSOU, PR.ETAPAS.REPASSOU].includes(j.etapa);

    const opcoes = Array.isArray(q.opcoes) || q.tipo === 'vf'
      ? h(
          'ol',
          { class: 'palco__opcoes', role: 'list' },
          (q.tipo === 'vf' ? [{ texto: t('questao.verdadeiro'), correta: q.correta }, { texto: t('questao.falso'), correta: !q.correta }] : q.opcoes).map((o, i) => {
            const marca = q.tipo === 'vf' ? MARCAS[i === 0 ? 3 : 0] : MARCAS[i % 8];
            return h('li', { class: 'palco__opcao', style: { '--cor': marca.cor }, 'data-correta': String(j.etapa === PR.ETAPAS.RESULTADO && Boolean(o.correta)) }, h('span', { class: 'visor__forma', 'aria-hidden': 'true' }, q.tipo === 'vf' ? (i === 0 ? '✓' : '✕') : marca.forma), h('span', null, o.texto));
          })
        )
      : null;

    let faixa;
    if (j.etapa === PR.ETAPAS.VEZ) faixa = t('passa.vez', { nome: nome(j.respondendo) });
    else if (j.etapa === PR.ETAPAS.PASSOU) faixa = t('passa.passou', { de: nome(j.quemPassou), para: nome(j.respondendo) });
    else if (j.etapa === PR.ETAPAS.REPASSOU) faixa = t('passa.repassou', { nome: nome(j.respondendo) });
    else faixa = j.ultimo.correta ? t('passa.acertou', { nome: nome(j.ultimo.equipe), pts: j.ultimo.pontos }) : j.ultimo.pontos < 0 ? t('passa.errouPerdeu', { nome: nome(j.ultimo.equipe), pts: Math.abs(j.ultimo.pontos) }) : t('passa.errou', { nome: nome(j.ultimo.equipe) });

    const controles = h('div', { class: 'pr-controles' });
    if (emJulgamento) {
      const decisao = h('div', { class: 'linha' });
      if (j.etapa === PR.ETAPAS.VEZ) decisao.append(Botao({ texto: t('passa.passa'), variante: 'amarelo', tamanho: 'grande', aoClicar: () => acao(PR.passar) }));
      if (j.etapa === PR.ETAPAS.PASSOU) decisao.append(Botao({ texto: t('passa.repassa'), variante: 'amarelo', tamanho: 'grande', aoClicar: () => acao(PR.repassar) }));
      controles.append(
        decisao,
        h('p', { class: 'texto-suave dica' }, julgaveis ? t('passa.julgarOpcao', { nome: nome(j.respondendo) }) : t('passa.julgarCerto', { nome: nome(j.respondendo) })),
        julgaveis
          ? h(
              'div',
              { class: 'linha pr-julgar' },
              julgaveis.map((o) => {
                const b = Botao({ texto: `${o.marca.forma} ${o.rotulo}`, rotulo: t('passa.disse', { nome: nome(j.respondendo), opcao: o.rotulo }), aoClicar: () => acao((x) => PR.julgar(x, { resposta: o.resposta })) });
                b.style.setProperty('background', o.marca.cor);
                b.style.setProperty('color', 'var(--tinta-fixa)');
                return b;
              })
            )
          : null,
        h(
          'div',
          { class: 'linha' },
          Botao({ texto: t('passa.acertouBotao'), variante: 'info', aoClicar: () => acao((x) => PR.julgar(x, { correta: true })) }),
          Botao({ texto: t('passa.errouBotao'), variante: 'perigo', aoClicar: () => acao((x) => PR.julgar(x, { correta: false })) })
        )
      );
    } else {
      const principal = Botao({ texto: j.indice + 1 >= j.perguntas.length ? t('jogar.verPodio') : t('jogar.proxima'), variante: 'primario', tamanho: 'grande', aoClicar: () => acao(PR.proxima) });
      principal.classList.add('palco__principal');
      controles.append(
        h('p', { class: 'visor__gabarito' }, t('questao.gabarito', { valor: textoGabarito(q) })),
        q.explicacao ? h('p', { class: 'visor__explicacao' }, h('strong', null, t('questao.explicacao')), ' ', q.explicacao) : null,
        principal
      );
    }

    corpo.append(
      h('p', { class: 'pr-faixa', 'data-etapa': j.etapa, 'data-certo': String(j.ultimo?.correta ?? '') }, faixa),
      h('div', { class: 'palco__pergunta' }, h('h1', { class: 'palco__enunciado', tabindex: '-1' }, q.enunciado), opcoes),
      controles
    );
    anuncio.textContent = faixa;
    corpo.querySelector('.palco__principal, .pr-controles .botao')?.focus({ preventScroll: true });
  }

  function telaFim() {
    const final = PR.placarFinal(j);
    const vencedores = final.filter((e) => e.posicao === 1);
    corpo.append(
      h(
        'div',
        { class: 'palco__fim' },
        h('h1', { class: 'palco__grande manuscrito', tabindex: '-1' }, vencedores.length > 1 ? t('passa.empate') : t('passa.venceu', { nome: vencedores[0].nome })),
        Mascote({ humor: 'feliz', tamanho: '7rem' }),
        h(
          'ol',
          { class: 'ranking', role: 'list' },
          final.map((e) => h('li', { class: 'ranking__item', style: { '--cor': e.cor } }, h('span', { class: 'ranking__pos' }, `${e.posicao}º`), h('span', { class: 'ranking__nome' }, e.nome), e.tortas ? h('span', { class: 'etiqueta' }, `🥧 ${e.tortas}`) : null, h('span', { class: 'ranking__pts' }, String(e.pontos))))
        ),
        h(
          'div',
          { class: 'linha palco__acoes' },
          Botao({
            texto: t('jogar.denovo'),
            variante: 'primario',
            aoClicar: () => {
              j = PR.criarJogo(atividade, equipes);
              salvo = false;
              desenhar();
            },
          }),
          h('a', { class: 'botao', href: '#/atividades' }, t('editor.voltar'))
        )
      )
    );
    if (!salvo) {
      salvo = true;
      salvar('resultados', {
        id: novoId('res'),
        atividadeId: atividade.id,
        titulo: atividade.titulo,
        modalidade: atividade.modalidade,
        data: new Date().toISOString(),
        participantes: final.map(({ id, nome: n, pontos, posicao, tortas }) => ({ id, nome: n, pontos, posicao, tortas })),
        historico: j.historico.map((x) => ({ ...x, enunciado: j.perguntas.find((q) => q.id === x.pergunta)?.enunciado })),
      });
    }
  }

  function teclado(e) {
    if (document.querySelector('dialog[open]') || e.target.closest?.('input, textarea, select, button, a')) return;
    if (e.code === 'Space' && j.etapa === PR.ETAPAS.RESULTADO) {
      e.preventDefault();
      acao(PR.proxima);
    }
  }
  document.addEventListener('keydown', teclado);
  desenhar();

  return () => {
    document.removeEventListener('keydown', teclado);
    document.body.classList.remove('modo-palco');
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  };
}
