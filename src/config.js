// Configuração. Tudo fica na pasta "dados" (fora do GitHub). Nada aqui pede senha: a chave do YouTube é um arquivo de texto no PC.
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { lerJson } from './store.js';

export const PADROES = {
  limiteMusicas: 50,            // quantas músicas por artista (as mais populares)
  limiteUnidadesPorDia: 9600,   // cota do YouTube: 10.000/dia; deixamos folga. Cada pesquisa gasta 101.
  validadeListaDias: 14,        // por quantos dias a lista de músicas de um artista é reaproveitada
  incluirAoVivo: false,         // false = ignora versões ao vivo/remix/karaokê/acústicas
  usarBiblioteca: true,         // true = não pesquisa o que já está na biblioteca (dados/biblioteca.json)
  porta: 8765,
};

const dentro = (n, min, max, padrao) => (Number.isFinite(Number(n)) ? Math.min(max, Math.max(min, Math.round(Number(n)))) : padrao);

export async function lerConfig(dados) {
  const arq = await lerJson(join(dados, 'config.json'), {});
  const c = { ...PADROES, ...arq };
  c.limiteMusicas = dentro(c.limiteMusicas, 1, 100, PADROES.limiteMusicas);
  c.limiteUnidadesPorDia = dentro(c.limiteUnidadesPorDia, 0, 10000, PADROES.limiteUnidadesPorDia);
  c.validadeListaDias = dentro(c.validadeListaDias, 1, 365, PADROES.validadeListaDias);
  c.porta = dentro(c.porta, 1024, 65535, PADROES.porta);
  c.incluirAoVivo = c.incluirAoVivo === true;
  c.usarBiblioteca = c.usarBiblioteca !== false;
  return c;
}

/** A chave pode estar em dados/youtube-chave.txt (primeira linha) ou na variável YOUTUBE_API_KEY. Devolve '' se não houver. */
export async function lerChaveYoutube(dados, env = process.env) {
  if (env.YOUTUBE_API_KEY?.trim()) return env.YOUTUBE_API_KEY.trim();
  try {
    const texto = await readFile(join(dados, 'youtube-chave.txt'), 'utf8');
    return texto.split(/\r?\n/).map((l) => l.trim()).find((l) => l && !l.startsWith('#')) ?? '';
  } catch {
    return '';
  }
}
