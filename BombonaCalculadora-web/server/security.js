import crypto from 'node:crypto';

const COOKIE_ADMIN = 'bombonacalc_admin';

function base64Url(valor) {
  return Buffer.from(valor).toString('base64url');
}

function assinar(conteudo, segredo) {
  return crypto.createHmac('sha256', segredo).update(conteudo).digest('base64url');
}

export function criarTokenAdmin({ segredo, duracaoMinutos }) {
  const agora = Math.floor(Date.now() / 1000);
  const payload = base64Url(JSON.stringify({
    tipo: 'admin',
    emitidoEm: agora,
    expiraEm: agora + duracaoMinutos * 60,
    nonce: crypto.randomUUID()
  }));
  return `${payload}.${assinar(payload, segredo)}`;
}

export function validarTokenAdmin(token, segredo) {
  if (!token || !token.includes('.')) return false;
  const [payload, assinatura] = token.split('.');
  const assinaturaEsperada = assinar(payload, segredo);
  const recebido = Buffer.from(assinatura);
  const esperado = Buffer.from(assinaturaEsperada);
  if (recebido.length !== esperado.length || !crypto.timingSafeEqual(recebido, esperado)) return false;

  try {
    const dados = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return dados.tipo === 'admin' && Number(dados.expiraEm) > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function compararPin(pinRecebido, pinEsperado) {
  const recebido = Buffer.from(String(pinRecebido ?? ''));
  const esperado = Buffer.from(String(pinEsperado ?? ''));
  return recebido.length === esperado.length && crypto.timingSafeEqual(recebido, esperado);
}

export function analisarCookies(cabecalho = '') {
  return Object.fromEntries(
    cabecalho.split(';').map((parte) => parte.trim()).filter(Boolean).map((parte) => {
      const indice = parte.indexOf('=');
      return indice < 0
        ? [parte, '']
        : [parte.slice(0, indice), decodeURIComponent(parte.slice(indice + 1))];
    })
  );
}

export function obterCookieAdmin(requisicao) {
  return analisarCookies(requisicao.headers.cookie)[COOKIE_ADMIN] ?? null;
}

export function criarCabecalhoCookieAdmin(token, { producao, duracaoMinutos }) {
  const partes = [
    `${COOKIE_ADMIN}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${duracaoMinutos * 60}`
  ];
  if (producao) partes.push('Secure');
  return partes.join('; ');
}

export function criarCabecalhoRemoverCookieAdmin({ producao }) {
  const partes = [`${COOKIE_ADMIN}=`, 'Path=/', 'HttpOnly', 'SameSite=Strict', 'Max-Age=0'];
  if (producao) partes.push('Secure');
  return partes.join('; ');
}

export function aplicarCabecalhosSeguranca(resposta) {
  resposta.setHeader('X-Content-Type-Options', 'nosniff');
  resposta.setHeader('X-Frame-Options', 'DENY');
  resposta.setHeader('Referrer-Policy', 'same-origin');
  resposta.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  resposta.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  resposta.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  resposta.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; base-uri 'self'; connect-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; manifest-src 'self'; object-src 'none'; script-src 'self'; style-src 'self'"
  );
}

export class LimitadorMemoria {
  #entradas = new Map();

  constructor({ limite, janelaMs }) {
    this.limite = limite;
    this.janelaMs = janelaMs;
  }

  consumir(chave) {
    const agora = Date.now();
    const atual = this.#entradas.get(chave);
    if (!atual || atual.expiraEm <= agora) {
      this.#entradas.set(chave, { quantidade: 1, expiraEm: agora + this.janelaMs });
      return { permitido: true, restante: this.limite - 1, expiraEm: agora + this.janelaMs };
    }

    atual.quantidade += 1;
    if (atual.quantidade > this.limite) {
      return { permitido: false, restante: 0, expiraEm: atual.expiraEm };
    }
    return { permitido: true, restante: this.limite - atual.quantidade, expiraEm: atual.expiraEm };
  }
}

export function obterIp(requisicao, trustProxy = false) {
  if (trustProxy) {
    const encaminhado = requisicao.headers['x-forwarded-for'];
    if (encaminhado) return String(encaminhado).split(',')[0].trim();
  }
  return requisicao.socket.remoteAddress ?? 'desconhecido';
}
