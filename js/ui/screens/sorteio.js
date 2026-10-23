// #/sorteio — sorteia alunos ou equipes sem repetir, com chamada rápida de presença.
import { h } from '../dom.js';
import { t } from '../../i18n/i18n.js';
import { criarSorteio, sortear, desfazerSorteio, reiniciar, marcarAusente, disponiveis, historico } from '../../core/sorteador.js';
import { ler, salvar } from '../../storage/db.js';
import { sons, desbloquear } from '../../audio/sons.js';
import { FonteDeNomes } from '../components/fonte-nomes.js';
import { Botao } from '../components/botao.js';
import { toast } from '../components/toast.js';
import { ModoProjetor } from '../components/projetor.js';

export const titulo = () => t('sorteio.titulo');
const SESSAO = 'sorteio';
const reduzido = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function render(alvo) {
  let sorteio = criarSorteio([]);
  let fonte = { turmaId: '', texto: '' };
  let rolando = null;
  const projetor = ModoProjetor();

  const guardar = () => salvar('sessoes', { id: SESSAO, sorteio, fonte });

  // ---------- Elementos ----------
  const visor = h('div', { class: 'sorteio__visor', 'aria-live': 'polite', 'aria-atomic': 'true' });
  const restam = h('p', { class: 'etiqueta sorteio__restam' });
  const btnSortear = Botao({ texto: t('sorteio.sortear'), variante: 'primario', tamanho: 'grande', icone: 'sorteio', aoClicar: () => fazerSorteio() });
  const btnDesfazer = Botao({ texto: t('sorteio.desfazer'), icone: 'desfazer', aoClicar: () => mudar(desfazerSorteio(sorteio)) });
  const btnReiniciar = Botao({
    texto: t('sorteio.reiniciar'),
    aoClicar: () => {
      mudar(reiniciar(sorteio));
      toast(t('sorteio.reiniciado'));
    },
  });
  const listaHistorico = h('ol', { class: 'sorteio__historico' });
  const chamada = h('ul', { class: 'chamada', role: 'list' });

  function mudar(novo, { manterVisor = false } = {}) {
    sorteio = novo;
    guardar();
    desenhar(manterVisor);
  }

  function desenhar(manterVisor) {
    const livres = disponiveis(sorteio);
    const ja = historico(sorteio);
    restam.textContent = t('sorteio.restam', { n: livres.length, total: sorteio.itens.length - sorteio.ausentes.length });
    btnSortear.disabled = !livres.length || rolando !== null;
    btnDesfazer.disabled = !ja.length || rolando !== null;
    btnReiniciar.disabled = !ja.length || rolando !== null;
    if (!manterVisor) {
      const ultimo = ja.at(-1);
      visor.textContent = ultimo ? ultimo.nome : sorteio.itens.length ? t('sorteio.pronto') : t('sorteio.semNomes');
      visor.dataset.estado = ultimo ? 'sorteado' : 'vazio';
    }
    listaHistorico.replaceChildren(...ja.map((it) => h('li', null, it.nome)));

    chamada.replaceChildren(
      ...sorteio.itens.map((it) => {
        const ausente = sorteio.ausentes.includes(it.id);
        const sorteado = sorteio.sorteados.includes(it.id);
        const botao = h(
          'button',
          { type: 'button', class: 'chamada__aluno', 'aria-pressed': String(!ausente), title: ausente ? t('sorteio.marcarPresente') : t('sorteio.marcarAusente') },
          h('span', { class: 'chamada__marca', 'aria-hidden': 'true' }, ausente ? '✕' : '✓'),
          h('span', null, it.nome),
          sorteado ? h('span', { class: 'sr-only' }, ` (${t('sorteio.jaSorteado')})`) : null
        );
        botao.dataset.sorteado = String(sorteado);
        botao.addEventListener('click', () => mudar(marcarAusente(sorteio, it.id, !ausente), { manterVisor: true }));
        return h('li', null, botao);
      })
    );
  }

  function fazerSorteio() {
    if (rolando !== null) return;
    desbloquear();
    const { sorteio: novo, item } = sortear(sorteio);
    if (!item) return;
    const livres = disponiveis(sorteio);
    if (reduzido() || livres.length < 2) {
      mudar(novo);
      sons.vitoria();
      return;
    }
    // Animação de "roleta": troca nomes cada vez mais devagar e para no sorteado.
    visor.dataset.estado = 'rolando';
    let passo = 0;
    const passos = 14;
    const girar = () => {
      passo += 1;
      if (passo >= passos) {
        rolando = null;
        mudar(novo);
        sons.vitoria();
        return;
      }
      visor.textContent = livres[Math.floor(Math.random() * livres.length)].nome;
      sons.registro();
      rolando = setTimeout(girar, 40 + passo * passo * 2.2);
    };
    rolando = 0;
    desenhar(true);
    girar();
  }

  function teclado(e) {
    if (document.querySelector('dialog[open]') || e.target.closest?.('input, textarea, select, button, a')) return;
    if (e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat) fazerSorteio();
    } else if (e.key === 'f' || e.key === 'F') projetor.alternar();
  }
  document.addEventListener('keydown', teclado);

  // Recupera a sessão salva (mesmos nomes, sorteados e ausentes) e monta a tela.
  ler('sessoes', SESSAO).then((sessao) => {
    if (sessao?.sorteio) {
      sorteio = sessao.sorteio;
      fonte = sessao.fonte ?? fonte;
    }
    const fonteNomes = FonteDeNomes({
      turmaId: fonte.turmaId,
      texto: fonte.texto,
      aoMudar: (alunos, origem) => {
        const mesmaLista = sorteio.itens.map((i) => i.nome).join('\n') === alunos.map((a) => a.nome).join('\n');
        fonte = origem;
        if (mesmaLista) return guardar();
        mudar(criarSorteio(alunos.map((a, i) => ({ id: a.id ?? `s${i + 1}`, nome: a.nome }))));
      },
    });

    alvo.append(
      h('div', { class: 'tela__topo buzzer-topo' }, h('div', null, h('h1', { tabindex: '-1' }, t('sorteio.titulo')), h('p', { class: 'tela__subtitulo' }, t('sorteio.subtitulo'))), projetor.botao),
      h(
        'div',
        { class: 'sorteio' },
        h(
          'section',
          { class: 'sorteio__palco cartao pautado', 'aria-label': t('sorteio.palco') },
          restam,
          visor,
          h('div', { class: 'linha sorteio__acoes' }, btnSortear, btnDesfazer, btnReiniciar),
          h('p', { class: 'texto-suave sorteio__dica' }, t('sorteio.dica'))
        ),
        h(
          'div',
          { class: 'sorteio__lado' },
          h('section', { class: 'cartao pilha', 'aria-labelledby': 'sorteio-nomes' }, h('h2', { id: 'sorteio-nomes' }, t('sorteio.nomes')), fonteNomes),
          h('section', { class: 'cartao pilha', 'aria-labelledby': 'sorteio-chamada' }, h('h2', { id: 'sorteio-chamada' }, t('sorteio.chamada')), h('p', { class: 'texto-suave' }, t('sorteio.chamadaDica')), chamada),
          h('section', { class: 'cartao pilha', 'aria-labelledby': 'sorteio-hist' }, h('h2', { id: 'sorteio-hist' }, t('sorteio.historico')), listaHistorico)
        )
      )
    );
    desenhar();
  });

  return () => {
    clearTimeout(rolando);
    document.removeEventListener('keydown', teclado);
    projetor.sair();
  };
}
