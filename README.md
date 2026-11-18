# Toxic Music Discovery

Programa para o seu computador (Windows). Você digita o nome de um artista. Ele:

1. acha as músicas mais conhecidas (até 50) no Deezer;
2. pesquisa o link do YouTube de cada uma e confere se é a música certa;
3. entrega os links numa lista: copiar tudo, ou baixar um TXT (`linkin_park.txt`) com **um link por linha**.

Depois é só colar no seu **Media Downloader**. O Discovery **não baixa nada** e não toca música.

## Como instalar (uma vez)
1. Instale o **Node.js** (versão LTS): https://nodejs.org
2. Crie a chave do YouTube. Siga `docs/YOUTUBE_SETUP.md`.
3. Dê dois cliques em `2-testar-conexao.bat`. Deve aparecer **OK** nas duas linhas.

## Como usar
1. Dê dois cliques em `1-iniciar.bat`. O navegador abre sozinho. Deixe a janela preta aberta.
2. Digite o artista e clique em **Pesquisar**.
3. Veja as listas:
   - **Encontradas**: título, artista e duração conferem. Entram no TXT.
   - **Precisam de conferência**: tem dúvida. Abra o link, e se estiver certo clique em **Usar este**.
   - **Já estão na sua biblioteca**: não foram pesquisadas (economiza cota).
4. Clique em **Copiar todos os links** ou **Baixar TXT** (também fica salvo na pasta `saida`).
5. Cole no Media Downloader.

## Economia de pesquisas
O YouTube dá cerca de **100 pesquisas por dia** (a cota zera por volta das 5h da manhã no horário de Cuiabá).
- Cada música pesquisada fica salva em `dados/cache`. Nunca é pesquisada de novo.
- Se a cota acabar no meio, o resultado fica salvo. No dia seguinte, pesquise o mesmo artista: ele continua só do que faltava.
- Reabrir um artista já pesquisado (botão em "Já pesquisados") **não gasta nada**.
- Com um artista de 50 músicas, uma pesquisa gasta metade do dia.

## Biblioteca do Google Drive (opcional)
Para não pesquisar o que você já tem: crie `dados/biblioteca.json` de um destes jeitos.
- Da pasta do PC: `node src/cli.js ler-pasta "C:\Musicas"`
- Do Drive: veja `docs/GOOGLE_SETUP.md`, depois `3-entrar-google.bat` e `4-atualizar-biblioteca.bat`.

**Aviso honesto:** a leitura do Drive vem do Toxic Music Engine e foi testada só com um Google de mentira. Teste no seu PC antes de confiar.

## Configurações (opcional)
Crie `dados/config.json`. Exemplo em `docs/config.exemplo.json`.

## Comandos (opcional)
`node src/cli.js buscar "Linkin Park" --limite 50` faz a busca sem abrir a página e salva o TXT.

## Segurança
- Só funciona neste computador (endereço 127.0.0.1).
- A chave do YouTube fica em `dados/youtube-chave.txt`. A pasta `dados` **nunca** vai para o GitHub (`.gitignore`). Nunca cole a chave em conversa.
- O acesso ao Drive é só **leitura**.

## Testes
`npm test` roda 107 testes automáticos (nenhum usa a internet).

Veja `docs/ESTADO.md` para saber o que está testado e o que falta.
