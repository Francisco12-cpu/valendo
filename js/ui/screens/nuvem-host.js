// Nuvem de palavras na sala: os alunos mandam até N palavras pelo celular e a nuvem cresce
// ao vivo no projetor (palavras repetidas ficam maiores; ofensivas não entram).
import { h } from '../dom.js';
import { t } from '../../i18n/i18n.js';
import { contarPalavras } from '../../core/nuvem.js';
import { salvar } from '../../storage/db.js';
import { novoId } from '../../core/ids.js';
import { MARCAS } from '../questoes.js';
import { Stepper } from '../components/stepper.js';
import { Botao } from '../components/botao.js';
import { ModoProjetor } from '../components/projetor.js';

export function configNuvem() {
  const valores = { pergunta: '', maximo: 3 };
  const campo = h('input', { id: 'nuvem-pergunta', class: 'campo', maxlength: 140, placeholder: t('nuvem.perguntaDica') });
  campo.addEventListener('input', () => (valores.pergunta = campo.value.trim()));
  const el = h('div', { class: 'pilha' }, h('div', { class: 'pilha pilha--justa' }, h('label', { for: 'nuvem-pergunta', class: 'rotulo' }, t('nuvem.pergunta')), campo), Stepper({ rotulo: t('nuvem.maximo'), valor: 3, min: 1, max: 5, aoMudar: (v) => (valores.maximo = v) }));
  return { el, valores };
}

export function jogarNuvem(alvo, host, config, extraTopo) {
  const entradas = new Map(); // clientId → [palavras]
  let aberta = true;
  const pergunta = config.pergunta || t('nuvem.perguntaPadrao');
  const nuvem = h('div', { class: 'nuvem', 'aria-live': 'polite' });
  const contagem = h('p', { class: 'etiqueta' });
  const projetor = ModoProjetor();
  const btnAbrir = Botao({ texto: t('nuvem.fechar'), aoClicar: () => ((aberta = !aberta), host.transmitirEstados(), desenhar()) });

  host.definirJogo({
    paraAluno: (id) => ({ tipo: 'nuvem', pergunta, maximo: config.maximo, enviadas: entradas.get(id)?.length ?? 0, aberta }),
    aoAcao: (id, acao) => {
      if (acao.tipo !== 'nuvem' || !aberta) return;
      const atuais = entradas.get(id) ?? [];
      const novas = (Array.isArray(acao.palavras) ? acao.palavras : []).map((p) => String(p).slice(0, 30)).filter(Boolean);
      entradas.set(id, [...atuais, ...novas].slice(0, config.maximo));
      host.enviarEstado(id);
      desenhar();
    },
  });

  function desenhar() {
    const palavras = contarPalavras([...entradas].map(([pid, p]) => ({ pid, palavras: p })));
    contagem.textContent = t('nuvem.respostas', { n: entradas.size, palavras: palavras.length });
    btnAbrir.querySelector('span').textContent = aberta ? t('nuvem.fechar') : t('nuvem.reabrir');
    nuvem.replaceChildren(
      ...(palavras.length
        ? palavras.map((p, i) => h('span', { class: 'nuvem__palavra', style: { '--tamanho': `${1 + p.peso * 3}rem`, '--cor': MARCAS[i % MARCAS.length].cor }, title: t('nuvem.vezes', { n: p.quantos }) }, p.texto))
        : [h('p', { class: 'texto-suave' }, t('nuvem.vazia'))])
    );
  }

  const guardar = () => salvar('resultados', { id: novoId('res'), titulo: `${t('nuvem.titulo')}: ${pergunta}`, modalidade: 'nuvem', data: new Date().toISOString(), palavras: contarPalavras([...entradas].map(([pid, p]) => ({ pid, palavras: p }))), participantes: [], perguntas: [] });

  alvo.append(
    h('div', { class: 'tela__topo buzzer-topo' }, h('div', null, h('p', { class: 'etiqueta' }, t('nuvem.titulo')), h('h1', { tabindex: '-1', class: 'nuvem__pergunta' }, pergunta)), extraTopo, projetor.botao),
    contagem,
    h('section', { class: 'cartao pautado nuvem__palco', 'aria-label': t('nuvem.titulo') }, nuvem),
    h('div', { class: 'linha buzzer-rodape' }, btnAbrir, Botao({ texto: t('nuvem.limpar'), variante: 'fantasma', aoClicar: () => (entradas.clear(), host.transmitirEstados(), desenhar()) }), Botao({ texto: t('nuvem.salvar'), aoClicar: () => guardar() }))
  );
  desenhar();
  return () => projetor.sair();
}
