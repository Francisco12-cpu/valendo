// Preferências pequenas no localStorage (dados de atividades vão para o IndexedDB nas próximas fases).
// Sempre com try/catch: em aba anônima ou com armazenamento bloqueado, o app segue com os padrões.

const PREFIXO = 'valendo.';

export function lerPreferencia(chave, padrao) {
  try {
    const bruto = localStorage.getItem(PREFIXO + chave);
    return bruto === null ? padrao : JSON.parse(bruto);
  } catch {
    return padrao;
  }
}

export function salvarPreferencia(chave, valor) {
  try {
    localStorage.setItem(PREFIXO + chave, JSON.stringify(valor));
    return true;
  } catch {
    return false;
  }
}
