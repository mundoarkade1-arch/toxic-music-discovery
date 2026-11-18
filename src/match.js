// Conferência: o vídeo achado é mesmo desta música deste artista?
// Dá pontos por sinais que dá para checar (título, artista/canal, duração) e tira pontos por sinais ruins (cover, remix, ao vivo...).
// Só vira "encontrada" quando título E artista conferem e a pontuação é alta. Na dúvida, vai para "conferir".
import { textoComparavel } from './normalize.js';
import { urlDoVideo } from './youtube.js';

export const LIMITE_ENCONTRADA = 70;
export const LIMITE_CONFERIR = 30;

const contem = (texto, trecho) => !!trecho && ` ${texto} `.includes(` ${trecho} `);
const PENALIDADE_FORTE = /\b(cover|remix|karaoke|instrumental|nightcore|slowed|sped up|reaction|tutorial|lesson|tribute|mashup|compilation|full album|greatest hits|best of|bass boosted|8d|live|ao vivo|acoustic|reverb)\b/;
const PENALIDADE_LEVE = /\b(lyrics?|letra|legendado|traducao|tradutor|sub espanol)\b/;
const OFICIAL = /\b(official|oficial)\b/;

/**
 * @param faixa { artista, titulo, duracao }  (duracao em segundos, pode ser 0)
 * @param cand  { id, titulo, canal, duracao }
 */
export function avaliar(faixa, cand) {
  const t = textoComparavel(faixa.titulo);
  const a = textoComparavel(faixa.artista);
  const v = textoComparavel(cand.titulo);
  const c = textoComparavel(cand.canal);
  const motivos = [];
  let pontos = 0;
  let tituloExato = false;
  let tituloParcial = false;
  let artistaOk = false;

  if (contem(v, t)) { pontos += 40; tituloExato = true; tituloParcial = true; motivos.push('o título confere'); }
  else {
    const palavras = t.split(' ').filter(Boolean);
    const noVideo = new Set(v.split(' '));
    const achadas = palavras.filter((p) => noVideo.has(p)).length;
    if (palavras.length && achadas / palavras.length >= 0.8) { pontos += 20; tituloParcial = true; motivos.push('o título confere em parte'); }
    else motivos.push('o título não confere');
  }

  if (contem(v, a) || contem(c, a)) { pontos += 25; artistaOk = true; motivos.push('o artista aparece no título ou no canal'); }
  else motivos.push('o artista não aparece');

  const colado = c.replace(/ /g, '');
  const alvo = a.replace(/ /g, '');
  if (alvo && [alvo, alvo + 'topic', alvo + 'vevo', alvo + 'official', alvo + 'music'].includes(colado)) { pontos += 15; motivos.push('canal oficial do artista'); }
  if (OFICIAL.test(v)) pontos += 5;

  if (cand.duracao && faixa.duracao) {
    const dif = Math.abs(cand.duracao - faixa.duracao);
    if (dif <= 8) { pontos += 20; motivos.push('a duração confere'); }
    else if (dif <= 20) { pontos += 10; motivos.push('a duração é parecida'); }
    else if (dif >= 60) { pontos -= 25; motivos.push('a duração é bem diferente'); }
  }
  if (cand.duracao > 720 && (faixa.duracao || 0) < 600) { pontos -= 40; motivos.push('vídeo muito longo (pode ser coletânea)'); }

  if (PENALIDADE_FORTE.test(v) && !PENALIDADE_FORTE.test(t)) { pontos -= 30; motivos.push('parece cover, remix ou ao vivo'); }
  if (PENALIDADE_LEVE.test(v) && !PENALIDADE_LEVE.test(t)) { pontos -= 10; motivos.push('parece vídeo de letra'); }

  return { pontos, tituloExato, tituloParcial, artistaOk, motivos };
}

/** Escolhe o melhor candidato. Quem tem o título certo vem antes. Empate: o que veio primeiro na pesquisa (mais relevante). */
export function escolher(faixa, candidatos) {
  const avaliados = candidatos.map((c, i) => ({ c, i, ...avaliar(faixa, c) }))
    .sort((x, y) => Number(y.tituloParcial) - Number(x.tituloParcial) || y.pontos - x.pontos || x.i - y.i);
  const lista = avaliados.slice(0, 3).map((x) => ({
    id: x.c.id, url: urlDoVideo(x.c.id), titulo: x.c.titulo, canal: x.c.canal,
    duracao: x.c.duracao || 0, pontuacao: x.pontos, motivos: x.motivos,
  }));
  const melhor = avaliados[0];
  let estado = 'sem_resultado';
  if (melhor) {
    if (melhor.pontos >= LIMITE_ENCONTRADA && melhor.tituloExato && melhor.artistaOk) estado = 'encontrada';
    else if (melhor.pontos >= LIMITE_CONFERIR && melhor.tituloParcial) estado = 'conferir';
  }
  return { estado, candidatos: lista };
}
