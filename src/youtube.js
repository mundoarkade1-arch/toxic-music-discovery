// YouTube Data API v3. Custo da cota (por dia, o Google dá 10.000 unidades):
//   pesquisar (search.list) = 100 unidades  ->  cerca de 100 pesquisas por dia
//   detalhes  (videos.list) = 1 unidade     ->  usado para conferir a duração do vídeo
// A chave NUNCA aparece em mensagens de erro.
const API = 'https://www.googleapis.com/youtube/v3';
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

export const CUSTO = { busca: 100, detalhes: 1 };
export const CUSTO_POR_MUSICA = CUSTO.busca + CUSTO.detalhes;

/** codigo: 'cota' (acabou a cota do dia) | 'chave' (chave inválida ou API desligada) | 'rede' | 'outro' */
export class ErroYoutube extends Error {
  constructor(mensagem, codigo = 'outro') { super(mensagem); this.codigo = codigo; }
}

const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
export function decodificar(t) {
  return String(t ?? '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTIDADES[e.toLowerCase()] ?? m;
  });
}

/** "PT3M45S" -> 225 */
export function duracaoEmSegundos(iso) {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(String(iso ?? ''));
  if (!m) return 0;
  const [, d = 0, h = 0, min = 0, s = 0] = m;
  return Number(d) * 86400 + Number(h) * 3600 + Number(min) * 60 + Number(s);
}

export class YouTube {
  constructor({ chave, fetchFn = fetch, esperar = dormir, tentativas = 3 }) {
    this.chave = chave; this.fetch = fetchFn; this.esperar = esperar; this.tentativas = tentativas;
  }

  _sem_segredo(texto) {
    return this.chave ? String(texto).split(this.chave).join('***') : String(texto);
  }

  async _get(rota, params) {
    if (!this.chave) throw new ErroYoutube('Falta a chave do YouTube. Veja docs/YOUTUBE_SETUP.md.', 'chave');
    const url = `${API}/${rota}?${new URLSearchParams({ ...params, key: this.chave })}`;
    for (let i = 1; ; i++) {
      let r;
      try {
        r = await this.fetch(url, { signal: AbortSignal.timeout(20_000) });
      } catch {
        if (i < this.tentativas) { await this.esperar(2000 * i); continue; }
        throw new ErroYoutube('Não consegui falar com o YouTube. Confira a internet.', 'rede');
      }
      let j = null;
      try { j = await r.json(); } catch { /* sem JSON */ }
      if (r.ok && j) return j;

      const motivo = j?.error?.errors?.[0]?.reason ?? '';
      const msg = this._sem_segredo(j?.error?.message ?? '');
      if (motivo === 'quotaExceeded' || motivo === 'dailyLimitExceeded') {
        throw new ErroYoutube('A cota de pesquisas do YouTube de hoje acabou. O que já foi achado está salvo. Continue amanhã.', 'cota');
      }
      if ((motivo === 'rateLimitExceeded' || motivo === 'userRateLimitExceeded' || r.status >= 500) && i < this.tentativas) {
        await this.esperar(2000 * i); continue;
      }
      if (motivo === 'keyInvalid' || /api key not valid/i.test(msg) || (r.status === 400 && /key/i.test(msg))) {
        throw new ErroYoutube('O YouTube não aceitou a chave. Confira o arquivo dados/youtube-chave.txt.', 'chave');
      }
      if (motivo === 'accessNotConfigured' || motivo === 'forbidden' || r.status === 403) {
        throw new ErroYoutube('O YouTube negou o acesso. Confira se a "YouTube Data API v3" está ativada no seu projeto do Google Cloud e se a chave pode usá-la.', 'chave');
      }
      throw new ErroYoutube(`O YouTube respondeu com erro ${r.status}.`, 'outro');
    }
  }

  /** Pesquisa vídeos. Custa 100 unidades. Devolve até `max` resultados, na ordem de relevância. */
  async buscar(consulta, max = 5) {
    const j = await this._get('search', { part: 'snippet', type: 'video', maxResults: String(max), q: consulta });
    return (j.items ?? []).filter((i) => i?.id?.videoId).map((i) => ({
      id: i.id.videoId,
      titulo: decodificar(i.snippet?.title),
      canal: decodificar(i.snippet?.channelTitle),
    }));
  }

  /** Duração dos vídeos. Custa 1 unidade para até 50 vídeos. Devolve Map id -> segundos. */
  async detalhes(ids) {
    const mapa = new Map();
    if (!ids.length) return mapa;
    const j = await this._get('videos', { part: 'contentDetails', id: ids.slice(0, 50).join(',') });
    for (const v of j.items ?? []) mapa.set(v.id, duracaoEmSegundos(v.contentDetails?.duration));
    return mapa;
  }
}

export const urlDoVideo = (id) => `https://www.youtube.com/watch?v=${id}`;
