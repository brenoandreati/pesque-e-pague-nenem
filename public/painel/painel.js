(function () {
  'use strict';

  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var MESES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  var PAGAMENTO = { pendente: 'Aguardando entrada', entrada: 'Entrada paga', pago: 'Pago' };
  var NOME_TIPO = { suite: 'Suítes', casa: 'Casa do Lago' };

  var $ = function (id) { return document.getElementById(id); };

  /* ---------- Datas e dinheiro ---------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function deIso(s) { var p = String(s).split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function soma(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function diaMes(d) { return d.getDate() === 1 ? '1º' : String(d.getDate()); }

  function periodo(tipo, sab) { return { chegada: tipo === 'casa' ? soma(sab, -1) : sab, saida: soma(sab, 1) }; }
  function intervaloLongo(tipo, sab) {
    var p = periodo(tipo, sab), a = p.chegada, b = p.saida, liga = tipo === 'casa' ? ' a ' : ' e ';
    if (a.getMonth() === b.getMonth()) return diaMes(a) + liga + diaMes(b) + ' de ' + MESES[b.getMonth()];
    return diaMes(a) + ' de ' + MESES[a.getMonth()] + ' a ' + diaMes(b) + ' de ' + MESES[b.getMonth()];
  }
  function intervaloCurto(tipo, sab) {
    var p = periodo(tipo, sab), a = p.chegada, b = p.saida;
    if (a.getMonth() === b.getMonth()) return a.getDate() + '–' + b.getDate() + ' ' + MESES_CURTO[b.getMonth()];
    return a.getDate() + ' ' + MESES_CURTO[a.getMonth()] + ' – ' + b.getDate() + ' ' + MESES_CURTO[b.getMonth()];
  }

  function moeda(centavos) {
    return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  function paraCampo(centavos) {
    return centavos === null || centavos === undefined ? '' : (centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  // "300", "300,50", "1.200,00" → centavos; vazio → null; inválido → NaN
  function lerDinheiro(s) {
    s = String(s || '').replace(/[R$\s]/g, '');
    if (!s) return null;
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    var n = Number(s);
    return isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function plural(n, um, varios) { return n + ' ' + (n === 1 ? um : varios); }
  function linkWhats(tel, texto) {
    var d = String(tel || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.length <= 11) d = '55' + d;
    return 'https://wa.me/' + d + (texto ? '?text=' + encodeURIComponent(texto) : '');
  }

  /* ---------- Feriados nacionais ---------- */
  function pascoa(ano) {
    var a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4;
    var f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    var i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    return new Date(ano, Math.floor((h + l - 7 * m + 114) / 31) - 1, ((h + l - 7 * m + 114) % 31) + 1);
  }
  var cacheFeriados = {};
  function feriadosDoAno(ano) {
    if (cacheFeriados[ano]) return cacheFeriados[ano];
    var f = {};
    [['01-01', 'Confraternização Universal'], ['04-21', 'Tiradentes'], ['05-01', 'Dia do Trabalho'], ['09-07', 'Independência'],
      ['10-12', 'N. Sra. Aparecida'], ['11-02', 'Finados'], ['11-15', 'Proclamação da República'], ['11-20', 'Consciência Negra'], ['12-25', 'Natal']
    ].forEach(function (x) { f[ano + '-' + x[0]] = x[1]; });
    var p = pascoa(ano);
    f[iso(soma(p, -48))] = 'Carnaval';
    f[iso(soma(p, -47))] = 'Carnaval';
    f[iso(soma(p, -2))] = 'Sexta-feira Santa';
    f[iso(soma(p, 60))] = 'Corpus Christi';
    return (cacheFeriados[ano] = f);
  }
  function feriadosDoFds(sab) {
    var nomes = [];
    for (var i = -1; i <= 2; i++) {
      var d = soma(sab, i), n = feriadosDoAno(d.getFullYear())[iso(d)];
      if (n && nomes.indexOf(n) < 0) nomes.push(n);
    }
    return nomes;
  }

  /* ---------- Estado ---------- */
  var est = {
    dados: null,
    hoje: null,
    tipo: 'suite',
    visao: 'fds',
    mes: 0,
    meses: [],
    filtro: 'futuras',
    busca: '',
    fdsAberto: null,
    editando: null,
    tipoForm: 'suite',
    valorManual: false,
    form: { suites: 1, adultos: 2, criancas: 0 }
  };
  try {
    est.tipo = localStorage.getItem('painel-tipo') === 'casa' ? 'casa' : 'suite';
    est.visao = localStorage.getItem('painel-visao') === 'lista' ? 'lista' : 'fds';
  } catch (e) { /* sem armazenamento local */ }
  function guardar(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignora */ } }

  function aj() { return est.dados.ajustes; }
  function reservasDe(tipo, k) {
    return est.dados.reservas.filter(function (r) { return r.tipo === tipo && r.sabado === k; });
  }
  function bloqueioDe(tipo, k) {
    return est.dados.bloqueios.filter(function (b) { return b.tipo === tipo && b.sabado === k; })[0] || null;
  }
  function ocupadas(k, ignorarId) {
    return reservasDe('suite', k).reduce(function (s, r) { return s + (r.id === ignorarId ? 0 : r.suites); }, 0);
  }
  function recebido(r) {
    if (r.valor === null) return 0;
    return r.pagamento === 'pago' ? r.valor : r.pagamento === 'entrada' ? Math.round(r.valor / 2) : 0;
  }
  function ehFutura(r) { return soma(deIso(r.sabado), 1) >= est.hoje; }
  function proximoSabado() {
    var w = est.hoje.getDay();
    return w === 0 ? soma(est.hoje, -1) : soma(est.hoje, 6 - w);
  }
  function sabadosAte(fim) {
    var lista = [];
    for (var s = proximoSabado(); s <= fim; s = soma(s, 7)) lista.push(s);
    return lista;
  }
  function vagasTexto(tipo, k, ignorarId) {
    if (bloqueioDe(tipo, k)) return 'bloqueado';
    if (tipo === 'casa') {
      var outra = reservasDe('casa', k).filter(function (r) { return r.id !== ignorarId; })[0];
      return outra ? 'reservada (' + outra.nome.split(' ')[0] + ')' : 'livre';
    }
    var livres = aj().suitesTotal - ocupadas(k, ignorarId);
    return livres <= 0 ? 'lotado' : plural(livres, 'livre', 'livres');
  }
  function temVaga(tipo, k, ignorarId, precisa) {
    if (bloqueioDe(tipo, k)) return false;
    if (tipo === 'casa') return !reservasDe('casa', k).some(function (r) { return r.id !== ignorarId; });
    return aj().suitesTotal - ocupadas(k, ignorarId) >= (precisa || 1);
  }

  /* ---------- API ---------- */
  function api(metodo, rota, corpo) {
    return fetch('/api/' + rota, {
      method: metodo,
      headers: corpo ? { 'content-type': 'application/json' } : {},
      body: corpo ? JSON.stringify(corpo) : undefined,
      credentials: 'same-origin'
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) {
          var e = new Error(d.erro || 'Não foi possível falar com o servidor. Confira a internet e tente de novo.');
          e.status = r.status;
          throw e;
        }
        return d;
      });
    }, function () {
      throw new Error('Sem conexão. Confira a internet e tente de novo.');
    });
  }

  function mostrar(tela) {
    $('tela-entrar').hidden = tela !== 'entrar';
    $('tela-carregando').hidden = tela !== 'carregando';
    $('tela-app').hidden = tela !== 'app';
  }

  function carregar() {
    return api('GET', 'painel').then(function (d) {
      var primeiraVez = !est.dados;
      est.dados = d;
      est.hoje = deIso(d.hoje);
      if (primeiraVez) montarMeses();
      mostrar('app');
      desenhar();
      if (est.fdsAberto && $('folha-fds').open) desenharFds();
    }).catch(function (e) {
      if (e.status === 401 || !est.dados) {
        mostrar('entrar');
        if (e.status !== 401) erroEntrar(e.message);
        setTimeout(function () { $('senha').focus(); }, 50);
      } else {
        aviso(e.message, true);
      }
    });
  }

  function montarMeses() {
    var fim = new Date(2027, 11, 1), doze = new Date(est.hoje.getFullYear(), est.hoje.getMonth() + 12, 1);
    if (doze > fim) fim = doze;
    est.meses = [];
    for (var m = new Date(est.hoje.getFullYear(), est.hoje.getMonth(), 1); m <= fim; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) est.meses.push(m);
    est.ultimoSabado = soma(new Date(fim.getFullYear(), fim.getMonth() + 1, 0), 0);
  }

  /* ---------- Desenho ---------- */
  function desenhar() {
    $('p-tipo-' + est.tipo).checked = true;
    $('aba-fds').setAttribute('aria-selected', est.visao === 'fds');
    $('aba-lista').setAttribute('aria-selected', est.visao === 'lista');
    $('v-fds').hidden = est.visao !== 'fds';
    $('v-lista').hidden = est.visao !== 'lista';
    $('btn-nova').lastChild.textContent = est.tipo === 'casa' ? ' Reservar a casa' : ' Nova reserva';
    desenharResumo();
    if (est.visao === 'fds') desenharMes(); else desenharLista();
  }

  function desenharResumo() {
    var t = est.tipo, sab = proximoSabado(), k = iso(sab);
    var futuras = est.dados.reservas.filter(function (r) { return r.tipo === t && ehFutura(r); });
    var pendentes = futuras.filter(function (r) { return r.pagamento === 'pendente'; });
    var aReceber = futuras.reduce(function (s, r) { return s + (r.valor === null ? 0 : r.valor - recebido(r)); }, 0);
    var entradasPendentes = pendentes.reduce(function (s, r) { return s + (r.valor === null ? 0 : Math.round(r.valor / 2)); }, 0);
    var ehEste = soma(sab, -1) <= est.hoje;

    var h = '<button type="button" class="num" data-abrir-fds="' + k + '"><span class="num__rot">' + (ehEste ? 'Este fim de semana' : 'Próximo fim de semana') + '</span>';
    h += '<span class="num__valor">' + intervaloCurto(t, sab) + '</span>';
    var bl = bloqueioDe(t, k);
    if (bl) {
      h += '<span class="num__sub">Bloqueado' + (bl.motivo ? ': ' + esc(bl.motivo) : '') + '</span>';
    } else if (t === 'suite') {
      var oc = ocupadas(k), tot = aj().suitesTotal;
      h += '<span class="num__sub">' + oc + ' de ' + tot + ' suítes ocupadas</span>';
      h += '<span class="barra' + (oc >= tot ? ' barra--cheia' : '') + '"><i style="width:' + Math.min(100, Math.round(oc / tot * 100)) + '%"></i></span>';
    } else {
      var rc = reservasDe('casa', k)[0];
      h += '<span class="num__sub">' + (rc ? 'Reservada para ' + esc(rc.nome) : 'Casa livre') + '</span>';
    }
    h += '</button>';

    h += '<button type="button" class="num' + (pendentes.length ? ' num--alerta' : ' num--ok') + '" data-ir-filtro="pendente">';
    h += '<span class="num__rot">Aguardando entrada</span><span class="num__valor">' + pendentes.length + '</span>';
    h += '<span class="num__sub">' + (pendentes.length ? moeda(entradasPendentes) + ' de entrada a receber' : 'Todas as entradas em dia') + '</span></button>';

    h += '<button type="button" class="num" data-ir-filtro="futuras"><span class="num__rot">A receber</span><span class="num__valor">' + moeda(aReceber).replace(/,00$/, '') + '</span>';
    h += '<span class="num__sub">em ' + plural(futuras.length, 'reserva futura', 'reservas futuras') + '</span></button>';
    $('painel-resumo').innerHTML = h;
  }

  function desenharMes() {
    est.mes = Math.max(0, Math.min(est.mes, est.meses.length - 1));
    var m = est.meses[est.mes];
    $('p-mes-ant').disabled = est.mes === 0;
    $('p-mes-prox').disabled = est.mes === est.meses.length - 1;

    var faixa = '';
    est.meses.forEach(function (mm, i) {
      var mostraAno = i === 0 || mm.getMonth() === 0;
      faixa += '<button type="button" data-mes="' + i + '" aria-current="' + (i === est.mes) + '">' + MESES_CURTO[mm.getMonth()] +
        (mostraAno ? '<small>' + String(mm.getFullYear()).slice(2) + '</small>' : '') + '</button>';
    });
    var elFaixa = $('p-meses');
    elFaixa.innerHTML = faixa;
    var ativo = elFaixa.querySelector('[aria-current="true"]');
    if (ativo) elFaixa.scrollLeft = Math.max(0, ativo.offsetLeft - elFaixa.offsetLeft - 8);

    $('p-mes-nome').innerHTML = MESES[m.getMonth()] + ' <span>' + m.getFullYear() + '</span>';

    var h = '';
    for (var s = new Date(m.getFullYear(), m.getMonth(), 1); s.getMonth() === m.getMonth(); s = soma(s, 1)) {
      if (s.getDay() === 6) h += linhaFds(s);
    }
    $('fds-lista').innerHTML = h;
  }

  function linhaFds(sab) {
    var t = est.tipo, k = iso(sab), rs = reservasDe(t, k), bl = bloqueioDe(t, k);
    var p = periodo(t, sab), a = p.chegada, b = p.saida;
    var passado = b < est.hoje;
    var estado, rotulo, status, barra = '';
    if (t === 'suite') {
      var oc = ocupadas(k), tot = aj().suitesTotal, livres = tot - oc;
      if (bl) { estado = 'bloqueado'; rotulo = 'Bloqueado'; status = bl.motivo ? esc(bl.motivo) : 'Fechado para reservas'; }
      else {
        if (oc >= tot) { estado = 'cheio'; rotulo = 'Lotado'; }
        else if (oc > 0) { estado = 'parcial'; rotulo = plural(livres, 'livre', 'livres'); }
        else { estado = 'livre'; rotulo = 'Livre'; }
        status = oc + ' de ' + tot + ' suítes ocupadas';
        barra = '<span class="barra' + (oc >= tot ? ' barra--cheia' : '') + '"><i style="width:' + Math.min(100, Math.round(oc / tot * 100)) + '%"></i></span>';
      }
    } else if (bl) { estado = 'bloqueado'; rotulo = 'Bloqueada'; status = bl.motivo ? esc(bl.motivo) : 'Fechada para reservas'; }
    else if (rs.length) { estado = 'cheio'; rotulo = 'Reservada'; status = esc(rs[0].nome); }
    else { estado = 'livre'; rotulo = 'Livre'; status = 'Ninguém reservou ainda'; }

    var nomes = t === 'suite' && rs.length
      ? '<span class="fds-linha__nomes">' + rs.map(function (r) { return esc(r.nome.split(' ')[0]) + ' (' + r.suites + ')'; }).join(' · ') + '</span>'
      : '';
    var extras = '';
    var pend = rs.filter(function (r) { return r.pagamento === 'pendente'; }).length;
    if (pend) extras += '<span class="etiqueta etiqueta--pendente">' + plural(pend, 'aguardando entrada', 'aguardando entrada') + '</span>';
    feriadosDoFds(sab).forEach(function (f) { extras += '<span class="etiqueta etiqueta--feriado">' + f + '</span>'; });

    var cruza = a.getMonth() !== b.getMonth();
    var legenda = cruza ? MESES_CURTO[a.getMonth()] + '/' + MESES_CURTO[b.getMonth()] : (t === 'casa' ? 'sex a dom' : 'sáb e dom');

    return '<button type="button" class="fds-linha' + (passado ? ' fds-linha--passado' : '') + '" data-abrir-fds="' + k + '"' +
      ' aria-label="' + intervaloLongo(t, sab) + ': ' + rotulo + '">' +
      '<span class="fds-linha__data"><b>' + a.getDate() + '–' + b.getDate() + '</b><small>' + legenda + '</small></span>' +
      '<span class="fds-linha__corpo"><span class="fds-linha__status">' + status + '</span>' + barra + nomes +
      (extras ? '<span class="fds-linha__extra">' + extras + '</span>' : '') + '</span>' +
      '<span class="fds-linha__fim"><span class="estado estado--' + estado + '">' + rotulo + '</span>' +
      '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M9.5 6l6 6-6 6"></path></svg></span>' +
      '</button>';
  }

  function cartaoReserva(r, comData) {
    var sab = deIso(r.sabado);
    var pessoas = plural(r.adultos, 'adulto', 'adultos') + (r.criancas ? ', ' + plural(r.criancas, 'criança', 'crianças') : '');
    var h = '<article class="res" data-id="' + r.id + '"><div class="res__topo"><div>';
    if (comData) h += '<p class="res__data">' + intervaloCurto(r.tipo, sab) + '</p>';
    h += '<p class="res__nome">' + esc(r.nome) + '</p>';
    h += '<p class="res__linha">' + (r.tipo === 'suite' ? plural(r.suites, 'suíte', 'suítes') + ' · ' : '') + pessoas + '</p>';
    h += '</div><span class="pag pag--' + r.pagamento + '">' + PAGAMENTO[r.pagamento] + '</span></div>';

    if (r.valor !== null) {
      var rec = recebido(r), falta = r.valor - rec;
      h += '<div class="res__valores"><span><small>Total</small><b>' + moeda(r.valor) + '</b></span>' +
        '<span><small>Recebido</small><b>' + moeda(rec) + '</b></span>' +
        '<span class="' + (falta ? 'falta' : 'quitado') + '"><small>Falta</small><b>' + (falta ? moeda(falta) : 'nada') + '</b></span></div>';
    } else {
      h += '<p class="res__linha">Valor ainda não definido</p>';
    }
    if (r.obs) h += '<p class="res__obs">' + esc(r.obs) + '</p>';

    h += '<div class="pag-troca" role="group" aria-label="Pagamento de ' + esc(r.nome) + '">';
    [['pendente', 'Aguardando'], ['entrada', '50% pago'], ['pago', 'Pago']].forEach(function (o) {
      h += '<button type="button" data-pag="' + o[0] + '" aria-pressed="' + (r.pagamento === o[0]) + '">' + o[1] + '</button>';
    });
    h += '</div><div class="res__acoes">';
    var zap = linkWhats(r.telefone, 'Olá, ' + r.nome.split(' ')[0] + '! Aqui é do Pesque Pague do Neném, sobre a sua reserva de ' + intervaloLongo(r.tipo, sab) + '.');
    if (zap) h += '<a class="botao botao--contorno botao--pequeno" href="' + zap + '" target="_blank" rel="noopener">WhatsApp ' + esc(r.telefone) + '</a>';
    h += '<button type="button" class="botao botao--texto botao--pequeno" data-editar="' + r.id + '">Editar</button></div></article>';
    return h;
  }

  function desenharLista() {
    var t = est.tipo, busca = est.busca.trim().toLowerCase();
    var todas = est.dados.reservas.filter(function (r) { return r.tipo === t; });
    var futuras = todas.filter(ehFutura);
    var grupos = {
      futuras: futuras,
      pendente: futuras.filter(function (r) { return r.pagamento === 'pendente'; }),
      entrada: futuras.filter(function (r) { return r.pagamento === 'entrada'; }),
      pago: futuras.filter(function (r) { return r.pagamento === 'pago'; }),
      anteriores: todas.filter(function (r) { return !ehFutura(r); }).reverse()
    };
    var rotulos = { futuras: 'Próximas', pendente: 'Aguardando entrada', entrada: 'Entrada paga', pago: 'Pago', anteriores: 'Anteriores' };
    $('filtros').innerHTML = Object.keys(rotulos).map(function (f) {
      return '<button type="button" data-filtro="' + f + '" aria-pressed="' + (est.filtro === f) + '">' + rotulos[f] + ' <span>' + grupos[f].length + '</span></button>';
    }).join('');

    var lista = grupos[est.filtro].filter(function (r) {
      return !busca || r.nome.toLowerCase().indexOf(busca) >= 0 || String(r.telefone).replace(/\D/g, '').indexOf(busca.replace(/\D/g, '') || '§') >= 0;
    });
    if (!lista.length) {
      $('res-lista').innerHTML = '<div class="vazio"><b>' + (busca ? 'Ninguém com esse nome' : 'Nenhuma reserva aqui') + '</b>' +
        '<p>' + (busca ? 'Confira a grafia ou limpe a busca.' : 'Use o botão "' + (t === 'casa' ? 'Reservar a casa' : 'Nova reserva') + '" para marcar a primeira.') + '</p></div>';
      return;
    }
    var h = '', atual = '';
    lista.forEach(function (r) {
      var mes = r.sabado.slice(0, 7);
      if (mes !== atual) {
        atual = mes;
        var d = deIso(r.sabado);
        h += '<p class="grupo-titulo">' + MESES[d.getMonth()] + ' de ' + d.getFullYear() + '</p>';
      }
      h += cartaoReserva(r, true);
    });
    $('res-lista').innerHTML = h;
  }

  /* ---------- Folha do fim de semana ---------- */
  function abrirFds(k) {
    est.fdsAberto = k;
    desenharFds();
    if (!$('folha-fds').open) $('folha-fds').showModal();
  }

  function desenharFds() {
    var k = est.fdsAberto, t = est.tipo, sab = deIso(k), rs = reservasDe(t, k), bl = bloqueioDe(t, k);
    var p = periodo(t, sab);
    $('fds-tipo').textContent = NOME_TIPO[t];
    $('fds-titulo').textContent = intervaloLongo(t, sab);
    var sub = t === 'casa' ? 'Entrada sexta às 18h · saída domingo até 18h' : 'Check-in sábado às 10h · check-out domingo até 18h';
    var fer = feriadosDoFds(sab);
    if (fer.length) sub += ' · Feriado: ' + fer.join(', ');
    $('fds-sub').textContent = sub;

    var h = '';
    var passado = p.saida < est.hoje;
    if (t === 'suite') {
      var oc = ocupadas(k), tot = aj().suitesTotal, livres = Math.max(0, tot - oc);
      h += '<div class="ocupacao"><p class="ocupacao__num"><b>' + oc + ' de ' + tot + '</b><span>suítes ocupadas · ' +
        (livres ? (livres === 1 ? 'resta 1' : 'restam ' + livres) : 'lotado') + '</span></p>' +
        '<span class="barra' + (oc >= tot ? ' barra--cheia' : '') + '"><i style="width:' + Math.min(100, Math.round(oc / tot * 100)) + '%"></i></span></div>';
    }
    if (rs.length) h += '<div class="res-grupo">' + rs.map(function (r) { return cartaoReserva(r, false); }).join('') + '</div>';

    h += '<div class="fds-acoes">';
    if (bl) {
      h += '<div class="bloqueio"><p><b>Fim de semana bloqueado.</b> ' + (bl.motivo ? esc(bl.motivo) + '. ' : '') + 'No site ele aparece como ocupado.</p>' +
        '<div class="bloqueio__linha"><button type="button" class="botao botao--contorno botao--pequeno" data-desbloquear>Desbloquear</button></div></div>';
    } else {
      if (temVaga(t, k) && !passado) {
        h += '<button type="button" class="botao botao--lago botao--largo" data-nova-em="' + k + '">' +
          (t === 'casa' ? 'Reservar a Casa do Lago' : 'Nova reserva neste fim de semana') + '</button>';
      }
      if (!rs.length && !passado) {
        h += '<div class="bloqueio" id="area-bloquear"><p>Vai fechar a ' + (t === 'casa' ? 'casa' : 'hospedagem') + ' nesse fim de semana? Bloqueie para aparecer como ocupado no site.</p>' +
          '<div class="bloqueio__linha"><label class="so-leitor" for="motivo-bloqueio">Motivo do bloqueio</label>' +
          '<input class="entrada-txt" id="motivo-bloqueio" type="text" placeholder="Motivo (opcional): reforma, evento…">' +
          '<button type="button" class="botao botao--contorno botao--pequeno" data-bloquear>Bloquear</button></div></div>';
      }
    }
    h += '</div>';
    $('fds-conteudo').innerHTML = h;
  }

  function bloquear(bloqueado) {
    var motivo = bloqueado && $('motivo-bloqueio') ? $('motivo-bloqueio').value : '';
    api('PUT', 'bloqueios', { sabado: est.fdsAberto, tipo: est.tipo, bloqueado: bloqueado, motivo: motivo }).then(function () {
      aviso(bloqueado ? 'Fim de semana bloqueado' : 'Fim de semana liberado');
      return carregar();
    }).catch(function (e) { aviso(e.message, true); });
  }

  /* ---------- Formulário de reserva ---------- */
  function abrirForm(r, sabPadrao) {
    est.editando = r ? r.id : null;
    est.tipoForm = r ? r.tipo : est.tipo;
    est.form = { suites: r ? r.suites : 1, adultos: r ? r.adultos : 2, criancas: r ? r.criancas : 0 };
    est.valorManual = !!r;
    var t = est.tipoForm;

    $('res-tipo').textContent = NOME_TIPO[t];
    $('res-titulo').textContent = r ? 'Editar reserva' : (t === 'casa' ? 'Reservar a casa' : 'Nova reserva');
    $('c-suites').hidden = t !== 'suite';

    var escolhido = r ? r.sabado : (sabPadrao || primeiroLivre(t));
    var opcoes = sabadosAte(est.ultimoSabado).map(iso);
    if (opcoes.indexOf(escolhido) < 0) opcoes.unshift(escolhido);
    $('r-sabado').innerHTML = opcoes.map(function (k) {
      var livre = temVaga(t, k, est.editando);
      return '<option value="' + k + '"' + (k === escolhido ? ' selected' : '') + (!livre && k !== escolhido ? ' disabled' : '') + '>' +
        intervaloCurto(t, deIso(k)) + ' ' + deIso(k).getFullYear() + ' · ' + vagasTexto(t, k, est.editando) + '</option>';
    }).join('');

    $('r-nome').value = r ? r.nome : '';
    $('r-telefone').value = r ? r.telefone : '';
    $('r-obs').value = r ? r.obs : '';
    $('pg-' + (r ? r.pagamento : 'pendente')).checked = true;
    $('r-valor').value = r ? paraCampo(r.valor) : paraCampo(valorPadrao());
    $('area-excluir').hidden = !r;
    $('confirma-excluir').hidden = true;
    $('btn-excluir').hidden = false;
    $('erro-reserva').hidden = true;
    atualizarForm();
    $('folha-reserva').showModal();
    if (!r) setTimeout(function () { $('r-nome').focus(); }, 60);
  }

  function primeiroLivre(t) {
    var lista = sabadosAte(est.ultimoSabado);
    for (var i = 0; i < lista.length; i++) if (temVaga(t, iso(lista[i]))) return iso(lista[i]);
    return iso(proximoSabado());
  }

  function valorPadrao() {
    if (est.tipoForm === 'suite') return aj().diariaSuite * est.form.suites;
    return aj().valorCasa;
  }

  function atualizarForm() {
    var t = est.tipoForm;
    var limites = { suites: [1, Math.max(1, aj().suitesTotal)], adultos: [1, t === 'casa' ? 10 : 30], criancas: [0, 20] };
    ['suites', 'adultos', 'criancas'].forEach(function (c) {
      est.form[c] = Math.max(limites[c][0], Math.min(limites[c][1], est.form[c]));
      $('r-' + c).textContent = est.form[c];
      document.querySelectorAll('[data-cont="' + c + '"]').forEach(function (b) {
        var delta = Number(b.getAttribute('data-delta'));
        b.disabled = delta < 0 ? est.form[c] <= limites[c][0] : est.form[c] >= limites[c][1];
      });
    });
    if (!est.valorManual) $('r-valor').value = paraCampo(valorPadrao());

    $('r-valor-dica').textContent = t === 'suite'
      ? 'Diária ' + moeda(aj().diariaSuite) + ' × ' + plural(est.form.suites, 'suíte', 'suítes') + ' = ' + moeda(aj().diariaSuite * est.form.suites) + '. Pode mudar se combinou outro valor.'
      : (aj().valorCasa !== null ? 'Valor padrão: ' + moeda(aj().valorCasa) + '. Pode mudar se combinou outro valor.' : 'Coloque o valor combinado com o cliente.');

    var valor = lerDinheiro($('r-valor').value);
    var pag = document.querySelector('input[name="pagamento"]:checked').value;
    var conta = $('r-conta');
    if (valor === null || isNaN(valor)) {
      conta.innerHTML = 'Coloque o valor para calcular a entrada de 50%.';
    } else {
      var entrada = Math.round(valor / 2);
      var rec = pag === 'pago' ? valor : pag === 'entrada' ? entrada : 0;
      conta.innerHTML = 'Entrada (50%): <b>' + moeda(entrada) + '</b> · ' +
        (valor - rec ? 'Falta receber: <b>' + moeda(valor - rec) + '</b>' : '<b>Tudo recebido</b>');
    }
  }

  function salvarReserva(e) {
    e.preventDefault();
    var erroEl = $('erro-reserva');
    var valor = lerDinheiro($('r-valor').value);
    var nome = $('r-nome').value.trim();
    var falha = !nome ? 'Coloque o nome de quem reservou.' : (typeof valor === 'number' && isNaN(valor) ? 'O valor não está certo. Use só números, como 300 ou 1.200,00.' : '');
    if (falha) {
      erroEl.textContent = falha;
      erroEl.hidden = false;
      return;
    }
    var corpo = {
      tipo: est.tipoForm,
      sabado: $('r-sabado').value,
      nome: nome,
      telefone: $('r-telefone').value.trim(),
      suites: est.form.suites,
      adultos: est.form.adultos,
      criancas: est.form.criancas,
      valor: valor,
      pagamento: document.querySelector('input[name="pagamento"]:checked').value,
      obs: $('r-obs').value.trim()
    };
    var btn = $('btn-salvar');
    btn.disabled = true;
    btn.textContent = 'Salvando…';
    var pedido = est.editando ? api('PUT', 'reservas/' + est.editando, corpo) : api('POST', 'reservas', corpo);
    pedido.then(function () {
      $('folha-reserva').close();
      aviso(est.editando ? 'Reserva atualizada' : 'Reserva salva. O site já mostra a data ocupada.');
      return carregar();
    }).catch(function (err) {
      erroEl.textContent = err.message;
      erroEl.hidden = false;
    }).then(function () {
      btn.disabled = false;
      btn.textContent = 'Salvar reserva';
    });
  }

  function excluirReserva() {
    api('DELETE', 'reservas/' + est.editando).then(function () {
      $('folha-reserva').close();
      aviso('Reserva excluída. A data voltou a ficar livre no site.');
      return carregar();
    }).catch(function (err) {
      $('erro-reserva').textContent = err.message;
      $('erro-reserva').hidden = false;
    });
  }

  function mudarPagamento(id, pagamento) {
    var r = est.dados.reservas.filter(function (x) { return x.id === id; })[0];
    if (!r || r.pagamento === pagamento) return;
    var antes = r.pagamento;
    r.pagamento = pagamento;
    redesenharAbertos();
    api('PUT', 'reservas/' + id, r).then(function () {
      aviso(r.nome.split(' ')[0] + ': ' + PAGAMENTO[pagamento].toLowerCase());
    }).catch(function (e) {
      r.pagamento = antes;
      redesenharAbertos();
      aviso(e.message, true);
    });
  }

  function redesenharAbertos() {
    desenhar();
    if ($('folha-fds').open) desenharFds();
  }

  /* ---------- Ajustes ---------- */
  var suitesAjuste = 6;
  function abrirAjustes() {
    suitesAjuste = aj().suitesTotal;
    $('aj-suites').textContent = suitesAjuste;
    $('aj-diaria').value = paraCampo(aj().diariaSuite);
    $('aj-casa').value = paraCampo(aj().valorCasa);
    $('erro-ajustes').hidden = true;
    $('folha-ajustes').showModal();
  }
  function salvarAjustes(e) {
    e.preventDefault();
    var diaria = lerDinheiro($('aj-diaria').value), casa = lerDinheiro($('aj-casa').value);
    if (diaria === null || isNaN(diaria) || (casa !== null && isNaN(casa))) {
      $('erro-ajustes').textContent = 'Confira os valores. Use só números, como 300 ou 1.200,00.';
      $('erro-ajustes').hidden = false;
      return;
    }
    api('PUT', 'ajustes', { suitesTotal: suitesAjuste, diariaSuite: diaria, valorCasa: casa }).then(function () {
      $('folha-ajustes').close();
      aviso('Ajustes salvos');
      return carregar();
    }).catch(function (err) {
      $('erro-ajustes').textContent = err.message;
      $('erro-ajustes').hidden = false;
    });
  }

  /* ---------- Avisos ---------- */
  var timerAviso;
  function aviso(msg, ehErro) {
    var t = $('toast');
    t.textContent = msg;
    t.className = 'toast' + (ehErro ? ' toast--erro' : '');
    t.hidden = false;
    clearTimeout(timerAviso);
    timerAviso = setTimeout(function () { t.hidden = true; }, ehErro ? 5000 : 2800);
  }
  function erroEntrar(msg) {
    $('erro-entrar').textContent = msg;
    $('erro-entrar').hidden = false;
  }

  /* ---------- Eventos ---------- */
  $('form-entrar').addEventListener('submit', function (e) {
    e.preventDefault();
    var senha = $('senha').value;
    if (!senha) { erroEntrar('Digite a senha.'); return; }
    var btn = $('btn-entrar');
    btn.disabled = true;
    btn.textContent = 'Entrando…';
    $('erro-entrar').hidden = true;
    api('POST', 'entrar', { senha: senha }).then(function () {
      $('senha').value = '';
      return carregar();
    }).catch(function (err) {
      erroEntrar(err.message);
    }).then(function () {
      btn.disabled = false;
      btn.textContent = 'Entrar';
    });
  });

  document.querySelectorAll('input[name="p-tipo"]').forEach(function (r) {
    r.addEventListener('change', function () {
      est.tipo = r.value;
      guardar('painel-tipo', est.tipo);
      desenhar();
    });
  });
  $('aba-fds').addEventListener('click', function () { est.visao = 'fds'; guardar('painel-visao', 'fds'); desenhar(); });
  $('aba-lista').addEventListener('click', function () { est.visao = 'lista'; guardar('painel-visao', 'lista'); desenhar(); });
  $('p-mes-ant').addEventListener('click', function () { est.mes--; desenharMes(); });
  $('p-mes-prox').addEventListener('click', function () { est.mes++; desenharMes(); });
  $('p-meses').addEventListener('click', function (e) {
    var b = e.target.closest('[data-mes]');
    if (b) { est.mes = Number(b.getAttribute('data-mes')); desenharMes(); }
  });
  $('busca').addEventListener('input', function () { est.busca = this.value; desenharLista(); });
  $('filtros').addEventListener('click', function (e) {
    var b = e.target.closest('[data-filtro]');
    if (b) { est.filtro = b.getAttribute('data-filtro'); desenharLista(); }
  });
  $('btn-nova').addEventListener('click', function () { abrirForm(null); });
  $('btn-ajustes').addEventListener('click', abrirAjustes);

  // Cliques dentro do painel e das folhas
  document.addEventListener('click', function (e) {
    var el;
    if ((el = e.target.closest('[data-abrir-fds]'))) {
      var k = el.getAttribute('data-abrir-fds');
      var d = deIso(k);
      for (var i = 0; i < est.meses.length; i++) {
        if (est.meses[i].getFullYear() === d.getFullYear() && est.meses[i].getMonth() === d.getMonth()) { est.mes = i; break; }
      }
      abrirFds(k);
    } else if ((el = e.target.closest('[data-ir-filtro]'))) {
      est.visao = 'lista';
      est.filtro = el.getAttribute('data-ir-filtro');
      guardar('painel-visao', 'lista');
      desenhar();
      $('v-lista').scrollIntoView({ block: 'start', behavior: 'smooth' });
    } else if ((el = e.target.closest('[data-pag]'))) {
      var card = el.closest('[data-id]');
      if (card) mudarPagamento(card.getAttribute('data-id'), el.getAttribute('data-pag'));
    } else if ((el = e.target.closest('[data-editar]'))) {
      var id = el.getAttribute('data-editar');
      abrirForm(est.dados.reservas.filter(function (r) { return r.id === id; })[0]);
    } else if ((el = e.target.closest('[data-nova-em]'))) {
      abrirForm(null, el.getAttribute('data-nova-em'));
    } else if (e.target.closest('[data-bloquear]')) {
      bloquear(true);
    } else if (e.target.closest('[data-desbloquear]')) {
      bloquear(false);
    } else if ((el = e.target.closest('[data-fechar]'))) {
      el.closest('dialog').close();
    }
  });

  // Fecha a folha ao tocar fora dela
  document.querySelectorAll('dialog.folha').forEach(function (d) {
    d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
  });
  $('folha-fds').addEventListener('close', function () { est.fdsAberto = null; });

  $('form-reserva').addEventListener('submit', salvarReserva);
  $('form-reserva').addEventListener('click', function (e) {
    var b = e.target.closest('[data-cont]');
    if (!b) return;
    est.form[b.getAttribute('data-cont')] += Number(b.getAttribute('data-delta'));
    atualizarForm();
  });
  $('r-valor').addEventListener('input', function () { est.valorManual = true; atualizarForm(); });
  document.querySelectorAll('input[name="pagamento"]').forEach(function (r) { r.addEventListener('change', atualizarForm); });
  $('btn-excluir').addEventListener('click', function () { $('confirma-excluir').hidden = false; this.hidden = true; });
  $('btn-excluir-nao').addEventListener('click', function () { $('confirma-excluir').hidden = true; $('btn-excluir').hidden = false; });
  $('btn-excluir-sim').addEventListener('click', excluirReserva);

  $('form-ajustes').addEventListener('submit', salvarAjustes);
  $('form-ajustes').addEventListener('click', function (e) {
    var b = e.target.closest('[data-aj]');
    if (!b) return;
    suitesAjuste = Math.max(1, Math.min(50, suitesAjuste + Number(b.getAttribute('data-aj'))));
    $('aj-suites').textContent = suitesAjuste;
  });
  $('btn-sair').addEventListener('click', function () {
    api('POST', 'sair').catch(function () {}).then(function () {
      $('folha-ajustes').close();
      est.dados = null;
      mostrar('entrar');
    });
  });

  // Atualiza sozinho quando a pessoa volta para o painel
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && est.dados && !document.querySelector('dialog[open]')) carregar();
  });

  mostrar('carregando');
  carregar();
})();
