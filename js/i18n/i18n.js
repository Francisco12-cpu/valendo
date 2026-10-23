// Tradução simples: t('chave', { variavel: valor }).
// pt-BR é o idioma padrão e o único carregado na v1.
import ptBR from './pt-BR.js';

const dicionarios = { 'pt-BR': ptBR };
let atual = ptBR;

export function definirIdioma(codigo) {
  atual = dicionarios[codigo] || ptBR;
  document.documentElement.lang = dicionarios[codigo] ? codigo : 'pt-BR';
}

export function t(chave, vars) {
  let texto = atual[chave] ?? ptBR[chave] ?? chave;
  if (vars) {
    texto = texto.replace(/\{(\w+)\}/g, (_, nome) => (nome in vars ? String(vars[nome]) : `{${nome}}`));
  }
  return texto;
}

// Como t(), mas devolve uma lista de partes para que variáveis possam ser elementos.
// Ex.: tPartes('inicio.titulo', { destaque: h('span', ...) }) → ['O que vai ser ', <span>, '?']
export function tPartes(chave, vars = {}) {
  const texto = atual[chave] ?? ptBR[chave] ?? chave;
  return texto.split(/(\{\w+\})/).filter(Boolean).map((parte) => {
    const nome = parte.match(/^\{(\w+)\}$/)?.[1];
    return nome && nome in vars ? vars[nome] : parte;
  });
}
