# Estado do projeto — Toxic Music Discovery
Atualizado: 2026-11-18. Legenda: [T] testado em teste automático com Deezer/YouTube/Google SIMULADOS · [R] testado de verdade, no PC do usuário · [?] ainda não comprovado

## Verificação (leia primeiro)
- 107 testes automáticos passam (Node 22 no desenvolvimento e Node 20 no GitHub Actions, verde em 2026-11-18). Nenhum usa a internet.
- Interface conferida num navegador de verdade (Chromium) com dados simulados.
- Os testes de economia (cache, cota) foram verificados quebrando o código de propósito: os testes falham quando deveriam.

## Testado de verdade no PC do usuário em 2026-11-18 [R]
- Deezer: achar o artista e as músicas mais conhecidas.
- YouTube: a chave de API é aceita (teste de conexão) e a pesquisa por música funciona. Linkin Park, 50 músicas, 49 links confirmados, 0 para conferir. O usuário abriu 3 links (começo, meio e fim) e os 3 estavam certos.
- Copiar os links e colar no Media Downloader: todas as músicas apareceram na fila.
- Google Drive (só leitura): login pelo cliente Desktop e leitura de 999 músicas.
- Comparação com a biblioteca: das 10 primeiras da Linkin Park, 9 foram reconhecidas como já existentes no Drive (o usuário confirmou que eram dele) e não foram pesquisadas. Pesquisas gastas nessa etapa: 0.

## Funciona [T]
- Limpar a lista (sem ao vivo/remix/karaokê e sem repetidas), pontuar e conferir o vídeo (título, artista/canal e duração).
- Cache em disco, cota diária (101 por música), parar e continuar no dia seguinte.
- Interface local com resultados separados, copiar, TXT, histórico, aprovar ou descartar na mão.
- Proteções do servidor local (só 127.0.0.1, recusa outros sites).

## Não comprovado [?]
- Artistas brasileiros e títulos em português. A pontuação de `src/match.js` pode precisar de ajuste.
- A 50ª música da Linkin Park não entrou nos 49 links e não foi examinada.
- Comparação com a biblioteca quando os nomes dos arquivos no Drive são bem diferentes do título original.

## Atenção
- A chave de API foi criada no projeto Google Cloud "Toxic Player", o mesmo do Gerenciador de Músicas. A cota de 10.000 pontos por dia é compartilhada, e o contador do Discovery não enxerga o que o site gastou.
- Com a tela de consentimento do Google em modo "Teste", o acesso ao Drive costuma expirar em cerca de 7 dias. Quando isso acontecer, rodar `3-entrar-google.bat` de novo.
- A chave do YouTube e o login do Google ficam só no PC, na pasta `dados` (fora do GitHub).

## Não feito de propósito (fora do escopo)
Player, download, recomendações, repesquisar uma música sozinha, outras fontes além do Deezer.

## Reaproveitado do Toxic Music Engine
`normalize.js`, `store.js`, `library.js`, `drive.js`, `google-auth.js` (com acesso só de leitura) e seus testes. Não levado (não serve a este propósito): fila de tarefas, charts Top 200, playlists, envio ao Drive. O Engine continua intacto no repositório dele.
