// Compara músicas com a biblioteca (dados/biblioteca.json), que vem de `ler-drive` (Google Drive) ou `ler-pasta` (pasta do PC).
// Serve para não pesquisar nem mostrar links de músicas que o usuário já tem.
import { join } from 'node:path';
import { stat } from 'node:fs/promises';
import { textoComparavel, codigoYoutubeDoNome } from './normalize.js';
import { lerJson } from './store.js';

const contem = (texto, trecho) => !!trecho && ` ${texto} `.includes(` ${trecho} `);

export function prepararBiblioteca(bib) {
  const porTitulo = new Map();
  const ids = new Set();
  for (const f of bib?.faixas ?? []) {
    const t = textoComparavel(f.t);
    if (t) {
      if (!porTitulo.has(t)) porTitulo.set(t, []);
      porTitulo.get(t).push({ a: textoComparavel(f.a), onde: textoComparavel(`${f.p ?? ''} ${f.fn ?? ''}`) });
    }
    const id = codigoYoutubeDoNome(f.fn);
    if (id) ids.add(id);
  }
  return { porTitulo, ids, total: (bib?.faixas ?? []).length, gerada: bib?.gerado ?? '' };
}

/** A música já está na biblioteca? Mesmo título e mesmo artista (ou o nome do artista aparece no arquivo/pasta). */
export function jaTenho(prep, artista, titulo) {
  if (!prep) return false;
  const t = textoComparavel(titulo);
  const a = textoComparavel(artista);
  return (prep.porTitulo.get(t) ?? []).some((f) =>
    f.a === a || contem(f.a, a) || (!!f.a && contem(a, f.a)) || contem(f.onde, a));
}

export const jaTenhoOVideo = (prep, videoId) => !!prep && prep.ids.has(videoId);

/** Lê dados/biblioteca.json. Só relê se o arquivo mudou. Devolve null se não existir. */
export function criarLeitorDeBiblioteca(dados) {
  const arq = join(dados, 'biblioteca.json');
  let memo = { mtime: -1, prep: null };
  return async function biblioteca() {
    let mtime;
    try { mtime = (await stat(arq)).mtimeMs; } catch { return null; }
    if (mtime !== memo.mtime) memo = { mtime, prep: prepararBiblioteca(await lerJson(arq, null)) };
    return memo.prep;
  };
}
