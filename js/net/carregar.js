// Carrega uma biblioteca de /vendor uma vez só (arquivos locais: funcionam offline).
const carregando = new Map();

export function carregarScript(caminho, global) {
  if (global && window[global]) return Promise.resolve(window[global]);
  if (!carregando.has(caminho)) {
    carregando.set(
      caminho,
      new Promise((resolver, rejeitar) => {
        const s = document.createElement('script');
        s.src = new URL(`../../${caminho}`, import.meta.url).href;
        s.async = true;
        s.onload = () => resolver(global ? window[global] : true);
        s.onerror = () => {
          carregando.delete(caminho);
          rejeitar(new Error(`Não consegui carregar ${caminho}`));
        };
        document.head.append(s);
      })
    );
  }
  return carregando.get(caminho);
}
