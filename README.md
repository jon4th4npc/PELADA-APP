# PELADA APP — GitHub Pages + Supabase

Sistema público para acompanhar a pelada pelo celular ou computador.

## Menus

### Partidas
- partidas classificatórias;
- placares;
- classificação;
- final de 10 minutos;
- público pode consultar sem login;
- somente admins conseguem alterar.

### Estatísticas
- artilharia da pelada selecionada;
- assistências da pelada selecionada;
- artilharia geral somando todas as peladas;
- assistências gerais somando todas as peladas;
- times e jogadores da rodada.

### Histórico
- lista as peladas anteriores;
- qualquer visitante pode abrir e consultar uma rodada antiga.

### Criar Pelada
- aparece somente depois do login de administrador;
- permite colar a lista semanal no mesmo formato de sempre;
- valida os 5 times e jogadores;
- gera automaticamente as 10 partidas.

## Administradores

A tela mostra somente:
- JONATHAN
- JULIO
- CAUE
- EDSON

Os e-mails internos de autenticação permanecem configurados no código e as senhas ficam somente no Supabase Auth.

## Acesso público

Não existe login obrigatório para visitantes.

Ao abrir o link do GitHub Pages, a pessoa entra diretamente como:

`Público • somente leitura`

Ela pode navegar em Partidas, Estatísticas e Histórico. O banco também bloqueia escrita pública por RLS, portanto não é apenas uma restrição visual.

## Visual para celular

Em telas pequenas, o sistema usa:
- cabeçalho compacto;
- cards de partidas em uma coluna;
- placares maiores para toque;
- menu fixo na parte inferior, estilo aplicativo;
- classificação com rolagem horizontal;
- final e rankings adaptados à largura do celular.

## Escudos

A pasta `logos` contém escudos locais usados anteriormente, incluindo Boca Juniors, River Plate, Platense, Estudiantes, Rivadavia, Barcelona, Real Madrid, Valencia, Atlético de Madrid e Real Betis.

Além disso, o sistema tenta carregar automaticamente um catálogo online com mais de 100 clubes das principais ligas europeias. Se um time não for encontrado, aparecem as iniciais do clube no lugar do escudo, sem quebrar o sistema.

## Atualização no GitHub

Para esta atualização, substitua no repositório:
- `index.html`
- `app.js`
- `styles.css`
- pasta `logos`

Não substitua seu `config.js`, porque ele contém a URL e a Publishable Key do seu projeto Supabase.
