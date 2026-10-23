// Quiz no projetor, num aparelho só: a tela mostra a pergunta e o professor registra a
// resposta de cada participante/equipe (os alunos falam ou levantam a cor/forma).
// Todas as ações passam por executar(): na Fase 5 o celular do professor (controle remoto)
// só vai precisar mandar os mesmos comandos.
import { h, svg } from '../dom.js';
import { t } from '../../i18n/i18n.js';
import * as Q from '../../core/quiz.js';
import { tipoDe } from '../../core/questions/index.js';
import { variasCorretas } from '../../core/questions/multipla.js';
import { formatarRelogio } from '../../core/timer.js';
import { salvar } from '../../storage/db.js';
import { novoId } from '../../core/ids.js';
import { sons, desbloquear } from '../../audio/sons.js';
import { MARCAS } from '../questoes.js';
import { Botao } from '../components/botao.js';
import { Mascote } from '../components/mascote.js';
import { icones } from '../components/icones.js';

const agora = () => performance.now();
const reduzido = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Para perguntas abertas o professor só diz "certo" ou "errado".
function respostaPara(q, certo) {
  if (q.tipo === 'multipla') return certo ? q.opcoes.filter((o) => o.correta).map((o) => o.id) : ['__errada__'];
  if (q.tipo === 'vf') return certo ? q.correta : !q.correta;
  if (q.tipo === 'numerica') return certo ? String(q.valor) : 'x';
  if (q.tipo === 'curta') return certo ? q.aceitas.find(Boolean) ?? '' : '\u0000';
  return null;
}

