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
const PARENTESES = /[([][^)\]]*[)\]]/g; // "(La Notte)", "[Remastered]"...
const AO_VIVO = /\b(ao vivo|live)\b/g;
// "Linkin Park feat. Jay-Z - Música": o "feat." no meio do título do vídeo não pode cortar o resto do título.
const semFeat = (texto) => String(texto ?? '').replace(/\s(feat|ft)\.?\s/gi, ' ');
const PREFIXO_ARTISTA = /^(mc|dj) /; // "MC Ryan SP" aparece nos vídeos só como "Ryan SP"

/**
 * @param faixa { artista, titulo, duracao }  (duracao em segundos, pode ser 0)
 * @param cand  { id, titulo, canal, duracao }
 */
export function avaliar(faixa, cand) {
  const t = textoComparavel(faixa.titulo);
  // O mesmo título sem o que vem entre parênteses. Ex.: "Desejo Imortal (It Must Have Been Love)" -> "desejo imortal".
  // O YouTube quase nunca traz esse nome extra. Só vale se sobrar um nome com pelo menos 4 letras.
  const tBase = textoComparavel(String(faixa.titulo ?? '').replace(PARENTESES, ' '));
  const temBase = tBase.length >= 4 && tBase !== t;
  const a = textoComparavel(faixa.artista);
  const aBase = a.replace(PREFIXO_ARTISTA, '').trim();
  const temABase = aBase.length >= 4 && aBase !== a;
  const artistaAparece = (texto) => contem(texto, a) || (temABase && contem(texto, aBase));
  const v = textoComparavel(semFeat(cand.titulo));
  const c = textoComparavel(semFeat(cand.canal));
  const motivos = [];
  let pontos = 0;
  let tituloExato = false;
  let tituloParcial = false;
  let artistaOk = false;

  if (contem(v, t) || (temBase && contem(v, tBase))) { pontos += 40; tituloExato = true; tituloParcial = true; motivos.push('o título confere'); }
  else {
    const parte = (tt) => {
      const palavras = tt.split(' ').filter(Boolean);
      const noVideo = new Set(v.split(' '));
      return palavras.length ? palavras.filter((p) => noVideo.has(p)).length / palavras.length : 0;
    };
    const melhorParte = Math.max(parte(t), temBase ? parte(tBase) : 0);
    if (melhorParte >= 0.8) { pontos += 20; tituloParcial = true; motivos.push('o título confere em parte'); }
    else motivos.push('o título não confere');
  }

  if (artistaAparece(v) || artistaAparece(c)) { pontos += 25; artistaOk = true; motivos.push('o artista aparece no título ou no canal'); }
  else motivos.push('o artista não aparece');

  const colado = c.replace(/ /g, '');
  const alvo = a.replace(/ /g, '');
  if (alvo && [alvo, alvo + 'topic', alvo + 'vevo', alvo + 'official', alvo + 'music'].includes(colado)) { pontos += 15; motivos.push('canal oficial do artista'); }
  if (OFICIAL.test(v)) pontos += 5;

  let duracaoConfere = false;
  if (cand.duracao && faixa.duracao) {
    const dif = Math.abs(cand.duracao - faixa.duracao);
    if (dif <= 8) { duracaoConfere = true; pontos += 20; motivos.push('a duração confere'); }
    else if (dif <= 20) { pontos += 10; motivos.push('a duração é parecida'); }
    else if (dif >= 60) { pontos -= 25; motivos.push('a duração é bem diferente'); }
  }
  if (cand.duracao > 720 && (faixa.duracao || 0) < 600) { pontos -= 40; motivos.push('vídeo muito longo (pode ser coletânea)'); }

  // Na música sertaneja, quase tudo é gravado ao vivo e o Deezer nem sempre põe "(Ao Vivo)" no título.
  // Se a duração é a mesma da música (diferença de até 8 segundos), "ao vivo" no vídeo não tira pontos.
  const paraPenalidade = duracaoConfere ? v.replace(AO_VIVO, ' ') : v;
  if (PENALIDADE_FORTE.test(paraPenalidade) && !PENALIDADE_FORTE.test(t)) { pontos -= 30; motivos.push('parece cover, remix ou ao vivo'); }
  else if (duracaoConfere && paraPenalidade !== v && !PENALIDADE_FORTE.test(t)) motivos.push('é ao vivo, mas a duração é a mesma da música');
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
