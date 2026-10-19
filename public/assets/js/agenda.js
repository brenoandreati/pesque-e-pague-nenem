/*
  AGENDA — dados de reserva do site
  ------------------------------------------------------------------
  As reservas agora são marcadas no painel (/painel) e o site lê a ocupação
  direto de lá. Este arquivo só é usado se o painel estiver fora do ar,
  e serve de padrão para o número do WhatsApp.
*/
window.AGENDA = {
  exemplo: false,

  // Número que recebe os pedidos (55 + DDD + número, só dígitos)
  whatsapp: "5527998555585",

  precos: {
    suiteDiaria: 300, // diária da suíte para casal, com café da manhã
    casaDoLago: null  // null = "valor sob consulta"
  },

  suites: { lotado: [], poucasVagas: [], fechado: [] },
  casaDoLago: { reservado: [], fechado: [] },
  fechado: [],

  // Feriados municipais ou estaduais. Os nacionais já aparecem sozinhos.
  feriadosExtras: {
    // "2027-06-29": "Feriado municipal"
  }
};
