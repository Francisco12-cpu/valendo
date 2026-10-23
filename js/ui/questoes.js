// Interface dos tipos de questão: Editor (professor) e Visor (aluno / pré-visualização).
// A lógica (validar, corrigir) fica em js/core/questions/; aqui é só tela.
import { h } from './dom.js';
import { t } from '../i18n/i18n.js';
import { lerNumero } from '../core/questions/base.js';
import { variasCorretas } from '../core/questions/multipla.js';
import { Botao } from './components/botao.js';
import { Escolha } from './components/escolha.js';

// Cores e formas das alternativas (cor + forma: não depende só da cor).
export const MARCAS = [
  { cor: '#FF5C8A', forma: '▲' },
  { cor: '#3FC1E0', forma: '◆' },
  { cor: '#FFD23F', forma: '●' },
  { cor: '#3DBE5A', forma: '■' },
  { cor: '#B9A8FF', forma: '★' },
  { cor: '#FF8A5B', forma: '✚' },
  { cor: '#B5E03F', forma: '⬟' },
  { cor: '#9DB8FF', forma: '♥' },
];

let contador = 0;
const uid = (p) => `${p}-${++contador}`;

function campoTexto({ rotulo, valor = '', area = false, linhas = 2, aoMudar, dica, ...extra }) {
  const id = uid('campo');
  const el = h(area ? 'textarea' : 'input', { id, class: `campo${area ? ' campo--area campo--curto' : ''}`, rows: area ? linhas : null, ...extra });
  el.value = valor;
  el.addEventListener('input', () => aoMudar(el.value));
  return h('div', { class: 'pilha pilha--justa' }, h('label', { for: id, class: 'rotulo' }, rotulo), el, dica ? h('p', { class: 'texto-suave dica' }, dica) : null);
}

// ---------- Editores ----------
function editorOpcoes(q, mudar, { comCorreta }) {
  const lista = h('ol', { class: 'opcoes-editor', role: 'list' });
  const desenhar = () => {
    lista.replaceChildren(
      ...q.opcoes.map((op, i) => {
        const marca = MARCAS[i % MARCAS.length];
        const texto = h('input', { class: 'campo', value: op.texto, maxlength: 200, 'aria-label': t('editor.opcaoN', { n: i + 1 }), placeholder: t('editor.opcaoN', { n: i + 1 }) });
        texto.value = op.texto;
        texto.addEventListener('input', () => {
          op.texto = texto.value;
          mudar();
        });
        let correta = null;
        if (comCorreta) {
          const caixa = h('input', { type: 'checkbox', class: 'opcoes-editor__caixa', 'aria-label': t('editor.marcarCorreta', { n: i + 1 }) });
          caixa.checked = op.correta;
          caixa.addEventListener('change', () => {
            op.correta = caixa.checked;
            mudar();
          });
          correta = h('label', { class: 'opcoes-editor__correta', title: t('editor.correta') }, caixa, h('span', { 'aria-hidden': 'true' }, '✓'));
        }
        const remover = Botao({
          icone: 'fechar',
          variante: 'fantasma',
          rotulo: t('editor.removerOpcao', { n: i + 1 }),
          desativado: q.opcoes.length <= 2,
          aoClicar: () => {
            q.opcoes.splice(i, 1);
            q.opcoes.forEach((o, j) => (o.id = String.fromCharCode(97 + j)));
            mudar();
            desenhar();
          },
        });
        return h('li', { class: 'opcoes-editor__linha', style: { '--cor': marca.cor } }, h('span', { class: 'opcoes-editor__marca', 'aria-hidden': 'true' }, marca.forma), correta, texto, remover);
      })
    );
  };
  desenhar();
  const adicionar = Botao({
    texto: t('editor.adicionarOpcao'),
    icone: 'mais',
    aoClicar: () => {
      if (q.opcoes.length >= 8) return;
      const novo = { id: String.fromCharCode(97 + q.opcoes.length), texto: '' };
      if (comCorreta) novo.correta = false;
      q.opcoes.push(novo);
      mudar();
      desenhar();
      lista.querySelector('li:last-child input:not([type])')?.focus();
    },
  });
  return h('div', { class: 'pilha' }, comCorreta ? h('p', { class: 'texto-suave dica' }, t('editor.dicaCorretas')) : null, lista, adicionar);
}

