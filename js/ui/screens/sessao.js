// #/sessao — sequência de modalidades numa aula: monta a lista de etapas e roda uma
// depois da outra. Durante a sessão, uma barra fixa (app.js) mostra "Próxima etapa".
import { h } from '../dom.js';
import { t } from '../../i18n/i18n.js';
import { ler, salvar } from '../../storage/db.js';
import { listarAtividades } from '../../storage/atividades.js';
import { Botao } from '../components/botao.js';
import { toast } from '../components/toast.js';

export const titulo = () => t('sessao.titulo');
export const SESSAO_ID = 'sequencia';

export const FERRAMENTAS_SESSAO = [
  { rota: '#/buzzer/jogar?relampago', chave: 'buzzer' },
  { rota: '#/cronometro', chave: 'cronometro' },
  { rota: '#/sorteio', chave: 'sorteio' },
  { rota: '#/roleta', chave: 'roleta' },
  { rota: '#/placar', chave: 'placar' },
  { rota: '#/equipes', chave: 'equipes' },
  { rota: '#/sala?jogo=enquete', chave: 'enquete' },
  { rota: '#/sala?jogo=nuvem', chave: 'nuvem' },
];

export async function lerSessao() {
  return (await ler('sessoes', SESSAO_ID)) ?? { id: SESSAO_ID, etapas: [], atual: 0, ativa: false };
}

export function render(alvo) {
  let sessao = null;
  const lista = h('ol', { class: 'sessao-etapas' });
  const seletor = h('select', { id: 'sessao-nova', class: 'campo' });
  const guardar = () => salvar('sessoes', sessao).then(() => window.dispatchEvent(new Event('valendo:sessao')));

  function desenhar() {
    lista.replaceChildren(
      ...sessao.etapas.map((e, i) =>
        h(
          'li',
          { class: 'sessao-etapa', 'aria-current': sessao.ativa && i === sessao.atual ? 'step' : null },
          h('span', { class: 'pergunta__numero manuscrito', 'aria-hidden': 'true' }, String(i + 1)),
          h('span', { class: 'sessao-etapa__nome' }, e.titulo),
          h(
            'span',
            { class: 'pergunta__acoes' },
            Botao({ icone: 'cima', variante: 'fantasma', rotulo: t('editor.subir', { n: i + 1 }), desativado: i === 0, aoClicar: () => mover(i, -1) }),
            Botao({ icone: 'baixo', variante: 'fantasma', rotulo: t('editor.descer', { n: i + 1 }), desativado: i === sessao.etapas.length - 1, aoClicar: () => mover(i, 1) }),
            Botao({ icone: 'lixo', variante: 'fantasma', rotulo: t('sessao.remover', { nome: e.titulo }), aoClicar: () => ((sessao.etapas.splice(i, 1)), guardar(), desenhar()) })
          )
        )
      )
    );
    if (!sessao.etapas.length) lista.replaceChildren(h('li', { class: 'texto-suave' }, t('sessao.vazia')));
  }

  function mover(i, d) {
    const [x] = sessao.etapas.splice(i, 1);
    sessao.etapas.splice(i + d, 0, x);
    guardar();
    desenhar();
  }

  Promise.all([lerSessao(), listarAtividades()]).then(([s, atividades]) => {
    sessao = s;
    const jogaveis = atividades.filter((a) => !a.erro && a.conteudo.perguntas.length);
    seletor.append(
      h('optgroup', { label: t('sessao.ferramentas') }, FERRAMENTAS_SESSAO.map((f) => h('option', { value: f.rota }, t(`sessao.f.${f.chave}`)))),
      jogaveis.length ? h('optgroup', { label: t('sessao.atividades') }, jogaveis.map((a) => h('option', { value: `#/jogar?id=${a.id}`, 'data-titulo': a.titulo }, a.titulo))) : null
    );
    const adicionar = Botao({
      texto: t('sessao.adicionar'),
      icone: 'mais',
      aoClicar: () => {
        const op = seletor.selectedOptions[0];
        sessao.etapas.push({ rota: op.value, titulo: op.dataset.titulo ?? op.textContent });
        guardar();
        desenhar();
      },
    });
    const comecar = Botao({
      texto: t('sessao.comecar'),
      variante: 'primario',
      tamanho: 'grande',
      icone: 'raio',
      aoClicar: async () => {
        if (!sessao.etapas.length) return toast(t('sessao.vazia'), { tipo: 'aviso' });
        sessao.ativa = true;
        sessao.atual = 0;
        await guardar();
        location.hash = sessao.etapas[0].rota;
      },
    });
    alvo.append(
      h('div', { class: 'tela__topo' }, h('h1', { tabindex: '-1' }, t('sessao.titulo')), h('p', { class: 'tela__subtitulo' }, t('sessao.subtitulo'))),
      h('section', { class: 'cartao pilha' }, h('h2', null, t('sessao.etapas')), lista, h('div', { class: 'pilha pilha--justa' }, h('label', { for: 'sessao-nova', class: 'rotulo' }, t('sessao.nova')), h('div', { class: 'linha' }, seletor, adicionar))),
      h('div', { class: 'linha buzzer-rodape' }, comecar)
    );
    desenhar();
  });
}
