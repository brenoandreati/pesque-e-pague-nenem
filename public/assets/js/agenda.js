/*
  AGENDA DE HOSPEDAGEM — Pesque Pague do Neném
  ------------------------------------------------------------------
  Este é o único arquivo que precisa ser editado no dia a dia.

  Para marcar um fim de semana, escreva a data do SÁBADO entre aspas,
  no formato "AAAA-MM-DD" (ano-mês-dia), separando por vírgula.
  Exemplo: o fim de semana de 7 e 8 de novembro de 2026 é "2026-11-07".
  (Se colocar a sexta ou o domingo, o site entende o fim de semana do mesmo jeito.)
*/
window.AGENDA = {
  // true mostra no site o aviso "datas de exemplo".
  // Troque para false quando colocar as datas reais.
  exemplo: true,

  // Número que recebe os pedidos (55 + DDD + número, só dígitos)
  whatsapp: "5527998555585",

  precos: {
    suiteDiaria: 300, // diária da suíte para casal, com café da manhã
    casaDoLago: null  // null = "valor sob consulta"
  },

  suites: {
    // Fins de semana sem nenhuma suíte livre
    lotado: ["2026-10-31", "2026-11-14", "2026-12-26", "2027-01-02", "2027-02-06"],
    // Fins de semana com poucas suítes livres (ainda dá para pedir)
    poucasVagas: ["2026-11-21", "2026-12-05", "2027-01-09"]
  },

  casaDoLago: {
    // Fins de semana em que a Casa do Lago já está alugada
    reservado: ["2026-10-24", "2026-11-14", "2026-11-21", "2026-12-26", "2027-01-02", "2027-02-06"]
  },

  // Fins de semana em que a hospedagem não abre (reforma, evento fechado...)
  fechado: [],

  // Feriados municipais ou estaduais. Os nacionais já aparecem sozinhos.
  feriadosExtras: {
    // "2027-06-29": "Feriado municipal"
  }
};
