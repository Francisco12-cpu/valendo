// QR Code: desenhar (vendor/qrcode.js) e ler pela câmera (vendor/jsQR.js). Tudo local.
import { h } from '../dom.js';
import { t } from '../../i18n/i18n.js';
import { carregarScript } from '../../net/carregar.js';
import { Botao } from './botao.js';

export function QRCodigo(texto, { rotulo, tamanho = '16rem' } = {}) {
  const caixa = h('div', { class: 'qr', style: { '--tamanho': tamanho }, role: 'img', 'aria-label': rotulo ?? t('qr.rotulo') });
  carregarScript('vendor/qrcode.js', 'qrcode')
    .then((qrcode) => {
      const qr = qrcode(0, texto.length > 600 ? 'L' : 'M');
      qr.addData(texto, 'Byte');
      qr.make();
      caixa.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
    })
    .catch(() => caixa.append(h('p', { class: 'erro-texto' }, t('qr.erro'))));
  return caixa;
}

// Lê um QR com a câmera traseira. aoLer(texto) recebe o conteúdo. Tem também "colar o código".
export function LeitorQR({ aoLer, dica }) {
  const video = h('video', { class: 'leitor__video', playsinline: true, muted: true, 'aria-hidden': 'true' });
  const status = h('p', { class: 'texto-suave', 'aria-live': 'polite' }, t('qr.abrindoCamera'));
  const area = h('textarea', { class: 'campo campo--area', rows: 3, 'aria-label': t('qr.colarRotulo'), placeholder: 'VLD1:…' });
  let fluxo = null;
  let ativo = true;
  let quadro = null;

  const parar = () => {
    ativo = false;
    cancelAnimationFrame(quadro);
    fluxo?.getTracks().forEach((faixa) => faixa.stop());
  };
  const entregar = (texto) => {
    if (!ativo) return;
    parar();
    aoLer(texto.trim());
  };

  (async () => {
    try {
      const jsQR = await carregarScript('vendor/jsQR.js', 'jsQR');
      fluxo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      if (!ativo) return parar();
      video.srcObject = fluxo;
      await video.play();
      status.textContent = dica ?? t('qr.aponte');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const ler = () => {
        if (!ativo) return;
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          const escala = Math.min(1, 640 / video.videoWidth);
          canvas.width = Math.round(video.videoWidth * escala);
          canvas.height = Math.round(video.videoHeight * escala);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const achado = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
          if (achado?.data) return entregar(achado.data);
        }
        quadro = requestAnimationFrame(ler);
      };
      ler();
    } catch {
      status.textContent = t('qr.semCamera');
    }
  })();

  const el = h(
    'div',
    { class: 'leitor pilha' },
    h('div', { class: 'leitor__moldura' }, video),
    status,
    h('details', { class: 'leitor__colar' }, h('summary', null, t('qr.colar')), h('div', { class: 'pilha' }, area, Botao({ texto: t('qr.usarCodigo'), aoClicar: () => area.value.trim() && entregar(area.value) })))
  );
  el.parar = parar;
  return el;
}
