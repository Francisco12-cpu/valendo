// #/jogar?id=... — prepara os participantes e abre o jogo certo para a modalidade.
// Tudo roda neste aparelho, sem internet (o celular de cada aluno chega na Fase 5).
import { h, svg } from '../dom.js';
import { t } from '../../i18n/i18n.js';
import { lerAtividade } from '../../storage/atividades.js';
import { ler } from '../../storage/db.js';
import { CORES_JOGADORES } from '../buzzer-ajustes.js';
import { Stepper } from '../components/stepper.js';
import { Botao } from '../components/botao.js';
import { icones } from '../components/icones.js';
import { nomeModalidade } from './atividades.js';
import { jogarQuiz } from './jogo-quiz.js';
import { jogarPassaRepassa } from './jogo-passa.js';

export const titulo = () => t('jogar.titulo');

const LIMITES = { 'passa-repassa': [2, 4, 2] }; // [mín, máx, padrão]
const PADRAO = [2, 12, 3];

export function render(alvo, params) {
  let limpar = () => {};
  const id = params.get('id');

  lerAtividade(id).then(async (a) => {
    if (!a || a.erro) {
      alvo.append(h('div', { class: 'vazio cartao' }, h('h1', { tabindex: '-1' }, t('editor.naoAchou')), h('a', { class: 'botao', href: '#/atividades' }, t('editor.voltar'))));
      return;
    }
    if (a.modalidade === 'prova' || a.modalidade === 'espiral') {
      alvo.append(
        h('div', { class: 'vazio cartao' }, h('h1', { tabindex: '-1' }, a.titulo), h('p', null, t('jogar.emBreveProva')), h('a', { class: 'botao', href: `#/atividades/testar?id=${a.id}` }, t('atividades.testar')))
      );
      return;
    }
    const jogaveis = a.conteudo.perguntas.length;
    if (!jogaveis) {
      alvo.append(h('div', { class: 'vazio cartao' }, h('h1', { tabindex: '-1' }, a.titulo), h('p', null, t('editor.semPerguntas')), h('a', { class: 'botao', href: `#/atividades/editar?id=${a.id}` }, t('atividades.editar'))));
      return;
    }

    const ehPassa = a.modalidade === 'passa-repassa';
    const [min, max, padrao] = LIMITES[a.modalidade] ?? PADRAO;
    const geradas = (await ler('sessoes', 'equipes'))?.equipes ?? [];
    let quantidade = padrao;
    const nomes = [];
    const lista = h('ol', { class: 'buzzer-nomes', role: 'list' });
    const rotuloN = (i) => (ehPassa ? t('placar.equipeN', { n: i + 1 }) : t('jogar.participanteN', { n: i + 1 }));
    const desenhar = () =>
      lista.replaceChildren(
        ...Array.from({ length: quantidade }, (_, i) => {
          const campo = h('input', { class: 'campo', maxlength: 30, placeholder: rotuloN(i), 'aria-label': t('jogar.nomeN', { n: i + 1 }) });
          campo.value = nomes[i] ?? '';
          campo.addEventListener('input', () => (nomes[i] = campo.value));
          return h('li', { class: 'buzzer-nomes__item' }, h('span', { class: 'buzzer-nomes__cor', style: { background: CORES_JOGADORES[i % 8] }, 'aria-hidden': 'true' }, String(i + 1)), campo);
        })
      );
    desenhar();
    const stepper = Stepper({ rotulo: ehPassa ? t('placar.quantas') : t('jogar.quantos'), valor: quantidade, min, max, aoMudar: (v) => ((quantidade = v), desenhar()) });

    const usarGeradas =
      geradas.length >= min
        ? Botao({
            texto: t('jogar.usarEquipes', { n: Math.min(geradas.length, max) }),
            aoClicar: () => {
              quantidade = Math.min(geradas.length, max);
              geradas.slice(0, quantidade).forEach((eq, i) => (nomes[i] = `${t('equipes.equipeN', { n: i + 1 })}: ${eq.map((x) => x.nome.split(' ')[0]).join(', ')}`.slice(0, 30)));
              stepper.definir(quantidade, false);
              desenhar();
            },
          })
        : null;

    const comecar = () => {
      const participantes = Array.from({ length: quantidade }, (_, i) => ({ id: `p${i + 1}`, nome: (nomes[i] ?? '').trim() || rotuloN(i), cor: CORES_JOGADORES[i % 8] }));
      alvo.replaceChildren();
      limpar = ehPassa ? jogarPassaRepassa(alvo, a, participantes) : jogarQuiz(alvo, a, participantes);
    };

    alvo.append(
      h('p', null, h('a', { href: '#/atividades', class: 'voltar' }, svg(icones.voltar), t('editor.voltar'))),
      h('div', { class: 'tela__topo' }, h('span', { class: 'etiqueta' }, nomeModalidade(a.modalidade)), h('h1', { tabindex: '-1' }, a.titulo), h('p', { class: 'tela__subtitulo' }, t('jogar.preparar', { n: jogaveis }))),
      h(
        'section',
        { class: 'cartao buzzer-bloco', 'aria-labelledby': 'jg-quem' },
        h('h2', { id: 'jg-quem' }, ehPassa ? t('placar.equipes') : t('jogar.quem')),
        h('p', { class: 'texto-suave' }, ehPassa ? t('jogar.dicaPassa') : t('jogar.dicaQuiz')),
        stepper,
        usarGeradas,
        lista
      ),
      h('div', { class: 'linha buzzer-rodape' }, Botao({ texto: t('jogar.comecar'), variante: 'primario', tamanho: 'grande', icone: 'raio', aoClicar: comecar }))
    );
  });

  return () => limpar();
}
