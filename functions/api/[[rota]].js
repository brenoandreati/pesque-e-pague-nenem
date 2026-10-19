/*
  API da agenda e do painel de reservas.

  GET    /api/agenda             público: só a ocupação dos fins de semana, sem dados pessoais
  POST   /api/entrar             { senha } → cookie de sessão
  POST   /api/sair
  GET    /api/painel             reservas, bloqueios e ajustes (precisa de sessão)
  POST   /api/reservas           cria uma reserva
  PUT    /api/reservas/:id       altera
  DELETE /api/reservas/:id       apaga
  PUT    /api/bloqueios          { sabado, tipo, bloqueado, motivo }
  PUT    /api/ajustes            { suitesTotal, diariaSuite, valorCasa }

  Precisa de: banco D1 em env.DB e dos segredos PAINEL_SENHA e SESSAO_CHAVE.
*/

const AJUSTES_PADRAO = { suitesTotal: 6, diariaSuite: 30000, valorCasa: null }; // valores em centavos
const COOKIE = 'painel_sessao';
const DIAS_SESSAO = 60;
const MAX_TENTATIVAS = 8;
const JANELA_TENTATIVAS = 15 * 60 * 1000;

const texto = new TextEncoder();

function json(dados, status = 200, extra = {}) {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra }
  });
}
const erro = (mensagem, status = 400) => json({ erro: mensagem }, status);

// Data de hoje em Brasília (AAAA-MM-DD)
function hojeBrasilia(deslocamentoDias = 0) {
  return new Date(Date.now() - 3 * 3600e3 + deslocamentoDias * 864e5).toISOString().slice(0, 10);
}

