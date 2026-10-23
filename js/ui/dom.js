// Ajudante mínimo para criar elementos sem framework.
// h('button', { class: 'botao', onClick: fn }, 'Texto', outroNo)

export function h(tag, props, ...filhos) {
  const el = document.createElement(tag);
  if (props) {
    for (const [chave, valor] of Object.entries(props)) {
      if (valor === undefined || valor === null || valor === false) continue;
      if (chave.startsWith('on') && typeof valor === 'function') {
        el.addEventListener(chave.slice(2).toLowerCase(), valor);
      } else if (chave === 'class') {
        el.className = valor;
      } else if (chave === 'style' && typeof valor === 'object') {
        for (const [prop, v] of Object.entries(valor)) el.style.setProperty(prop, v);
      } else if (chave === 'html') {
        el.innerHTML = valor; // apenas para SVGs internos e confiáveis
      } else if (valor === true) {
        el.setAttribute(chave, '');
      } else {
        el.setAttribute(chave, String(valor));
      }
    }
  }
  anexar(el, filhos);
  return el;
}

function anexar(el, filhos) {
  for (const filho of filhos) {
    if (filho === undefined || filho === null || filho === false) continue;
    if (Array.isArray(filho)) anexar(el, filho);
    else el.append(filho instanceof Node ? filho : String(filho));
  }
}

// Cria um SVG a partir de uma string confiável (ícones do próprio app).
export function svg(marcacao) {
  const tpl = document.createElement('template');
  tpl.innerHTML = marcacao.trim();
  return tpl.content.firstElementChild;
}
