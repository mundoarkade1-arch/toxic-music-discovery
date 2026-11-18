// Deezer: fonte das músicas mais populares de cada artista. API pública, sem chave e sem custo.
// Só duas chamadas: achar o artista e pegar as músicas mais tocadas dele.
import { normalizarArtista } from './normalize.js';

const API = 'https://api.deezer.com';
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

export class ErroDeezer extends Error {}

export class Deezer {
  constructor({ fetchFn = fetch, esperar = dormir, tentativas = 3 } = {}) {
    this.fetch = fetchFn; this.esperar = esperar; this.tentativas = tentativas;
  }

  async _get(caminho, params = {}) {
    const url = `${API}${caminho}?${new URLSearchParams(params)}`;
    for (let i = 1; ; i++) {
      let r;
      try {
        r = await this.fetch(url, { signal: AbortSignal.timeout(15_000) });
      } catch {
        if (i < this.tentativas) { await this.esperar(2000 * i); continue; }
        throw new ErroDeezer('Não consegui falar com o Deezer. Confira a internet e tente de novo.');
      }
      let j = null;
      try { j = await r.json(); } catch { /* sem JSON */ }
      // O Deezer responde 200 com {"error":{"code":4}} quando passa do limite de pedidos por segundo.
      const limite = j?.error?.code === 4 || r.status === 429;
      if ((limite || r.status >= 500) && i < this.tentativas) { await this.esperar(3000 * i); continue; }
      if (!r.ok || j?.error) throw new ErroDeezer(`O Deezer recusou o pedido (${String(j?.error?.message ?? r.status).slice(0, 80)}).`);
      return j;
    }
  }

  /** Acha o artista. Entre nomes iguais ao digitado, escolhe o com mais fãs. Sem nome igual, pega o 1º e marca exato:false. */
  async buscarArtista(nome) {
    const digitado = String(nome ?? '').trim();
    if (!digitado) throw new ErroDeezer('Digite o nome de um artista.');
    const j = await this._get('/search/artist', { q: digitado, limit: '10' });
    const lista = (j.data ?? []).filter((a) => a?.id && a?.name);
    if (!lista.length) throw new ErroDeezer(`Não achei "${digitado}" no Deezer. Confira o nome.`);
    const alvo = normalizarArtista(digitado);
    const iguais = lista.filter((a) => normalizarArtista(a.name) === alvo).sort((x, y) => (y.nb_fan ?? 0) - (x.nb_fan ?? 0));
    const escolhido = iguais[0] ?? lista[0];
    return { id: escolhido.id, nome: escolhido.name, fas: escolhido.nb_fan ?? 0, exato: iguais.length > 0 };
  }

  /** As músicas mais populares, da mais para a menos tocada. */
  async topFaixas(artistaId, limite = 100) {
    const j = await this._get(`/artist/${encodeURIComponent(artistaId)}/top`, { limit: String(limite) });
    return (j.data ?? []).filter((t) => t?.title).map((t) => ({
      titulo: t.title_short || t.title,
      tituloCompleto: t.title,
      album: t.album?.title ?? '',
      duracao: Number(t.duration) || 0,
    }));
  }
}
