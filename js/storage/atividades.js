// Atividades no IndexedDB. Tudo que sai daqui já passou por abrir() (migração + padrões).
import { listar, ler, salvar, apagar } from './db.js';
import { abrir } from '../core/activity.js';

const LOJA = 'atividades';

// Atividade que não abre (ex.: feita numa versão mais nova) vem como { id, titulo, erro }.
function abrirComSeguranca(bruta) {
  try {
    return abrir(bruta);
  } catch (erro) {
    return { id: bruta.id, titulo: bruta.titulo ?? bruta.nome ?? '?', erro: erro.message, bruta };
  }
}

export async function listarAtividades() {
  return (await listar(LOJA)).map(abrirComSeguranca);
}

export async function lerAtividade(id) {
  const bruta = await ler(LOJA, id);
  return bruta ? abrirComSeguranca(bruta) : null;
}

export function salvarAtividade(atividade) {
  return salvar(LOJA, atividade);
}

export function apagarAtividade(id) {
  return apagar(LOJA, id);
}
