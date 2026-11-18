// Ajudantes dos testes (não é um teste). Deezer e YouTube de mentira: nada sai para a internet.
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Cache } from '../src/cache.js';
import { Deezer } from '../src/deezer.js';
import { YouTube } from '../src/youtube.js';
import { Descobridor } from '../src/discover.js';
import { PADROES } from '../src/config.js';

export const resposta = (corpo, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => corpo });
export const semEspera = async () => {};
export const pastaTemp = () => mkdtemp(join(tmpdir(), 'tmd-'));
export const idDe = (i) => 'VID' + String(i).padStart(8, '0');

const ERRO_COTA = { error: { code: 403, message: 'quota', errors: [{ reason: 'quotaExceeded' }] } };

export const FAIXAS = [
  { titulo: 'Numb', album: 'Meteora', duracao: 185 },
  { titulo: 'In the End', album: 'Hybrid Theory', duracao: 216 },
  { titulo: 'Crawling', album: 'Hybrid Theory', duracao: 209 },
  { titulo: 'Faint', album: 'Meteora', duracao: 162 },
  { titulo: 'What I\'ve Done', album: 'Minutes to Midnight', duracao: 205 },
  { titulo: 'Somewhere I Belong', album: 'Meteora', duracao: 213 },
];

/**
 * Deezer + YouTube de mentira. Para cada música, a busca devolve o vídeo certo e um "cover" de isca.
 * opções: cotaApos (depois de N buscas o YouTube diz que a cota acabou), erro503 (toda busca dá 503), chaveRuim.
 */
export function mundoFalso({ artista = 'Linkin Park', faixas = FAIXAS, cotaApos = Infinity, erro503 = false, chaveRuim = false } = {}) {
  const chamadas = { busca: 0, detalhes: 0, deezerBusca: 0, deezerTop: 0 };
  const videos = new Map();
  faixas.forEach((f, i) => {
    videos.set(idDe(i), { titulo: `${artista} - ${f.titulo} (Official Video)`, canal: artista, duracao: f.duracao + 4 });
    videos.set('COV' + String(i).padStart(8, '0'), { titulo: `${f.titulo} (Cover by Joe)`, canal: 'Joe Covers', duracao: f.duracao + 30 });
  });
  const iso = (s) => `PT${Math.floor(s / 60)}M${s % 60}S`;

  const fetchFn = async (url) => {
    const u = new URL(url);
    if (u.host === 'api.deezer.com') {
      if (u.pathname === '/search/artist') { chamadas.deezerBusca++; return resposta({ data: [{ id: 7, name: artista, nb_fan: 1000 }] }); }
      if (u.pathname === '/artist/7/top') {
        chamadas.deezerTop++;
        return resposta({ data: faixas.map((f) => ({ title: f.titulo, title_short: f.titulo, duration: f.duracao, album: { title: f.album } })) });
      }
    }
    if (u.host === 'www.googleapis.com') {
      if (chaveRuim) return resposta({ error: { code: 400, message: 'API key not valid. Please pass a valid API key.', errors: [{ reason: 'badRequest' }] } }, 400);
      if (u.pathname.endsWith('/search')) {
        if (erro503) return resposta({}, 503);
        if (chamadas.busca >= cotaApos) return resposta(ERRO_COTA, 403);
        chamadas.busca++;
        const q = u.searchParams.get('q').toLowerCase();
        const i = faixas.findIndex((f) => q.includes(f.titulo.toLowerCase()));
        if (i < 0) return resposta({ items: [] });
        const ids = [idDe(i), 'COV' + String(i).padStart(8, '0')];
        return resposta({ items: ids.map((id) => ({ id: { videoId: id }, snippet: { title: videos.get(id).titulo, channelTitle: videos.get(id).canal } })) });
      }
      if (u.pathname.endsWith('/videos')) {
        chamadas.detalhes++;
        const ids = u.searchParams.get('id').split(',');
        return resposta({ items: ids.filter((id) => videos.has(id)).map((id) => ({ id, contentDetails: { duration: iso(videos.get(id).duracao) } })) });
      }
    }
    return resposta({}, 404);
  };
  return { fetchFn, chamadas, videos };
}

/** Monta um Descobridor completo com o mundo falso e uma pasta de dados nova. */
export async function montarTudo({ mundo = mundoFalso(), config = {}, biblioteca = async () => null, agora } = {}) {
  const dados = await pastaTemp();
  const cache = await new Cache(dados, agora ? { agora } : {}).carregar();
  const cfg = { ...PADROES, ...config };
  const deezer = new Deezer({ fetchFn: mundo.fetchFn, esperar: semEspera });
  const youtube = new YouTube({ chave: 'CHAVE-SECRETA-123', fetchFn: mundo.fetchFn, esperar: semEspera, tentativas: 2 });
  const descobridor = new Descobridor({ deezer, youtube, cache, config: cfg, biblioteca });
  return { dados, cache, deezer, youtube, descobridor, mundo, config: cfg };
}
