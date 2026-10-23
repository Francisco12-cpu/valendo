// Registro dos tipos de questão (plugins). Para criar um tipo novo: um arquivo nesta pasta
// exportando { tipo, temResposta, novo, validar, corrigir } e uma linha aqui.
// O editor e o visor de cada tipo ficam na interface (js/ui/questoes.js), fora do /core.
import * as multipla from './multipla.js';
import * as vf from './vf.js';
import * as curta from './curta.js';
import * as numerica from './numerica.js';
import * as enquete from './enquete.js';
import * as slide from './slide.js';

export const TIPOS = { multipla, vf, curta, numerica, enquete, slide };
export const LISTA_TIPOS = Object.keys(TIPOS);

export function tipoDe(q) {
  return TIPOS[q?.tipo] ?? null;
}

export function novaQuestao(tipo, id = '') {
  const plugin = TIPOS[tipo];
  if (!plugin) throw new Error(`Tipo de questão desconhecido: ${tipo}`);
  return { ...plugin.novo(), id };
}

export function validarQuestao(q) {
  const plugin = tipoDe(q);
  return plugin ? plugin.validar(q) : [`tipo desconhecido: ${q?.tipo}`];
}

export function corrigir(q, resposta) {
  const plugin = tipoDe(q);
  if (!plugin) return { correta: null, gabarito: null };
  return plugin.corrigir(q, resposta);
}
