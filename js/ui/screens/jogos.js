// #/quiz e #/passa — a pasta de cada modalidade: atividades prontas para jogar,
// criar uma nova ou experimentar um exemplo de 10 perguntas.
import { h } from '../dom.js';
import { t } from '../../i18n/i18n.js';
import { criarAtividade } from '../../core/activity.js';
import { quizExemplo, passaRepassaExemplo } from '../../core/exemplos.js';
import { listarAtividades, salvarAtividade } from '../../storage/atividades.js';
import { Botao } from '../components/botao.js';
import { Mascote } from '../components/mascote.js';

const CONFIG = {
  quiz: { modalidades: ['quiz', 'buzzer', 'personalizada'], nova: 'quiz', exemplo: quizExemplo, chave: 'quiz' },
  passa: { modalidades: ['passa-repassa'], nova: 'passa-repassa', exemplo: passaRepassaExemplo, chave: 'passa' },
};

const qual = () => (location.hash.startsWith('#/passa') ? 'passa' : 'quiz');
export const titulo = () => t(`jogos.${qual()}.titulo`);

export function render(alvo) {
  const c = CONFIG[qual()];
  const lista = h('ul', { class: 'atividades', role: 'list' });

  const nova = Botao({
    texto: t('jogos.criar'),
    variante: 'primario',
    icone: 'mais',
    aoClicar: async () => {
      const a = criarAtividade({ titulo: t(`jogos.${c.chave}.novoTitulo`), modalidade: c.nova });
      await salvarAtividade(a);
      location.hash = `#/atividades/editar?id=${a.id}`;
    },
  });
  const exemplo = Botao({
    texto: t('jogos.exemplo'),
    variante: 'amarelo',
    icone: 'raio',
    aoClicar: async () => {
      const a = c.exemplo();
      await salvarAtividade(a);
      location.hash = `#/jogar?id=${a.id}`;
    },
  });

  alvo.append(
    h('div', { class: 'tela__topo' }, h('h1', { tabindex: '-1' }, t(`jogos.${c.chave}.titulo`)), h('p', { class: 'tela__subtitulo' }, t(`jogos.${c.chave}.subtitulo`))),
    h('div', { class: 'linha' }, nova, exemplo, c.chave === 'quiz' ? h('a', { class: 'botao', href: '#/sala' }, t('jogos.comCelulares')) : null, h('a', { class: 'botao botao--fantasma', href: '#/atividades' }, t('jogos.todas'))),
    h('section', { class: 'secao', 'aria-labelledby': 'jogos-lista' }, h('h2', { id: 'jogos-lista', class: 'secao__titulo' }, t('jogos.suas')), lista)
  );

  listarAtividades().then((todas) => {
    const minhas = todas.filter((a) => !a.erro && c.modalidades.includes(a.modalidade)).sort((x, y) => (y.favorita - x.favorita) || String(y.atualizadoEm).localeCompare(String(x.atualizadoEm)));
    if (!minhas.length) {
      lista.replaceChildren(h('li', { class: 'vazio cartao' }, Mascote({ humor: 'neutro', tamanho: '6rem' }), h('p', null, t('jogos.vazio'))));
      return;
    }
    lista.replaceChildren(
      ...minhas.map((a) =>
        h(
          'li',
          { class: 'cartao atividade', 'data-modalidade': a.modalidade },
          h('h3', { class: 'atividade__titulo' }, a.favorita ? '★ ' : '', a.titulo),
          h('p', { class: 'texto-suave atividade__meta' }, [t('atividades.nPerguntas', { n: a.conteudo.perguntas.length }), a.disciplina].filter(Boolean).join(' · ')),
          h('div', { class: 'linha atividade__acoes' }, h('a', { class: 'botao botao--primario', href: `#/jogar?id=${a.id}` }, t('atividades.jogar')), h('a', { class: 'botao', href: `#/atividades/editar?id=${a.id}` }, t('atividades.editar')))
        )
      )
    );
  });
}
