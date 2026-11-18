import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escolher } from '../src/match.js';

const numb = { artista: 'Linkin Park', titulo: 'Numb', duracao: 185 };
const cand = (id, titulo, canal, duracao) => ({ id, titulo, canal, duracao });

test('vídeo oficial do artista com a duração certa: encontrada', () => {
  const r = escolher(numb, [cand('A', 'Linkin Park - Numb (Official Music Video) [4K Upgrade]', 'Linkin Park', 188)]);
  assert.equal(r.estado, 'encontrada');
  assert.equal(r.candidatos[0].url, 'https://www.youtube.com/watch?v=A');
});

test('faixa automática "Artista - Topic" também vale', () => {
  assert.equal(escolher(numb, [cand('T', 'Numb', 'Linkin Park - Topic', 186)]).estado, 'encontrada');
});

test('cover de outro canal não passa, mesmo com o título certo', () => {
  const r = escolher(numb, [cand('C', 'Numb (Cover by Joe)', 'Joe Covers', 190)]);
  assert.notEqual(r.estado, 'encontrada');
});

test('o vídeo certo ganha do cover mesmo se o cover vier primeiro na pesquisa', () => {
  const r = escolher(numb, [cand('C', 'Numb (Cover by Joe)', 'Joe Covers', 190), cand('A', 'Linkin Park - Numb (Official Video)', 'Linkin Park', 187)]);
  assert.equal(r.estado, 'encontrada');
  assert.equal(r.candidatos[0].id, 'A');
});

test('coletânea de 1 hora não é aceita', () => {
  const r = escolher(numb, [cand('L', 'Linkin Park - Greatest Hits Full Album (Numb, In the End)', 'Rock Mix', 3600)]);
  assert.notEqual(r.estado, 'encontrada');
});

test('música errada do mesmo artista: sem resultado (não vai para conferir)', () => {
  const r = escolher(numb, [cand('X', 'Linkin Park - In The End (Official Video)', 'Linkin Park', 216)]);
  assert.equal(r.estado, 'sem_resultado');
});

test('título certo, canal desconhecido e sem artista no título: vai para conferir', () => {
  const r = escolher(numb, [cand('Q', 'Numb [Official Audio]', 'Canal Qualquer', 185)]);
  assert.equal(r.estado, 'conferir');
});

test('música cujo nome tem "live" não é punida por isso', () => {
  const r = escolher({ artista: 'Oasis', titulo: 'Live Forever', duracao: 276 }, [cand('O', 'Oasis - Live Forever (Remastered)', 'Oasis', 278)]);
  assert.equal(r.estado, 'encontrada');
});

test('sem candidatos: sem resultado', () => {
  assert.deepEqual(escolher(numb, []), { estado: 'sem_resultado', candidatos: [] });
});

test('guarda no máximo 3 candidatos, com os motivos', () => {
  const r = escolher(numb, [1, 2, 3, 4, 5].map((n) => cand('V' + n, 'Numb', 'Linkin Park', 185)));
  assert.equal(r.candidatos.length, 3);
  assert.ok(r.candidatos[0].motivos.length > 0);
});
