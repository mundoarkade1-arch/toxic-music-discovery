// Teste de conexão: confere se o Deezer e a chave do YouTube funcionam de verdade neste PC.
// Gasta só 1 unidade da cota do YouTube (não faz pesquisa).
import { CUSTO } from './youtube.js';

const VIDEO_DE_TESTE = 'dQw4w9WgXcQ'; // um vídeo público qualquer; só pedimos a duração dele

export async function testarConexoes({ deezer, youtube, cache }) {
  const r = { deezer: { ok: false, mensagem: '' }, youtube: { ok: false, mensagem: '' } };
  try {
    const a = await deezer.buscarArtista('Linkin Park');
    const faixas = await deezer.topFaixas(a.id, 5);
    r.deezer = faixas.length
      ? { ok: true, mensagem: `Deezer funcionando: achei "${a.nome}" e ${faixas.length} músicas.` }
      : { ok: false, mensagem: 'O Deezer respondeu, mas não veio nenhuma música.' };
  } catch (e) { r.deezer = { ok: false, mensagem: e.message }; }

  try {
    const mapa = await youtube.detalhes([VIDEO_DE_TESTE]);
    await cache?.gastar(CUSTO.detalhes);
    r.youtube = mapa.size
      ? { ok: true, mensagem: 'YouTube funcionando: a chave foi aceita.' }
      : { ok: false, mensagem: 'O YouTube respondeu, mas sem dados. Tente de novo.' };
  } catch (e) { r.youtube = { ok: false, mensagem: e.message }; }
  return r;
}
