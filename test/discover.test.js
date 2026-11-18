import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montarTudo, mundoFalso, FAIXAS, idDe } from './apoio.js';
import { prepararBiblioteca } from '../src/comparar.js';
import { lerNomeDeArquivo } from '../src/normalize.js';
import { Cache } from '../src/cache.js';
import { ErroYoutube } from '../src/youtube.js';

const bibDe = (...nomes) => prepararBiblioteca({ faixas: nomes.map((fn) => ({ fn, p: '', ...lerNomeDeArquivo(fn) })) });

test('pesquisa completa: acha o vídeo certo de cada música (e não o cover)', async () => {
  const t = await montarTudo();
  const r = await t.descobridor.rodar({ artista: 'linkin park', limite: 50 });
  assert.equal(r.pesquisadas, 6);
  assert.equal(r.parou, '');
  const res = await t.descobridor.resultado('linkin_park');
  assert.equal(res.totais.encontrada, 6);
  assert.deepEqual(res.urls, FAIXAS.map((_, i) => `https://www.youtube.com/watch?v=${idDe(i)}`));
  assert.equal(t.mundo.chamadas.busca, 6);
  assert.equal(t.mundo.chamadas.detalhes, 6);
  assert.equal(t.cache.unidadesHoje(), 6 * 101);
});

test('ECONOMIA: rodar de novo não gasta nenhuma pesquisa', async () => {
  const t = await montarTudo();
  await t.descobridor.rodar({ artista: 'Linkin Park' });
  const antes = { ...t.mundo.chamadas };
  const r2 = await t.descobridor.rodar({ artista: 'Linkin Park' });
  assert.equal(r2.pesquisadas, 0);
  assert.equal(r2.jaSalvas, 6);
  assert.equal(t.mundo.chamadas.busca, antes.busca);
  assert.equal(t.mundo.chamadas.deezerTop, 1); // a lista do artista também foi reaproveitada
});

test('ECONOMIA: o resultado sobrevive a fechar e abrir o programa', async () => {
  const t = await montarTudo();
  await t.descobridor.rodar({ artista: 'Linkin Park' });
  const cache2 = await new Cache(t.dados).carregar();
  const t2 = await montarTudo({ mundo: t.mundo });
  t2.descobridor.cache = cache2;
  const r = await t2.descobridor.rodar({ artista: 'Linkin Park' });
  assert.equal(r.pesquisadas, 0);
  assert.equal(r.jaSalvas, 6);
});

test('limite de músicas: só pesquisa as N mais populares', async () => {
  const t = await montarTudo();
  const r = await t.descobridor.rodar({ artista: 'Linkin Park', limite: 2 });
  assert.equal(r.pesquisadas, 2);
  const res = await t.descobridor.resultado('linkin_park', 2);
  assert.deepEqual(res.faixas.map((f) => f.titulo), ['Numb', 'In the End']);
});

test('BIBLIOTECA: não pesquisa nem mostra link do que já existe', async () => {
  const lib = bibDe('Numb - Linkin Park.mp3', 'Linkin Park - Faint (Official Video)-ABCdef12345.mp3');
  const t = await montarTudo({ biblioteca: async () => lib });
  const r = await t.descobridor.rodar({ artista: 'Linkin Park' });
  assert.equal(r.naBiblioteca, 2);
  assert.equal(r.pesquisadas, 4);
  assert.equal(t.mundo.chamadas.busca, 4);
  const res = await t.descobridor.resultado('linkin_park');
  assert.equal(res.totais.na_biblioteca, 2);
  assert.equal(res.urls.length, 4);
  assert.equal(res.faixas.find((f) => f.titulo === 'Numb').estado, 'na_biblioteca');
});

test('BIBLIOTECA desligada na configuração: pesquisa tudo', async () => {
  const lib = bibDe('Numb - Linkin Park.mp3');
  const t = await montarTudo({ biblioteca: async () => lib, config: { usarBiblioteca: false } });
  assert.equal((await t.descobridor.rodar({ artista: 'Linkin Park' })).pesquisadas, 6);
});

