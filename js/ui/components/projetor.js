// Modo projetor: esconde cabeçalho e rodapé, aumenta tudo e tenta a tela cheia.
// Sai com o mesmo botão, com Esc (tela cheia) ou ao trocar de tela.
import { h, svg } from '../dom.js';
import { t } from '../../i18n/i18n.js';
import { icones } from './icones.js';
import { ativarAfundar } from './botao.js';

export function ModoProjetor() {
  const botao = ativarAfundar(h('button', { type: 'button', class: 'botao', 'aria-pressed': 'false' }, svg(icones.projetor), h('span', null, t('projetor.entrar'))));
  const rotulo = botao.querySelector('span');

  const aplicar = (ligado) => {
    document.body.classList.toggle('modo-projetor', ligado);
    botao.setAttribute('aria-pressed', String(ligado));
    rotulo.textContent = ligado ? t('projetor.sair') : t('projetor.entrar');
  };

  const aoMudarTelaCheia = () => {
    if (!document.fullscreenElement) aplicar(false);
  };
  document.addEventListener('fullscreenchange', aoMudarTelaCheia);

  botao.addEventListener('click', () => {
    const ligar = !document.body.classList.contains('modo-projetor');
    aplicar(ligar);
    if (ligar && document.fullscreenEnabled) document.documentElement.requestFullscreen().catch(() => {});
    if (!ligar && document.fullscreenElement) document.exitFullscreen().catch(() => {});
  });

  return {
    botao,
    alternar: () => botao.click(),
    sair() {
      document.removeEventListener('fullscreenchange', aoMudarTelaCheia);
      aplicar(false);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    },
  };
}
