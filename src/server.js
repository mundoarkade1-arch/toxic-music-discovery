// Servidor LOCAL: só responde neste computador (127.0.0.1). Serve a página e uma pequena API.
// Proteções: só aceita pedidos do próprio endereço (evita que outro site abra o servidor às escondidas e gaste a cota).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { CUSTO_POR_MUSICA } from './youtube.js';
import { gravarTxt, textoTxt } from './exportar.js';
import { testarConexoes } from './diagnostico.js';

const WEB = fileURLToPath(new URL('../web/', import.meta.url));
const ESTATICOS = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/estilo.css': ['estilo.css', 'text/css; charset=utf-8'],
};

const json = (res, status, obj) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
};

async function lerCorpo(req) {
  let tamanho = 0; const partes = [];
  for await (const p of req) {
    tamanho += p.length;
    if (tamanho > 20_000) throw Object.assign(new Error('Pedido grande demais.'), { status: 413 });
    partes.push(p);
  }
  try { return JSON.parse(Buffer.concat(partes).toString('utf8') || '{}'); }
  catch { throw Object.assign(new Error('Pedido ilegível.'), { status: 400 }); }
}

/**
 * @param {{ descobridor, cache, config, saida: string, temChave: () => boolean, youtube, deezer }} app
 */
export function criarServidor(app) {
  const { descobridor, cache, config } = app;
  const job = { rodando: false, artista: '', etapa: '', total: 0, feitas: 0, mensagem: '', resumo: null, erro: '' };
  let parar = false;
  let porta = 0;

  const origensOk = () => [`http://127.0.0.1:${porta}`, `http://localhost:${porta}`];

  async function estado() {
    const lib = await descobridor.biblioteca().catch(() => null);
    return {
      chaveYoutube: app.temChave(),
      biblioteca: lib ? { faixas: lib.total, gerada: lib.gerada } : null,
      usarBiblioteca: config.usarBiblioteca,
      limiteMusicas: config.limiteMusicas,
      cota: {
        pesquisasRestantes: descobridor.restantes(),
        pesquisasPorDia: Math.floor(config.limiteUnidadesPorDia / CUSTO_POR_MUSICA),
      },
      job: { ...job },
      historico: descobridor.historico(),
    };
  }

  function iniciarPesquisa(artista, limite) {
    Object.assign(job, { rodando: true, artista, etapa: 'artista', total: 0, feitas: 0, mensagem: 'Começando...', resumo: null, erro: '' });
    parar = false;
    descobridor.rodar({ artista, limite }, {
      aoProgredir: (p) => Object.assign(job, p),
      deveParar: () => parar,
    }).then((r) => { job.resumo = r; })
      .catch((e) => { job.erro = e?.message ?? 'Erro inesperado.'; })
      .finally(() => { job.rodando = false; job.etapa = 'fim'; });
  }

  async function tratar(req, res) {
    const host = req.headers.host ?? '';
    if (!origensOk().some((o) => o === `http://${host}`)) return json(res, 403, { erro: 'Endereço não permitido.' });
    const url = new URL(req.url, `http://${host}`);
    const caminho = url.pathname;

    if (req.method === 'GET' && ESTATICOS[caminho]) {
      const [arq, tipo] = ESTATICOS[caminho];
      res.writeHead(200, { 'Content-Type': tipo, 'Cache-Control': 'no-store' });
      return res.end(await readFile(WEB + arq));
    }

    if (req.method === 'GET' && caminho === '/api/estado') return json(res, 200, await estado());

    if (req.method === 'GET' && caminho === '/api/resultado') {
      const r = await descobridor.resultado(url.searchParams.get('artista') ?? '');
      return r ? json(res, 200, r) : json(res, 404, { erro: 'Esse artista ainda não foi pesquisado.' });
    }

    if (req.method === 'GET' && caminho === '/api/exportar') {
      const slug = url.searchParams.get('artista') ?? '';
      const r = await descobridor.resultado(slug);
      if (!r) return json(res, 404, { erro: 'Esse artista ainda não foi pesquisado.' });
      if (!r.urls.length) return json(res, 404, { erro: 'Ainda não há links confirmados para exportar.' });
      await gravarTxt(app.saida, r.artista.slug, r.urls);
      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${r.artista.slug}.txt"`,
        'Cache-Control': 'no-store',
      });
      return res.end(textoTxt(r.urls));
    }

    if (req.method === 'POST') {
      const origem = req.headers.origin;
      if (origem && !origensOk().includes(origem)) return json(res, 403, { erro: 'Origem não permitida.' });
      if (!/^application\/json/i.test(req.headers['content-type'] ?? '')) return json(res, 415, { erro: 'Tipo de pedido inválido.' });
      const corpo = await lerCorpo(req);

      if (caminho === '/api/pesquisar') {
        if (job.rodando) return json(res, 409, { erro: 'Já existe uma pesquisa em andamento.' });
        const artista = String(corpo.artista ?? '').trim();
        if (!artista || artista.length > 100) return json(res, 400, { erro: 'Digite o nome de um artista.' });
        const limite = Math.min(100, Math.max(1, Math.round(Number(corpo.limite) || config.limiteMusicas)));
        iniciarPesquisa(artista, limite);
        return json(res, 202, { ok: true });
      }
      if (caminho === '/api/parar') { parar = true; return json(res, 200, { ok: true }); }
      if (caminho === '/api/decidir') {
        try { await descobridor.decidir(String(corpo.artista ?? ''), String(corpo.chave ?? ''), String(corpo.acao ?? ''), String(corpo.videoId ?? '')); }
        catch (e) { return json(res, 400, { erro: e.message }); }
        return json(res, 200, { ok: true });
      }
      if (caminho === '/api/testar') {
        return json(res, 200, await testarConexoes({ deezer: app.deezer, youtube: app.youtube, cache }));
      }
    }
    return json(res, 404, { erro: 'Não existe.' });
  }

  const servidor = createServer((req, res) => {
    tratar(req, res).catch((e) => {
      if (!res.headersSent) json(res, e.status ?? 500, { erro: e.status ? e.message : 'Erro inesperado no programa.' });
      else res.end();
    });
  });

  return {
    servidor,
    job,
    /** Começa a ouvir só neste computador. Porta 0 = qualquer porta livre (usado nos testes). */
    ouvir(p) {
      return new Promise((ok, erro) => {
        servidor.once('error', erro);
        servidor.listen(p, '127.0.0.1', () => { porta = servidor.address().port; ok(porta); });
      });
    },
    fechar: () => new Promise((ok) => servidor.close(ok)),
  };
}
