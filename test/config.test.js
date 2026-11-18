import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { lerConfig, lerChaveYoutube, PADROES } from '../src/config.js';
import { pastaTemp } from './apoio.js';

test('sem config.json usa os padrões', async () => assert.deepEqual(await lerConfig(await pastaTemp()), PADROES));

test('config.json muda só o que foi escrito e corrige valores absurdos', async () => {
  const d = await pastaTemp();
  await writeFile(join(d, 'config.json'), JSON.stringify({ limiteMusicas: 5000, porta: 'abc', incluirAoVivo: true }));
  const c = await lerConfig(d);
  assert.equal(c.limiteMusicas, 100);
  assert.equal(c.porta, PADROES.porta);
  assert.equal(c.incluirAoVivo, true);
  assert.equal(c.usarBiblioteca, true);
});

test('chave do YouTube: arquivo (ignora comentário e espaços) ou variável de ambiente', async () => {
  const d = await pastaTemp();
  assert.equal(await lerChaveYoutube(d, {}), '');
  await writeFile(join(d, 'youtube-chave.txt'), '# minha chave\r\n  AIzaFAKE123  \r\n');
  assert.equal(await lerChaveYoutube(d, {}), 'AIzaFAKE123');
  assert.equal(await lerChaveYoutube(d, { YOUTUBE_API_KEY: 'DOAMBIENTE' }), 'DOAMBIENTE');
});