const EDITORES = {
  multipla: (q, mudar) => editorOpcoes(q, mudar, { comCorreta: true }),
  enquete: (q, mudar) => editorOpcoes(q, mudar, { comCorreta: false }),
  vf: (q, mudar) =>
    Escolha({
      rotulo: t('editor.respostaCerta'),
      valor: q.correta ? 'v' : 'f',
      compacta: true,
      aoMudar: (v) => {
        q.correta = v === 'v';
        mudar();
      },
      opcoes: [
        { valor: 'v', texto: t('questao.verdadeiro') },
        { valor: 'f', texto: t('questao.falso') },
      ],
    }),
  curta: (q, mudar) =>
    campoTexto({
      rotulo: t('editor.aceitas'),
      valor: q.aceitas.join('\n'),
      area: true,
      linhas: 3,
      dica: t('editor.aceitasDica'),
      aoMudar: (v) => {
        q.aceitas = v.split('\n').map((s) => s.trim()).filter(Boolean);
        if (!q.aceitas.length) q.aceitas = [''];
        mudar();
      },
    }),
  numerica: (q, mudar) => {
    const num = (rotulo, chave, extra = {}) =>
      campoTexto({
        rotulo,
        valor: String(q[chave] ?? '').replace('.', ','),
        inputmode: 'decimal',
        ...extra,
        aoMudar: (v) => {
          q[chave] = lerNumero(v);
          mudar();
        },
      });
    return h(
      'div',
      { class: 'grade-campos' },
      num(t('editor.valor'), 'valor'),
      num(t('editor.tolerancia'), 'tolerancia', { dica: t('editor.toleranciaDica') }),
      campoTexto({ rotulo: t('editor.unidade'), valor: q.unidade, maxlength: 20, aoMudar: (v) => ((q.unidade = v.trim()), mudar()) })
    );
  },
  slide: (q, mudar) => campoTexto({ rotulo: t('editor.textoSlide'), valor: q.texto ?? '', area: true, linhas: 4, aoMudar: (v) => ((q.texto = v), mudar()) }),
};

// nivel: 'basica' | 'avancada' | 'personalizada' (mostra só o que importa).
export function EditorQuestao(q, { mudar, nivel = 'basica', comMultiplicador = false }) {
  const partes = [
    campoTexto({
      rotulo: q.tipo === 'slide' ? t('editor.tituloSlide') : t('editor.enunciado'),
      valor: q.enunciado,
      area: true,
      linhas: 2,
      maxlength: 1000,
      aoMudar: (v) => ((q.enunciado = v), mudar()),
    }),
    EDITORES[q.tipo](q, mudar),
  ];
  if (nivel !== 'basica' && comMultiplicador && q.tipo !== 'slide' && q.tipo !== 'enquete') {
    partes.push(
      Escolha({
        rotulo: t('editor.valorPergunta'),
        valor: String(q.multiplicador ?? 1),
        compacta: true,
        aoMudar: (v) => {
          q.multiplicador = Number(v);
          mudar();
        },
        opcoes: [
          { valor: '1', texto: t('editor.valorNormal') },
          { valor: '2', texto: t('editor.valorDobro') },
          { valor: '0', texto: t('editor.valorZero') },
        ],
      })
    );
  }
  if (nivel !== 'basica' && q.tipo !== 'slide') {
    partes.push(campoTexto({ rotulo: t('editor.explicacao'), valor: q.explicacao, area: true, linhas: 2, dica: t('editor.explicacaoDica'), aoMudar: (v) => ((q.explicacao = v), mudar()) }));
  }
  if (nivel === 'personalizada') {
    const num = (rotulo, chave) =>
      campoTexto({ rotulo, valor: String(q[chave]), inputmode: 'numeric', aoMudar: (v) => ((q[chave] = Math.max(0, Math.round(lerNumero(v) || 0))), mudar()) });
    partes.push(
      h(
        'div',
        { class: 'grade-campos' },
        num(t('editor.pontosQuestao'), 'pontos'),
        num(t('editor.tempoQuestao'), 'tempo'),
        campoTexto({ rotulo: t('editor.tagsQuestao'), valor: q.tags.join(', '), aoMudar: (v) => ((q.tags = v.split(',').map((s) => s.trim()).filter(Boolean)), mudar()) })
      )
    );
  }
  return h('div', { class: 'pilha' }, partes);
}

