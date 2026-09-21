# Pelada — projeto pronto para GitHub + Supabase

Você mesmo fará o upload. Este pacote não cria nem altera nada na sua conta.

## O que já está pronto

- site público somente leitura;
- área Admin;
- 4 usuários: JONATHAN, JULIO, CAUE e EDSON;
- importação semanal por texto, no mesmo formato que você costuma enviar;
- 5 times / 5 jogadores;
- geração automática das 10 partidas de 8min30s;
- classificação automática: PTS → SG → GP → confronto direto;
- final de 10 minutos entre 1º e 2º;
- lançamento de gols e assistências por jogador em cada partida;
- artilharia e ranking de assistências;
- histórico de peladas;
- RLS no Supabase: público só lê; somente os 4 admins alteram.

## 1. Criar o projeto no Supabase

Crie um projeto no Supabase.

Abra:
SQL Editor → New query

Cole e execute todo o conteúdo de:

`supabase/schema.sql`

## 2. Criar os quatro usuários

No Supabase:

Authentication → Users → Add user

Crie estes e-mails internos:

- `jonathan@pelada.local`
- `julio@pelada.local`
- `caue@pelada.local`
- `edson@pelada.local`

Defina para os quatro a senha que você escolheu.

Na tela do site eles não digitam esses e-mails.
Eles escolhem apenas JONATHAN, JULIO, CAUE ou EDSON.

### Importante

Em Authentication, deixe o cadastro público de novos usuários desativado.

A senha NÃO está gravada no código e NÃO deve ser colocada no GitHub.

## 3. Configurar o frontend

No Supabase:

Project Settings → API

Copie:

- Project URL
- anon key / publishable key

Abra `config.js` e substitua:

`COLE_AQUI_SUA_SUPABASE_URL`

e

`COLE_AQUI_SUA_SUPABASE_ANON_KEY`

A anon/publishable key pode ficar no frontend.
NUNCA coloque a `service_role` no GitHub.

## 4. Subir no GitHub

Crie um repositório e envie estes arquivos:

- `index.html`
- `styles.css`
- `app.js`
- `config.js`
- `README.md`
- pasta `supabase` (opcional para o site, mas recomendado para guardar o SQL)

## 5. Ativar GitHub Pages

No repositório:

Settings → Pages

Source:
`Deploy from a branch`

Branch:
`main`

Folder:
`/ (root)`

Salve.

O GitHub fornecerá o link público do sistema.

## 6. Uso semanal

Admin → login.

Cole algo assim:

1 - Boca Juniors
1. Edson Luna
2. tiago ceifador
3. coquinha
4. Luis Felipe
5. Davi Pessoa

2 - River Plate
1. IG
2. JV
3. Rafael Pessoa
4. Lyndemarques
5. Julião

... até o quinto time.

Clique:

`Conferir lista`

Depois:

`Criar pelada`

O sistema gera as 10 partidas.

## 7. Gols e assistências

Depois de lançar o placar, clique em:

`Gols e assistências`

Aparecem somente os jogadores dos dois times daquela partida.

Você informa:
- gols;
- assistências.

O sistema soma automaticamente a artilharia e o ranking de assistências.

## 8. Acesso público

Qualquer pessoa com o link poderá consultar:
- jogos;
- placares;
- classificação;
- final;
- campeão;
- gols;
- assistências;
- histórico.

Sem login, os campos ficam bloqueados e o banco também impede alterações por RLS.

## Observação sobre escudos

Esta primeira versão de hospedagem não busca escudos automaticamente, porque o clube muda semanalmente.
A estrutura pode ser ampliada com um catálogo de clubes + escudos no Supabase Storage, para você cadastrar o escudo uma vez e ele reaparecer automaticamente sempre que o mesmo clube for usado.
