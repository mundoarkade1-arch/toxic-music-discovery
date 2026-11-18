// O coração do programa: descobre as músicas populares, pesquisa o vídeo de cada uma (só o que falta) e monta o resultado.
// Regra de ouro: nunca pesquisar duas vezes a mesma música, nem música que já está na biblioteca.
import { chave } from './normalize.js';
import { limparFaixas } from './faixas.js';
import { escolher } from './match.js';
import { CUSTO, CUSTO_POR_MUSICA, ErroYoutube } from './youtube.js';
import { ErroDeezer } from './deezer.js';
import { nomeParaArquivo } from './cache.js';
import { jaTenho, jaTenhoOVideo } from './comparar.js';

export class Descobridor {
  /** @param {{ deezer, youtube, cache, config, biblioteca?: () => Promise<object|null> }} o */
  constructor({ deezer, youtube, cache, config, biblioteca = async () => null }) {
    this.deezer = deezer; this.youtube = youtube; this.cache = cache; this.cfg = config; this.biblioteca = biblioteca;
  }

  /** Quantas pesquisas ainda cabem na cota de hoje. */
  restantes() {
    return Math.max(0, Math.floor((this.cfg.limiteUnidadesPorDia - this.cache.unidadesHoje()) / CUSTO_POR_MUSICA));
  }

  /** Acha o artista e a lista das músicas mais populares (reaproveita a lista salva, se for recente). */
  async preparar(nomeDigitado) {
    const achado = await this.deezer.buscarArtista(nomeDigitado);
    const slug = nomeParaArquivo(achado.nome);
    let reg = this.cache.artista(slug);
    const fresca = this.cache.listaEstaFresca(reg, this.cfg.validadeListaDias) && reg.incluirAoVivo === this.cfg.incluirAoVivo;
    if (!fresca) {
      const brutas = await this.deezer.topFaixas(achado.id, 100);
      const faixas = limparFaixas(brutas, { incluirAoVivo: this.cfg.incluirAoVivo })
        .map((f, i) => ({ ...f, ordem: i + 1, chave: chave(achado.nome, f.titulo) }));
      if (!faixas.length) throw new ErroDeezer(`O Deezer não tem músicas populares de "${achado.nome}".`);
      await this.cache.gravarArtista(slug, { nome: achado.nome, deezerId: achado.id, incluirAoVivo: this.cfg.incluirAoVivo, faixas });
      reg = this.cache.artista(slug);
    }
    return { slug, nome: reg.nome, exato: achado.exato, faixas: reg.faixas };
  }

  /** Pesquisa UMA música no YouTube (gasta 101 unidades), confere e grava no cache. */
  async pesquisarUma(artistaNome, faixa) {
    const consulta = `${artistaNome} ${faixa.titulo} official`;
    const itens = await this.youtube.buscar(consulta, 5);
    await this.cache.gastar(CUSTO.busca);
    let duracoes = new Map();
    let erroDetalhes = null;
    if (itens.length) {
      try {
        duracoes = await this.youtube.detalhes(itens.map((i) => i.id));
        await this.cache.gastar(CUSTO.detalhes);
      } catch (e) { erroDetalhes = e; }
    }
    const candidatos = itens.map((i) => ({ ...i, duracao: duracoes.get(i.id) ?? 0 }));
    const { estado, candidatos: lista } = escolher({ artista: artistaNome, titulo: faixa.titulo, duracao: faixa.duracao }, candidatos);
    await this.cache.gravarPesquisa(faixa.chave, { estado, candidatos: lista, consulta });
    // Os 100 já gastos ficam salvos mesmo se a conferência de duração falhou por cota/chave.
    if (erroDetalhes instanceof ErroYoutube && (erroDetalhes.codigo === 'cota' || erroDetalhes.codigo === 'chave')) throw erroDetalhes;
  }

  /**
   * Faz a pesquisa de um artista. Só gasta cota com o que ainda não tem resposta guardada.
   * @returns {{ slug, nome, total, pesquisadas, jaSalvas, naBiblioteca, parou: ''|'usuario'|'cota_local'|'cota_youtube'|'erros', erro?: string }}
   */
  async rodar({ artista, limite }, { aoProgredir = () => {}, deveParar = () => false } = {}) {
    aoProgredir({ etapa: 'artista', mensagem: 'Procurando o artista no Deezer...' });
    const prep = await this.preparar(artista);
    const faixas = prep.faixas.slice(0, limite ?? this.cfg.limiteMusicas);
    const lib = this.cfg.usarBiblioteca ? await this.biblioteca() : null;

    let naBiblioteca = 0; let jaSalvas = 0;
    const aPesquisar = [];
    for (const f of faixas) {
      if (lib && jaTenho(lib, prep.nome, f.titulo)) naBiblioteca++;
      else if (this.cache.pesquisa(f.chave)) jaSalvas++;
      else aPesquisar.push(f);
    }

    const resumo = { slug: prep.slug, nome: prep.nome, exato: prep.exato, total: faixas.length, pesquisadas: 0, jaSalvas, naBiblioteca, parou: '' };
    aoProgredir({ etapa: 'pesquisa', total: aPesquisar.length, feitas: 0, mensagem: `${faixas.length} músicas na lista. Faltam pesquisar ${aPesquisar.length}.` });

    let errosSeguidos = 0;
    for (const f of aPesquisar) {
      if (deveParar()) { resumo.parou = 'usuario'; break; }
      if (this.restantes() < 1) { resumo.parou = 'cota_local'; break; }
      aoProgredir({ etapa: 'pesquisa', total: aPesquisar.length, feitas: resumo.pesquisadas, mensagem: `Pesquisando: ${f.titulo}` });
      try {
        await this.pesquisarUma(prep.nome, f);
        resumo.pesquisadas++;
        errosSeguidos = 0;
      } catch (e) {
        if (e instanceof ErroYoutube && e.codigo === 'cota') { await this.cache.esgotarHoje(this.cfg.limiteUnidadesPorDia); resumo.parou = 'cota_youtube'; resumo.erro = e.message; break; }
        if (e instanceof ErroYoutube && e.codigo === 'chave') throw e;
        if (++errosSeguidos >= 3) { resumo.parou = 'erros'; resumo.erro = e.message; break; }
      }
    }
    aoProgredir({ etapa: 'fim', total: aPesquisar.length, feitas: resumo.pesquisadas, mensagem: '' });
    return resumo;
  }

