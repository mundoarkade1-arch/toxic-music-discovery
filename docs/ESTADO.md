# Estado do projeto — Toxic Music Discovery
Legenda: [T] testado em teste automático com Deezer/YouTube/Google SIMULADOS · [R] testado de verdade na internet · [?] ainda não comprovado

## Verificação (leia primeiro)
- 107 testes automáticos passam (Node 22). Nenhum usa a internet.
- Interface conferida num navegador de verdade (Chromium), com dados simulados: pesquisar, aprovar, copiar, baixar TXT, agrupar por álbum, celular.
- Os testes de economia (cache, cota) foram verificados quebrando o código de propósito: os testes falham quando deveriam.
- **NENHUMA ligação com Deezer, YouTube ou Google foi testada de verdade.** O ambiente de desenvolvimento não tinha acesso a esses sites. Por isso existe `2-testar-conexao.bat` (e o botão "Testar conexões").

## Funciona [T]
- Achar artista e músicas populares no Deezer; tirar ao vivo/remix/karaokê e repetidas.
- Pesquisar no YouTube (5 resultados), conferir título + artista/canal + duração, pontuar. Cover, remix, coletânea e vídeo de outro artista não passam.
- Cache em disco; cota diária (101 por música); parar e continuar no dia seguinte.
- Comparar com `dados/biblioteca.json` (por nome e pelo código do YouTube no nome do arquivo).
- Interface local, resultados separados (encontradas / conferir / sem resultado / pendentes / biblioteca / descartadas), copiar, TXT, histórico.
- Proteções do servidor local (só 127.0.0.1, recusa outros sites).

## Não comprovado [?]
- Deezer real: formato de `/search/artist` e `/artist/{id}/top?limit=100` (baseado na documentação pública).
- YouTube real: `search.list` e `videos.list` e as mensagens de erro de cota/chave.
- Google Drive real (herdado do Toxic Music Engine: só testado com mock).
- Se a pontuação de conferência acerta bem com artistas brasileiros/títulos em português: precisa de uso real. Ajustes em `src/match.js`.

## Não feito de propósito (fora do escopo)
Player, download, recomendações, reconferir/repesquisar uma música sozinha, outras fontes além do Deezer.

## Reaproveitado do Toxic Music Engine
`normalize.js`, `store.js`, `library.js`, `drive.js`, `google-auth.js` (com acesso só de leitura) e seus testes. Não levado (não serve a este propósito): fila de tarefas, charts Top 200, playlists, envio ao Drive. O Engine continua intacto no repositório dele.
