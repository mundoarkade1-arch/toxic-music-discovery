// Memória do programa: resultados de pesquisas, listas de músicas e cota usada hoje.
// Tudo é gravado na hora (gravação segura), então se o PC desligar no meio nenhuma pesquisa paga é perdida.
import { join } from 'node:path';
import { lerJson, gravarJson } from './store.js';

/** A cota do YouTube zera à meia-noite do horário do Pacífico (Califórnia). */
export function diaDaCota(agora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);
}

export const nomeParaArquivo = (nome) =>
  String(nome ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/&/g, ' e ').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'artista';

export class Cache {
  constructor(dados, { agora = () => new Date() } = {}) {
    this.dados = dados; this.agora = agora;
    this.arq = {
      pesquisas: join(dados, 'cache', 'pesquisas.json'),
      artistas: join(dados, 'cache', 'artistas.json'),
      cota: join(dados, 'cache', 'cota.json'),
    };
    this.pesquisas = {}; this.artistas = {}; this.cota = { dia: '', unidades: 0 };
  }

  async carregar() {
    this.pesquisas = await lerJson(this.arq.pesquisas, {});
    this.artistas = await lerJson(this.arq.artistas, {});
    this.cota = await lerJson(this.arq.cota, { dia: '', unidades: 0 });
    return this;
  }

  // ---- pesquisas por música (chave "artista|título") ----
  pesquisa(chave) { return this.pesquisas[chave] ?? null; }
  async gravarPesquisa(chave, dados) {
    this.pesquisas[chave] = { ...dados, quando: this.agora().toISOString() };
    await gravarJson(this.arq.pesquisas, this.pesquisas);
  }

  // ---- lista de músicas por artista ----
  artista(slug) { return this.artistas[slug] ?? null; }
  async gravarArtista(slug, dados) {
    this.artistas[slug] = { ...dados, quando: this.agora().toISOString() };
    await gravarJson(this.arq.artistas, this.artistas);
  }
  listaEstaFresca(registro, dias) {
    return !!registro && this.agora().getTime() - new Date(registro.quando).getTime() < dias * 86_400_000;
  }

  // ---- cota do dia ----
  unidadesHoje() {
    return this.cota.dia === diaDaCota(this.agora()) ? this.cota.unidades : 0;
  }
  async gastar(unidades) {
    const hoje = diaDaCota(this.agora());
    this.cota = { dia: hoje, unidades: (this.cota.dia === hoje ? this.cota.unidades : 0) + unidades };
    await gravarJson(this.arq.cota, this.cota);
  }
  /** Quando o Google avisa que a cota acabou, marca tudo como gasto hoje. */
  async esgotarHoje(limite) {
    this.cota = { dia: diaDaCota(this.agora()), unidades: Math.max(this.unidadesHoje(), limite) };
    await gravarJson(this.arq.cota, this.cota);
  }
}
