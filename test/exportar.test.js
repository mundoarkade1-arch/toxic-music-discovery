import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { textoTxt, gravarTxt } from '../src/exportar.js';
import { pastaTemp } from './apoio.js';

test('o TXT tem só links, um por linha, sem repetir e sem linhas em branco', () => {
  const t = textoTxt(['https://www.youtube.com/watch?v=AAAAAAAAAAA', 'https://www.youtube.com/watch?v=BBBBBBBBBBB', 'https://www.youtube.com/watch?v=AAAAAAAAAAA']);
  assert.equal(t, 'https://www.youtube.com/watch?v=AAAAAAAAAAA\nhttps://www.youtube.com/watch?v=BBBBBBBBBBB\n');
  for (const linha of t.trimEnd().split('\n')) assert.match(linha, /^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/);
});

test('sem links, o TXT fica vazio', () => assert.equal(textoTxt([]), ''));

test('grava saida/<artista>.txt', async () => {
  const d = await pastaTemp();
  const caminho = await gravarTxt(d + '/saida', 'linkin_park', ['https://www.youtube.com/watch?v=AAAAAAAAAAA']);
  assert.ok(caminho.endsWith('linkin_park.txt'));
  assert.equal(await readFile(caminho, 'utf8'), 'https://www.youtube.com/watch?v=AAAAAAAAAAA\n');
});
