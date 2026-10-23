// IndexedDB do Valendo!: turmas, sessões das ferramentas (placar, sorteio...) e, nas próximas
// fases, atividades e resultados. Tudo com try/catch: se o IndexedDB falhar (aba anônima antiga,
// armazenamento bloqueado), cai para um armazenamento em memória e o app continua funcionando.

const NOME = 'valendo';
const VERSAO = 1;
export const LOJAS = ['turmas', 'sessoes', 'atividades', 'resultados'];

let conexao = null;
const memoria = new Map(LOJAS.map((l) => [l, new Map()]));

function abrir() {
  if (conexao) return conexao;
  conexao = new Promise((resolver, rejeitar) => {
    try {
      const pedido = indexedDB.open(NOME, VERSAO);
      pedido.onupgradeneeded = () => {
        const db = pedido.result;
        for (const loja of LOJAS) if (!db.objectStoreNames.contains(loja)) db.createObjectStore(loja, { keyPath: 'id' });
      };
      pedido.onsuccess = () => resolver(pedido.result);
      pedido.onerror = () => rejeitar(pedido.error);
      pedido.onblocked = () => rejeitar(new Error('IndexedDB bloqueado'));
    } catch (erro) {
      rejeitar(erro);
    }
  }).catch(() => null); // null = usar memória
  return conexao;
}

function operar(loja, modo, fn) {
  return abrir().then(
    (db) =>
      new Promise((resolver, rejeitar) => {
        if (!db) return resolver(fn(null)?.result);
        try {
          const tx = db.transaction(loja, modo);
          const pedido = fn(tx.objectStore(loja));
          tx.oncomplete = () => resolver(pedido?.result);
          tx.onerror = () => rejeitar(tx.error);
          tx.onabort = () => rejeitar(tx.error);
        } catch (erro) {
          rejeitar(erro);
        }
      })
  );
}

export async function ler(loja, id) {
  try {
    return (await operar(loja, 'readonly', (s) => (s ? s.get(id) : { result: memoria.get(loja).get(id) }))) ?? null;
  } catch {
    return memoria.get(loja).get(id) ?? null;
  }
}

export async function listar(loja) {
  try {
    return (await operar(loja, 'readonly', (s) => (s ? s.getAll() : { result: [...memoria.get(loja).values()] }))) ?? [];
  } catch {
    return [...memoria.get(loja).values()];
  }
}

export async function salvar(loja, registro) {
  const agora = new Date().toISOString();
  const dados = { criadoEm: agora, ...registro, atualizadoEm: agora };
  memoria.get(loja).set(dados.id, dados);
  try {
    await operar(loja, 'readwrite', (s) => s?.put(dados));
  } catch {
    /* fica só na memória desta aba */
  }
  return dados;
}

export async function apagar(loja, id) {
  memoria.get(loja).delete(id);
  try {
    await operar(loja, 'readwrite', (s) => s?.delete(id));
  } catch {
    /* ignorado */
  }
}

export function novoId(prefixo = 'id') {
  const aleatorio = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefixo}-${aleatorio}`;
}
