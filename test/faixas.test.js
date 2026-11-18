import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ehVariante, tituloLimpo, limparFaixas } from '../src/faixas.js';

test('reconhece versões ao vivo, remix e acústicas, mas não músicas com "Live" no nome', () => {
  assert.equal(ehVariante('Numb - Live in Texas'), true);
  assert.equal(ehVariante('Crawling (Acoustic)'), true);
  assert.equal(ehVariante('In the End (Remix)'), true);
  assert.equal(ehVariante('Evidências (Ao Vivo)'), true);
  assert.equal(ehVariante('Live Forever'), false);
  assert.equal(ehVariante('Live and Let Die'), false);
  assert.equal(ehVariante('Numb (Remastered 2011)'), false);
});

test('limpa Remastered, Radio Edit etc. sem mexer em outros parênteses', () => {
  assert.equal(tituloLimpo('In the End (Remastered 2011)'), 'In the End');
  assert.equal(tituloLimpo('Numb - Radio Edit'), 'Numb');
  assert.equal(tituloLimpo('Faint - 2009 Remaster'), 'Faint');
  assert.equal(tituloLimpo('Numb (feat. Jay-Z)'), 'Numb (feat. Jay-Z)');
});

test('limparFaixas: tira variantes e repetidas, mantém a ordem de popularidade', () => {
  const brutas = [
    { titulo: 'Numb', album: 'Meteora', duracao: 185 },
    { titulo: 'Numb', tituloCompleto: 'Numb (Live)', album: 'Live', duracao: 190 },
    { titulo: 'In the End', tituloCompleto: 'In the End (Remastered)', album: 'HT', duracao: 216 },
    { titulo: 'In The End', album: 'HT', duracao: 216 },
    { titulo: 'Faint', tituloCompleto: 'Faint (Remix)', album: 'X', duracao: 100 },
    { titulo: 'Crawling', album: 'HT', duracao: 209 },
  ];
  assert.deepEqual(limparFaixas(brutas).map((f) => f.titulo), ['Numb', 'In the End', 'Crawling']);
  assert.equal(limparFaixas(brutas, { incluirAoVivo: true }).length, 4); // Numb e Numb (Live) são a mesma chave de título
});
