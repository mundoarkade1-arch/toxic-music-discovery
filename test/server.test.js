import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { criarServidor } from '../src/server.js';
import { montarTudo } from './apoio.js';

async function subir(opcoes) {
  const t = await montarTudo(opcoes);
  const app = criarServidor({ descobridor: t.descobridor, cache: t.cache, config: t.config, saida: join(t.dados, 'saida'), temChave: () => true, youtube: t.youtube, deezer: t.deezer });
  const porta = await app.ouvir(0);
  const chamar = (metodo, caminho, { corpo, headers = {} } = {}) => new Promise((ok, erro) => {
    const dados = corpo === undefined ? null : JSON.stringify(corpo);
    const req = request({ host: '127.0.0.1', port: porta, path: caminho, method: metodo, headers: { ...(dados ? { 'Content-Type': 'application/json' } : {}), ...headers } }, (res) => {
      const partes = []; res.on('data', (p) => partes.push(p));
      res.on('end', () => ok({ status: res.statusCode, headers: res.headers, texto: Buffer.concat(partes).toString('utf8') }));
    });
    req.on('error', erro); req.end(dados);
  });
  return { ...t, app, porta, chamar, fechar: () => app.fechar() };
}
const jsonDe = (r) => JSON.parse(r.texto);
async function esperarFim(s) {
  for (let i = 0; i < 100; i++) {
    const e = jsonDe(await s.chamar('GET', '/api/estado'));
    if (!e.job.rodando && e.job.etapa === 'fim') return e;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error('a pesquisa não terminou');
}

test('serve a página, o script e o estilo', async () => {
  const s = await subir();
  try {
    const home = await s.chamar('GET', '/');
    assert.equal(home.status, 200);
    assert.match(home.texto, /Toxic Music Discovery/);
    assert.match(home.headers['content-type'], /text\/html/);
    assert.equal((await s.chamar('GET', '/app.js')).status, 200);
    assert.equal((await s.chamar('GET', '/estilo.css')).status, 200);
  } finally { await s.fechar(); }
});

test('só serve os 3 arquivos da página (nada de ler outros arquivos do PC)', async () => {
  const s = await subir();
  try {
    for (const c of ['/../package.json', '/%2e%2e/package.json', '/package.json', '/src/cli.js', '/dados/cache/cota.json']) {
      assert.equal((await s.chamar('GET', c)).status, 404, c);
    }
  } finally { await s.fechar(); }
});

test('recusa pedidos com endereço de outro site (anti "DNS rebinding") ou origem estranha', async () => {
  const s = await subir();
  try {
    assert.equal((await s.chamar('GET', '/api/estado', { headers: { Host: 'evil.com' } })).status, 403);
    const p = await s.chamar('POST', '/api/pesquisar', { corpo: { artista: 'x' }, headers: { Origin: 'http://evil.com' } });
    assert.equal(p.status, 403);
    assert.equal((await s.chamar('POST', '/api/pesquisar', { headers: { 'Content-Type': 'text/plain' } })).status, 415);
    assert.equal(s.mundo.chamadas.deezerBusca, 0); // nada foi pesquisado
  } finally { await s.fechar(); }
});

test('fluxo completo: pesquisar, acompanhar, ver resultado, copiar links e baixar o TXT', async () => {
  const s = await subir();
  try {
    const origem = `http://127.0.0.1:${s.porta}`;
    const ini = await s.chamar('POST', '/api/pesquisar', { corpo: { artista: 'linkin park', limite: 3 }, headers: { Origin: origem } });
    assert.equal(ini.status, 202);
    const fim = await esperarFim(s);
    assert.equal(fim.job.resumo.pesquisadas, 3);
    assert.equal(fim.job.erro, '');
    assert.equal(fim.historico[0].slug, 'linkin_park');
    assert.equal(fim.cota.pesquisasRestantes, Math.floor((9600 - 303) / 101));

    const res = jsonDe(await s.chamar('GET', '/api/resultado?artista=linkin_park'));
    assert.equal(res.urls.length, 3);

    const txt = await s.chamar('GET', '/api/exportar?artista=linkin_park');
    assert.equal(txt.status, 200);
    assert.match(txt.headers['content-type'], /text\/plain/);
    assert.match(txt.headers['content-disposition'], /filename="linkin_park\.txt"/);
    assert.equal(txt.texto, res.urls.join('\n') + '\n');
    assert.equal(await readFile(join(s.dados, 'saida', 'linkin_park.txt'), 'utf8'), txt.texto);
  } finally { await s.fechar(); }
});

test('não deixa começar duas pesquisas ao mesmo tempo, e valida o nome do artista', async () => {
  const s = await subir();
  try {
    assert.equal((await s.chamar('POST', '/api/pesquisar', { corpo: { artista: '   ' } })).status, 400);
    assert.equal((await s.chamar('POST', '/api/pesquisar', { corpo: { artista: 'x'.repeat(200) } })).status, 400);
    assert.equal((await s.chamar('POST', '/api/pesquisar', { corpo: { artista: 'Linkin Park' } })).status, 202);
    assert.equal((await s.chamar('POST', '/api/pesquisar', { corpo: { artista: 'Linkin Park' } })).status, 409);
    await esperarFim(s);
  } finally { await s.fechar(); }
});

test('erro na pesquisa aparece em português no estado, sem derrubar o programa', async () => {
  const s = await subir();
  try {
    s.descobridor.deezer.buscarArtista = async () => { throw new Error('Não achei "zzz" no Deezer. Confira o nome.'); };
    await s.chamar('POST', '/api/pesquisar', { corpo: { artista: 'zzz' } });
    const fim = await esperarFim(s);
    assert.match(fim.job.erro, /Não achei/);
    assert.equal((await s.chamar('GET', '/api/estado')).status, 200);
  } finally { await s.fechar(); }
});

test('exportar sem links confirmados ou artista desconhecido: 404 com explicação', async () => {
  const s = await subir();
  try {
    const r = await s.chamar('GET', '/api/exportar?artista=ninguem');
    assert.equal(r.status, 404);
    assert.match(jsonDe(r).erro, /ainda não foi pesquisado/);
  } finally { await s.fechar(); }
});

test('decidir pela API e teste de conexão', async () => {
  const s = await subir();
  try {
    await s.chamar('POST', '/api/pesquisar', { corpo: { artista: 'Linkin Park', limite: 1 } });
    await esperarFim(s);
    const res = jsonDe(await s.chamar('GET', '/api/resultado?artista=linkin_park'));
    const d = await s.chamar('POST', '/api/decidir', { corpo: { artista: 'linkin_park', chave: res.faixas[0].chave, acao: 'descartar' } });
    assert.equal(d.status, 200);
    assert.equal(jsonDe(await s.chamar('GET', '/api/resultado?artista=linkin_park')).totais.descartada, 1);
    assert.equal((await s.chamar('POST', '/api/decidir', { corpo: { artista: 'linkin_park', chave: 'x', acao: 'descartar' } })).status, 400);

    const antes = s.cache.unidadesHoje();
    const t = jsonDe(await s.chamar('POST', '/api/testar', { corpo: {} }));
    assert.equal(t.deezer.ok, true);
    assert.equal(s.cache.unidadesHoje(), antes + 1); // o teste gasta só 1 unidade
  } finally { await s.fechar(); }
});
