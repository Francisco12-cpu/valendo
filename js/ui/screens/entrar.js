// #/entrar — a tela do aluno no próprio celular: entra na sala com código (ou QR) e um nome,
// e então responde o quiz, joga no seu ritmo ou usa o buzzer. Reconecta sozinho se cair.
import { h, svg } from '../dom.js';
import { t } from '../../i18n/i18n.js';
import { validarNome, gerarApelido } from '../../core/nomes.js';
import { limparPalavra } from '../../core/nuvem.js';
import { normalizarCodigo, codigoValido } from '../../core/sala.js';
import { lerNumero } from '../../core/questions/base.js';
import { formatarMs } from '../../core/clock.js';
import { criarClienteSala } from '../sala-cliente.js';
import { MARCAS } from '../questoes.js';
import { Botao } from '../components/botao.js';
import { abrirModal } from '../components/modal.js';
import { Mascote } from '../components/mascote.js';
import { QRCodigo, LeitorQR } from '../components/qr.js';
import { icones } from '../components/icones.js';
import { sons, desbloquear } from '../../audio/sons.js';

export const titulo = () => t('entrar.titulo');

export function render(alvo, params) {
  const modo = ['online', 'qr', 'local'].includes(params.get('modo')) ? params.get('modo') : 'online';
  let cliente = null;
  let ultimoEstado = null;
  let relogio = null;
  let largadaTimer = null;
  const tela = h('div', { class: 'aluno' });
  const statusBarra = h('p', { class: 'aluno__status', 'aria-live': 'polite' });
  // replaceChildren nativo escreveria "null": filtra os vazios.
  const trocar = (...filhos) => tela.replaceChildren(...filhos.filter((f) => f !== null && f !== undefined && f !== false));
  document.body.classList.add('modo-aluno');

  // ---------- Formulário ----------
  function formulario() {
    const campoCodigo = h('input', { id: 'entrar-codigo', class: 'campo aluno__codigo', autocomplete: 'off', inputmode: 'text', maxlength: 7, autocapitalize: 'characters', placeholder: 'ABC234' });
    campoCodigo.value = normalizarCodigo(params.get('sala') ?? '');
    let nomeSalvo = '';
    try {
      nomeSalvo = sessionStorage.getItem('valendo.nome') ?? '';
    } catch {}
    const campoNome = h('input', { id: 'entrar-nome', class: 'campo', maxlength: 20, autocomplete: 'nickname', placeholder: t('entrar.nomeDica') });
    campoNome.value = nomeSalvo;
    const erro = h('p', { class: 'erro-texto', role: 'alert' });
    const apelido = Botao({ texto: t('entrar.apelido'), icone: 'sorteio', aoClicar: () => (campoNome.value = gerarApelido()) });

    const entrar = () => {
      desbloquear();
      const codigo = normalizarCodigo(campoCodigo.value);
      const v = validarNome(campoNome.value);
      if (modo !== 'qr' && !codigoValido(codigo)) return (erro.textContent = t('entrar.codigoInvalido'));
      if (!v.ok) return (erro.textContent = v.motivo === 'ofensivo' ? t('entrar.nomeOfensivo') : t('entrar.nomeCurto'));
      try {
        sessionStorage.setItem('valendo.nome', v.nome);
      } catch {}
      if (modo === 'qr') return lerConvite(v.nome);
      conectarSala({ codigo, nome: v.nome });
    };
    const form = h(
      'form',
      { class: 'cartao pilha aluno__form', novalidate: true },
      modo === 'qr' ? h('p', null, t('entrar.qrDica')) : h('div', { class: 'pilha pilha--justa' }, h('label', { for: 'entrar-codigo', class: 'rotulo' }, t('entrar.codigo')), campoCodigo),
      h('div', { class: 'pilha pilha--justa' }, h('label', { for: 'entrar-nome', class: 'rotulo' }, t('entrar.nome')), campoNome),
      apelido,
      erro,
      Botao({ texto: modo === 'qr' ? t('entrar.lerConvite') : t('entrar.entrar'), variante: 'primario', tamanho: 'grande', tipo: 'submit', bloco: true })
    );
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      entrar();
    });
    trocar(h('div', { class: 'tela__topo aluno__topo' }, Mascote({ humor: 'feliz', tamanho: '5rem' }), h('h1', { tabindex: '-1' }, t('entrar.titulo'))), form);
  }

  // ---------- Modo QR: ler o convite, mostrar a resposta ----------
  function lerConvite(nome) {
    const leitor = LeitorQR({
      dica: t('entrar.qrAponte'),
      aoLer: (convite) => {
        trocar(h('p', null, t('entrar.qrGerando')));
        conectarSala({
          nome,
          convite,
          aoResposta: (texto) =>
            trocar(
              h('div', { class: 'pilha aluno__qr' }, h('h1', { tabindex: '-1', class: 'manuscrito' }, t('entrar.qrMostre')), QRCodigo(texto, { tamanho: 'min(85vw, 22rem)' }), h('details', { class: 'leitor__colar' }, h('summary', null, t('qr.copiarCodigo')), h('textarea', { class: 'campo campo--area', rows: 3, readonly: true, 'aria-label': t('qr.copiarCodigo') }, texto)))
            ),
        });
      },
    });
    trocar(h('h1', { tabindex: '-1', class: 'manuscrito' }, t('entrar.qrLeia')), leitor);
  }

  // ---------- Conexão ----------
  function conectarSala({ codigo = '', nome, convite, aoResposta }) {
    cliente = criarClienteSala({
      modo,
      codigo,
      convite,
      aoResposta,
      nome,
      aoEstado: (estado) => {
        ultimoEstado = estado;
        desenhar(estado);
      },
      aoStatus: (status, detalhe = {}) => {
        tela.dataset.status = status;
        if (status === 'conectado') {
          statusBarra.textContent = detalhe.reconectou ? t('entrar.voltou', { nome: detalhe.nome }) : t('entrar.conectadoComo', { nome: detalhe.nome });
          if (!ultimoEstado) trocar(h('p', { class: 'aluno__aguarde' }, t('entrar.aguarde')));
        } else if (status === 'conectando') {
          if (modo !== 'qr') trocar(h('p', { class: 'aluno__aguarde' }, t('entrar.conectando')));
        } else if (status === 'reconectando') statusBarra.textContent = t('entrar.reconectando');
        else fimComMensagem(status, detalhe);
      },
    });
  }

  function fimComMensagem(status, detalhe) {
    const motivo = status === 'recusado' ? t(`entrar.recusado.${detalhe.motivo}`) : t(`entrar.status.${status}`);
    statusBarra.textContent = '';
    trocar(
      h('div', { class: 'cartao pilha aluno__fim' }, Mascote({ humor: 'triste', tamanho: '5rem' }), h('h1', { tabindex: '-1', class: 'manuscrito' }, motivo), Botao({ texto: t('entrar.tentarDeNovo'), variante: 'primario', aoClicar: () => location.reload() }))
    );
  }

  // ---------- Telas por estado ----------
  function desenhar(e) {
    clearInterval(relogio);
    if (e.tipo !== 'buzzer') clearTimeout(largadaTimer);
    if (e.tipo === 'lobby') return trocar(h('div', { class: 'aluno__lobby pilha' }, Mascote({ humor: 'feliz', tamanho: '6rem' }), h('h1', { tabindex: '-1', class: 'manuscrito' }, t('entrar.naSala', { nome: e.nome })), h('p', null, t('entrar.lobby', { n: e.participantes })), h('p', { class: 'etiqueta' }, `${t('sala.codigoCurto')} ${e.codigo}`)));
    if (e.tipo === 'espera') return trocar(h('p', { class: 'aluno__aguarde' }, t('entrar.comecou')));
    if (e.tipo === 'quiz') return quiz(e);
    if (e.tipo === 'ritmo') return ritmo(e);
    if (e.tipo === 'buzzer') return buzzer(e);
    if (e.tipo === 'espiral') return espiral(e);
    if (e.tipo === 'prova') return provaIndividual(e);
    if (e.tipo === 'nuvem') return nuvemAluno(e);
  }

  // ---------- Nuvem de palavras ----------
  let chaveNuvem = '';
  function nuvemAluno(e) {
    const chave = `${e.aberta}|${e.enviadas}|${e.pergunta}`;
    if (chave === chaveNuvem) return;
    chaveNuvem = chave;
    const restam = Math.max(0, e.maximo - e.enviadas);
    if (!e.aberta) return trocar(h('p', { class: 'aluno__aguarde' }, t('nuvem.fechadaAluno')));
    if (!restam) return trocar(h('div', { class: 'aluno__lobby pilha' }, Mascote({ humor: 'feliz', tamanho: '6rem' }), h('h1', { tabindex: '-1', class: 'manuscrito' }, t('nuvem.obrigado')), h('p', null, t('nuvem.olheTela'))));
    const campo = h('input', { id: 'nuvem-palavra', class: 'campo aluno__campo', maxlength: 30, autocomplete: 'off', enterkeyhint: 'send' });
    const erro = h('p', { class: 'erro-texto', role: 'alert' });
    const enviar = () => {
      const l = limparPalavra(campo.value);
      if (!l) return (erro.textContent = t('nuvem.invalida'));
      cliente.agir('nuvem', { palavras: [campo.value.trim()] });
      sons.registro();
      erro.textContent = '';
      campo.value = '';
    };
    campo.addEventListener('keydown', (ev) => ev.key === 'Enter' && enviar());
    trocar(
      h('p', { class: 'etiqueta' }, t('nuvem.restam', { n: restam })),
      h('h1', { class: 'aluno__enunciado', tabindex: '-1' }, e.pergunta),
      h('label', { for: 'nuvem-palavra', class: 'rotulo' }, t('nuvem.suaPalavra')),
      campo,
      erro,
      Botao({ texto: t('nuvem.enviar'), variante: 'primario', bloco: true, aoClicar: enviar })
    );
  }

  const mmss = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;
  const temResposta = (r) => r !== undefined && r !== null && r !== '' && !(Array.isArray(r) && !r.length);

  // Resposta que pode ser trocada até travar (provas). Marca a escolhida sem redesenhar tudo.
  function respostaEditavel(p, atual, aoMudar) {
    if (p.tipo === 'multipla' || p.tipo === 'enquete' || p.tipo === 'vf') {
      const itens =
        p.tipo === 'vf'
          ? [
              { id: true, texto: t('questao.verdadeiro'), cor: MARCAS[3].cor, forma: '✓' },
              { id: false, texto: t('questao.falso'), cor: MARCAS[0].cor, forma: '✕' },
            ]
          : p.opcoes.map((o, i) => ({ id: o.id, texto: o.texto, cor: MARCAS[i % 8].cor, forma: MARCAS[i % 8].forma }));
      let escolha = p.varias ? new Set(Array.isArray(atual) ? atual : []) : atual;
      const marcado = (id) => (p.varias ? escolha.has(id) : Array.isArray(escolha) ? escolha.includes(id) : escolha === id);
      const botoes = itens.map((it) => {
        const b = h('button', { type: 'button', class: 'aluno__opcao aluno__opcao--compacta', style: { '--cor': it.cor }, 'aria-pressed': String(marcado(it.id)) }, h('span', { class: 'visor__forma', 'aria-hidden': 'true' }, it.forma), h('span', null, it.texto));
        b.addEventListener('click', () => {
          if (p.varias) {
            if (escolha.has(it.id)) escolha.delete(it.id);
            else escolha.add(it.id);
            aoMudar([...escolha]);
          } else {
            escolha = p.tipo === 'multipla' ? [it.id] : it.id;
            aoMudar(escolha);
          }
          botoes.forEach((x, k) => x.setAttribute('aria-pressed', String(marcado(itens[k].id))));
        });
        return b;
      });
      return h('div', { class: 'pilha' }, p.varias ? h('p', { class: 'texto-suave dica' }, t('questao.variasCorretas')) : null, h('div', { class: 'aluno__opcoes' }, botoes));
    }
    if (p.tipo === 'curta' || p.tipo === 'numerica') {
      const campo = h('input', { class: 'campo aluno__campo', autocomplete: 'off', inputmode: p.tipo === 'numerica' ? 'decimal' : 'text', maxlength: 200, 'aria-label': `${t('questao.suaResposta')}${p.unidade ? ` (${p.unidade})` : ''}` });
      campo.value = atual ?? '';
      let salvo = atual ?? '';
      const salvarCampo = () => {
        const v = campo.value.trim();
        if (v === salvo) return;
        salvo = v;
        aoMudar(v);
      };
      campo.addEventListener('change', salvarCampo);
      campo.addEventListener('keydown', (ev) => ev.key === 'Enter' && salvarCampo());
      return h('div', { class: 'linha' }, campo, Botao({ texto: t('provaInd.salvar'), aoClicar: salvarCampo }));
    }
    return p.texto ? h('p', null, p.texto) : null;
  }

  // ---------- Prova em Espiral (aparelho do grupo ou da estação) ----------
  // O host reenvia o estado a cada resposta e a cada 5 s: só reconstrói a tela quando algo
  // estrutural muda (para não apagar o que o aluno está digitando).
  let telaEspiral = null;
  function espiral(e) {
    if (e.espectador) return trocar(h('p', { class: 'aluno__aguarde' }, t('espiral.aparelhoSobrando')));
    const chave = `${e.status}|${e.rodada}|${e.prova?.id}|${e.travado}|${e.pausa}|${e.grupo}`;
    const fim = e.restaMs === null ? null : performance.now() + e.restaMs;
    if (telaEspiral?.chave === chave) return telaEspiral.atualizar(e, fim);
    const relogioEl = h('span', { class: 'aluno__tempo', role: 'timer' });
    const aviso = h('p', { class: 'aluno__aviso', role: 'alert' });
    const cabeca = h('div', { class: 'aluno__barra' }, h('span', { class: 'etiqueta' }, e.modo === 'estacao' ? e.estacao : e.grupo), h('span', { class: 'etiqueta' }, t('espiral.rodada', { n: e.rodada, total: e.total })), relogioEl);
    const salvas = new Map();
    const atualizar = (est, fimLocal) => {
      clearInterval(relogio);
      const tique = () => (relogioEl.textContent = fimLocal === null ? '' : mmss(Math.max(0, fimLocal - performance.now())));
      tique();
      if (est.status === 'rodando') relogio = setInterval(tique, 500);
      aviso.textContent = est.aviso ? t('espiral.avisoAluno') : '';
      for (const [qid, el] of salvas) el.textContent = temResposta(est.respostas?.[qid]) ? t('provaInd.salva') : '';
    };
    telaEspiral = { chave, atualizar };
    if (e.status === 'preparando') trocar(cabeca, h('p', { class: 'aluno__aguarde' }, e.modo === 'estacao' ? t('espiral.estacaoAguarde', { nome: e.estacao }) : t('espiral.aguardeInicio', { nome: e.grupo })));
    else if (e.status === 'fim') trocar(h('div', { class: 'aluno__lobby pilha' }, Mascote({ humor: 'feliz', tamanho: '6rem' }), h('h1', { tabindex: '-1', class: 'manuscrito' }, t('espiral.fimAluno'))));
    else if (e.pausa) trocar(cabeca, h('p', { class: 'aluno__aguarde' }, e.modo === 'estacao' ? t('espiral.estacaoVazia') : t('espiral.descansaAluno')), e.proxima ? h('p', { class: 'etiqueta' }, t('espiral.proximaAluno', { prova: e.proxima })) : null);
    else if (e.travado || e.status === 'troca') {
      trocar(
        cabeca,
        h(
          'div',
          { class: 'aluno__enviado pilha' },
          h('p', { class: 'manuscrito aluno__grande' }, t('espiral.tempoEsgotado')),
          h('p', null, t('espiral.respostasSalvas')),
          e.proxima !== undefined ? h('p', { class: 'etiqueta' }, e.proxima ? t('espiral.proximaAluno', { prova: e.proxima }) : t('espiral.proximaDescanso')) : null
        )
      );
    } else {
      const pausado = e.status === 'pausado';
      trocar(
        cabeca,
        pausado ? h('p', { class: 'aluno__aviso', role: 'alert' }, t('espiral.pausaGeral')) : aviso,
        e.modo === 'estacao' ? h('p', { class: 'etiqueta' }, t('espiral.grupoAqui', { nome: e.grupo })) : null,
        h('h1', { class: 'manuscrito aluno__prova', tabindex: '-1' }, e.prova.titulo),
        h(
          'ol',
          { class: 'aluno__questoes', 'data-pausado': String(pausado) },
          e.prova.perguntas.map((p) => {
            const marca = h('span', { class: 'aluno__salva', 'aria-live': 'polite' });
            salvas.set(p.id, marca);
            return h(
              'li',
              { class: 'cartao pilha' },
              h('p', { class: 'aluno__enunciado' }, p.enunciado),
              respostaEditavel(p, e.respostas[p.id], (resposta) => {
                cliente.agir('espiral', { prova: e.prova.id, qid: p.id, resposta });
                marca.textContent = t('provaInd.salvando');
              }),
              marca
            );
          })
        )
      );
    }
    atualizar(e, fim);
  }

  // ---------- Prova individual ----------
  let telaProva = null;
  function provaIndividual(e) {
    if (e.aguardando) return trocar(h('p', { class: 'aluno__aguarde' }, t('entrar.aguarde')));
    const chave = `${e.status}|${e.perguntas?.length ?? 0}`;
    if (telaProva?.chave === chave) return telaProva.atualizar(e);
    const relogioEl = h('span', { class: 'aluno__tempo', role: 'timer' });
    let atual = telaProva?.indice ?? 0;
    let respostas = { ...(e.respostas ?? {}) };
    let fimLocal = performance.now() + e.restaMs;
    let inicioLocal = performance.now() + e.inicioEmMs;
    let navegar = () => {};
    const tique = () => (relogioEl.textContent = mmss(e.status === 'aguardando' ? Math.max(0, inicioLocal - performance.now()) : Math.max(0, fimLocal - performance.now())));
    clearInterval(relogio);
    relogio = setInterval(tique, 500);
    tique();
    telaProva = {
      chave,
      atualizar(est) {
        fimLocal = performance.now() + est.restaMs;
        inicioLocal = performance.now() + est.inicioEmMs;
        respostas = { ...(est.respostas ?? {}), ...respostas };
        tique();
      },
      get indice() {
        return atual;
      },
    };
    const cabeca = h('div', { class: 'aluno__barra' }, h('span', { class: 'etiqueta' }, e.titulo), relogioEl);
    if (e.status === 'aguardando') return trocar(cabeca, h('p', { class: 'aluno__aguarde' }, t('provaInd.aguardeInicio')));
    if (e.status === 'entregue') return trocar(h('div', { class: 'aluno__lobby pilha' }, Mascote({ humor: 'feliz', tamanho: '6rem' }), h('h1', { tabindex: '-1', class: 'manuscrito' }, t('provaInd.entregue'))));
    if (e.status === 'encerrada') return trocar(h('div', { class: 'aluno__lobby pilha' }, Mascote({ humor: 'neutro', tamanho: '6rem' }), h('h1', { tabindex: '-1', class: 'manuscrito' }, t('provaInd.encerradaAluno')), h('p', null, t('espiral.respostasSalvas'))));
    const mapa = h('ol', { class: 'aluno__mapa', 'aria-label': t('provaInd.mapa') });
    const area = h('div', { class: 'pilha' });
    navegar = () => {
      const p = e.perguntas[atual];
      mapa.replaceChildren(
        ...e.perguntas.map((q, i) => {
          const respondida = temResposta(respostas[q.id]);
          const b = h('button', { type: 'button', class: 'aluno__mapa-item', 'aria-current': i === atual ? 'step' : null, 'data-respondida': String(respondida), 'aria-label': t('provaInd.irPara', { n: i + 1, estado: respondida ? t('provaInd.respondida') : t('provaInd.semResposta') }) }, String(i + 1));
          b.addEventListener('click', () => {
            atual = i;
            navegar();
          });
          return h('li', null, b);
        })
      );
      const entregar = async () => {
        const faltam = e.perguntas.filter((q) => !temResposta(respostas[q.id])).length;
        const ok = await abrirModal({
          titulo: t('provaInd.entregarTitulo'),
          conteudo: faltam ? t('provaInd.entregarFaltam', { n: faltam }) : t('provaInd.entregarTexto'),
          acoes: [
            { texto: t('vitrine.secundario'), valor: false },
            { texto: t('provaInd.entregar'), variante: 'primario', valor: true },
          ],
        });
        if (ok) cliente.agir('prova-entregar', {});
      };
      area.replaceChildren(
        h('p', { class: 'etiqueta' }, t('testar.progresso', { i: atual + 1, n: e.perguntas.length })),
        h('p', { class: 'aluno__enunciado' }, p.enunciado),
        ...[
          respostaEditavel(p, respostas[p.id], (resposta) => {
            respostas[p.id] = resposta;
            cliente.agir('prova-responder', { qid: p.id, resposta });
            mapa.querySelectorAll('.aluno__mapa-item')[atual].dataset.respondida = String(temResposta(resposta));
          }),
        ].filter(Boolean),
        h(
          'div',
          { class: 'linha aluno__navegar' },
          Botao({ texto: t('provaInd.anterior'), desativado: atual === 0, aoClicar: () => ((atual -= 1), navegar()) }),
          atual + 1 < e.perguntas.length ? Botao({ texto: t('provaInd.proxima'), variante: 'primario', aoClicar: () => ((atual += 1), navegar()) }) : Botao({ texto: t('provaInd.entregar'), variante: 'primario', aoClicar: entregar })
        )
      );
    };
    trocar(cabeca, mapa, area);
    navegar();
  }

  function botoesResposta(p, aoEscolher) {
    if (p.tipo === 'multipla' || p.tipo === 'enquete') {
      const marcadas = new Set();
      const grade = h(
        'div',
        { class: 'aluno__opcoes' },
        p.opcoes.map((o, i) => {
          const b = h('button', { type: 'button', class: 'aluno__opcao', style: { '--cor': MARCAS[i % 8].cor }, 'aria-pressed': p.varias ? 'false' : null }, h('span', { class: 'visor__forma', 'aria-hidden': 'true' }, MARCAS[i % 8].forma), h('span', null, o.texto));
          b.addEventListener('click', () => {
            if (!p.varias) return aoEscolher(p.tipo === 'enquete' ? o.id : [o.id]);
            if (marcadas.has(o.id)) marcadas.delete(o.id);
            else marcadas.add(o.id);
            b.setAttribute('aria-pressed', String(marcadas.has(o.id)));
          });
          return b;
        })
      );
      return p.varias ? h('div', { class: 'pilha' }, h('p', { class: 'texto-suave' }, t('questao.variasCorretas')), grade, Botao({ texto: t('questao.confirmar'), variante: 'primario', bloco: true, aoClicar: () => marcadas.size && aoEscolher([...marcadas]) })) : grade;
    }
    if (p.tipo === 'vf') {
      return h(
        'div',
        { class: 'aluno__opcoes aluno__opcoes--vf' },
        [true, false].map((v, i) => {
          const b = h('button', { type: 'button', class: 'aluno__opcao', style: { '--cor': MARCAS[i === 0 ? 3 : 0].cor } }, h('span', { class: 'visor__forma', 'aria-hidden': 'true' }, v ? '✓' : '✕'), h('span', null, v ? t('questao.verdadeiro') : t('questao.falso')));
          b.addEventListener('click', () => aoEscolher(v));
          return b;
        })
      );
    }
    if (p.tipo === 'curta' || p.tipo === 'numerica') {
      const campo = h('input', { id: 'aluno-resposta', class: 'campo aluno__campo', autocomplete: 'off', inputmode: p.tipo === 'numerica' ? 'decimal' : 'text', maxlength: 120 });
      const enviar = () => campo.value.trim() && (p.tipo !== 'numerica' || Number.isFinite(lerNumero(campo.value.replace(p.unidade || '\u0000', '')))) && aoEscolher(campo.value);
      campo.addEventListener('keydown', (ev) => ev.key === 'Enter' && enviar());
      return h('div', { class: 'pilha' }, h('label', { for: 'aluno-resposta', class: 'rotulo' }, t('questao.suaResposta'), p.unidade ? ` (${p.unidade})` : ''), campo, Botao({ texto: t('questao.responder'), variante: 'primario', bloco: true, aoClicar: enviar }));
    }
    return Botao({ texto: t('questao.continuar'), variante: 'primario', bloco: true, aoClicar: () => aoEscolher(null) });
  }

  function textoGabarito(p, g) {
    if (g === null || g === undefined) return '';
    if (p.tipo === 'multipla') return p.opcoes.filter((o) => g.includes(o.id)).map((o) => o.texto).join(' + ');
    if (p.tipo === 'vf') return g ? t('questao.verdadeiro') : t('questao.falso');
    if (p.tipo === 'curta') return g.join(' / ');
    if (p.tipo === 'numerica') return `${String(g.valor).replace('.', ',')} ${g.unidade}`;
    return '';
  }

  function quiz(e) {
    const topo = h('div', { class: 'aluno__barra' }, h('span', { class: 'etiqueta' }, t('testar.progresso', { i: e.indice + 1, n: e.total })), h('span', { class: 'etiqueta' }, t('jogar.pontos', { n: e.meusPontos })));
    if (e.fase === 'abertura') return trocar(h('p', { class: 'aluno__aguarde' }, t('entrar.preparados')));
    if (e.fase === 'pergunta') {
      const p = e.pergunta;
      if (e.respondeu || p.tipo === 'slide') return trocar(topo, h('div', { class: 'aluno__enviado pilha' }, h('p', { class: 'aluno__enunciado' }, p.enunciado), h('p', { class: 'manuscrito aluno__grande' }, p.tipo === 'slide' ? t('entrar.olheTela') : t('entrar.enviada'))));
      const tempo = h('span', { class: 'aluno__tempo', role: 'timer' });
      const fim = e.restaMs === null ? null : performance.now() + e.restaMs;
      const tique = () => {
        if (fim === null) return;
        const resta = Math.max(0, fim - performance.now());
        tempo.textContent = `${Math.ceil(resta / 1000)}s`;
      };
      tique();
      relogio = setInterval(tique, 250);
      trocar(
        h('div', { class: 'aluno__barra' }, topo.firstChild, fim === null ? null : tempo),
        p.multiplicador === 2 ? h('p', { class: 'etiqueta etiqueta--dobro' }, t('jogar.dobro')) : null,
        h('p', { class: 'aluno__enunciado' }, p.enunciado),
        botoesResposta(p, (resposta) => {
          cliente.agir('responder', { resposta });
          sons.registro();
          ultimoEstado = { ...e, respondeu: true };
          desenhar(ultimoEstado);
        })
      );
      return;
    }
    if (e.fase === 'revelacao' || e.fase === 'ranking') {
      const m = e.minha;
      const veredito = !m ? t('jogar.naoRespondeu') : m.correta === null ? t('testar.registrado') : m.correta ? t('testar.certo') : t('testar.errado');
      if (m?.correta === true) sons.vitoria();
      trocar(
        topo,
        h(
          'div',
          { class: 'aluno__veredito pilha', 'data-certo': String(m?.correta ?? 'nada') },
          h('p', { class: 'manuscrito aluno__grande' }, veredito),
          m?.correta ? h('p', { class: 'aluno__pts' }, `+${m.pontos}`) : m?.pontos < 0 ? h('p', { class: 'aluno__pts' }, String(m.pontos)) : null,
          e.gabarito !== undefined && e.gabarito !== null ? h('p', null, t('testar.gabarito'), ' ', h('strong', null, textoGabarito(e.pergunta, e.gabarito))) : null,
          e.explicacao ? h('p', { class: 'visor__explicacao' }, e.explicacao) : null,
          e.posicao ? h('p', { class: 'etiqueta' }, t('entrar.posicao', { n: e.posicao, total: e.participantes })) : null
        )
      );
      return;
    }
    if (e.fase === 'fim') {
      trocar(
        h(
          'div',
          { class: 'aluno__lobby pilha' },
          Mascote({ humor: e.posicao === 1 ? 'feliz' : 'neutro', tamanho: '6rem' }),
          h('h1', { tabindex: '-1', class: 'manuscrito' }, e.posicao === 1 ? t('entrar.campeao') : t('entrar.fim')),
          h('p', { class: 'aluno__grande' }, t('entrar.posicao', { n: e.posicao, total: e.participantes })),
          h('p', null, t('jogar.pontos', { n: e.meusPontos })),
          e.ranking ? h('ol', { class: 'ranking ranking--compacto' }, e.ranking.map((x) => h('li', { class: 'ranking__item' }, h('span', { class: 'ranking__pos' }, `${x.posicao}º`), h('span', { class: 'ranking__nome' }, x.nome), h('span', { class: 'ranking__pts' }, String(x.pontos))))) : null
        )
      );
    }
  }

  function ritmo(e) {
    if (e.aguardando) return trocar(h('p', { class: 'aluno__aguarde' }, t('entrar.aguarde')));
    const barra = h('div', { class: 'aluno__barra' }, h('span', { class: 'etiqueta' }, t('testar.progresso', { i: Math.min(e.indice + 1, e.total), n: e.total })), h('span', { class: 'etiqueta' }, t('jogar.pontos', { n: e.meusPontos })));
    const retorno = e.ultimo
      ? h('p', { class: 'aluno__retorno', 'data-certo': String(e.ultimo.correta) }, e.ultimo.correta === null ? t('testar.registrado') : e.ultimo.correta ? `${t('testar.certo')} +${e.ultimo.pontos}` : t('testar.errado'))
      : null;
    if (e.terminou) {
      return trocar(barra, retorno, h('div', { class: 'aluno__lobby pilha' }, Mascote({ humor: 'feliz', tamanho: '6rem' }), h('h1', { tabindex: '-1', class: 'manuscrito' }, t('entrar.terminou')), h('p', { class: 'aluno__grande' }, t('jogar.pontos', { n: e.meusPontos }))));
    }
    const p = e.pergunta;
    trocar(
      barra,
      retorno,
      h('p', { class: 'aluno__enunciado' }, p.enunciado),
      p.tipo === 'slide' && p.texto ? h('p', null, p.texto) : null,
      botoesResposta(p, (resposta) => {
        cliente.agir('ritmo', { qid: p.id, resposta });
        trocar(barra, h('p', { class: 'aluno__aguarde' }, t('entrar.corrigindo')));
      })
    );
  }

  // Buzzer: o sinal aparece no horário do host convertido para este celular.
  function buzzer(e) {
    if (e.espectador) return trocar(h('p', { class: 'aluno__aguarde' }, t('entrar.espectador')));
    const botao = h('button', { type: 'button', class: 'aluno__buzzer', 'aria-label': t('entrar.apertar') }, h('span', { class: 'aluno__buzzer-texto' }, ''));
    const texto = botao.firstChild;
    let jaApertou = Boolean(e.agiu);
    botao.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      if (jaApertou || !['armado', 'valendo'].includes(e.fase)) return;
      jaApertou = true;
      desbloquear();
      cliente.agir('buzzer', {}, ev.timeStamp);
      botao.dataset.estado = 'agiu';
      texto.textContent = t('buzzer.registrado');
      if (navigator.vibrate) navigator.vibrate(40);
    });
    clearTimeout(largadaTimer);
    if (e.fase === 'armado' || e.fase === 'valendo') {
      const largadaLocal = e.largadaEmHost === null || e.largadaEmHost === undefined ? null : e.largadaEmHost - cliente.offset;
      const mostrarSinal = () => {
        if (jaApertou) return;
        botao.dataset.estado = 'valendo';
        texto.textContent = t('buzzer.aperte');
        sons.valendo();
      };
      if (e.agiu) {
        botao.dataset.estado = 'agiu';
        texto.textContent = t('buzzer.registrado');
      } else if (e.fase === 'valendo' || (largadaLocal !== null && performance.now() >= largadaLocal)) mostrarSinal(); // o host já disse "valendo": mostra na hora
      else {
        botao.dataset.estado = 'espera';
        texto.textContent = t('buzzer.espere');
        if (largadaLocal !== null) {
          const passo = () => {
            const falta = largadaLocal - performance.now();
            if (falta <= 0) return mostrarSinal();
            if (e.contagem) texto.textContent = String(Math.ceil(falta / 1000));
            largadaTimer = setTimeout(passo, Math.min(falta, e.contagem ? 100 : falta));
          };
          passo();
        }
      }
    } else if (e.fase === 'resultado' && e.resultado) {
      const r = e.resultado;
      botao.disabled = true;
      botao.dataset.estado = r.venceu ? 'venceu' : r.queimou ? 'queimou' : 'perdeu';
      texto.textContent = r.queimou && !r.venceu ? t('buzzer.queimou') : r.venceu ? (r.tipo === 'empate' ? t('buzzer.empatou') : t('buzzer.primeiro')) : r.posicao ? `${r.posicao}º` : '—';
      if (r.venceu) sons.vitoria();
    } else {
      botao.disabled = true;
      botao.dataset.estado = e.queimou ? 'queimou' : 'ocioso';
      texto.textContent = e.queimou ? t('buzzer.queimou') : t('entrar.buzzerAguarde');
    }
    trocar(
      h('p', { class: 'aluno__nome manuscrito' }, e.nome),
      botao,
      e.resultado?.tempo ? h('p', { class: 'etiqueta' }, formatarMs(e.resultado.tempo)) : null,
      e.resultado?.vencedores?.length && !e.resultado.venceu ? h('p', null, t('buzzer.venceu', { nome: e.resultado.vencedores.join(' e ') })) : null
    );
  }

  alvo.append(
    h('div', { class: 'aluno__cabeca' }, h('a', { class: 'botao botao--icone', href: '#/', 'aria-label': t('entrar.sair'), title: t('entrar.sair') }, svg(icones.fechar)), statusBarra),
    tela
  );
  formulario();

  return () => {
    clearInterval(relogio);
    clearTimeout(largadaTimer);
    cliente?.sair();
    document.body.classList.remove('modo-aluno');
  };
}
