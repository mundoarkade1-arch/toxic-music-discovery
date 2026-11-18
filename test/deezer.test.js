import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Deezer, ErroDeezer } from '../src/deezer.js';
import { resposta, semEspera } from './apoio.js';

const dz = (fetchFn) => new Deezer({ fetchFn, esperar: semEspera });

test('entre artistas com o mesmo nome, escolhe o com mais fãs', async () => {
  const a = await dz(async () => resposta({ data: [{ id: 1, name: 'Linkin Park Tribute', nb_fan: 5 }, { id: 2, name: 'Linkin Park', nb_fan: 50 }, { id: 3, name: 'LINKIN PARK', nb_fan: 9000 }] })).buscarArtista('linkin park');
  assert.deepEqual(a, { id: 3, nome: 'LINKIN PARK', fas: 9000, exato: true });
});

test('sem nome igual: usa o primeiro e avisa que não foi exato', async () => {
  const a = await dz(async () => resposta({ data: [{ id: 9, name: 'Linkin Park', nb_fan: 1 }] })).buscarArtista('linkin');
  assert.equal(a.exato, false);
  assert.equal(a.nome, 'Linkin Park');
});

test('artista que não existe: erro claro', async () => {
  await assert.rejects(dz(async () => resposta({ data: [] })).buscarArtista('zzzzqqq'), (e) => e instanceof ErroDeezer && /Não achei/.test(e.message));
  await assert.rejects(dz(async () => resposta({})).buscarArtista('  '), /Digite/);
});

test('limite de pedidos do Deezer (200 com error.code 4): espera e tenta de novo', async () => {
  const filas = [resposta({ error: { code: 4, message: 'Quota limit exceeded' } }), resposta({ data: [{ id: 1, name: 'X', nb_fan: 1 }] })];
  assert.equal((await dz(async () => filas.shift()).buscarArtista('x')).id, 1);
});

test('erro do Deezer que não passa: mensagem em português', async () => {
  await assert.rejects(dz(async () => resposta({ error: { code: 800, message: 'no data' } })).buscarArtista('x'), (e) => e instanceof ErroDeezer);
});

test('sem internet: erro claro', async () => {
  await assert.rejects(dz(async () => { throw new Error('x'); }).buscarArtista('x'), /Não consegui falar com o Deezer/);
});

test('topFaixas: título curto, título completo, álbum e duração', async () => {
  const f = await dz(async () => resposta({ data: [{ title: 'Numb (Live)', title_short: 'Numb', duration: '185', album: { title: 'Meteora' } }, { nada: 1 }] })).topFaixas(7);
  assert.deepEqual(f, [{ titulo: 'Numb', tituloCompleto: 'Numb (Live)', album: 'Meteora', duracao: 185 }]);
});
