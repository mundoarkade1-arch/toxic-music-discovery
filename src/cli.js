#!/usr/bin/env node
// Comandos do Toxic Music Discovery. Sem comando = abre a interface no navegador.
import { resolve, join } from 'node:path';
import { spawn } from 'node:child_process';
import { lerConfig, lerChaveYoutube } from './config.js';
import { Cache } from './cache.js';
import { Deezer } from './deezer.js';
import { YouTube } from './youtube.js';
import { Descobridor } from './discover.js';
import { criarLeitorDeBiblioteca } from './comparar.js';
import { criarServidor } from './server.js';
import { gravarTxt } from './exportar.js';
import { testarConexoes } from './diagnostico.js';
import { lerPasta } from './library.js';
import { gravarJson } from './store.js';
import { entrar, desconectar, criarProvedorDeToken } from './google-auth.js';
import { DriveClient } from './drive.js';

const args = process.argv.slice(2);
const cmd = args[0] && !args[0].startsWith('--') ? args[0] : 'servir';
const opcao = (nome, padrao) => {
  const i = args.indexOf('--' + nome);
  return i >= 0 && args[i + 1] ? args[i + 1] : padrao;
};
const dados = resolve(opcao('dados', 'dados'));
const saida = resolve(opcao('saida', 'saida'));

async function montar() {
  const config = await lerConfig(dados);
  const chave = await lerChaveYoutube(dados);
  const cache = await new Cache(dados).carregar();
  const deezer = new Deezer();
  const youtube = new YouTube({ chave });
  const descobridor = new Descobridor({ deezer, youtube, cache, config, biblioteca: criarLeitorDeBiblioteca(dados) });
  return { config, chave, cache, deezer, youtube, descobridor };
}

function abrirNoNavegador(url) {
  const [prog, ...resto] = process.platform === 'win32' ? ['rundll32', 'url.dll,FileProtocolHandler', url]
    : process.platform === 'darwin' ? ['open', url] : ['xdg-open', url];
  try { spawn(prog, resto, { detached: true, stdio: 'ignore' }).on('error', () => {}).unref(); } catch { /* sem navegador: o link já foi mostrado */ }
}

async function main() {
  if (cmd === 'servir') {
    const m = await montar();
    const app = criarServidor({ ...m, saida, temChave: () => !!m.chave });
    let porta;
    try { porta = await app.ouvir(Number(opcao('porta', m.config.porta))); }
    catch (e) {
      if (e.code === 'EADDRINUSE') throw new Error(`A porta ${m.config.porta} já está em uso. Talvez o Toxic Music Discovery já esteja aberto em outra janela.`);
      throw e;
    }
    const url = `http://127.0.0.1:${porta}`;
    console.log(`Toxic Music Discovery aberto em ${url}`);
    console.log('Deixe esta janela aberta enquanto usa. Para fechar o programa, feche esta janela.');
    if (!m.chave) console.log('\nATENÇÃO: falta a chave do YouTube. Veja docs/YOUTUBE_SETUP.md. Sem ela só dá para ver resultados já salvos.');
    if (!args.includes('--sem-navegador')) abrirNoNavegador(url);
  } else if (cmd === 'buscar') {
    const nome = args[1];
    if (!nome || nome.startsWith('--')) throw new Error('Diga o artista: node src/cli.js buscar "Linkin Park"');
    const m = await montar();
    const r = await m.descobridor.rodar({ artista: nome, limite: Number(opcao('limite', m.config.limiteMusicas)) }, {
      aoProgredir: (p) => { if (p.mensagem) console.log(p.mensagem); },
    });
    const res = await m.descobridor.resultado(r.slug, Number(opcao('limite', m.config.limiteMusicas)));
    const caminho = res.urls.length ? await gravarTxt(saida, r.slug, res.urls) : '';
    console.log(`\nArtista: ${r.nome}`);
    console.log(`Encontradas: ${res.totais.encontrada} | Para conferir: ${res.totais.conferir} | Sem resultado: ${res.totais.sem_resultado} | Já na biblioteca: ${res.totais.na_biblioteca} | Ainda não pesquisadas: ${res.totais.pendente}`);
    if (r.parou) console.log(`Parei antes do fim (${r.parou}). ${r.erro ?? 'Rode de novo para continuar.'}`);
    console.log(caminho ? `TXT salvo em ${caminho}` : 'Nenhum link confirmado ainda; nenhum TXT foi criado.');
  } else if (cmd === 'testar-conexao') {
    const m = await montar();
    if (!m.chave) console.log('Falta a chave do YouTube (veja docs/YOUTUBE_SETUP.md). Vou testar só o Deezer.');
    const r = await testarConexoes({ deezer: m.deezer, youtube: m.youtube, cache: m.chave ? m.cache : null });
    console.log(`${r.deezer.ok ? 'OK      ' : 'PROBLEMA'} ${r.deezer.mensagem}`);
    console.log(`${r.youtube.ok ? 'OK      ' : 'PROBLEMA'} ${r.youtube.mensagem}`);
    process.exitCode = r.deezer.ok && r.youtube.ok ? 0 : 1;
  } else if (cmd === 'ler-pasta') {
    if (!args[1]) throw new Error('Diga a pasta: node src/cli.js ler-pasta "C:\\Musicas"');
    const bib = await lerPasta(resolve(args[1]));
    await gravarJson(join(dados, 'biblioteca.json'), bib);
    console.log(`Li ${bib.faixas.length} músicas. Salvei em ${join(dados, 'biblioteca.json')}`);
  } else if (cmd === 'entrar-google') {
    await entrar(dados, { mostrar: (url) => console.log('\nAbra este link no navegador, escolha a sua conta e clique em Permitir:\n\n' + url + '\n\nEsperando você...') });
    console.log('Pronto! O programa está conectado ao Google (só leitura).');
  } else if (cmd === 'ler-drive') {
    const drive = new DriveClient({ token: criarProvedorDeToken(dados) });
    const bib = await drive.lerBiblioteca();
    await gravarJson(join(dados, 'biblioteca.json'), bib);
    console.log(`Li ${bib.faixas.length} músicas no Drive. Salvei em ${join(dados, 'biblioteca.json')}`);
  } else if (cmd === 'desconectar-google') {
    console.log((await desconectar(dados)) ? 'Desconectado. O acesso foi cancelado no Google e apagado deste PC.' : 'O programa não estava conectado.');
  } else {
    console.log('Comandos: servir (padrão) | buscar "Artista" [--limite 50] | testar-conexao | ler-drive | ler-pasta <pasta> | entrar-google | desconectar-google');
    console.log('Opções: --dados <pasta> --saida <pasta> --porta <número> --sem-navegador');
    process.exitCode = 1;
  }
}
main().catch((e) => { console.error('ERRO:', e.message); process.exitCode = 1; });
