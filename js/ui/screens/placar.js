// #/placar — placar manual por equipe, com desfazer. Salvo no aparelho a cada ponto.
import { h, svg } from '../dom.js';
import { t } from '../../i18n/i18n.js';
import { criarPlacar, pontuar, desfazer, refazer, zerar, ranking, renomear } from '../../core/scoring.js';
import { ler, salvar } from '../../storage/db.js';
import { CORES_JOGADORES } from '../buzzer-ajustes.js';
import { Botao, ativarAfundar } from '../components/botao.js';
import { Stepper } from '../components/stepper.js';
import { abrirModal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { icones } from '../components/icones.js';
import { ModoProjetor } from '../components/projetor.js';

export const titulo = () => t('placar.titulo');
const SESSAO = 'placar';

export function render(alvo) {
  let placar = null;
  let limpar = () => {};
  ler('sessoes', SESSAO).then((sessao) => {
    placar = sessao?.placar ?? null;
    if (placar) limpar = mostrarPlacar();
    else configurar();
  });

  const guardar = () => salvar('sessoes', { id: SESSAO, placar });

  // ---------- Configuração ----------
  function configurar(anterior) {
    limpar();
    alvo.replaceChildren();
    let quantidade = anterior?.equipes.length ?? 2;
    const nomes = anterior?.equipes.map((e) => e.nome) ?? [];
    const lista = h('ol', { class: 'buzzer-nomes', role: 'list' });
    const desenharNomes = () =>
      lista.replaceChildren(
        ...Array.from({ length: quantidade }, (_, i) => {
          const campo = h('input', { class: 'campo', maxlength: 30, placeholder: t('placar.equipeN', { n: i + 1 }), 'aria-label': t('placar.nomeEquipe', { n: i + 1 }) });
          campo.value = nomes[i] ?? '';
          campo.addEventListener('input', () => (nomes[i] = campo.value));
          return h('li', { class: 'buzzer-nomes__item' }, h('span', { class: 'buzzer-nomes__cor', style: { background: CORES_JOGADORES[i] }, 'aria-hidden': 'true' }, String(i + 1)), campo);
        })
      );
    desenharNomes();

    const comecar = Botao({
      texto: t('placar.comecar'),
      variante: 'primario',
      tamanho: 'grande',
      icone: 'placar',
      aoClicar: () => {
        placar = criarPlacar(
          Array.from({ length: quantidade }, (_, i) => ({
            nome: (nomes[i] ?? '').trim() || t('placar.equipeN', { n: i + 1 }),
            cor: CORES_JOGADORES[i],
          }))
        );
        guardar();
        limpar = mostrarPlacar();
      },
    });

    alvo.append(
      h('div', { class: 'tela__topo' }, h('h1', { tabindex: '-1' }, t('placar.titulo')), h('p', { class: 'tela__subtitulo' }, t('placar.subtitulo'))),
      h(
        'section',
        { class: 'cartao buzzer-bloco' },
        h('h2', null, t('placar.equipes')),
        Stepper({ rotulo: t('placar.quantas'), valor: quantidade, min: 2, max: 8, aoMudar: (v) => ((quantidade = v), desenharNomes()) }),
        lista,
        h('p', { class: 'texto-suave' }, t('placar.dicaEquipes'), ' ', h('a', { href: '#/equipes' }, t('placar.irEquipes')))
      ),
      h('div', { class: 'linha buzzer-rodape' }, comecar)
    );
    alvo.querySelector('h1')?.focus();
  }

  // ---------- Placar ----------
  function mostrarPlacar() {
    alvo.replaceChildren();
    const cartoes = new Map();
    const grade = h('div', { class: 'placar' });
    const anuncio = h('p', { class: 'sr-only', 'aria-live': 'polite' });

    const aplicar = (novo, mensagem) => {
      if (novo === placar) return;
      placar = novo;
      guardar();
      desenhar();
      if (mensagem) anuncio.textContent = mensagem;
    };

    const pontos = (id, delta) => {
      const equipe = placar.equipes.find((e) => e.id === id);
      aplicar(pontuar(placar, id, delta), t('placar.anuncio', { nome: equipe.nome, delta: delta > 0 ? `+${delta}` : delta, total: equipe.pontos + delta }));
      const valor = cartoes.get(id)?.valor;
      if (valor) {
        valor.classList.remove('esta-pulando');
        void valor.offsetWidth; // reinicia a animação
        valor.classList.add('esta-pulando');
      }
    };

    for (const equipe of placar.equipes) {
      const valor = h('output', { class: 'placar__pontos', 'aria-label': t('placar.pontosDe', { nome: equipe.nome }) });
      const nome = h('button', { type: 'button', class: 'placar__nome manuscrito', title: t('placar.renomear') });
      const posicao = h('span', { class: 'etiqueta placar__posicao' });
      nome.addEventListener('click', async () => {
        const campo = h('input', { class: 'campo', maxlength: 30, 'aria-label': t('placar.renomear') });
        campo.value = placar.equipes.find((e) => e.id === equipe.id).nome;
        const ok = await abrirModal({
          titulo: t('placar.renomear'),
          conteudo: campo,
          acoes: [
            { texto: t('vitrine.secundario'), valor: false },
            { texto: t('placar.salvar'), variante: 'primario', valor: true },
          ],
        });
        if (ok && campo.value.trim()) aplicar(renomear(placar, equipe.id, campo.value.trim()));
      });
      const botoes = [-1, 1, 5, 10].map((d) =>
        Botao({
          texto: d > 0 ? `+${d}` : `−${Math.abs(d)}`,
          variante: d < 0 ? undefined : d === 1 ? 'primario' : 'amarelo',
          rotulo: t('placar.somar', { delta: d > 0 ? `+${d}` : d, nome: equipe.nome }),
          aoClicar: () => pontos(equipe.id, d),
        })
      );
      const outro = Botao({
        texto: '±',
        rotulo: t('placar.outroValor', { nome: equipe.nome }),
        aoClicar: async () => {
          let valorEscolhido = 2;
          const ok = await abrirModal({
            titulo: t('placar.outroValorTitulo', { nome: equipe.nome }),
            conteudo: Stepper({ rotulo: t('placar.pontos'), valor: 2, min: -1000, max: 1000, aoMudar: (v) => (valorEscolhido = v) }),
            acoes: [
              { texto: t('vitrine.secundario'), valor: false },
              { texto: t('placar.aplicar'), variante: 'primario', valor: true },
            ],
          });
          if (ok) pontos(equipe.id, valorEscolhido);
        },
      });
      const cartao = h(
        'section',
        { class: 'placar__equipe', style: { '--cor': equipe.cor || 'var(--amarelo)' }, 'aria-label': equipe.nome },
        h('div', { class: 'placar__topo' }, nome, posicao),
        valor,
        h('div', { class: 'placar__botoes' }, botoes, outro)
      );
      cartoes.set(equipe.id, { cartao, valor, nome, posicao });
      grade.append(cartao);
    }

    const btnDesfazer = Botao({ texto: t('placar.desfazer'), icone: 'desfazer', aoClicar: () => aplicar(desfazer(placar), t('placar.desfeito')) });
    const btnRefazer = Botao({ texto: t('placar.refazer'), icone: 'refazer', aoClicar: () => aplicar(refazer(placar), t('placar.refeito')) });
    const btnZerar = Botao({
      texto: t('placar.zerar'),
      aoClicar: async () => {
        const ok = await abrirModal({
          titulo: t('placar.zerarTitulo'),
          conteudo: t('placar.zerarTexto'),
          acoes: [
            { texto: t('vitrine.secundario'), valor: false },
            { texto: t('placar.zerar'), variante: 'perigo', valor: true },
          ],
        });
        if (ok) {
          aplicar(zerar(placar));
          toast(t('placar.zerado'), { tipo: 'aviso' });
        }
      },
    });
    const btnNovo = Botao({ texto: t('placar.novo'), variante: 'fantasma', aoClicar: () => configurar(placar) });
    const projetor = ModoProjetor();

    function desenhar() {
      const pos = new Map(ranking(placar).map((e) => [e.id, e.posicao]));
      const lider = Math.max(...placar.equipes.map((e) => e.pontos));
      for (const equipe of placar.equipes) {
        const c = cartoes.get(equipe.id);
        c.valor.textContent = String(equipe.pontos);
        c.nome.textContent = equipe.nome;
        c.posicao.textContent = `${pos.get(equipe.id)}º`;
        c.cartao.dataset.lider = String(equipe.pontos === lider && lider > 0);
      }
      btnDesfazer.disabled = !placar.historico.length;
      btnRefazer.disabled = !placar.futuro.length;
    }
    desenhar();

    // Atalhos: 1–8 = +1 na equipe; Shift+1–8 = −1; Ctrl+Z / Ctrl+Y.
    function teclado(e) {
      if (document.querySelector('dialog[open]') || e.target.closest?.('input, textarea, select')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        aplicar(e.shiftKey ? refazer(placar) : desfazer(placar));
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        aplicar(refazer(placar));
      } else if (/^Digit[1-8]$/.test(e.code) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const equipe = placar.equipes[Number(e.code.slice(5)) - 1];
        if (equipe) pontos(equipe.id, e.shiftKey ? -1 : 1);
      }
    }
    document.addEventListener('keydown', teclado);

    alvo.append(
      h(
        'div',
        { class: 'tela__topo buzzer-topo' },
        h('div', null, h('h1', { tabindex: '-1' }, t('placar.titulo')), h('p', { class: 'tela__subtitulo texto-suave' }, t('placar.dicaAtalhos'))),
        h('div', { class: 'linha' }, btnDesfazer, btnRefazer, btnZerar, projetor.botao, btnNovo)
      ),
      grade,
      anuncio
    );
    alvo.querySelector('h1')?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener('keydown', teclado);
      projetor.sair();
    };
  }

  return () => limpar();
}
