# Pesque Pague do Neném — site

Site estático (HTML, CSS e JavaScript puros, sem build) do Pesque Pague do Neném, em São Paulo de Viana, Viana – ES.

- **O pesqueiro**: pesca esportiva, restaurante e piscina, com preços.
- **Hospedagem**: Suítes e Casa do Lago, com regras e horários.
- **Agenda**: calendário até dezembro de 2027 com os fins de semana livres e ocupados. A pessoa escolhe o fim de semana, informa quantas pessoas vão e o site monta a mensagem pronta para o WhatsApp.

## Arquivos

```
index.html            página única
assets/css/estilo.css visual
assets/js/agenda.js   ← datas ocupadas, preços e número do WhatsApp (o que se edita no dia a dia)
assets/js/site.js     calendário, feriados e mensagem do WhatsApp
assets/img/logo.png   logo
```

## Como atualizar a agenda

Abra `assets/js/agenda.js` e coloque a data do **sábado** de cada fim de semana, no formato `"AAAA-MM-DD"`:

```js
suites: {
  lotado: ["2026-11-14"],      // nenhuma suíte livre
  poucasVagas: ["2026-11-21"]  // poucas suítes livres
},
casaDoLago: {
  reservado: ["2026-11-14"]    // Casa do Lago já alugada
},
```

As datas que vêm no arquivo são **exemplos**. Depois de colocar as datas reais, troque `exemplo: true` por `exemplo: false` para tirar o aviso de prévia do site.

Os feriados nacionais (incluindo Carnaval, Sexta-feira Santa e Corpus Christi) são calculados sozinhos. Feriados municipais vão em `feriadosExtras`.

## Publicar

Qualquer hospedagem de site estático serve. No Cloudflare Pages, sem passo de build:

```
npx wrangler pages deploy . --project-name pesque-pague-do-nenem --branch main
```
