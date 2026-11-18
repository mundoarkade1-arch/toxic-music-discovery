import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { prepararBiblioteca, jaTenho, jaTenhoOVideo, criarLeitorDeBiblioteca } from '../src/comparar.js';
import { lerNomeDeArquivo, codigoYoutubeDoNome, textoComparavel } from '../src/normalize.js';
import { pastaTemp } from './apoio.js';

const bib = (...nomes) => prepararBiblioteca({ faixas: nomes.map((fn) => ({ fn, p: '', ...lerNomeDeArquivo(fn) })) });

test('textoComparavel: sem acento, sem feat, sem conectores', () => {
  assert.equal(textoComparavel('Simon & Garfunkel'), 'simon garfunkel');
  assert.equal(textoComparavel('Numb (feat. Jay-Z)'), 'numb');
  assert.equal(textoComparavel('Atração Fatal'), 'atracao fatal');
});

test('código do YouTube no fim do nome do arquivo', () => {
  assert.equal(codigoYoutubeDoNome('Tate McRae - Housewife (Official Video)-DPEodkHzH-s.mp3'), 'DPEodkHzH-s');
  assert.equal(codigoYoutubeDoNome('Numb - Linkin Park.mp3'), '');
});

test('reconhece música que já tem, nos dois jeitos de nome de arquivo', () => {
  const b = bib('Numb - Linkin Park.mp3', 'Linkin Park - In The End (Official Video)-ABCdef12345.mp3');
  assert.equal(jaTenho(b, 'Linkin Park', 'Numb'), true);
  assert.equal(jaTenho(b, 'Linkin Park', 'In the End'), true);
  assert.equal(jaTenho(b, 'Linkin Park', 'Faint'), false);
});

test('mesmo título de outro artista não conta', () => {
  assert.equal(jaTenho(bib('Numb - U2.mp3'), 'Linkin Park', 'Numb'), false);
});

test('participação de outro cantor no nome do arquivo ainda conta', () => {
  assert.equal(jaTenho(bib('Numb - Linkin Park, Jay-Z.mp3'), 'Linkin Park', 'Numb'), true);
});

test('arquivo sem artista no nome, mas com o artista na pasta', () => {
  const b = prepararBiblioteca({ faixas: [{ fn: 'Numb.mp3', p: 'Linkin Park/Meteora', t: 'Numb', a: '' }] });
  assert.equal(jaTenho(b, 'Linkin Park', 'Numb'), true);
  assert.equal(jaTenho(b, 'U2', 'Numb'), false);
});

test('reconhece vídeo já baixado pelo código no nome do arquivo', () => {
  const b = bib('Linkin Park - Numb (Official Video)-ABCdef12345.mp3');
  assert.equal(jaTenhoOVideo(b, 'ABCdef12345'), true);
  assert.equal(jaTenhoOVideo(b, 'OUTROcodigo'), false);
  assert.equal(jaTenhoOVideo(null, 'x'), false);
});

test('leitor: sem arquivo devolve null; com arquivo lê e só relê se mudou', async () => {
  const d = await pastaTemp();
  const ler = criarLeitorDeBiblioteca(d);
  assert.equal(await ler(), null);
  await writeFile(join(d, 'biblioteca.json'), JSON.stringify({ gerado: 'hoje', faixas: [{ fn: 'a.mp3', t: 'Numb', a: 'Linkin Park' }] }));
  const p1 = await ler();
  assert.equal(p1.total, 1);
  assert.equal(await ler(), p1); // mesma preparação, sem reler
});
