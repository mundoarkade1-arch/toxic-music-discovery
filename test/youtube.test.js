import { test } from 'node:test';
import assert from 'node:assert/strict';
import { YouTube, ErroYoutube, duracaoEmSegundos, decodificar } from '../src/youtube.js';
import { resposta, semEspera } from './apoio.js';

const yt = (fetchFn, extra = {}) => new YouTube({ chave: 'SEGREDO-XYZ', fetchFn, esperar: semEspera, tentativas: 3, ...extra });
const erroGoogle = (status, reason, message = 'm') => resposta({ error: { code: status, message, errors: [{ reason }] } }, status);

test('duração ISO vira segundos', () => {
  assert.equal(duracaoEmSegundos('PT3M45S'), 225);
  assert.equal(duracaoEmSegundos('PT1H2M3S'), 3723);
  assert.equal(duracaoEmSegundos('PT45S'), 45);
  assert.equal(duracaoEmSegundos('P0D'), 0);
  assert.equal(duracaoEmSegundos('lixo'), 0);
});

test('decodifica &amp; e aspas dos títulos', () => {
  assert.equal(decodificar('AC&amp;DC &#39;Back&#39; &quot;x&quot; &#x41;'), `AC&DC 'Back' "x" A`);
});

test('buscar: manda a chave, pede 5 vídeos e devolve id, título e canal', async () => {
  let pedido;
  const r = await yt(async (url) => { pedido = new URL(url); return resposta({ items: [{ id: { videoId: 'abc' }, snippet: { title: 'Rock &amp; Roll', channelTitle: 'Canal' } }, { id: {}, snippet: {} }] }); }).buscar('linkin park numb');
  assert.deepEqual(r, [{ id: 'abc', titulo: 'Rock & Roll', canal: 'Canal' }]);
  assert.equal(pedido.pathname, '/youtube/v3/search');
  assert.equal(pedido.searchParams.get('type'), 'video');
  assert.equal(pedido.searchParams.get('maxResults'), '5');
  assert.equal(pedido.searchParams.get('key'), 'SEGREDO-XYZ');
});

test('detalhes: devolve a duração de cada vídeo', async () => {
  const m = await yt(async () => resposta({ items: [{ id: 'a', contentDetails: { duration: 'PT2M' } }] })).detalhes(['a', 'b']);
  assert.equal(m.get('a'), 120);
  assert.equal(m.has('b'), false);
});

test('cota acabou: erro "cota", sem tentar de novo', async () => {
  let n = 0;
  await assert.rejects(yt(async () => { n++; return erroGoogle(403, 'quotaExceeded'); }).buscar('x'), (e) => e instanceof ErroYoutube && e.codigo === 'cota');
  assert.equal(n, 1);
});

test('chave inválida: erro "chave" e a mensagem não mostra a chave', async () => {
  await assert.rejects(yt(async () => erroGoogle(400, 'badRequest', 'API key not valid. SEGREDO-XYZ')).buscar('x'), (e) => {
    assert.equal(e.codigo, 'chave');
    assert.ok(!e.message.includes('SEGREDO-XYZ'));
    return true;
  });
});

test('API desligada no projeto (403 accessNotConfigured) explica o que fazer', async () => {
  await assert.rejects(yt(async () => erroGoogle(403, 'accessNotConfigured')).buscar('x'), (e) => e.codigo === 'chave' && /YouTube Data API v3/.test(e.message));
});

test('erro 503 e limite por segundo: tenta de novo e dá certo', async () => {
  const respostas = [resposta({}, 503), erroGoogle(403, 'rateLimitExceeded'), resposta({ items: [] })];
  assert.deepEqual(await yt(async () => respostas.shift()).buscar('x'), []);
});

test('sem internet: erro "rede" e a mensagem não mostra a chave', async () => {
  await assert.rejects(yt(async (url) => { throw new Error('falhou ' + url); }).buscar('x'), (e) => e.codigo === 'rede' && !e.message.includes('SEGREDO-XYZ'));
});

test('sem chave: pede a chave antes de qualquer pedido', async () => {
  let chamou = false;
  await assert.rejects(new YouTube({ chave: '', fetchFn: async () => { chamou = true; } }).buscar('x'), (e) => e.codigo === 'chave');
  assert.equal(chamou, false);
});
