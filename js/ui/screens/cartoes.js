// #/cartoes — cartões de resposta impressos (estilo Plickers): imprimir e ler pela câmera.
// Sem celular para os alunos: cada um tem um cartão de papel e mostra a letra virada para cima.
import { h } from '../dom.js';
import { t } from '../../i18n/i18n.js';
import { conteudoCartao, LETRAS, respostaDaLetra } from '../../core/cartoes.js';
import { corrigir } from '../../core/questions/index.js';
import { listar, salvar } from '../../storage/db.js';
import { novoId } from '../../core/ids.js';
import { listarAtividades } from '../../storage/atividades.js';
import { carregarScript } from '../../net/carregar.js';
import { lerCartoesDaImagem } from '../leitor-cartoes.js';
import { MARCAS } from '../questoes.js';
import { QRCodigo } from '../components/qr.js';
import { Escolha } from '../components/escolha.js';
import { Stepper } from '../components/stepper.js';
import { Botao } from '../components/botao.js';
import { toast } from '../components/toast.js';
import { sons } from '../../audio/sons.js';

export const titulo = () => t('cartoes.titulo');

export function render(alvo) {
  let limpar = () => {};
  const area = h('div', { class: 'pilha' });
  let aba = 'imprimir';
  const trocarAba = (v) => {
    aba = v;
    limpar();
    area.replaceChildren();
    limpar = aba === 'imprimir' ? imprimir(area) : ler(area);
  };
  alvo.append(
    h('div', { class: 'tela__topo' }, h('h1', { tabindex: '-1' }, t('cartoes.titulo')), h('p', { class: 'tela__subtitulo' }, t('cartoes.subtitulo'))),
    Escolha({
      rotulo: t('cartoes.oQue'),
      valor: aba,
      compacta: true,
      aoMudar: trocarAba,
      opcoes: [
        { valor: 'imprimir', texto: t('cartoes.imprimir') },
        { valor: 'ler', texto: t('cartoes.ler') },
      ],
    }),
    area
  );
  trocarAba('imprimir');
  return () => limpar();
}

// ---------- Imprimir ----------
function imprimir(area) {
  let quantidade = 30;
  let nomes = [];
  const seletor = h('select', { id: 'cartoes-turma', class: 'campo' }, h('option', { value: '' }, t('cartoes.semNomes')));
  const folha = h('div', { class: 'cartoes-folha' });
  const desenhar = () =>
    folha.replaceChildren(
      ...Array.from({ length: quantidade }, (_, i) => {
        const n = i + 1;
        return h(
          'div',
          { class: 'cartao-resposta' },
          ...LETRAS.map((l, k) => h('span', { class: `cartao-resposta__letra cartao-resposta__letra--${k}` }, l)),
          h('div', { class: 'cartao-resposta__qr' }, QRCodigo(conteudoCartao(n), { rotulo: t('cartoes.cartaoN', { n }), tamanho: '100%' })),
          h('span', { class: 'cartao-resposta__numero' }, `${n}${nomes[i] ? ` · ${nomes[i]}` : ''}`)
        );
      })
    );
  listar('turmas').then((turmas) => {
    for (const tm of turmas) seletor.append(h('option', { value: tm.id }, tm.nome));
    seletor.addEventListener('change', () => {
      const turma = turmas.find((x) => x.id === seletor.value);
      nomes = turma ? turma.alunos.map((a) => a.nome) : [];
      if (turma) {
        quantidade = Math.max(1, Math.min(60, turma.alunos.length));
        stepper.definir(quantidade, false);
      }
      desenhar();
    });
  });
  const stepper = Stepper({ rotulo: t('cartoes.quantos'), valor: quantidade, min: 1, max: 60, aoMudar: (v) => ((quantidade = v), desenhar()) });
  desenhar();
  area.append(
    h(
      'section',
      { class: 'cartao pilha cartoes-config' },
      h('p', { class: 'texto-suave' }, t('cartoes.comoUsar')),
      h('div', { class: 'linha' }, stepper, h('div', { class: 'pilha pilha--justa' }, h('label', { for: 'cartoes-turma', class: 'rotulo' }, t('cartoes.turma')), seletor)),
      Botao({
        texto: t('cartoes.imprimirBotao'),
        variante: 'primario',
        aoClicar: () => {
          document.body.classList.add('modo-impressao');
          window.print();
          setTimeout(() => document.body.classList.remove('modo-impressao'), 500);
        },
      })
    ),
    folha
  );
  return () => document.body.classList.remove('modo-impressao');
}