// opcoes.remoto: respostas chegam dos celulares (Fase 5). aoMudar(p) avisa a sala a cada mudança;
// aoPronto({ executar, partida }) entrega os comandos para quem controla de fora.
export function jogarQuiz(alvo, atividade, participantes, opcoes = {}) {
  const remoto = Boolean(opcoes.remoto);
  const sairHref = opcoes.sairHref ?? '#/atividades';
  let p = Q.criarPartida(atividade, participantes);
  let relogio = null;
  let ultimoSegundo = null;
  let salvo = false;

  document.body.classList.add('modo-palco');
  const palco = h('div', { class: 'palco' });
  const progresso = h('span', { class: 'etiqueta palco__progresso' });
  const anuncio = h('p', { class: 'sr-only', 'aria-live': 'polite' });
  const telaCheia = document.fullscreenEnabled
    ? Botao({ icone: 'telaCheia', rotulo: t('buzzer.telaCheia'), aoClicar: () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {}) })
    : null;
  const topo = h(
    'div',
    { class: 'palco__topo' },
    h('a', { class: 'botao botao--icone', href: sairHref, 'aria-label': t('jogar.sair'), title: t('jogar.sair') }, svg(icones.fechar)),
    h('span', { class: 'palco__titulo manuscrito' }, atividade.titulo),
    opcoes.extraTopo ?? null,
    progresso,
    telaCheia
  );
  const corpo = h('div', { class: 'palco__corpo' });
  palco.append(topo, corpo, anuncio);
  alvo.append(palco);

  // ---------- Comandos (futuro controle remoto) ----------
  function executar(comando, dados = {}) {
    desbloquear();
    const antes = p;
    if (comando === 'proxima') p = Q.proximaPergunta(p, agora());
    else if (comando === 'responder') p = Q.responder(p, dados.pid, dados.resposta, dados.t ?? agora());
    else if (comando === 'encerrar') p = Q.encerrarPergunta(p);
    else if (comando === 'ranking') p = Q.mostrarRanking(p);
    if (p === antes) return;
    if (comando === 'responder') {
      sons.registro();
      if (Q.todosResponderam(p)) p = Q.encerrarPergunta(p);
    }
    if (antes.fase !== p.fase || antes.indice !== p.indice) {
      clearInterval(relogio);
      relogio = null;
      if (p.fase === Q.FASES.REVELACAO) sons.empate();
      if (p.fase === Q.FASES.FIM) sons.vitoria();
    }
    desenhar(antes.fase !== p.fase || antes.indice !== p.indice);
    opcoes.aoMudar?.(p);
  }

  // Avança conforme a tela atual (Espaço / botão principal).
  function avancar() {
    if (p.fase === Q.FASES.ABERTURA || p.fase === Q.FASES.RANKING) executar('proxima');
    else if (p.fase === Q.FASES.PERGUNTA) {
      const slide = Q.perguntaAtual(p).tipo === 'slide';
      executar('encerrar');
      if (slide) executar('proxima'); // slide não tem revelação
    } else if (p.fase === Q.FASES.REVELACAO) {
      if (p.ranking === 'oculto') executar('proxima');
      else executar('ranking');
    }
  }

  // ---------- Telas ----------
  function desenhar(trocouTela) {
    const q = Q.perguntaAtual(p);
    progresso.textContent = q && p.fase !== Q.FASES.FIM ? t('testar.progresso', { i: p.indice + 1, n: p.perguntas.length }) : t('jogar.nPerguntas', { n: p.perguntas.length });
    palco.dataset.fase = p.fase;
    if (!trocouTela && p.fase === Q.FASES.PERGUNTA) return atualizarPainel();
    corpo.replaceChildren();
    if (p.fase === Q.FASES.ABERTURA) telaAbertura();
    else if (p.fase === Q.FASES.PERGUNTA) telaPergunta(q);
    else if (p.fase === Q.FASES.REVELACAO) telaRevelacao(q);
    else if (p.fase === Q.FASES.RANKING) telaRanking();
    else telaFim();
    corpo.querySelector('.palco__principal')?.focus({ preventScroll: true });
  }

  function botaoPrincipal(texto) {
    return Botao({ texto, variante: 'primario', tamanho: 'grande', aoClicar: avancar });
  }

  function telaAbertura() {
    const b = botaoPrincipal(t('jogar.comecarQuiz'));
    b.classList.add('palco__principal');
    corpo.append(
      h(
        'div',
        { class: 'palco__abertura' },
        Mascote({ humor: 'feliz', tamanho: '8rem' }),
        h('h1', { class: 'palco__grande manuscrito', tabindex: '-1' }, atividade.titulo),
        h('p', null, t('jogar.aberturaTexto', { n: p.perguntas.length })),
        h('ul', { class: 'palco__participantes', role: 'list' }, p.participantes.map((x) => h('li', { class: 'etiqueta', style: { background: x.cor, color: 'var(--tinta-fixa)', 'border-color': 'var(--tinta-fixa)' } }, x.nome))),
        b,
        h('p', { class: 'texto-suave' }, t('jogar.dicaEspaco'))
      )
    );
  }

  const painel = h('div', { class: 'painel' });
  const cronometro = h('div', { class: 'palco__relogio', role: 'timer', 'aria-label': t('jogar.tempo') });
  const barra = h('div', { class: 'palco__barra', 'aria-hidden': 'true' }, h('span'));
  const contagemRespostas = h('span', { class: 'etiqueta' });

  function telaPergunta(q) {
    const plugin = tipoDe(q);
    const mult = Q.multiplicador(q);
    const opcoes = Array.isArray(q.opcoes)
      ? h(
          'ol',
          { class: 'palco__opcoes', role: 'list' },
          q.opcoes.map((o, i) => h('li', { class: 'palco__opcao', style: { '--cor': MARCAS[i % 8].cor } }, h('span', { class: 'visor__forma', 'aria-hidden': 'true' }, MARCAS[i % 8].forma), h('span', null, o.texto)))
        )
      : q.tipo === 'vf'
        ? h('ol', { class: 'palco__opcoes', role: 'list' }, [true, false].map((v, i) => h('li', { class: 'palco__opcao', style: { '--cor': MARCAS[i === 0 ? 3 : 0].cor } }, h('span', { class: 'visor__forma', 'aria-hidden': 'true' }, v ? '✓' : '✕'), h('span', null, v ? t('questao.verdadeiro') : t('questao.falso')))))
        : q.tipo === 'slide'
          ? h('p', { class: 'palco__texto' }, q.texto ?? '')
          : h('p', { class: 'palco__aberta texto-suave' }, q.tipo === 'numerica' ? t('jogar.respostaNumerica', { unidade: q.unidade || '' }) : t('jogar.respostaAberta'));

    const principal = botaoPrincipal(plugin.temResposta ? t('jogar.encerrar') : t('questao.continuar'));
    principal.classList.add('palco__principal');
    corpo.append(
      h(
        'div',
        { class: 'palco__pergunta' },
        h(
          'div',
          { class: 'palco__cabeca' },
          mult === 2 ? h('span', { class: 'etiqueta etiqueta--dobro' }, t('jogar.dobro')) : mult === 0 ? h('span', { class: 'etiqueta' }, t('jogar.valeZero')) : null,
          Q.tempoLimite(p) ? cronometro : null,
          plugin.temResposta ? contagemRespostas : null
        ),
        Q.tempoLimite(p) ? barra : null,
        h('h1', { class: 'palco__enunciado', tabindex: '-1' }, q.enunciado),
        opcoes
      ),
      plugin.temResposta || q.tipo === 'enquete' ? painel : null,
      h('div', { class: 'linha palco__acoes' }, principal)
    );
    montarPainel(q);
    if (Q.tempoLimite(p)) {
      ultimoSegundo = null;
      relogio = setInterval(tique, 100);
      tique();
    }
    anuncio.textContent = q.enunciado;
  }

  function tique() {
    const fim = Q.prazo(p);
    if (fim === null) return;
    const resta = Math.max(0, fim - agora());
    cronometro.textContent = String(Math.ceil(resta / 1000));
    barra.firstChild.style.transform = `scaleX(${resta / Q.tempoLimite(p)})`;
    palco.dataset.acabando = String(resta <= 5000);
    const s = Math.ceil(resta / 1000);
    if (s <= 5 && s > 0 && s !== ultimoSegundo) sons.contagem();
    ultimoSegundo = s;
    if (resta <= 0) executar('encerrar');
  }

  function montarPainel(q) {
    const nomeTipo = q.tipo;
    if (remoto) {
      painel.replaceChildren(
        h('h2', { class: 'painel__titulo' }, t('sala.respostasCelulares')),
        h('ul', { class: 'painel__lista', role: 'list' }, p.participantes.map((x) => h('li', { class: 'painel__linha', 'data-pid': x.id, 'data-tipo': nomeTipo }, h('span', { class: 'painel__nome', style: { '--cor': x.cor } }, x.nome), h('span', { class: 'painel__ok', 'aria-hidden': 'true' }))))
      );
      atualizarPainel();
      return;
    }
    const porOpcao = (q.tipo === 'multipla' && !variasCorretas(q)) || q.tipo === 'enquete' || q.tipo === 'vf';
    painel.replaceChildren(
      h('h2', { class: 'painel__titulo' }, t('jogar.registrar')),
      h('p', { class: 'texto-suave dica' }, porOpcao ? t('jogar.registrarDicaOpcao') : t('jogar.registrarDicaCerto')),
      h(
        'ul',
        { class: 'painel__lista', role: 'list' },
        p.participantes.map((x) => {
          const botoes = porOpcao
            ? (q.tipo === 'vf' ? [true, false] : q.opcoes).map((o, i) => {
                const marca = q.tipo === 'vf' ? MARCAS[o ? 3 : 0] : MARCAS[i % 8];
                const rotulo = q.tipo === 'vf' ? (o ? t('questao.verdadeiro') : t('questao.falso')) : o.texto;
                return Botao({
                  texto: q.tipo === 'vf' ? (o ? 'V' : 'F') : marca.forma,
                  rotulo: t('jogar.respondeu', { nome: x.nome, opcao: rotulo }),
                  aoClicar: () => executar('responder', { pid: x.id, resposta: q.tipo === 'vf' ? o : q.tipo === 'enquete' ? o.id : [o.id] }),
                });
              })
            : [
                Botao({ texto: '✓', variante: 'info', rotulo: t('jogar.acertou', { nome: x.nome }), aoClicar: () => executar('responder', { pid: x.id, resposta: respostaPara(q, true) }) }),
                Botao({ texto: '✕', rotulo: t('jogar.errou', { nome: x.nome }), aoClicar: () => executar('responder', { pid: x.id, resposta: respostaPara(q, false) }) }),
              ];
          botoes.forEach((b, i) => {
            if (porOpcao && q.tipo !== 'vf') b.style.setProperty('background', MARCAS[i % 8].cor);
            if (porOpcao) b.classList.add('painel__opcao');
          });
          return h('li', { class: 'painel__linha', 'data-pid': x.id, 'data-tipo': nomeTipo }, h('span', { class: 'painel__nome', style: { '--cor': x.cor } }, x.nome), h('span', { class: 'painel__botoes' }, botoes), h('span', { class: 'painel__ok', 'aria-hidden': 'true' }));
        })
      )
    );
    atualizarPainel();
  }

  function atualizarPainel() {
    const q = Q.perguntaAtual(p);
    const respostas = p.respostas[q.id] ?? {};
    let n = 0;
    painel.querySelectorAll('.painel__linha').forEach((linha) => {
      const respondeu = Boolean(respostas[linha.dataset.pid]);
      if (respondeu) n += 1;
      linha.dataset.respondeu = String(respondeu);
      linha.querySelector('.painel__ok').textContent = respondeu ? '✓' : '';
      linha.querySelectorAll('button').forEach((b) => (b.disabled = respondeu));
    });
    contagemRespostas.textContent = t('jogar.responderam', { n, total: p.participantes.length });
  }

  function telaRevelacao(q) {
    const plugin = tipoDe(q);
    const dist = Q.distribuicao(p, q);
    const maximo = Math.max(1, dist.total);
    let barras = null;
    if (dist.tipo === 'opcoes' || dist.tipo === 'vf') {
      const itens = dist.tipo === 'vf' ? [{ id: 'true', texto: t('questao.verdadeiro'), correta: q.correta === true }, { id: 'false', texto: t('questao.falso'), correta: q.correta === false }] : q.opcoes;
      barras = h(
        'ol',
        { class: 'distribuicao', role: 'list' },
        itens.map((o, i) => {
          const marca = dist.tipo === 'vf' ? MARCAS[i === 0 ? 3 : 0] : MARCAS[i % 8];
          const qtd = dist.contagem[o.id] ?? 0;
          return h(
            'li',
            { class: 'distribuicao__item', 'data-correta': String(Boolean(o.correta)), style: { '--cor': marca.cor, '--valor': qtd / maximo } },
            h('span', { class: 'distribuicao__barra', 'aria-hidden': 'true' }),
            h('span', { class: 'distribuicao__qtd' }, String(qtd)),
            h('span', { class: 'distribuicao__texto' }, h('span', { 'aria-hidden': 'true' }, `${marca.forma} `), o.texto, o.correta ? h('span', { class: 'distribuicao__certa' }, ` ✓ ${t('jogar.correta')}`) : null)
          );
        })
      );
    } else if (dist.tipo === 'aberta') {
      barras = h(
        'div',
        { class: 'pilha' },
        h('p', { class: 'visor__gabarito' }, t('questao.gabarito', { valor: q.tipo === 'curta' ? q.aceitas.filter(Boolean).join(' / ') : `${String(q.valor).replace('.', ',')} ${q.unidade ?? ''}` })),
        h('p', null, t('jogar.certasErradas', { certas: dist.contagem.certas, erradas: dist.contagem.erradas }))
      );
    }
    const resultados = plugin.temResposta
      ? h(
          'ul',
          { class: 'resultados', role: 'list' },
          p.participantes.map((x) => {
            const r = p.respostas[q.id]?.[x.id];
            const estado = !r ? 'sem' : r.correta ? 'certo' : 'errado';
            return h('li', { class: 'resultados__item', 'data-estado': estado, style: { '--cor': x.cor } }, h('span', { class: 'resultados__nome' }, x.nome), h('span', { class: 'resultados__pts' }, !r ? t('jogar.naoRespondeu') : r.correta ? `+${r.pontos}` : r.pontos < 0 ? String(r.pontos) : '✕'));
          })
        )
      : null;
    const ultima = p.indice + 1 >= p.perguntas.length;
    const principal = botaoPrincipal(p.ranking !== 'oculto' ? t('jogar.verRanking') : ultima ? t('jogar.verPodio') : t('jogar.proxima'));
    principal.classList.add('palco__principal');
    corpo.append(
      h(
        'div',
        { class: 'palco__pergunta' },
        h('h1', { class: 'palco__enunciado palco__enunciado--menor', tabindex: '-1' }, q.enunciado),
        barras,
        q.explicacao && p.regras.mostrarExplicacao ? h('p', { class: 'visor__explicacao' }, h('strong', null, t('questao.explicacao')), ' ', q.explicacao) : null,
        resultados
      ),
      h('div', { class: 'linha palco__acoes' }, principal)
    );
    anuncio.textContent = t('jogar.revelado');
  }

  function telaRanking() {
    const lista = Q.ranking(p);
    const mostrar = p.ranking === 'top5' ? lista.slice(0, 5) : lista;
    const ultima = p.indice + 1 >= p.perguntas.length;
    const principal = botaoPrincipal(ultima ? t('jogar.verPodio') : t('jogar.proxima'));
    principal.classList.add('palco__principal');
    corpo.append(
      h(
        'div',
        { class: 'palco__ranking' },
        h('h1', { class: 'palco__grande manuscrito', tabindex: '-1' }, t('jogar.ranking')),
        h(
          'ol',
          { class: 'ranking', role: 'list' },
          mostrar.map((x) =>
            h(
              'li',
              { class: 'ranking__item', style: { '--cor': x.cor } },
              h('span', { class: 'ranking__pos' }, `${x.posicao}º`),
              h('span', { class: 'ranking__nome' }, x.nome),
              x.subiu > 0 ? h('span', { class: 'ranking__subiu', title: t('jogar.subiu', { n: x.subiu }) }, `▲${x.subiu}`) : null,
              x.sequencia > 1 ? h('span', { class: 'etiqueta', title: t('jogar.sequencia') }, `🔥${x.sequencia}`) : null,
              h('span', { class: 'ranking__pts' }, String(x.pontos))
            )
          )
        )
      ),
      h('div', { class: 'linha palco__acoes' }, principal)
    );
  }

  function telaFim() {
    const ranking = Q.ranking(p);
    const [primeiro, segundo, terceiro] = [1, 2, 3].map((pos) => ranking.filter((x) => x.posicao === pos));
    const degrau = (grupo, lugar) =>
      h(
        'li',
        { class: `podio__degrau podio__degrau--${lugar}` },
        h('span', { class: 'podio__nomes' }, grupo.map((x) => x.nome).join(' · ') || '—'),
        h('span', { class: 'podio__pts' }, grupo[0] ? t('jogar.pontos', { n: grupo[0].pontos }) : ''),
        h('span', { class: 'podio__bloco', style: { '--cor': grupo[0]?.cor ?? 'var(--linha-caderno)' } }, `${lugar}º`)
      );
    corpo.append(
      h(
        'div',
        { class: 'palco__fim' },
        reduzido() ? null : h('div', { class: 'confete', 'aria-hidden': 'true' }, Array.from({ length: 40 }, (_, i) => h('span', { style: { '--i': i, '--x': `${(i * 37) % 100}%`, '--cor': ['#FFD23F', '#FF5C8A', '#3FC1E0', '#3DBE5A', '#7B61FF'][i % 5] } }))),
        h('h1', { class: 'palco__grande manuscrito', tabindex: '-1' }, t('jogar.podio')),
        Mascote({ humor: 'feliz', tamanho: '7rem' }),
        h('ol', { class: 'podio', role: 'list' }, degrau(segundo, 2), degrau(primeiro, 1), degrau(terceiro, 3)),
        h('ol', { class: 'ranking ranking--compacto', role: 'list' }, ranking.map((x) => h('li', { class: 'ranking__item', style: { '--cor': x.cor } }, h('span', { class: 'ranking__pos' }, `${x.posicao}º`), h('span', { class: 'ranking__nome' }, x.nome), h('span', { class: 'ranking__pts' }, String(x.pontos))))),
        h(
          'div',
          { class: 'linha palco__acoes' },
          Botao({
            texto: t('jogar.denovo'),
            variante: 'primario',
            aoClicar: () => {
              p = Q.criarPartida(atividade, participantes);
              salvo = false;
              desenhar(true);
              opcoes.aoMudar?.(p);
            },
          }),
          h('a', { class: 'botao', href: sairHref }, t('editor.voltar'))
        )
      )
    );
    anuncio.textContent = t('jogar.vencedor', { nome: primeiro.map((x) => x.nome).join(' e ') });
    if (!salvo) {
      salvo = true;
      salvar('resultados', { id: novoId('res'), ...Q.resumo(p, atividade) });
    }
  }

  // ---------- Teclado ----------
  function teclado(e) {
    if (document.querySelector('dialog[open]') || e.target.closest?.('input, textarea, select')) return;
    if (e.code === 'Space' && !e.target.closest?.('button, a')) {
      e.preventDefault();
      if (!e.repeat) avancar();
    } else if ((e.key === 'f' || e.key === 'F') && document.fullscreenEnabled) {
      (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {});
    }
  }
  document.addEventListener('keydown', teclado);

  desenhar(true);
  opcoes.aoPronto?.({ executar, partida: () => p });

  return () => {
    clearInterval(relogio);
    document.removeEventListener('keydown', teclado);
    document.body.classList.remove('modo-palco');
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  };
}
