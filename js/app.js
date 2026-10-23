// Boot + router por hash (#/rota). Sem framework, sem build.
import { t, definirIdioma } from './i18n/i18n.js';
import { h, svg } from './ui/dom.js';
import { icones } from './ui/components/icones.js';
import { ativarAfundar } from './ui/components/botao.js';
import { toast } from './ui/components/toast.js';
import * as inicio from './ui/screens/inicio.js';

// A tela inicial vem junto; as outras carregam quando abertas (todas ficam no cache offline).
const ROTAS = {
  '/': () => inicio,
  '/sobre': () => import('./ui/screens/sobre.js'),
  '/vitrine': () => import('./ui/screens/vitrine.js'),
  '/buzzer': () => import('./ui/screens/buzzer.js'),
  '/buzzer/jogar': () => import('./ui/screens/buzzer-jogo.js'),
  '/placar': () => import('./ui/screens/placar.js'),
  '/sorteio': () => import('./ui/screens/sorteio.js'),
  '/cronometro': () => import('./ui/screens/cronometro.js'),
  '/equipes': () => import('./ui/screens/equipes.js'),
  '/turmas': () => import('./ui/screens/turmas.js'),
  '/ferramentas': () => import('./ui/screens/ferramentas.js'),
  '/atividades': () => import('./ui/screens/atividades.js'),
  '/atividades/editar': () => import('./ui/screens/editor.js'),
  '/atividades/testar': () => import('./ui/screens/testar.js'),
  '/jogar': () => import('./ui/screens/jogar.js'),
  '/quiz': () => import('./ui/screens/jogos.js'),
  '/passa': () => import('./ui/screens/jogos.js'),
  '/sala': () => import('./ui/screens/sala.js'),
  '/entrar': () => import('./ui/screens/entrar.js'),
  '/relatorios': () => import('./ui/screens/relatorios.js'),
  '/cartoes': () => import('./ui/screens/cartoes.js'),
  '/roleta': () => import('./ui/screens/roleta.js'),
  '/sessao': () => import('./ui/screens/sessao.js'),
  '/importar': () => import('./ui/screens/importar.js'),
};
const naoEncontrado = () => import('./ui/screens/nao-encontrado.js');

const conteudo = document.getElementById('conteudo');
let primeiraRota = true;
let limparTela = null; // telas podem devolver uma função de limpeza (timers, ouvintes...)

// ---------- Router ----------
function rotaAtual() {
  const hash = location.hash;
  if (!hash || hash === '#' || hash === '#/') return '/';
  return hash.slice(1).split('?')[0].replace(/\/+$/, '') || '/';
}

let navegacao = 0;

async function navegar() {
  // Âncoras comuns (ex.: #conteudo) não são rotas: ignora.
  if (location.hash && !location.hash.startsWith('#/')) return;

  const caminho = rotaAtual();
  const minha = ++navegacao;
  const tela = await (ROTAS[caminho] || naoEncontrado)();
  if (minha !== navegacao) return; // o usuário já foi para outra tela
  const params = new URLSearchParams(location.hash.split('?')[1] || '');

  if (limparTela) limparTela();
  // Modal aberto não sobrevive à troca de tela.
  document.querySelectorAll('dialog.modal[open]').forEach((d) => d.close());
  conteudo.replaceChildren();
  limparTela = tela.render(conteudo, params) || null;

  const nome = tela.titulo();
  document.title = tela === inicio ? `${t('app.nome')} — ${t('inicio.titulo', { destaque: t('inicio.tituloDestaque') })}` : `${nome} · ${t('app.nome')}`;

  document.querySelectorAll('[data-rota]').forEach((link) => {
    const rota = link.dataset.rota;
    if (rota === caminho || (rota !== '/' && caminho.startsWith(`${rota}/`))) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });

  // Ao trocar de tela, leva o foco ao título (leitores de tela anunciam a nova página).
  if (!primeiraRota) {
    window.scrollTo(0, 0);
    const titulo = conteudo.querySelector('h1');
    if (titulo) titulo.focus({ preventScroll: true });
  }
  primeiraRota = false;
  desenharBarraSessao();
}

// ---------- Sessão (sequência de etapas): barra fixa em qualquer tela ----------
const barraSessao = h('nav', { class: 'barra-sessao', 'aria-label': t('sessao.barra'), hidden: true });
document.body.append(barraSessao);

