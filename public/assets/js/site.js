(function () {
  'use strict';

  var A = window.AGENDA || {};
  var WHATSAPP = String(A.whatsapp || '5527998555585').replace(/\D/g, '');
  var PRECOS = A.precos || {};
  var DIARIA_SUITE = typeof PRECOS.suiteDiaria === 'number' ? PRECOS.suiteDiaria : 300;
  var VALOR_CASA = typeof PRECOS.casaDoLago === 'number' ? PRECOS.casaDoLago : null;

  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var MESES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  var SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  var CABECALHO = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  // Dias de cada fim de semana (getDay: 5 sexta, 6 sábado, 0 domingo)
  var TIPOS = {
    suite: { nome: 'Suíte', dias: [6, 0], entrada: 'a partir das 10h', saida: 'até as 18h' },
    casa: { nome: 'Casa do Lago', dias: [5, 6, 0], entrada: 'a partir das 18h', saida: 'até as 18h' }
  };
  var ROTULO = { livre: 'Livre', poucas: 'Poucas vagas', ocupado: 'Ocupado', fechado: 'Fechado', passado: 'Já passou' };
  var LIMITES = {
    suite: { suites: [1, 6], adultos: [1, 12], criancas: [0, 10] },
    casa: { suites: [1, 1], adultos: [1, 10], criancas: [0, 10] }
  };

  /* ---------- Datas ---------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function deIso(s) {
    var p = String(s).split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }
  function soma(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function sabadoDe(d) {
    var w = d.getDay();
    if (w === 6) return d;
    if (w === 0) return soma(d, -1);
    if (w === 5) return soma(d, 1);
    return null;
  }
  function diaMes(d) { return (d.getDate() === 1 ? '1º' : d.getDate()); }
  function ddmm(d) { return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear(); }

  var agora = new Date();
  var hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());

  // Meses da agenda: do mês atual até dezembro de 2027 (ou 12 meses à frente, o que for mais longe)
  var fimAgenda = new Date(2027, 11, 1);
  var dozeMeses = new Date(hoje.getFullYear(), hoje.getMonth() + 12, 1);
  if (dozeMeses > fimAgenda) fimAgenda = dozeMeses;
  var MESES_AGENDA = [];
  for (var m = new Date(hoje.getFullYear(), hoje.getMonth(), 1); m <= fimAgenda; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
    MESES_AGENDA.push(m);
  }

  /* ---------- Feriados ---------- */
  function pascoa(ano) {
    var a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4;
    var f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    var i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, mm = Math.floor((a + 11 * h + 22 * l) / 451);
    var mes = Math.floor((h + l - 7 * mm + 114) / 31), dia = ((h + l - 7 * mm + 114) % 31) + 1;
    return new Date(ano, mes - 1, dia);
  }
  var FERIADOS = {};
  for (var ano = hoje.getFullYear(); ano <= fimAgenda.getFullYear(); ano++) {
    [['01-01', 'Confraternização Universal'], ['04-21', 'Tiradentes'], ['05-01', 'Dia do Trabalho'],
      ['09-07', 'Independência do Brasil'], ['10-12', 'Nossa Senhora Aparecida'], ['11-02', 'Finados'],
      ['11-15', 'Proclamação da República'], ['11-20', 'Consciência Negra'], ['12-25', 'Natal']
    ].forEach(function (f) { FERIADOS[ano + '-' + f[0]] = f[1]; });
    var p = pascoa(ano);
    FERIADOS[iso(soma(p, -48))] = 'Carnaval';
    FERIADOS[iso(soma(p, -47))] = 'Carnaval';
    FERIADOS[iso(soma(p, -2))] = 'Sexta-feira Santa';
    FERIADOS[iso(soma(p, 60))] = 'Corpus Christi';
  }
  Object.keys(A.feriadosExtras || {}).forEach(function (k) { FERIADOS[k] = A.feriadosExtras[k]; });

  /* ---------- Ocupação ---------- */
  function conjunto(lista) {
    var s = {};
    (lista || []).forEach(function (v) {
      var d = deIso(v);
      if (isNaN(d.getTime())) return;
      var sab = sabadoDe(d);
      if (sab) s[iso(sab)] = true;
      else if (window.console) console.warn('agenda.js: ' + v + ' não cai num fim de semana');
    });
    return s;
  }
  var LOTADO = conjunto(A.suites && A.suites.lotado);
  var POUCAS = conjunto(A.suites && A.suites.poucasVagas);
  var RESERVADO = conjunto(A.casaDoLago && A.casaDoLago.reservado);
  var FECHADO = conjunto(A.fechado);

  function status(tipo, sab) {
    var k = iso(sab);
    var chegada = tipo === 'casa' ? soma(sab, -1) : sab;
    if (chegada < hoje) return 'passado';
    if (FECHADO[k]) return 'fechado';
    if (tipo === 'casa') return RESERVADO[k] ? 'ocupado' : 'livre';
    if (LOTADO[k]) return 'ocupado';
    if (POUCAS[k]) return 'poucas';
    return 'livre';
  }
  function disponivel(st) { return st === 'livre' || st === 'poucas'; }
  function rotuloStatus(tipo, st) {
    if (st === 'ocupado') return tipo === 'casa' ? 'Reservada' : 'Lotado';
    return ROTULO[st];
  }

  function periodo(tipo, sab) {
    return { chegada: tipo === 'casa' ? soma(sab, -1) : sab, saida: soma(sab, 1) };
  }
  // "7 e 8 de novembro", "6 a 8 de novembro", "31 de outubro a 1º de novembro"
  function intervaloLongo(tipo, sab) {
    var p = periodo(tipo, sab), a = p.chegada, b = p.saida;
    var liga = tipo === 'casa' ? ' a ' : ' e ';
    if (a.getMonth() === b.getMonth()) return diaMes(a) + liga + diaMes(b) + ' de ' + MESES[b.getMonth()];
    return diaMes(a) + ' de ' + MESES[a.getMonth()] + ' a ' + diaMes(b) + ' de ' + MESES[b.getMonth()];
  }
  // "7–8 nov", "31 out – 1 nov"
  function intervaloCurto(tipo, sab) {
    var p = periodo(tipo, sab), a = p.chegada, b = p.saida;
    if (a.getMonth() === b.getMonth()) return a.getDate() + '–' + b.getDate() + ' ' + MESES_CURTO[b.getMonth()];
    return a.getDate() + ' ' + MESES_CURTO[a.getMonth()] + ' – ' + b.getDate() + ' ' + MESES_CURTO[b.getMonth()];
  }
  function feriadosDoFds(sab) {
    var nomes = [];
    for (var i = -1; i <= 2; i++) {
      var f = FERIADOS[iso(soma(sab, i))];
      if (f && nomes.indexOf(f) < 0) nomes.push(f);
    }
    return nomes;
  }

  /* ---------- Estado ---------- */
  var estado = {
    tipo: 'suite',
    sel: null,     // ISO do sábado escolhido
    ver: 0,        // índice do primeiro mês visível
    suites: 1,
    adultos: 2,
    criancas: 0
  };

  var $ = function (id) { return document.getElementById(id); };
  var elMeses = $('meses');
  if (!elMeses) return;
  var elFaixa = $('meses-faixa');
  var mqDois = window.matchMedia('(min-width: 1100px)');
  function quantosMeses() { return mqDois.matches ? 2 : 1; }

  /* ---------- Calendário ---------- */
  function blocoTocaMes(sab, mes) {
    var dias = TIPOS[estado.tipo].dias;
    var inicio = dias[0] === 5 ? soma(sab, -1) : sab;
    for (var d = inicio; d <= soma(sab, 1); d = soma(d, 1)) if (d.getMonth() === mes) return true;
    return false;
  }

  function mesHTML(primeiro) {
    var ano = primeiro.getFullYear(), mes = primeiro.getMonth();
    var ultimo = new Date(ano, mes + 1, 0);
    var ini = soma(primeiro, -((primeiro.getDay() + 6) % 7));
    var fim = soma(ultimo, 6 - ((ultimo.getDay() + 6) % 7));
    var dias = TIPOS[estado.tipo].dias;
    var hojeIso = iso(hoje);

    var h = '<div class="mes"><h3 class="mes__nome">' + MESES[mes] + ' <span>' + ano + '</span></h3>';
    h += '<div class="mes__semana" aria-hidden="true">';
    CABECALHO.forEach(function (c, i) {
      var fdsCab = (i === 4 && estado.tipo === 'casa') || i >= 5;
      h += '<span' + (fdsCab ? ' class="fds-cab"' : '') + '>' + c + '</span>';
    });
    h += '</div><div class="mes__grade">';

    for (var d = ini; d <= fim; d = soma(d, 1)) {
      var w = d.getDay();
      var noMes = d.getMonth() === mes;
      var ehFds = dias.indexOf(w) >= 0;
      var sab = ehFds ? sabadoDe(d) : null;

      if (!noMes && (!ehFds || !blocoTocaMes(sab, mes))) {
        h += '<span class="dia dia--vazio" aria-hidden="true"></span>';
        continue;
      }

      var k = iso(d);
      var fer = FERIADOS[k];
      var cls = ['dia'];
      if (!noMes) cls.push('dia--fora');
      if (k === hojeIso) cls.push('dia--hoje');
      var miolo = '<span class="dia__n">' + d.getDate() + '</span>' + (fer ? '<span class="dia__fer" aria-hidden="true"></span>' : '');
      var dica = fer ? ' title="' + fer + '"' : '';

      if (!ehFds) {
        h += '<span class="' + cls.join(' ') + '"' + dica + '>' + miolo + '</span>';
        continue;
      }

      var sk = iso(sab);
      var st = status(estado.tipo, sab);
      var pos = w === dias[0] ? 'ini' : (w === 0 ? 'fim' : 'meio');
      cls.push('fds', 'fds--' + st, 'fds--' + pos);
      if (estado.sel === sk) cls.push('fds--sel');
      var texto = intervaloLongo(estado.tipo, sab) + ': ' + rotuloStatus(estado.tipo, st) + (fer ? ' (feriado: ' + fer + ')' : '');

      if (disponivel(st)) {
        h += '<button type="button" class="' + cls.join(' ') + '" data-sab="' + sk + '" aria-pressed="' + (estado.sel === sk) + '"' +
          ' aria-label="' + texto + '" title="' + texto + '"' + (w === 6 ? '' : ' tabindex="-1"') + '>' + miolo + '</button>';
      } else {
        h += '<span class="' + cls.join(' ') + '" title="' + texto + '">' + miolo + '</span>';
      }
    }
    return h + '</div></div>';
  }

  function desenharFaixa() {
    var n = quantosMeses();
    var h = '';
    MESES_AGENDA.forEach(function (m, i) {
      var atual = i >= estado.ver && i < estado.ver + n;
      var mostraAno = i === 0 || m.getMonth() === 0;
      h += '<button type="button" data-mes="' + i + '" aria-current="' + atual + '">' + MESES_CURTO[m.getMonth()] +
        (mostraAno ? '<small>' + String(m.getFullYear()).slice(2) + '</small>' : '') + '</button>';
    });
    elFaixa.innerHTML = h;
    var ativo = elFaixa.querySelector('[aria-current="true"]');
    if (ativo) elFaixa.scrollLeft = Math.max(0, ativo.offsetLeft - elFaixa.offsetLeft - 8);
  }

  function desenharCalendario() {
    var n = quantosMeses();
    estado.ver = Math.max(0, Math.min(estado.ver, MESES_AGENDA.length - n));
    elMeses.style.setProperty('--n', n);
    var h = '';
    var nomesFeriados = [];
    for (var i = estado.ver; i < estado.ver + n; i++) {
      var m = MESES_AGENDA[i];
      h += mesHTML(m);
      Object.keys(FERIADOS).sort().forEach(function (k) {
        var d = deIso(k);
        if (d.getFullYear() === m.getFullYear() && d.getMonth() === m.getMonth()) {
          nomesFeriados.push(d.getDate() + ' de ' + MESES[d.getMonth()] + ' (' + SEMANA[d.getDay()] + '), ' + FERIADOS[k]);
        }
      });
    }
    elMeses.innerHTML = h;
    $('mes-ant').disabled = estado.ver <= 0;
    $('mes-prox').disabled = estado.ver >= MESES_AGENDA.length - n;
    $('cal-feriados').textContent = nomesFeriados.length ? 'Feriados: ' + nomesFeriados.join(' · ') + '.' : '';
    $('leg-poucas').hidden = estado.tipo !== 'suite';
    desenharFaixa();
  }

  function proximosLivres(qtd) {
    var lista = [];
    var sab = soma(hoje, (6 - hoje.getDay() + 7) % 7);
    var limite = new Date(fimAgenda.getFullYear(), fimAgenda.getMonth() + 1, 0);
    while (lista.length < qtd && sab <= limite) {
      if (disponivel(status(estado.tipo, sab))) lista.push(sab);
      sab = soma(sab, 7);
    }
    return lista;
  }

  /* ---------- Resumo e mensagem ---------- */
  function moeda(v) {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  function plural(n, um, varios) { return n + ' ' + (n === 1 ? um : varios); }

  function mensagem(sab) {
    var t = TIPOS[estado.tipo];
    var p = periodo(estado.tipo, sab);
    var nome = $('nome').value.trim();
    var pessoas = plural(estado.adultos, 'adulto', 'adultos');
    if (estado.criancas) pessoas += ' e ' + plural(estado.criancas, 'criança', 'crianças') + ' (até 12 anos)';
    var linhas = [
      'Olá! Vim pelo site e quero reservar ' + (estado.tipo === 'casa' ? 'a *Casa do Lago*.' : '*' + plural(estado.suites, 'suíte', 'suítes') + '*.'),
      '',
      '*Chegada:* ' + SEMANA[p.chegada.getDay()] + ', ' + ddmm(p.chegada) + ', ' + t.entrada,
      '*Saída:* ' + SEMANA[p.saida.getDay()] + ', ' + ddmm(p.saida) + ', ' + t.saida,
      '*Pessoas:* ' + pessoas
    ];
    if (estado.tipo === 'suite') {
      var total = DIARIA_SUITE * estado.suites;
      linhas.push('*Valor estimado:* ' + moeda(total) + ' (entrada de 50%: ' + moeda(total / 2) + ')');
    } else if (VALOR_CASA !== null) {
      linhas.push('*Valor:* ' + moeda(VALOR_CASA) + ' (entrada de 50%: ' + moeda(VALOR_CASA / 2) + ')');
    }
    if (nome) linhas.push('*Nome:* ' + nome);
    linhas.push('', 'Esse fim de semana está disponível?');
    return linhas.join('\n');
  }

  function desenharResumo() {
    var vazio = $('resumo-vazio'), cheio = $('resumo-cheio');
    if (!estado.sel) {
      vazio.hidden = false;
      cheio.hidden = true;
      var livres = proximosLivres(4);
      $('atalhos').innerHTML = livres.length
        ? livres.map(function (s) { return '<button type="button" data-sab="' + iso(s) + '">' + intervaloCurto(estado.tipo, s) + '</button>'; }).join('')
        : '<p>Nenhum fim de semana livre na agenda. Chame no WhatsApp para ver outras opções.</p>';
      atualizarBarra();
      return;
    }

    var sab = deIso(estado.sel);
    var t = TIPOS[estado.tipo];
    var st = status(estado.tipo, sab);
    var p = periodo(estado.tipo, sab);
    var lim = LIMITES[estado.tipo];
    ['suites', 'adultos', 'criancas'].forEach(function (c) {
      estado[c] = Math.max(lim[c][0], Math.min(lim[c][1], estado[c]));
    });

    vazio.hidden = true;
    cheio.hidden = false;
    $('r-tipo').textContent = estado.tipo === 'casa' ? 'Casa do Lago' : 'Suíte';
    var selo = $('r-status');
    selo.textContent = rotuloStatus(estado.tipo, st);
    selo.className = 'selo selo--' + st;
    $('r-datas').textContent = intervaloLongo(estado.tipo, sab);
    $('r-entrada').textContent = SEMANA[p.chegada.getDay()] + ', ' + t.entrada.replace('a partir das ', 'das ');
    $('r-saida').textContent = SEMANA[p.saida.getDay()] + ', ' + t.saida;

    $('campo-suites').hidden = estado.tipo !== 'suite';
    ['suites', 'adultos', 'criancas'].forEach(function (c) {
      $('v-' + c).textContent = estado[c];
      document.querySelectorAll('[data-passo="' + c + '"]').forEach(function (b) {
        var delta = Number(b.getAttribute('data-delta'));
        b.disabled = delta < 0 ? estado[c] <= lim[c][0] : estado[c] >= lim[c][1];
      });
    });

    var avisos = [];
    var fers = feriadosDoFds(sab);
    if (fers.length && estado.tipo === 'suite') avisos.push('Fim de semana com feriado (' + fers.join(', ') + '). O valor pode mudar.');
    if (estado.tipo === 'suite' && estado.adultos > estado.suites * 2) avisos.push('Cada suíte é para um casal. Aumente o número de suítes ou confirme pelo WhatsApp.');
    if (st === 'poucas') avisos.push('Restam poucas suítes nesse fim de semana.');
    var aviso = $('r-aviso');
    aviso.hidden = !avisos.length;
    aviso.textContent = avisos.join(' ');

    var v = '';
    if (estado.tipo === 'suite') {
      var total = DIARIA_SUITE * estado.suites;
      v += '<div class="valor-linha"><span>' + plural(estado.suites, 'suíte', 'suítes') + ' × 1 diária</span><span>' + moeda(total) + '</span></div>';
      v += '<div class="valor-linha valor-linha--forte"><span>Entrada (50%)</span><strong>' + moeda(total / 2) + '</strong></div>';
      v += '<p class="valor-nota">Café da manhã incluso. Crianças até 12 anos não pagam.</p>';
    } else if (VALOR_CASA !== null) {
      v += '<div class="valor-linha"><span>Fim de semana</span><span>' + moeda(VALOR_CASA) + '</span></div>';
      v += '<div class="valor-linha valor-linha--forte"><span>Entrada (50%)</span><strong>' + moeda(VALOR_CASA / 2) + '</strong></div>';
    } else {
      v += '<div class="valor-linha valor-linha--forte"><span>Valor</span><strong>sob consulta</strong></div>';
      v += '<p class="valor-nota">A Casa do Lago é alugada para o fim de semana inteiro, para até 10 adultos.</p>';
    }
    $('r-valor').innerHTML = v;

    var msg = mensagem(sab);
    $('r-msg').textContent = msg;
    $('r-zap').href = 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(msg);
    atualizarBarra();
  }

  function desenharTudo() {
    desenharCalendario();
    desenharResumo();
  }

  /* ---------- Ações ---------- */
  function escolher(sk, mostrar) {
    estado.sel = sk;
    if (mostrar) {
      var d = deIso(sk);
      for (var i = 0; i < MESES_AGENDA.length; i++) {
        var m = MESES_AGENDA[i];
        if (m.getFullYear() === d.getFullYear() && m.getMonth() === d.getMonth()) { estado.ver = i; break; }
      }
    }
    desenharTudo();
  }

  function trocarTipo(tipo) {
    if (!TIPOS[tipo]) return;
    estado.tipo = tipo;
    var radio = $('tipo-' + tipo);
    if (radio) radio.checked = true;
    if (estado.sel && !disponivel(status(tipo, deIso(estado.sel)))) estado.sel = null;
    desenharTudo();
  }

  elMeses.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-sab]');
    if (b) escolher(estado.sel === b.getAttribute('data-sab') ? null : b.getAttribute('data-sab'), false);
  });
  // Destaca o fim de semana inteiro ao passar o mouse
  elMeses.addEventListener('mouseover', function (e) {
    var b = e.target.closest('button[data-sab]');
    elMeses.querySelectorAll('.paira').forEach(function (x) { x.classList.remove('paira'); });
    if (b) elMeses.querySelectorAll('button[data-sab="' + b.getAttribute('data-sab') + '"]').forEach(function (x) { x.classList.add('paira'); });
  });
  elMeses.addEventListener('mouseleave', function () {
    elMeses.querySelectorAll('.paira').forEach(function (x) { x.classList.remove('paira'); });
  });

  $('atalhos').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-sab]');
    if (b) escolher(b.getAttribute('data-sab'), true);
  });
  elFaixa.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-mes]');
    if (!b) return;
    estado.ver = Number(b.getAttribute('data-mes'));
    desenharCalendario();
  });
  $('mes-ant').addEventListener('click', function () { estado.ver--; desenharCalendario(); });
  $('mes-prox').addEventListener('click', function () { estado.ver++; desenharCalendario(); });
  document.querySelectorAll('input[name="tipo"]').forEach(function (r) {
    r.addEventListener('change', function () { trocarTipo(r.value); });
  });
  document.querySelectorAll('[data-ir-agenda]').forEach(function (b) {
    b.addEventListener('click', function () {
      trocarTipo(b.getAttribute('data-ir-agenda'));
      $('agenda').scrollIntoView({ block: 'start' });
    });
  });
  $('resumo-cheio').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-passo]');
    if (!b) return;
    var c = b.getAttribute('data-passo');
    estado[c] += Number(b.getAttribute('data-delta'));
    desenharResumo();
  });
  $('resumo-cheio').addEventListener('submit', function (e) { e.preventDefault(); });
  $('nome').addEventListener('input', function () {
    if (!estado.sel) return;
    var msg = mensagem(deIso(estado.sel));
    $('r-msg').textContent = msg;
    $('r-zap').href = 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(msg);
  });
  $('r-limpar').addEventListener('click', function () {
    estado.sel = null;
    desenharTudo();
    var alvo = elMeses.querySelector('button[data-sab]');
    if (alvo) alvo.focus({ preventScroll: true });
  });
  if (mqDois.addEventListener) mqDois.addEventListener('change', desenharCalendario);

  /* ---------- Barra de seleção (celular) ---------- */
  var resumoVisivel = false, agendaVisivel = false;
  function atualizarBarra() {
    var barra = $('barra-sel');
    if (!estado.sel) { barra.hidden = true; return; }
    $('b-datas').textContent = intervaloCurto(estado.tipo, deIso(estado.sel));
    $('b-tipo').textContent = estado.tipo === 'casa' ? 'Casa do Lago' : plural(estado.suites, 'suíte', 'suítes');
    barra.hidden = resumoVisivel || !agendaVisivel;
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (en.target.id === 'resumo') resumoVisivel = en.isIntersecting;
        if (en.target.id === 'agenda') agendaVisivel = en.isIntersecting;
      });
      atualizarBarra();
    }, { threshold: [0, 0.25] }).observe($('resumo'));
    new IntersectionObserver(function (es) {
      agendaVisivel = es[0].isIntersecting;
      atualizarBarra();
    }).observe($('agenda'));
  }

  $('cal-exemplo').hidden = !A.exemplo;
  desenharTudo();
})();

/* ---------- Topo e reflexo do lago ---------- */
(function () {
  var topo = document.getElementById('topo');
  if (topo) {
    var marcar = function () { topo.classList.toggle('rolou', window.scrollY > 8); };
    window.addEventListener('scroll', marcar, { passive: true });
    marcar();
  }

  var ceu = document.getElementById('ceu');
  var reflexo = document.getElementById('reflexo');
  if (ceu && reflexo) {
    var copia = ceu.cloneNode(true);
    copia.removeAttribute('id');
    copia.querySelectorAll('[id]').forEach(function (el) { el.removeAttribute('id'); });
    copia.querySelectorAll('h1').forEach(function (h) {
      var p = document.createElement('p');
      p.className = h.className;
      p.innerHTML = h.innerHTML;
      h.replaceWith(p);
    });
    reflexo.appendChild(copia);
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelectorAll('#ondas animate').forEach(function (a) { a.remove(); });
  }
})();
