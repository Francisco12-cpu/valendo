// Tela inicial: as modalidades como cartões-pasta (desativados até cada fase chegar).
import { h } from '../dom.js';
import { t, tPartes } from '../../i18n/i18n.js';
import { CartaoPasta } from '../components/pasta.js';
import { toast } from '../components/toast.js';

const MODALIDADES = [
  { id: 'buzzer', icone: 'buzzer', cor: 'var(--cor-buzzer)' },
  { id: 'placar', icone: 'placar', cor: 'var(--cor-placar)' },
  { id: 'sorteio', icone: 'sorteio', cor: 'var(--cor-sorteio)' },
  { id: 'quiz', icone: 'quiz', cor: 'var(--cor-quiz)' },
  { id: 'passa', icone: 'passa', cor: 'var(--cor-passa)' },
  { id: 'espiral', icone: 'espiral', cor: 'var(--cor-espiral)' },
  { id: 'provas', icone: 'provas', cor: 'var(--cor-provas)', sobreCor: 'var(--sobre-info)' },
  { id: 'ferramentas', icone: 'ferramentas', cor: 'var(--cor-ferramentas)' },
];

export const titulo = () => t('app.nome');

export function render(alvo) {
  const pastas = MODALIDADES.map((m, i) => {
    const nome = t(`modalidade.${m.id}`);
    return h(
      'li',
      null,
      CartaoPasta({
        titulo: nome,
        aba: String(i + 1).padStart(2, '0'),
        descricao: t(`modalidade.${m.id}.desc`),
        cor: m.cor,
        sobreCor: m.sobreCor,
        icone: m.icone,
        desativado: true,
        etiqueta: t('inicio.emBreve'),
        aoClicarDesativado: () => toast(t('inicio.emBreveToast', { nome }), { tipo: 'aviso' }),
      })
    );
  });

  alvo.append(
    h(
      'div',
      { class: 'tela__topo' },
      h('h1', { tabindex: '-1' }, tPartes('inicio.titulo', { destaque: h('span', { class: 'marca-texto' }, t('inicio.tituloDestaque')) })),
      h('p', { class: 'tela__subtitulo' }, t('inicio.subtitulo'))
    ),
    h('ul', { class: 'grade-pastas', role: 'list' }, pastas)
  );
}