// ---------- Ler pela câmera ----------
function ler(area) {
  let fluxo = null;
  let quadro = null;
  let atividade = null;
  let indice = 0;
  let revelado = false;
  let leituras = new Map(); // cartão → letra (a última vale)
  const respostasPorQuestao = {};
  const seletor = h('select', { id: 'cartoes-atividade', class: 'campo' });
  const video = h('video', { class: 'leitor__video', playsinline: true, muted: true, 'aria-hidden': 'true' });
  const contagem = h('p', { class: 'etiqueta cartoes-contagem', 'aria-live': 'polite' });
  const lidos = h('ul', { class: 'cartoes-lidos', role: 'list' });
  const palco = h('div', { class: 'pilha' });
  const status = h('p', { class: 'texto-suave' });

  const perguntas = () => atividade.conteudo.perguntas.filter((q) => (q.tipo === 'multipla' && q.opcoes.length <= 4) || q.tipo === 'vf' || q.tipo === 'enquete');

  function desenharPergunta() {
    const q = perguntas()[indice];
    if (!q) return fim();
    const opcoes = q.tipo === 'vf' ? [{ texto: t('questao.verdadeiro'), correta: q.correta }, { texto: t('questao.falso'), correta: !q.correta }] : q.opcoes;
    const contar = (k) => [...leituras.values()].filter((l) => l === LETRAS[k]).length;
    palco.replaceChildren(
      h('p', { class: 'etiqueta' }, t('testar.progresso', { i: indice + 1, n: perguntas().length })),
      h('h2', { class: 'palco__enunciado' }, q.enunciado),
      h(
        'ol',
        { class: 'palco__opcoes', role: 'list' },
        opcoes.map((o, k) =>
          h('li', { class: 'palco__opcao', style: { '--cor': MARCAS[k].cor }, 'data-correta': String(revelado && Boolean(o.correta)) }, h('span', { class: 'visor__forma', 'aria-hidden': 'true' }, LETRAS[k]), h('span', null, o.texto), revelado ? h('span', { class: 'cartoes-qtd' }, String(contar(k))) : null)
        )
      ),
      h(
        'div',
        { class: 'linha' },
        revelado
          ? Botao({ texto: t('jogar.proxima'), variante: 'primario', tamanho: 'grande', aoClicar: proxima })
          : Botao({ texto: t('cartoes.revelar'), variante: 'primario', tamanho: 'grande', aoClicar: revelar }),
        Botao({ texto: t('cartoes.limpar'), variante: 'fantasma', aoClicar: () => ((leituras = new Map()), atualizarLidos()) })
      )
    );
  }

  function atualizarLidos() {
    contagem.textContent = t('cartoes.lidos', { n: leituras.size });
    lidos.replaceChildren(...[...leituras.keys()].sort((a, b) => a - b).map((n) => h('li', { class: 'cartoes-lidos__item' }, String(n))));
  }

  function revelar() {
    const q = perguntas()[indice];
    revelado = true;
    respostasPorQuestao[q.id] = Object.fromEntries([...leituras].map(([n, letra]) => {
      const r = respostaDaLetra(q, letra);
      return [`c${n}`, { letra, correta: r === null ? false : corrigir(q, r).correta, pontos: 0 }];
    }));
    sons.empate();
    desenharPergunta();
  }

  function proxima() {
    indice += 1;
    revelado = false;
    leituras = new Map();
    atualizarLidos();
    desenharPergunta();
  }

  function fim() {
    const cartoes = new Set(Object.values(respostasPorQuestao).flatMap((r) => Object.keys(r)));
    const participantes = [...cartoes].map((c) => ({ id: c, nome: t('cartoes.cartaoN', { n: c.slice(1) }), pontos: Object.values(respostasPorQuestao).filter((r) => r[c]?.correta).length }));
    salvar('resultados', {
      id: novoId('res'),
      atividadeId: atividade.id,
      titulo: `${atividade.titulo} (${t('cartoes.titulo')})`,
      modalidade: atividade.modalidade,
      data: new Date().toISOString(),
      participantes,
      perguntas: perguntas().map((q) => ({ id: q.id, enunciado: q.enunciado, tipo: q.tipo, respostas: respostasPorQuestao[q.id] ?? {} })),
    });
    pararCamera();
    palco.replaceChildren(h('p', { class: 'manuscrito palco__grande' }, t('testar.fim')), h('p', null, t('cartoes.salvo')), h('a', { class: 'botao botao--primario', href: '#/relatorios' }, t('relatorio.titulo')));
  }

  async function ligarCamera() {
    try {
      const jsQR = await carregarScript('vendor/jsQR.js', 'jsQR');
      fluxo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false });
      video.srcObject = fluxo;
      await video.play();
      status.textContent = t('cartoes.aponte');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const passo = () => {
        if (!fluxo) return;
        if (video.readyState === video.HAVE_ENOUGH_DATA && !revelado) {
          const escala = Math.min(1, 960 / video.videoWidth);
          canvas.width = Math.round(video.videoWidth * escala);
          canvas.height = Math.round(video.videoHeight * escala);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const achados = lerCartoesDaImagem(ctx, canvas.width, canvas.height, jsQR);
          let novos = 0;
          for (const a of achados) {
            if (leituras.get(a.numero) !== a.letra) novos += 1;
            leituras.set(a.numero, a.letra);
          }
          if (novos) {
            sons.registro();
            atualizarLidos();
          }
        }
        quadro = setTimeout(passo, 120);
      };
      passo();
    } catch {
      status.textContent = t('cartoes.semCamera');
    }
  }

  function pararCamera() {
    clearTimeout(quadro);
    fluxo?.getTracks().forEach((f) => f.stop());
    fluxo = null;
  }

  listarAtividades().then((todas) => {
    const boas = todas.filter((a) => !a.erro && a.conteudo.perguntas.some((q) => (q.tipo === 'multipla' && q.opcoes.length <= 4) || q.tipo === 'vf'));
    seletor.replaceChildren(...boas.map((a) => h('option', { value: a.id }, a.titulo)));
    const comecar = Botao({
      texto: t('cartoes.comecarLeitura'),
      variante: 'primario',
      desativado: !boas.length,
      aoClicar: () => {
        atividade = boas.find((a) => a.id === seletor.value);
        if (!atividade) return toast(t('cartoes.escolhaAtividade'), { tipo: 'aviso' });
        inicio.hidden = true;
        leitura.hidden = false;
        atualizarLidos();
        desenharPergunta();
        ligarCamera();
      },
    });
    const inicio = h(
      'section',
      { class: 'cartao pilha' },
      h('p', { class: 'texto-suave' }, boas.length ? t('cartoes.lerDica') : t('cartoes.semAtividades')),
      h('div', { class: 'pilha pilha--justa' }, h('label', { for: 'cartoes-atividade', class: 'rotulo' }, t('sala.atividade')), seletor),
      comecar
    );
    const leitura = h('div', { class: 'cartoes-leitura', hidden: true }, palco, h('aside', { class: 'pilha' }, h('div', { class: 'leitor__moldura' }, video), status, contagem, lidos));
    area.append(inicio, leitura);
  });

  return pararCamera;
}