/* ---------- Sessão ---------- */
function b64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function deB64url(s) {
  const b = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  return Uint8Array.from(atob(b), c => c.charCodeAt(0));
}
function chave(env) {
  return crypto.subtle.importKey('raw', texto.encode(env.SESSAO_CHAVE + ':' + env.PAINEL_SENHA),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
async function criarSessao(env) {
  const corpo = String(Date.now() + DIAS_SESSAO * 864e5);
  const assinatura = await crypto.subtle.sign('HMAC', await chave(env), texto.encode(corpo));
  return corpo + '.' + b64url(assinatura);
}
async function sessaoValida(request, env) {
  const par = (request.headers.get('cookie') || '').split(/;\s*/).find(p => p.startsWith(COOKIE + '='));
  if (!par) return false;
  const [corpo, assinatura] = par.slice(COOKIE.length + 1).split('.');
  if (!corpo || !assinatura || Number(corpo) < Date.now()) return false;
  try {
    return await crypto.subtle.verify('HMAC', await chave(env), deB64url(assinatura), texto.encode(corpo));
  } catch {
    return false;
  }
}
function cookieSessao(valor, maxAge) {
  return `${COOKIE}=${valor}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}
async function senhaConfere(digitada, env) {
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', texto.encode(String(digitada))),
    crypto.subtle.digest('SHA-256', texto.encode(env.PAINEL_SENHA))
  ]);
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let dif = 0;
  for (let i = 0; i < x.length; i++) dif |= x[i] ^ y[i];
  return dif === 0;
}

/* ---------- Ajustes ---------- */
async function lerAjustes(env) {
  const { results } = await env.DB.prepare('SELECT chave, valor FROM ajustes').all();
  const aj = { ...AJUSTES_PADRAO };
  for (const { chave: k, valor } of results) {
    if (k in aj) aj[k] = JSON.parse(valor);
  }
  return aj;
}

/* ---------- Reservas ---------- */
function ehSabado(iso) {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && new Date(iso + 'T12:00:00Z').getUTCDay() === 6;
}
function inteiro(v, min, max, padrao) {
  if (v === null || v === undefined || v === '') return padrao;
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : padrao;
}
function limparReserva(d) {
  const tipo = d.tipo === 'casa' ? 'casa' : d.tipo === 'suite' ? 'suite' : null;
  if (!tipo) throw new Error('Escolha Suíte ou Casa do Lago.');
  const sabado = String(d.sabado || '');
  if (!ehSabado(sabado)) throw new Error('Escolha um fim de semana válido.');
  const nome = String(d.nome || '').trim().slice(0, 120);
  if (!nome) throw new Error('Coloque o nome de quem reservou.');
  return {
    tipo,
    sabado,
    nome,
    telefone: String(d.telefone || '').replace(/[^\d+() -]/g, '').slice(0, 30),
    suites: tipo === 'suite' ? inteiro(d.suites, 1, 50, 1) : 1,
    adultos: inteiro(d.adultos, 0, 60, 2),
    criancas: inteiro(d.criancas, 0, 60, 0),
    valor: inteiro(d.valor, 0, 100000000, null),
    pagamento: ['pendente', 'entrada', 'pago'].includes(d.pagamento) ? d.pagamento : 'pendente',
    obs: String(d.obs || '').slice(0, 1000)
  };
}

// Confere se cabe no fim de semana. Devolve a mensagem de erro, ou null se estiver tudo certo.
async function conferirVaga(env, r, idIgnorado = '') {
  const bloq = await env.DB.prepare('SELECT 1 FROM bloqueios WHERE sabado = ? AND tipo = ?').bind(r.sabado, r.tipo).first();
  if (bloq) return 'Esse fim de semana está bloqueado. Desbloqueie antes de reservar.';
  if (r.tipo === 'casa') {
    const outra = await env.DB.prepare('SELECT nome FROM reservas WHERE tipo = ? AND sabado = ? AND id != ?')
      .bind('casa', r.sabado, idIgnorado).first();
    return outra ? `A Casa do Lago já está reservada nesse fim de semana (${outra.nome}).` : null;
  }
  const { suitesTotal } = await lerAjustes(env);
  const ocupadas = await env.DB.prepare('SELECT COALESCE(SUM(suites), 0) AS n FROM reservas WHERE tipo = ? AND sabado = ? AND id != ?')
    .bind('suite', r.sabado, idIgnorado).first('n');
  const livres = suitesTotal - ocupadas;
  if (r.suites > livres) {
    return livres <= 0 ? 'Não há suítes livres nesse fim de semana.' : `Só ${livres === 1 ? 'resta 1 suíte' : 'restam ' + livres + ' suítes'} nesse fim de semana.`;
  }
  return null;
}

/* ---------- Agenda pública ---------- */
function poucasVagas(livres, total) {
  return livres > 0 && livres < total && livres <= Math.max(1, Math.round(total * 0.3));
}
async function agendaPublica(env) {
  const desde = hojeBrasilia(-7);
  const [aj, ocupacao, bloqueios] = await Promise.all([
    lerAjustes(env),
    env.DB.prepare('SELECT tipo, sabado, SUM(suites) AS suites FROM reservas WHERE sabado >= ? GROUP BY tipo, sabado').bind(desde).all(),
    env.DB.prepare('SELECT tipo, sabado FROM bloqueios WHERE sabado >= ?').bind(desde).all()
  ]);
  const agenda = {
    suites: { lotado: [], poucasVagas: [], fechado: [] },
    casaDoLago: { reservado: [], fechado: [] },
    precos: {
      suiteDiaria: aj.diariaSuite / 100,
      casaDoLago: aj.valorCasa === null ? null : aj.valorCasa / 100
    }
  };
  for (const o of ocupacao.results) {
    if (o.tipo === 'casa') agenda.casaDoLago.reservado.push(o.sabado);
    else if (o.suites >= aj.suitesTotal) agenda.suites.lotado.push(o.sabado);
    else if (poucasVagas(aj.suitesTotal - o.suites, aj.suitesTotal)) agenda.suites.poucasVagas.push(o.sabado);
  }
  for (const b of bloqueios.results) {
    (b.tipo === 'casa' ? agenda.casaDoLago : agenda.suites).fechado.push(b.sabado);
  }
  return agenda;
}

/* ---------- Rotas ---------- */
async function ler(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export async function onRequest({ request, env, params }) {
  const rota = (params.rota || []).join('/');
  const metodo = request.method;

  if (!env.DB) return erro('Banco de dados não configurado.', 500);

  if (rota === 'agenda' && metodo === 'GET') {
    return json(await agendaPublica(env), 200, { 'cache-control': 'public, max-age=15' });
  }

  if (!env.PAINEL_SENHA || !env.SESSAO_CHAVE) return erro('O painel ainda não tem senha configurada.', 500);

  if (rota === 'entrar' && metodo === 'POST') {
    const ip = request.headers.get('cf-connecting-ip') || 'local';
    const agora = Date.now();
    const recentes = await env.DB.prepare('SELECT COUNT(*) AS n FROM tentativas WHERE ip = ? AND quando > ?')
      .bind(ip, agora - JANELA_TENTATIVAS).first('n');
    if (recentes >= MAX_TENTATIVAS) return erro('Muitas tentativas erradas. Espere 15 minutos e tente de novo.', 429);
    const { senha } = await ler(request);
    if (!(await senhaConfere(senha || '', env))) {
      await env.DB.batch([
        env.DB.prepare('INSERT INTO tentativas (ip, quando) VALUES (?, ?)').bind(ip, agora),
        env.DB.prepare('DELETE FROM tentativas WHERE quando < ?').bind(agora - 864e5)
      ]);
      await new Promise(r => setTimeout(r, 700));
      return erro('Senha incorreta.', 401);
    }
    await env.DB.prepare('DELETE FROM tentativas WHERE ip = ?').bind(ip).run();
    return json({ ok: true }, 200, { 'set-cookie': cookieSessao(await criarSessao(env), DIAS_SESSAO * 86400) });
  }

  if (rota === 'sair' && metodo === 'POST') {
    return json({ ok: true }, 200, { 'set-cookie': cookieSessao('', 0) });
  }

  // Daqui para baixo, só com sessão
  if (!(await sessaoValida(request, env))) return erro('Entre com a senha do painel.', 401);

  if (rota === 'painel' && metodo === 'GET') {
    const [reservas, bloqueios, ajustes] = await Promise.all([
      env.DB.prepare('SELECT * FROM reservas WHERE sabado >= ? ORDER BY sabado, criado_em').bind(hojeBrasilia(-400)).all(),
      env.DB.prepare('SELECT * FROM bloqueios WHERE sabado >= ?').bind(hojeBrasilia(-30)).all(),
      lerAjustes(env)
    ]);
    return json({ reservas: reservas.results, bloqueios: bloqueios.results, ajustes, hoje: hojeBrasilia() });
  }

  if (rota === 'reservas' && metodo === 'POST') {
    let r;
    try { r = limparReserva(await ler(request)); } catch (e) { return erro(e.message); }
    const problema = await conferirVaga(env, r);
    if (problema) return erro(problema, 409);
    const agora = new Date().toISOString();
    const id = crypto.randomUUID();
    await env.DB.prepare(`INSERT INTO reservas (id, tipo, sabado, nome, telefone, suites, adultos, criancas, valor, pagamento, obs, criado_em, atualizado_em)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, r.tipo, r.sabado, r.nome, r.telefone, r.suites, r.adultos, r.criancas, r.valor, r.pagamento, r.obs, agora, agora).run();
    return json({ ok: true, id }, 201);
  }

  const m = rota.match(/^reservas\/([\w-]+)$/);
  if (m && metodo === 'PUT') {
    let r;
    try { r = limparReserva(await ler(request)); } catch (e) { return erro(e.message); }
    const existe = await env.DB.prepare('SELECT 1 FROM reservas WHERE id = ?').bind(m[1]).first();
    if (!existe) return erro('Essa reserva não existe mais.', 404);
    const problema = await conferirVaga(env, r, m[1]);
    if (problema) return erro(problema, 409);
    await env.DB.prepare(`UPDATE reservas SET tipo = ?, sabado = ?, nome = ?, telefone = ?, suites = ?, adultos = ?, criancas = ?,
      valor = ?, pagamento = ?, obs = ?, atualizado_em = ? WHERE id = ?`)
      .bind(r.tipo, r.sabado, r.nome, r.telefone, r.suites, r.adultos, r.criancas, r.valor, r.pagamento, r.obs, new Date().toISOString(), m[1]).run();
    return json({ ok: true });
  }
  if (m && metodo === 'DELETE') {
    await env.DB.prepare('DELETE FROM reservas WHERE id = ?').bind(m[1]).run();
    return json({ ok: true });
  }

  if (rota === 'bloqueios' && metodo === 'PUT') {
    const d = await ler(request);
    const tipo = d.tipo === 'casa' ? 'casa' : 'suite';
    if (!ehSabado(String(d.sabado || ''))) return erro('Escolha um fim de semana válido.');
    if (d.bloqueado) {
      const tem = await env.DB.prepare('SELECT COUNT(*) AS n FROM reservas WHERE tipo = ? AND sabado = ?').bind(tipo, d.sabado).first('n');
      if (tem) return erro('Esse fim de semana já tem reserva. Exclua ou mude a reserva antes de bloquear.', 409);
      await env.DB.prepare('INSERT OR REPLACE INTO bloqueios (sabado, tipo, motivo) VALUES (?, ?, ?)')
        .bind(d.sabado, tipo, String(d.motivo || '').slice(0, 200)).run();
    } else {
      await env.DB.prepare('DELETE FROM bloqueios WHERE sabado = ? AND tipo = ?').bind(d.sabado, tipo).run();
    }
    return json({ ok: true });
  }

  if (rota === 'ajustes' && metodo === 'PUT') {
    const d = await ler(request);
    const novo = {
      suitesTotal: inteiro(d.suitesTotal, 1, 50, AJUSTES_PADRAO.suitesTotal),
      diariaSuite: inteiro(d.diariaSuite, 0, 100000000, AJUSTES_PADRAO.diariaSuite),
      valorCasa: inteiro(d.valorCasa, 0, 100000000, null)
    };
    await env.DB.batch(Object.entries(novo).map(([k, v]) =>
      env.DB.prepare('INSERT OR REPLACE INTO ajustes (chave, valor) VALUES (?, ?)').bind(k, JSON.stringify(v))));
    return json({ ok: true, ajustes: novo });
  }

  return erro('Rota não encontrada.', 404);
}
