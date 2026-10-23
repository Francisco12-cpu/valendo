// Montagem de equipes: aleatória, equilibrada (por nível) e ajustes manuais. Lógica pura.

// Fisher–Yates com gerador injetável (para testes).
export function embaralhar(lista, rng = Math.random) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

export function quantidadeDeEquipes(total, { quantidade, tamanho } = {}) {
  if (tamanho) return Math.max(1, Math.ceil(total / Math.max(1, tamanho)));
  return Math.max(1, Math.min(total || 1, quantidade || 2));
}

const nivelDe = (aluno) => (Number.isFinite(aluno.nivel) ? aluno.nivel : 2);
export const somaNiveis = (equipe) => equipe.reduce((s, a) => s + nivelDe(a), 0);

// alunos: [{ id, nome, nivel? }] → equipes: [[aluno, ...], ...]
export function dividir(alunos, { quantidade, tamanho, modo = 'aleatorio', rng = Math.random } = {}) {
  const n = quantidadeDeEquipes(alunos.length, { quantidade, tamanho });
  const equipes = Array.from({ length: n }, () => []);
  const misturados = embaralhar(alunos, rng);

  if (modo === 'equilibrado') {
    // Do mais forte para o mais fraco; cada um vai para a equipe com menor soma
    // (no empate, a com menos gente). Resultado: somas e tamanhos parecidos.
    const ordenados = misturados.sort((a, b) => nivelDe(b) - nivelDe(a));
    for (const aluno of ordenados) {
      let alvo = 0;
      for (let i = 1; i < n; i++) {
        const [si, sa] = [somaNiveis(equipes[i]), somaNiveis(equipes[alvo])];
        if (equipes[i].length < equipes[alvo].length || (equipes[i].length === equipes[alvo].length && si < sa)) alvo = i;
      }
      equipes[alvo].push(aluno);
    }
    return equipes;
  }

  misturados.forEach((aluno, i) => equipes[i % n].push(aluno));
  return equipes;
}

// Ajuste manual: move um aluno para outra equipe.
export function mover(equipes, alunoId, destino) {
  const aluno = equipes.flat().find((a) => a.id === alunoId);
  if (!aluno || destino < 0 || destino >= equipes.length) return equipes;
  return equipes.map((eq, i) => {
    const sem = eq.filter((a) => a.id !== alunoId);
    return i === destino ? [...sem, aluno] : sem;
  });
}

// "Ana\nBia;3\n  Caio  " → [{ id, nome, nivel }]. Um nome por linha
// (ou separados por vírgula, se tudo vier numa linha só). ";3" define o nível (1 a 3).
export function lerLista(texto) {
  const bruto = String(texto ?? '').trim();
  const linhas = bruto.includes('\n') ? bruto.split(/\r?\n/) : bruto.split(',');
  return linhas
    .map((linha) => linha.trim())
    .filter(Boolean)
    .map((linha, i) => {
      const [nome, nivel] = linha.split(';').map((p) => p.trim());
      const n = Number.parseInt(nivel, 10);
      return { id: `a${i + 1}`, nome: nome.slice(0, 40), nivel: n >= 1 && n <= 3 ? n : 2 };
    })
    .filter((a) => a.nome);
}