test('BIBLIOTECA: vídeo achado que já foi baixado (pelo código no arquivo) não aparece', async () => {
  const lib = bibDe(`Qualquer coisa-${idDe(1)}.mp3`.replace('Qualquer coisa', 'Outro nome'));
  // o código tem 11 letras (VID00000001) e dígitos, então o leitor o reconhece
  const t = await montarTudo({ biblioteca: async () => lib });
  await t.descobridor.rodar({ artista: 'Linkin Park' });
  const res = await t.descobridor.resultado('linkin_park');
  assert.equal(res.faixas.find((f) => f.titulo === 'In the End').estado, 'na_biblioteca');
  assert.equal(res.urls.length, 5);
});

test('COTA local: para quando acaba e continua do ponto certo no dia seguinte', async () => {
  let agora = new Date('2026-11-16T15:00:00Z');
  const t = await montarTudo({ config: { limiteUnidadesPorDia: 101 * 4 }, agora: () => agora });
  const r1 = await t.descobridor.rodar({ artista: 'Linkin Park' });
  assert.equal(r1.pesquisadas, 4);
  assert.equal(r1.parou, 'cota_local');
  assert.equal(t.descobridor.restantes(), 0);
  assert.equal((await t.descobridor.resultado('linkin_park')).totais.pendente, 2);

  agora = new Date('2026-11-17T15:00:00Z');
  const r2 = await t.descobridor.rodar({ artista: 'Linkin Park' });
  assert.equal(r2.pesquisadas, 2); // só as 2 que faltavam
  assert.equal(r2.jaSalvas, 4);
  assert.equal(t.mundo.chamadas.busca, 6);
  assert.equal((await t.descobridor.resultado('linkin_park')).totais.encontrada, 6);
});

test('COTA do YouTube acabou de repente: guarda o que já tinha e marca o dia como gasto', async () => {
  const t = await montarTudo({ mundo: mundoFalso({ cotaApos: 2 }) });
  const r = await t.descobridor.rodar({ artista: 'Linkin Park' });
  assert.equal(r.parou, 'cota_youtube');
  assert.equal(r.pesquisadas, 2);
  assert.equal(t.descobridor.restantes(), 0);
  const res = await t.descobridor.resultado('linkin_park');
  assert.equal(res.totais.encontrada, 2);
  assert.equal(res.totais.pendente, 4);
});

test('chave inválida: avisa e nada é gravado como resposta', async () => {
  const t = await montarTudo({ mundo: mundoFalso({ chaveRuim: true }) });
  await assert.rejects(t.descobridor.rodar({ artista: 'Linkin Park' }), (e) => e instanceof ErroYoutube && e.codigo === 'chave');
  assert.equal(Object.keys(t.cache.pesquisas).length, 0);
  assert.equal(t.cache.unidadesHoje(), 0);
});

test('erros passageiros seguidos: para depois de 3 e não grava lixo', async () => {
  const t = await montarTudo({ mundo: mundoFalso({ erro503: true }) });
  const r = await t.descobridor.rodar({ artista: 'Linkin Park' });
  assert.equal(r.parou, 'erros');
  assert.equal(Object.keys(t.cache.pesquisas).length, 0);
  assert.equal(t.cache.unidadesHoje(), 0);
});

test('botão Parar: para entre uma música e outra', async () => {
  const t = await montarTudo();
  let n = 0;
  const r = await t.descobridor.rodar({ artista: 'Linkin Park' }, { deveParar: () => n++ >= 2 });
  assert.equal(r.parou, 'usuario');
  assert.equal(r.pesquisadas, 2);
});