  /** Monta o resultado a partir do que está salvo. Não gasta cota. */
  async resultado(slug, limite) {
    const reg = this.cache.artista(slug);
    if (!reg) return null;
    const lib = this.cfg.usarBiblioteca ? await this.biblioteca() : null;
    const faixas = reg.faixas.slice(0, limite ?? this.cfg.limiteMusicas);

    const itens = faixas.map((f) => {
      const p = this.cache.pesquisa(f.chave);
      const item = { ordem: f.ordem, titulo: f.titulo, album: f.album, chave: f.chave, estado: 'pendente', candidatos: p?.candidatos ?? [] };
      if (p?.manual?.acao === 'descartada') item.estado = 'descartada';
      else if (lib && jaTenho(lib, reg.nome, f.titulo)) item.estado = 'na_biblioteca';
      else if (p) {
        item.estado = p.estado === 'encontrada' || p.estado === 'conferir' || p.estado === 'sem_resultado' ? p.estado : 'pendente';
        if (p.manual?.acao === 'aprovada') {
          const v = item.candidatos.find((c) => c.id === p.manual.videoId);
          if (v) { item.estado = 'encontrada'; item.video = v; item.manual = true; }
        } else if (item.estado === 'encontrada') item.video = item.candidatos[0];
      }
      return item;
    });

    // Um vídeo só pode servir a uma música. Aprovações manuais têm prioridade; depois, a mais popular.
    const usados = new Set();
    const ordemDeClaim = [...itens].sort((x, y) => (y.manual ? 1 : 0) - (x.manual ? 1 : 0) || x.ordem - y.ordem);
    for (const it of ordemDeClaim) {
      if (it.estado !== 'encontrada') continue;
      if (jaTenhoOVideo(lib, it.video.id)) { it.estado = 'na_biblioteca'; delete it.video; }
      else if (usados.has(it.video.id)) { it.estado = 'conferir'; it.aviso = 'Este vídeo já foi escolhido para outra música.'; delete it.video; }
      else usados.add(it.video.id);
    }

    const totais = { encontrada: 0, conferir: 0, sem_resultado: 0, na_biblioteca: 0, pendente: 0, descartada: 0 };
    for (const it of itens) totais[it.estado]++;
    return {
      artista: { nome: reg.nome, slug },
      limite: faixas.length,
      totais,
      faixas: itens,
      urls: itens.filter((i) => i.estado === 'encontrada').map((i) => i.video.url),
      biblioteca: lib ? { faixas: lib.total, gerada: lib.gerada } : null,
    };
  }

  /** Decisão manual do usuário sobre uma música: 'aprovar' (com o id do vídeo), 'descartar' ou 'limpar'. */
  async decidir(slug, chaveMusica, acao, videoId) {
    const reg = this.cache.artista(slug);
    const p = this.cache.pesquisa(chaveMusica);
    if (!reg || !p || !reg.faixas.some((f) => f.chave === chaveMusica)) throw new Error('Não achei essa música no histórico.');
    const { manual, ...resto } = p;
    if (acao === 'aprovar') {
      if (!p.candidatos?.some((c) => c.id === videoId)) throw new Error('Esse vídeo não está entre os candidatos desta música.');
      await this.cache.gravarPesquisa(chaveMusica, { ...resto, manual: { acao: 'aprovada', videoId } });
    } else if (acao === 'descartar') {
      await this.cache.gravarPesquisa(chaveMusica, { ...resto, manual: { acao: 'descartada' } });
    } else if (acao === 'limpar') {
      await this.cache.gravarPesquisa(chaveMusica, resto);
    } else throw new Error('Ação desconhecida.');
  }

  /** Artistas já pesquisados (para reabrir sem gastar cota). */
  historico() {
    return Object.entries(this.cache.artistas)
      .map(([slug, r]) => ({ slug, nome: r.nome, quando: r.quando }))
      .sort((a, b) => String(b.quando).localeCompare(String(a.quando)));
  }
}
