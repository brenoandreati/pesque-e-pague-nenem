# Pesque Pague do Neném — site

Site do Pesque Pague do Neném, em São Paulo de Viana, Viana – ES. HTML, CSS e JavaScript puros, sem build, no Cloudflare Pages.

- **O pesqueiro**: pesca esportiva, restaurante e piscina, com preços.
- **Hospedagem**: Suítes e Casa do Lago, com regras e horários.
- **Agenda**: calendário até dezembro de 2027 com os fins de semana livres e ocupados. A pessoa escolhe o fim de semana, informa quantas pessoas vão e o site monta a mensagem pronta para o WhatsApp.
- **Painel** (`/painel`): área com senha onde a equipe marca as reservas fechadas pelo WhatsApp (nome, telefone, pessoas, valor e pagamento: aguardando entrada, entrada de 50% paga ou pago). Suítes e Casa do Lago ficam separadas. O site público atualiza na hora.

No ar em: https://pesque-pague-do-nenem.pages.dev (painel em https://pesque-pague-do-nenem.pages.dev/painel/)

## Arquivos

```
public/index.html            site
public/painel/               painel de reservas (index.html, painel.css, painel.js)
public/assets/css/estilo.css visual do site (o painel também usa)
public/assets/js/site.js     calendário do site, feriados e mensagem do WhatsApp
public/assets/js/agenda.js   número do WhatsApp e reserva de segurança se a API cair
public/assets/img/logo.png   logo
functions/api/[[rota]].js    API: agenda pública, login, reservas, bloqueios e ajustes
migrations/                  estrutura do banco D1
wrangler.jsonc               configuração do Cloudflare Pages e do banco
```

## Como funciona a agenda

As reservas ficam no banco D1 da Cloudflare. O site lê `/api/agenda`, que devolve só quais fins de semana estão ocupados, sem nenhum dado pessoal.

- **Suítes**: o fim de semana aparece como lotado quando todas as suítes estão reservadas, e como "poucas vagas" quando sobra pouco. O número de suítes e a diária ficam em Ajustes, no painel.
- **Casa do Lago**: uma reserva por fim de semana.
- **Bloqueio**: fecha um fim de semana sem reserva (reforma, evento). No site ele aparece como ocupado.

Os feriados nacionais (incluindo Carnaval, Sexta-feira Santa e Corpus Christi) são calculados sozinhos. Feriados municipais vão em `feriadosExtras`, no `agenda.js`.

## Publicar

Depois de editar o código, publique de novo a partir da raiz do repositório:

```
npx wrangler pages deploy --branch main
```

Se mudar a estrutura do banco, crie um arquivo novo em `migrations/` e aplique com:

```
npx wrangler d1 migrations apply pesque-pague-do-nenem --remote
```

A senha do painel fica guardada como segredo na Cloudflare, nunca no código. Para trocar (isso desconecta todo mundo que estava logado):

```
npx wrangler pages secret put PAINEL_SENHA
```

### Testar no computador

Crie um arquivo `.dev.vars` (ele não vai para o Git) com `PAINEL_SENHA="..."` e `SESSAO_CHAVE="..."`, depois:

```
npx wrangler d1 migrations apply pesque-pague-do-nenem --local
npx wrangler pages dev
```
