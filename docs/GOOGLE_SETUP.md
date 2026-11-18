# Ligar o Google Drive (opcional, só leitura)

Serve para o programa saber quais músicas você já tem no Drive. Use o MESMO projeto do Google Cloud do Toxic Music Engine (a Drive API já está ativa lá). Se você já tem o `google-cliente.json` do programa, copie-o para a pasta `dados` daqui e pule para o passo 6.

1. Abra https://console.cloud.google.com/apis/credentials e confira que o projeto do site está selecionado no topo.
2. Clique em **Criar credenciais > ID do cliente OAuth**.
3. Em **Tipo de aplicativo**, escolha **App para computador** (Desktop app). Nome: `Toxic Music Discovery`. Clique em **Criar**.
4. Clique em **Fazer o download do JSON**. Salve o arquivo com o nome `google-cliente.json` dentro da pasta `dados` do programa.
5. Se a tela de consentimento estiver em modo "Teste", o seu e-mail precisa estar na lista de usuários de teste (já está, por causa do site).
6. Dê dois cliques em `3-entrar-google.bat`, abra o link que aparecer, escolha a conta e clique em Permitir.

## Cuidados
- O arquivo `google-cliente.json` e o `google-token.json` ficam só no seu PC, na pasta `dados` (fora do GitHub). Nunca envie para ninguém nem cole em conversa.
- Para cancelar o acesso: `5-desconectar-google.bat`. Também dá para remover em https://myaccount.google.com/permissions
- Com a tela de consentimento em modo "Teste", o Google costuma cancelar o acesso depois de 7 dias. Quando isso acontecer, o programa avisa e você roda `3-entrar-google.bat` de novo.
- Escopos usados: leitura do Drive (para ver a biblioteca) e `drive.file` (só os arquivos que o próprio programa cria). O motor nunca apaga nada.
