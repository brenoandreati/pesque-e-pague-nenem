-- Reservas de hospedagem. Valores em centavos.
CREATE TABLE IF NOT EXISTS reservas (
  id TEXT PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('suite', 'casa')),
  sabado TEXT NOT NULL,                 -- sábado do fim de semana (AAAA-MM-DD)
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL DEFAULT '',
  suites INTEGER NOT NULL DEFAULT 1,
  adultos INTEGER NOT NULL DEFAULT 2,
  criancas INTEGER NOT NULL DEFAULT 0,
  valor INTEGER,                        -- valor total; NULL = ainda não combinado
  pagamento TEXT NOT NULL DEFAULT 'pendente' CHECK (pagamento IN ('pendente', 'entrada', 'pago')),
  obs TEXT NOT NULL DEFAULT '',
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reservas_sabado ON reservas (sabado, tipo);

-- Fins de semana fechados para um tipo de hospedagem
CREATE TABLE IF NOT EXISTS bloqueios (
  sabado TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('suite', 'casa')),
  motivo TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (sabado, tipo)
);

-- Ajustes do painel (número de suítes, preços)
CREATE TABLE IF NOT EXISTS ajustes (
  chave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);

-- Tentativas de senha erradas, para frear quem tenta adivinhar
CREATE TABLE IF NOT EXISTS tentativas (
  ip TEXT NOT NULL,
  quando INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tentativas_ip ON tentativas (ip, quando);