test('o mesmo vídeo não serve a duas músicas: a segunda vai para conferir', async () => {
  const t = await montarTudo();
  await t.descobridor.rodar({ artista: 'Linkin Park' });
  const [a, b] = t.cache.artista('linkin_park').faixas;
  await t.cache.gravarPesquisa(b.chave, { ...t.cache.pesquisa(a.chave) });
  const res = await t.descobridor.resultado('linkin_park');
  assert.equal(res.faixas[0].estado, 'encontrada');
  assert.equal(res.faixas[1].estado, 'conferir');
  assert.match(res.faixas[1].aviso, /outra música/);
  assert.equal(new Set(res.urls).size, res.urls.length);
});

test('conferência manual: aprovar, descartar e desfazer', async () => {
  // faz a primeira música cair em "conferir": só existe o cover (título certo, canal sem relação)
  const mundo = mundoFalso();
  mundo.videos.set(idDe(0), { titulo: 'Numb [Audio]', canal: 'Canal Qualquer', duracao: 189 });
  const t = await montarTudo({ mundo });
  await t.descobridor.rodar({ artista: 'Linkin Park' });
  let res = await t.descobridor.resultado('linkin_park');
  const numb = res.faixas.find((f) => f.titulo === 'Numb');
  assert.equal(numb.estado, 'conferir');
  assert.ok(numb.candidatos.length >= 1);
  assert.equal(res.urls.length, 5);

  await t.descobridor.decidir('linkin_park', numb.chave, 'aprovar', idDe(0));
  res = await t.descobridor.resultado('linkin_park');
  assert.equal(res.faixas.find((f) => f.titulo === 'Numb').estado, 'encontrada');
  assert.equal(res.faixas.find((f) => f.titulo === 'Numb').manual, true);
  assert.equal(res.urls.length, 6);

  await t.descobridor.decidir('linkin_park', numb.chave, 'descartar');
  assert.equal((await t.descobridor.resultado('linkin_park')).totais.descartada, 1);
  await t.descobridor.decidir('linkin_park', numb.chave, 'limpar');
  assert.equal((await t.descobridor.resultado('linkin_park')).faixas.find((f) => f.titulo === 'Numb').estado, 'conferir');

  await assert.rejects(t.descobridor.decidir('linkin_park', numb.chave, 'aprovar', 'VIDEOINVENTADO'), /não está entre os candidatos/);
  await assert.rejects(t.descobridor.decidir('linkin_park', 'inventada|x', 'descartar'), /Não achei/);
  await assert.rejects(t.descobridor.decidir('linkin_park', numb.chave, 'voar'), /desconhecida/);
});

test('decisão manual não gasta pesquisa e não some ao pesquisar de novo', async () => {
  const mundo = mundoFalso();
  mundo.videos.set(idDe(0), { titulo: 'Numb [Audio]', canal: 'Canal Qualquer', duracao: 189 });
  const t = await montarTudo({ mundo });
  await t.descobridor.rodar({ artista: 'Linkin Park' });
  const chave = t.cache.artista('linkin_park').faixas[0].chave;
  await t.descobridor.decidir('linkin_park', chave, 'aprovar', idDe(0));
  const buscas = mundo.chamadas.busca;
  await t.descobridor.rodar({ artista: 'Linkin Park' });
  assert.equal(mundo.chamadas.busca, buscas);
  assert.equal((await t.descobridor.resultado('linkin_park')).faixas[0].estado, 'encontrada');
});

test('histórico lista os artistas já pesquisados', async () => {
  const t = await montarTudo();
  assert.deepEqual(t.descobridor.historico(), []);
  await t.descobridor.rodar({ artista: 'Linkin Park' });
  assert.deepEqual(t.descobridor.historico().map((h) => [h.slug, h.nome]), [['linkin_park', 'Linkin Park']]);
});

test('artista sem resultado no Deezer: erro claro', async () => {
  const mundo = mundoFalso();
  const original = mundo.fetchFn;
  mundo.fetchFn = async (url) => (new URL(url).pathname === '/search/artist' ? { ok: true, status: 200, json: async () => ({ data: [] }) } : original(url));
  const t = await montarTudo({ mundo });
  await assert.rejects(t.descobridor.rodar({ artista: 'zzzz' }), /Não achei/);
});
