// Ids únicos (sem DOM nem rede: crypto existe no navegador e no Node).
export function novoId(prefixo = 'id') {
  const aleatorio = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefixo}-${aleatorio}`;
}

// Ids curtos para opções e perguntas dentro de uma atividade.
export function idCurto(existentes = [], prefixo = '') {
  const usados = new Set(existentes);
  for (let i = 1; ; i++) {
    const id = `${prefixo}${i}`;
    if (!usados.has(id)) return id;
  }
}
