// Service worker do Valendo!: guarda o app inteiro no aparelho para funcionar offline.
// Ao publicar uma versão nova, troque VERSAO (e em js/config.js) e mantenha ARQUIVOS em dia
// (todo arquivo do app precisa estar na lista para funcionar offline).
const VERSAO = '0.8.2';
const CACHE = `valendo-${VERSAO}`;

const ARQUIVOS = [
  './',
  './index.html',
  './404.html',
  './manifest.webmanifest',
  './css/base.css',
  './css/components.css',
  './css/tokens.css',
  './js/app.js',
  './js/audio/sons.js',
  './js/config.js',
  './js/core/activity.js',
  './js/core/aleatorio.js',
  './js/core/arquivos.js',
  './js/core/buzzer.js',
  './js/core/cartoes.js',
  './js/core/clock.js',
  './js/core/compartilhar.js',
  './js/core/exemplos.js',
  './js/core/ids.js',
  './js/core/nomes.js',
  './js/core/nuvem.js',
  './js/core/passa-repassa.js',
  './js/core/prova.js',
  './js/core/questions/base.js',
  './js/core/questions/curta.js',
  './js/core/questions/enquete.js',
  './js/core/questions/index.js',
  './js/core/questions/multipla.js',
  './js/core/questions/numerica.js',
  './js/core/questions/slide.js',
  './js/core/questions/vf.js',
  './js/core/quiz.js',
  './js/core/relatorio.js',
  './js/core/ritmo.js',
  './js/core/rotation.js',
  './js/core/sala.js',
  './js/core/scoring.js',
  './js/core/sorteador.js',
  './js/core/teams.js',
  './js/core/timer.js',
  './js/i18n/i18n.js',
  './js/i18n/pt-BR.js',
  './js/net/carregar.js',
  './js/net/local-server.js',
  './js/net/peer-online.js',
  './js/net/peer-qr.js',
  './js/net/protocol.js',
  './js/net/transport.js',
  './js/storage/atividades.js',
  './js/storage/db.js',
  './js/storage/preferencias.js',
  './js/ui/arquivo.js',
  './js/ui/buzzer-ajustes.js',
  './js/ui/components/botao.js',
  './js/ui/components/escolha.js',
  './js/ui/components/fonte-nomes.js',
  './js/ui/components/grade.js',
  './js/ui/components/grafico.js',
  './js/ui/components/icones.js',
  './js/ui/components/mascote.js',
  './js/ui/components/modal.js',
  './js/ui/components/pasta.js',
  './js/ui/components/postit.js',
  './js/ui/components/projetor.js',
  './js/ui/components/qr.js',
  './js/ui/components/stepper.js',
  './js/ui/components/switch.js',
  './js/ui/components/toast.js',
  './js/ui/dom.js',
  './js/ui/imagem-resultado.js',
  './js/ui/leitor-cartoes.js',
  './js/ui/questoes.js',
  './js/ui/sala-cliente.js',
  './js/ui/sala-host.js',
  './js/ui/screens/atividades.js',
  './js/ui/screens/buzzer-jogo.js',
  './js/ui/screens/buzzer.js',
  './js/ui/screens/cartoes.js',
  './js/ui/screens/cronometro.js',
  './js/ui/screens/editor.js',
  './js/ui/screens/entrar.js',
  './js/ui/screens/equipes.js',
  './js/ui/screens/espiral-host.js',
  './js/ui/screens/ferramentas.js',
  './js/ui/screens/importar.js',
  './js/ui/screens/inicio.js',
  './js/ui/screens/jogar.js',
  './js/ui/screens/jogo-passa.js',
  './js/ui/screens/jogo-quiz.js',
  './js/ui/screens/jogos.js',
  './js/ui/screens/nao-encontrado.js',
  './js/ui/screens/nuvem-host.js',
  './js/ui/screens/placar.js',
  './js/ui/screens/prova-host.js',
  './js/ui/screens/relatorios.js',
  './js/ui/screens/roleta.js',
  './js/ui/screens/sala.js',
  './js/ui/screens/sessao.js',
  './js/ui/screens/sobre.js',
  './js/ui/screens/sorteio.js',
  './js/ui/screens/testar.js',
  './js/ui/screens/turmas.js',
  './js/ui/screens/vitrine.js',
  './vendor/jsQR.js',
  './vendor/peerjs.min.js',
  './vendor/qrcode.js',
  './assets/fonts/caveat-latin-wght.woff2',
  './assets/fonts/space-grotesk-latin-wght.woff2',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/icone-192.png',
  './assets/icons/icone-512.png',
  './assets/icons/icone-maskable-512.png',
  './assets/icons/icone-maskable.svg',
  './assets/icons/icone.svg',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ARQUIVOS.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n.startsWith('valendo-') && n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (evento) => {
  const { request } = evento;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navegação: o shell vem do cache na hora (mesmo com Wi-Fi da escola "sem internet").
  if (request.mode === 'navigate') {
    const escopo = new URL(self.registration.scope);
    const ehShell = url.pathname === escopo.pathname || url.pathname === `${escopo.pathname}index.html`;
    evento.respondWith(
      ehShell
        ? caches.match('./index.html').then((r) => r || fetch(request))
        : fetch(request).catch(() => caches.match('./404.html'))
    );
    return;
  }

  // Demais arquivos: cache primeiro; o que vier da rede é guardado para a próxima vez.
  evento.respondWith(
    caches.match(request, { ignoreSearch: true }).then(
      (salvo) =>
        salvo ||
        fetch(request).then((resposta) => {
          if (resposta.ok && resposta.type === 'basic') {
            const copia = resposta.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copia));
          }
          return resposta;
        })
    )
  );
});