async function desenharBarraSessao() {
  const { lerSessao } = await import('./ui/screens/sessao.js');
  const { salvar } = await import('./storage/db.js');
  const s = await lerSessao();
  if (!s.ativa || !s.etapas.length) {
    barraSessao.hidden = true;
    document.body.classList.remove('com-sessao');
    return;
  }
  const ir = async (i) => {
    if (i >= s.etapas.length) {
      s.ativa = false;
      await salvar('sessoes', s);
      toast(t('sessao.terminou'), { tipo: 'sucesso' });
      location.hash = '#/sessao';
      return;
    }
    s.atual = Math.max(0, i);
    await salvar('sessoes', s);
    location.hash = s.etapas[s.atual].rota;
  };
  const botao = (texto, fn, extra = {}) => ativarAfundar(h('button', { type: 'button', class: `botao ${extra.classe ?? ''}`, disabled: extra.desativado, onClick: fn }, texto));
  barraSessao.replaceChildren(
    h('span', { class: 'barra-sessao__info' }, t('sessao.etapaDe', { n: s.atual + 1, total: s.etapas.length }), ' · ', h('strong', null, s.etapas[s.atual].titulo)),
    botao(t('provaInd.anterior'), () => ir(s.atual - 1), { desativado: s.atual === 0 }),
    botao(s.atual + 1 < s.etapas.length ? t('sessao.proxima') : t('sessao.encerrar'), () => ir(s.atual + 1), { classe: 'botao--primario' }),
    botao(t('sessao.sair'), async () => {
      s.ativa = false;
      await salvar('sessoes', s);
      desenharBarraSessao();
    }, { classe: 'botao--fantasma' })
  );
  barraSessao.hidden = false;
  document.body.classList.add('com-sessao');
}
window.addEventListener('valendo:sessao', desenharBarraSessao);

// ---------- Tema: automático → claro → quadro-negro ----------
const TEMAS = ['auto', 'claro', 'quadro'];
const CHAVE_TEMA = 'valendo.tema';

function lerTema() {
  try {
    const salvo = localStorage.getItem(CHAVE_TEMA);
    return TEMAS.includes(salvo) ? salvo : 'auto';
  } catch {
    return 'auto';
  }
}

function aplicarTema(tema) {
  const raiz = document.documentElement;
  if (tema === 'auto') raiz.removeAttribute('data-theme');
  else raiz.setAttribute('data-theme', tema);
  try {
    localStorage.setItem(CHAVE_TEMA, tema);
  } catch {
    /* preferências são opcionais */
  }
  const botao = document.getElementById('botao-tema');
  if (botao) {
    const rotulo = t('tema.rotulo', { nome: t(`tema.${tema}`) });
    botao.setAttribute('aria-label', rotulo);
    botao.title = rotulo;
  }
  const cor = getComputedStyle(raiz).getPropertyValue('--papel').trim();
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && cor) meta.setAttribute('content', cor);
}

function montarCabecalho() {
  const acoes = document.querySelector('.cabecalho__acoes');
  const botaoTema = h('button', { type: 'button', id: 'botao-tema', class: 'botao botao--icone' }, svg(icones.tema));
  botaoTema.addEventListener('click', () => {
    const proximo = TEMAS[(TEMAS.indexOf(lerTema()) + 1) % TEMAS.length];
    aplicarTema(proximo);
    toast(t('tema.trocado', { nome: t(`tema.${proximo}`) }));
  });
  acoes.append(ativarAfundar(botaoTema));
  acoes.querySelectorAll('.botao').forEach(ativarAfundar);
}

// ---------- Service worker (offline) ----------
function registrarSW() {
  if (!('serviceWorker' in navigator)) return;
  // Na primeira instalação não avisa nada (o app já está aberto); só avisa atualizações.
  if (!navigator.serviceWorker.controller) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
    return;
  }
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then((reg) => {
        reg.addEventListener('updatefound', () => {
          const novo = reg.installing;
          if (!novo) return;
          novo.addEventListener('statechange', () => {
            if (novo.state === 'activated') toast(t('app.atualizado'), { tipo: 'sucesso', duracao: 5000 });
          });
        });
      })
      .catch(() => {
        /* sem SW (ex.: file://) o app continua funcionando online */
      });
  });
}

// ---------- Boot ----------
definirIdioma('pt-BR');
montarCabecalho();
aplicarTema(lerTema());

// iOS só aplica :active (o "afundar") se houver um ouvinte de toque.
document.addEventListener('touchstart', () => {}, { passive: true });

// Link "pular para o conteúdo" sem mexer no hash do router.
document.querySelector('.pular')?.addEventListener('click', (e) => {
  e.preventDefault();
  conteudo.focus();
});

window.addEventListener('hashchange', navegar);
navegar();
registrarSW();
