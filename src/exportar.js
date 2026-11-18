// Exportação TXT: SÓ links, um por linha. Sem título, número, comentário ou linha em branco.
import { join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';

export function textoTxt(urls) {
  const unicas = [...new Set(urls)];
  return unicas.length ? unicas.join('\n') + '\n' : '';
}

/** Grava saida/<artista>.txt e devolve o caminho. */
export async function gravarTxt(pastaSaida, slug, urls) {
  await mkdir(pastaSaida, { recursive: true });
  const caminho = join(pastaSaida, `${slug}.txt`);
  await writeFile(caminho, textoTxt(urls), 'utf8');
  return caminho;
}
