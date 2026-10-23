// #/importar?d=... — abre uma atividade compartilhada por link ou QR (vai dentro do link,
// compactada; não passa por servidor) e salva no aparelho.
import { h } from '../dom.js';
import { t } from '../../i18n/i18n.js';
import { decodificarAtividade } from '../../core/compartilhar.js';
import { salvarAtividade } from '../../storage/atividades.js';
import { nomeModalidade } from './atividades.js';
import { NOMES_TIPOS } from '../questoes.js';
import { Botao } from '../components/botao.js';
import { Mascote } from '../components/mascote.js';
import { toast } from '../components/toast.js';

export const titulo = () => t('importar.titulo');

export function render(alvo, params) {
  const codigo = params.get('d') ?? '';
  decodificarAtividade(codigo)
    .then((a) => {
      const nomes = NOMES_TIPOS();
      alvo.append(
        h('div', { class: 'tela__topo' }, h('span', { class: 'etiqueta' }, nomeModalidade(a.modalidade)), h('h1', { tabindex: '-1' }, a.titulo), h('p', { class: 'tela__subtitulo' }, t('importar.recebeu', { n: a.conteudo.perguntas.length }))),
        h('ol', { class: 'cartao importar-lista' }, a.conteudo.perguntas.map((q) => h('li', null, h('span', { class: 'etiqueta' }, nomes[q.tipo]), ' ', q.enunciado))),
        h(
          'div',
          { class: 'linha buzzer-rodape' },
          Botao({
            texto: t('importar.salvar'),
            variante: 'primario',
            tamanho: 'grande',
            aoClicar: async () => {
              await salvarAtividade(a);
              toast(t('importar.salva'), { tipo: 'sucesso' });
              location.hash = `#/atividades/editar?id=${a.id}`;
            },
          })
        )
      );
    })
    .catch(() => {
      alvo.append(h('div', { class: 'vazio cartao' }, Mascote({ humor: 'triste', tamanho: '6rem' }), h('h1', { tabindex: '-1' }, t('importar.invalido')), h('a', { class: 'botao', href: '#/atividades' }, t('editor.voltar'))));
    });
}
