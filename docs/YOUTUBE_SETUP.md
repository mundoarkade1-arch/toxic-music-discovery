# Chave do YouTube (uma vez só)

O programa usa a **YouTube Data API v3** (do Google). Ela é grátis até 10.000 "pontos" por dia. Cada pesquisa custa 101 pontos, então dá cerca de 95 a 100 pesquisas por dia.

1. Abra https://console.cloud.google.com/ e escolha um projeto (pode ser o mesmo do site).
2. Abra https://console.cloud.google.com/apis/library/youtube.googleapis.com e clique em **Ativar** (YouTube Data API v3).
3. Abra https://console.cloud.google.com/apis/credentials e clique em **Criar credenciais > Chave de API**.
4. Copie a chave.
5. Na pasta do programa, crie a pasta `dados` (se não existir) e dentro dela o arquivo de texto `youtube-chave.txt`. Cole **só a chave** na primeira linha e salve.
6. Dê dois cliques em `2-testar-conexao.bat`.

## Cuidados
- Nunca envie a chave para ninguém nem cole em conversa. O arquivo fica só no seu PC.
- Se a chave vazar, apague-a no Google Cloud e crie outra.
- Mensagem "O YouTube negou o acesso": a API do passo 2 não está ativada, ou a chave tem restrição que não inclui a YouTube Data API v3.
