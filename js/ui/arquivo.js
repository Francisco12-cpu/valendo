// Baixar e abrir arquivos no aparelho (sem servidor).

export function baixar(nome, conteudo, tipo = 'application/json') {
  const blob = conteudo instanceof Blob ? conteudo : new Blob([conteudo], { type: `${tipo};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Abre o seletor de arquivos e devolve [{ nome, texto }].
export function escolherArquivos({ aceitar = '', varios = false } = {}) {
  return new Promise((resolver) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = aceitar;
    input.multiple = varios;
    input.addEventListener('change', async () => {
      const arquivos = await Promise.all([...input.files].map(async (f) => ({ nome: f.name, texto: await f.text() })));
      resolver(arquivos);
    });
    input.click();
  });
}

// "Revisão: Citologia!" → "revisao-citologia"
export function nomeDeArquivo(titulo) {
  return (
    String(titulo || 'atividade')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'atividade'
  );
}