// ---------- Visores ----------
// modo 'previa': mostra o gabarito; modo 'teste': o aluno responde e aoResponder(resposta) é chamado.
export function VisorQuestao(q, { modo = 'teste', aoResponder, travado = false } = {}) {
  const corpo = h('div', { class: 'visor' });
  corpo.append(h('p', { class: 'visor__enunciado' }, q.enunciado || t('editor.semEnunciado')));
  const responder = (r) => {
    if (travado || modo !== 'teste') return;
    travado = true;
    corpo.querySelectorAll('button, input').forEach((b) => (b.disabled = true));
    aoResponder?.(r);
  };

  if (q.tipo === 'multipla' || q.tipo === 'enquete') {
    const varias = q.tipo === 'multipla' && variasCorretas(q);
    const marcadas = new Set();
    const grade = h(
      'div',
      { class: 'visor__opcoes', role: varias ? 'group' : null },
      q.opcoes.map((op, i) => {
        const marca = MARCAS[i % MARCAS.length];
        const b = h(
          'button',
          { type: 'button', class: 'visor__opcao', style: { '--cor': marca.cor }, 'aria-pressed': varias ? 'false' : null },
          h('span', { class: 'visor__forma', 'aria-hidden': 'true' }, marca.forma),
          h('span', null, op.texto || '—')
        );
        if (modo === 'previa' && op.correta) b.dataset.correta = 'true';
        b.addEventListener('click', () => {
          if (!varias) return responder(q.tipo === 'multipla' ? [op.id] : op.id);
          if (marcadas.has(op.id)) marcadas.delete(op.id);
          else marcadas.add(op.id);
          b.setAttribute('aria-pressed', String(marcadas.has(op.id)));
        });
        return b;
      })
    );
    corpo.append(grade);
    if (varias) {
      corpo.append(h('p', { class: 'texto-suave dica' }, t('questao.variasCorretas')));
      if (modo === 'teste') corpo.append(Botao({ texto: t('questao.confirmar'), variante: 'primario', aoClicar: () => responder([...marcadas]) }));
    }
  } else if (q.tipo === 'vf') {
    const grade = h(
      'div',
      { class: 'visor__opcoes visor__opcoes--vf' },
      [true, false].map((valor, i) => {
        const b = h('button', { type: 'button', class: 'visor__opcao', style: { '--cor': MARCAS[i === 0 ? 3 : 0].cor } }, h('span', { class: 'visor__forma', 'aria-hidden': 'true' }, valor ? '✓' : '✕'), h('span', null, valor ? t('questao.verdadeiro') : t('questao.falso')));
        if (modo === 'previa' && q.correta === valor) b.dataset.correta = 'true';
        b.addEventListener('click', () => responder(valor));
        return b;
      })
    );
    corpo.append(grade);
  } else if (q.tipo === 'curta' || q.tipo === 'numerica') {
    const id = uid('resp');
    const campo = h('input', { id, class: 'campo visor__campo', autocomplete: 'off', inputmode: q.tipo === 'numerica' ? 'decimal' : 'text', maxlength: 120 });
    const enviar = () => campo.value.trim() && responder(campo.value);
    campo.addEventListener('keydown', (e) => e.key === 'Enter' && enviar());
    corpo.append(
      h('label', { for: id, class: 'rotulo' }, t('questao.suaResposta'), q.tipo === 'numerica' && q.unidade ? ` (${q.unidade})` : ''),
      h('div', { class: 'linha' }, campo, modo === 'teste' ? Botao({ texto: t('questao.responder'), variante: 'primario', aoClicar: enviar }) : null)
    );
    if (modo === 'previa') {
      const gab = q.tipo === 'curta' ? q.aceitas.filter(Boolean).join(' · ') : `${String(q.valor).replace('.', ',')}${q.tolerancia ? ` ± ${String(q.tolerancia).replace('.', ',')}` : ''} ${q.unidade ?? ''}`;
      corpo.append(h('p', { class: 'visor__gabarito' }, t('questao.gabarito', { valor: gab })));
    }
  } else if (q.tipo === 'slide') {
    if (q.texto) corpo.append(h('p', { class: 'visor__texto' }, q.texto));
    if (modo === 'teste') corpo.append(Botao({ texto: t('questao.continuar'), variante: 'primario', aoClicar: () => responder(null) }));
  }
  if (modo === 'previa' && q.explicacao) corpo.append(h('p', { class: 'visor__explicacao' }, h('strong', null, t('questao.explicacao')), ' ', q.explicacao));
  return corpo;
}

export const NOMES_TIPOS = () => ({
  multipla: t('tipo.multipla'),
  vf: t('tipo.vf'),
  curta: t('tipo.curta'),
  numerica: t('tipo.numerica'),
  enquete: t('tipo.enquete'),
  slide: t('tipo.slide'),
});
