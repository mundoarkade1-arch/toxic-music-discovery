import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Cache, diaDaCota, nomeParaArquivo } from '../src/cache.js';
import { pastaTemp } from './apoio.js';

test('nomes de arquivo: sem acento, sem símbolo, em minúsculas', () => {
  assert.equal(nomeParaArquivo('Linkin Park'), 'linkin_park');
  assert.equal(nomeParaArquivo('Henrique & Juliano'), 'henrique_e_juliano');
  assert.equal(nomeParaArquivo("Guns N' Roses"), 'guns_n_roses');
  assert.equal(nomeParaArquivo('Legião Urbana'), 'legiao_urbana');
  assert.equal(nomeParaArquivo('???'), 'artista');
});

test('o dia da cota segue o horário do Pacífico (zera às 05:00 em Cuiabá no inverno)', () => {
  assert.equal(diaDaCota(new Date('2026-11-16T10:00:00Z')), '2026-11-16');
  assert.equal(diaDaCota(new Date('2026-11-16T07:00:00Z')), '2026-11-15');
});

test('pesquisas e listas ficam salvas no disco e voltam depois', async () => {
  const d = await pastaTemp();
  const a = await new Cache(d).carregar();
  await a.gravarPesquisa('lp|numb', { estado: 'encontrada' });
  await a.gravarArtista('linkin_park', { nome: 'Linkin Park', faixas: [] });
  const b = await new Cache(d).carregar();
  assert.equal(b.pesquisa('lp|numb').estado, 'encontrada');
  assert.equal(b.artista('linkin_park').nome, 'Linkin Park');
  assert.equal(b.pesquisa('nao|existe'), null);
});

test('cota: soma no mesmo dia e zera no dia seguinte', async () => {
  let agora = new Date('2026-11-16T15:00:00Z');
  const d = await pastaTemp();
  const c = await new Cache(d, { agora: () => agora }).carregar();
  await c.gastar(101); await c.gastar(101);
  assert.equal(c.unidadesHoje(), 202);
  assert.equal((await new Cache(d, { agora: () => agora }).carregar()).unidadesHoje(), 202); // sobrevive a reiniciar
  agora = new Date('2026-11-17T15:00:00Z');
  assert.equal(c.unidadesHoje(), 0);
  await c.gastar(1);
  assert.equal(c.unidadesHoje(), 1);
});

test('esgotarHoje marca a cota como gasta', async () => {
  const c = await new Cache(await pastaTemp()).carregar();
  await c.esgotarHoje(9600);
  assert.equal(c.unidadesHoje(), 9600);
});

test('lista de artista: fresca por N dias', async () => {
  let agora = new Date('2026-11-01T00:00:00Z');
  const c = await new Cache(await pastaTemp(), { agora: () => agora }).carregar();
  await c.gravarArtista('x', { nome: 'X' });
  assert.equal(c.listaEstaFresca(c.artista('x'), 14), true);
  agora = new Date('2026-11-20T00:00:00Z');
  assert.equal(c.listaEstaFresca(c.artista('x'), 14), false);
  assert.equal(c.listaEstaFresca(null, 14), false);
});
