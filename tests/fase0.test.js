// Testes da Fase 0 (fundação). Rodar com: node --test  (ou npm test)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const ler = (arq) => readFileSync(join(RAIZ, arq), 'utf8');

function listar(pasta, filtro = () => true) {
  const dir = join(RAIZ, pasta);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return listar(relative(RAIZ, caminho), filtro);
    return filtro(nome) ? [relative(RAIZ, caminho).split(sep).join('/')] : [];
  });
}

const arquivosDoSW = () => [...ler('sw.js').matchAll(/^\s*'(\.\/[^']*)',?$/gm)].map((m) => m[1]);

test('todo arquivo pré-cacheado pelo service worker existe', () => {
  const lista = arquivosDoSW();
  assert.ok(lista.length > 10, 'lista ARQUIVOS do sw.js não encontrada');
  for (const url of lista) {
    if (url === './') continue;
    assert.ok(existsSync(join(RAIZ, url)), `sw.js lista ${url}, mas o arquivo não existe`);
  }
});

test('todo JS, CSS e fonte do app está no cache offline', () => {
  const lista = new Set(arquivosDoSW());
  const necessarios = [
    ...listar('js', (n) => n.endsWith('.js')),
    ...listar('css', (n) => n.endsWith('.css')),
    ...listar('assets/fonts', (n) => n.endsWith('.woff2')),
  ];
  for (const arq of necessarios) {
    assert.ok(lista.has(`./${arq}`), `${arq} não está em ARQUIVOS do sw.js (não funcionaria offline)`);
  }
});

test('versão do sw.js e do config.js é a mesma', () => {
  const sw = ler('sw.js').match(/VERSAO = '([^']+)'/)[1];
  const cfg = ler('js/config.js').match(/VERSAO = '([^']+)'/)[1];
  assert.equal(sw, cfg);
});

test('/core nunca acessa DOM nem rede', () => {
  const proibidos = /\b(document|window|navigator|localStorage|sessionStorage|indexedDB|fetch|XMLHttpRequest|WebSocket|RTCPeerConnection)\b/;
  for (const arq of listar('js/core', (n) => n.endsWith('.js'))) {
    const codigo = ler(arq).replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, '');
    assert.doesNotMatch(codigo, proibidos, `${arq} usa API de DOM ou rede`);
  }
});

test('manifest é válido e os ícones existem', () => {
  const manifest = JSON.parse(ler('manifest.webmanifest'));
  assert.equal(manifest.lang, 'pt-BR');
  assert.equal(manifest.display, 'standalone');
  const tamanhos = manifest.icons.map((i) => i.sizes);
  assert.ok(tamanhos.includes('192x192') && tamanhos.includes('512x512'));
  assert.ok(manifest.icons.some((i) => i.purpose === 'maskable'));
  for (const icone of manifest.icons) assert.ok(existsSync(join(RAIZ, icone.src)), `ícone ${icone.src} não existe`);
});

test('toda chave de tradução usada no código existe em pt-BR', async () => {
  const { default: ptBR } = await import(pathToFileURL(join(RAIZ, 'js/i18n/pt-BR.js')));
  for (const arq of listar('js', (n) => n.endsWith('.js')).filter((a) => !a.startsWith('js/i18n/'))) {
    for (const [, chave] of ler(arq).matchAll(/\bt(?:Partes)?\('([\w.]+)'/g)) {
      assert.ok(chave in ptBR, `${arq} usa a chave '${chave}', que não existe em pt-BR.js`);
    }
  }
});

test('créditos ao autor aparecem no rodapé, no 404, no Sobre e no README', () => {
  for (const arq of ['index.html', '404.html', 'README.md']) {
    const texto = ler(arq);
    assert.match(texto, /Francisco Audir/, `${arq} sem o nome do autor`);
    assert.match(texto, /@filho\.af/, `${arq} sem o Instagram do autor`);
  }
  assert.match(ler('js/ui/screens/sobre.js'), /creditos\.autor/);
  assert.match(ler('LICENSE'), /MIT License/);
});

test('nenhum recurso obrigatório vem de CDN', () => {
  for (const arq of ['index.html', '404.html', ...listar('css'), ...listar('js', (n) => n.endsWith('.js'))]) {
    assert.doesNotMatch(ler(arq), /(src|href)=["']https?:\/\/(?!instagram\.com)|@import\s+url\(["']?https?:|from\s+['"]https?:/, `${arq} carrega algo de fora`);
  }
});
