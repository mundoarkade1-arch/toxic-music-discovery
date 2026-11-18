// Limpa a lista de músicas populares: tira versões ao vivo/remix/karaokê e músicas repetidas (ex.: "Remastered").
import { textoComparavel } from './normalize.js';

const VARIANTE = /\b(live|ao vivo|remix|rmx|karaoke|karaok[eê]|instrumental|acoustic|ac[uú]stic[oa]|demo|cover|tribute|nightcore|sped up|slowed|8d|mashup|bootleg|rework|reprise)\b/i;
const MESMA_MUSICA = /\b(remaster(ed)?|mono|stereo|radio edit|single version|album version|edit|deluxe|bonus track|explicit|clean)\b/i;

/** O que vem entre ( ) [ ] ou depois de " - ". "Live Forever" não conta; "Numb - Live in Texas" conta. */
function extras(titulo) {
  const partes = [];
  for (const m of String(titulo).matchAll(/[([]([^)\]]*)[)\]]/g)) partes.push(m[1]);
  const i = String(titulo).indexOf(' - ');
  if (i >= 0) partes.push(String(titulo).slice(i + 3));
  return partes;
}

export function ehVariante(titulo) {
  return extras(titulo).some((e) => VARIANTE.test(e));
}

/** Título limpo para exibir e pesquisar: tira "(Remastered 2011)", "- Radio Edit" etc. */
export function tituloLimpo(titulo) {
  let t = String(titulo ?? '');
  t = t.replace(/[([][^)\]]*[)\]]/g, (g) => (MESMA_MUSICA.test(g) ? ' ' : g));
  const i = t.indexOf(' - ');
  if (i >= 0 && MESMA_MUSICA.test(t.slice(i + 3))) t = t.slice(0, i);
  return t.replace(/\s+/g, ' ').trim();
}

/**
 * @param brutas faixas do Deezer na ordem de popularidade: { titulo, tituloCompleto, album, duracao }
 * @returns faixas limpas, sem repetidas, na mesma ordem
 */
export function limparFaixas(brutas, { incluirAoVivo = false } = {}) {
  const vistas = new Set();
  const saida = [];
  for (const b of brutas) {
    const completo = b.tituloCompleto ?? b.titulo;
    if (!incluirAoVivo && ehVariante(completo)) continue;
    const titulo = tituloLimpo(b.titulo || completo);
    const k = textoComparavel(titulo);
    if (!k || vistas.has(k)) continue;
    vistas.add(k);
    saida.push({ titulo, album: b.album ?? '', duracao: Number(b.duracao) || 0 });
  }
  return saida;
}
