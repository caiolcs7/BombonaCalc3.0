import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { promisify } from 'node:util';
import {
  aplicarCabecalhosSeguranca,
  compararPin,
  criarCabecalhoCookieAdmin,
  criarCabecalhoRemoverCookieAdmin,
  criarTokenAdmin,
  LimitadorMemoria,
  obterCookieAdmin,
  obterIp,
  validarTokenAdmin
} from './security.js';
import {
  ErroValidacao,
  normalizarClienteId,
  normalizarMaiusculo,
  validarConfiguracoes,
  validarCriacaoCalculo,
  validarEdicaoCalculo,
  validarRecipientes
} from './validation.js';
import { calcularProducao } from './services/calculation-service.js';

const gzip = promisify(zlib.gzip);
const TIPOS = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.ico', 'image/x-icon'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8']
]);

function responderJson(resposta, status, dados, cabecalhos = {}) {
  resposta.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...cabecalhos
  });
  resposta.end(JSON.stringify(dados));
}

function responderErro(resposta, status, codigo, mensagem, extras = {}) {
  responderJson(resposta, status, { erro: { codigo, mensagem, ...extras } });
}

async function lerCorpoJson(requisicao, limiteBytes = 32 * 1024) {
  const partes = [];
  let tamanho = 0;
  for await (const parte of requisicao) {
    tamanho += parte.length;
    if (tamanho > limiteBytes) {
      const erro = new Error('Corpo da requisição excede o limite permitido.');
      erro.codigoHttp = 413;
      throw erro;
    }
    partes.push(parte);
  }
  if (!partes.length) return {};
  try {
    return JSON.parse(Buffer.concat(partes).toString('utf8'));
  } catch {
    const erro = new Error('JSON inválido.');
    erro.codigoHttp = 400;
    throw erro;
  }
}

function rotaId(caminho, sufixo = '') {
  const padrao = sufixo
    ? new RegExp(`^/api/calculos/([^/]+)/${sufixo}$`)
    : /^\/api\/calculos\/([^/]+)$/;
  return caminho.match(padrao)?.[1] ?? null;
}

function exigeAdmin(requisicao, resposta, configuracao) {
  const token = obterCookieAdmin(requisicao);
  if (!validarTokenAdmin(token, configuracao.sessionSecret)) {
    responderErro(resposta, 401, 'ADMIN_NAO_AUTENTICADO', 'A sessão administrativa não está ativa.');
    return false;
  }
  return true;
}

async function servirArquivo(requisicao, resposta, configuracao, url) {
  let caminhoRelativo = decodeURIComponent(url.pathname);
  if (caminhoRelativo === '/') caminhoRelativo = '/index.html';
  const caminhoNormalizado = path.normalize(caminhoRelativo).replace(/^(\.\.(\/|\\|$))+/, '');
  let caminhoCompleto = path.join(configuracao.diretorioPublico, caminhoNormalizado);

  if (!caminhoCompleto.startsWith(configuracao.diretorioPublico)) {
    responderErro(resposta, 403, 'ACESSO_NEGADO', 'Acesso negado.');
    return;
  }

  try {
    let estatistica = await fs.stat(caminhoCompleto);
    if (estatistica.isDirectory()) caminhoCompleto = path.join(caminhoCompleto, 'index.html');
    let conteudo = await fs.readFile(caminhoCompleto);
    const extensao = path.extname(caminhoCompleto).toLowerCase();
    const tipo = TIPOS.get(extensao) ?? 'application/octet-stream';
    const podeComprimir = /^(text\/|application\/(json|javascript))/.test(tipo)
      && String(requisicao.headers['accept-encoding'] ?? '').includes('gzip')
      && conteudo.length > 1024;

    const cabecalhos = {
      'Content-Type': tipo,
      'Cache-Control': caminhoCompleto.endsWith('index.html') || caminhoCompleto.endsWith('sw.js')
        ? 'no-cache'
        : 'public, max-age=86400'
    };
    if (podeComprimir) {
      conteudo = await gzip(conteudo);
      cabecalhos['Content-Encoding'] = 'gzip';
      cabecalhos.Vary = 'Accept-Encoding';
    }
    resposta.writeHead(200, cabecalhos);
    resposta.end(conteudo);
  } catch (erro) {
    if (erro.code === 'ENOENT' && !path.extname(url.pathname)) {
      const conteudo = await fs.readFile(path.join(configuracao.diretorioPublico, 'index.html'));
      resposta.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
      resposta.end(conteudo);
      return;
    }
    if (erro.code === 'ENOENT') {
      responderErro(resposta, 404, 'ARQUIVO_NAO_ENCONTRADO', 'Arquivo não encontrado.');
      return;
    }
    throw erro;
  }
}

export function criarAplicacao({ repositorio, configuracao }) {
  const limitadorLogin = new LimitadorMemoria({ limite: 5, janelaMs: 15 * 60 * 1000 });
  const limitadorEscrita = new LimitadorMemoria({ limite: 120, janelaMs: 60 * 1000 });

  return async function aplicacao(requisicao, resposta) {
    aplicarCabecalhosSeguranca(resposta);
    const url = new URL(requisicao.url, `http://${requisicao.headers.host ?? 'localhost'}`);
    const caminho = url.pathname;
    const metodo = requisicao.method ?? 'GET';

    try {
      if (caminho === '/api/health' && metodo === 'GET') {
        responderJson(resposta, 200, { status: 'ok', versao: '4.0.0', horario: new Date().toISOString() });
        return;
      }

      if (caminho === '/api/bootstrap' && metodo === 'GET') {
        responderJson(resposta, 200, await repositorio.obterBootstrap());
        return;
      }

      if (caminho === '/api/calculos' && metodo === 'GET') {
        const produtoId = normalizarMaiusculo(url.searchParams.get('produtoId'), 60);
        const limite = Math.min(Math.max(Number(url.searchParams.get('limite')) || 50, 1), 100);
        const itens = await repositorio.listarCalculos({ produtoId, limite });
        responderJson(resposta, 200, { itens, filtro: { produtoId }, totalExibido: itens.length });
        return;
      }

      if (caminho === '/api/calculos' && metodo === 'POST') {
        const ip = obterIp(requisicao, configuracao.trustProxy);
        const cota = limitadorEscrita.consumir(ip);
        if (!cota.permitido) {
          responderErro(resposta, 429, 'LIMITE_EXCEDIDO', 'Muitas gravações em pouco tempo. Tente novamente em alguns instantes.');
          return;
        }
        const dados = validarCriacaoCalculo(await lerCorpoJson(requisicao));
        const [recipiente, configuracoes] = await Promise.all([
          repositorio.obterRecipiente(dados.recipienteId),
          repositorio.obterConfiguracoes()
        ]);
        if (!recipiente) {
          responderErro(resposta, 422, 'RECIPIENTE_INVALIDO', 'O recipiente selecionado não está disponível.');
          return;
        }
        let calculo;
        try {
          calculo = calcularProducao({
            pesoBrutoKg: dados.pesoBrutoKg,
            gramaturaG: dados.gramaturaG,
            recipiente,
            taxaRendimento: configuracoes.taxaRendimento,
            politicaArredondamento: configuracoes.politicaArredondamento
          });
        } catch (erro) {
          responderErro(resposta, 422, erro.codigo ?? 'CALCULO_INVALIDO', erro.message, { campo: erro.campo });
          return;
        }
        const clienteId = normalizarClienteId(requisicao.headers['x-client-id']);
        const registro = await repositorio.criarCalculo({
          produtoId: dados.produtoId,
          endereco: dados.endereco,
          recipiente,
          entrada: { pesoBrutoKg: dados.pesoBrutoKg, gramaturaG: dados.gramaturaG },
          calculo: {
            pesoLiquidoKg: calculo.pesoLiquidoKg,
            taxaRendimento: configuracoes.taxaRendimento,
            politicaArredondamento: configuracoes.politicaArredondamento,
            quantidadeCalculadaOriginal: calculo.quantidadeFinal,
            quantidadeFinal: calculo.quantidadeFinal,
            versaoFormula: calculo.versaoFormula
          },
          criadoPorCliente: clienteId
        });
        responderJson(resposta, 201, { registro });
        return;
      }

      const idDetalhe = rotaId(caminho);
      if (idDetalhe && metodo === 'GET') {
        const registro = await repositorio.obterCalculo(idDetalhe);
        if (!registro) responderErro(resposta, 404, 'REGISTRO_NAO_ENCONTRADO', 'Registro não encontrado.');
        else responderJson(resposta, 200, { registro });
        return;
      }

      if (idDetalhe && metodo === 'PATCH') {
        const ip = obterIp(requisicao, configuracao.trustProxy);
        if (!limitadorEscrita.consumir(ip).permitido) {
          responderErro(resposta, 429, 'LIMITE_EXCEDIDO', 'Muitas alterações em pouco tempo.');
          return;
        }
        const dados = validarEdicaoCalculo(await lerCorpoJson(requisicao));
        const resultado = await repositorio.atualizarCalculo(idDetalhe, {
          ...dados,
          clienteId: normalizarClienteId(requisicao.headers['x-client-id'])
        });
        if (resultado.tipo === 'nao_encontrado') {
          responderErro(resposta, 404, 'REGISTRO_NAO_ENCONTRADO', 'Registro não encontrado.');
        } else if (resultado.tipo === 'conflito') {
          responderErro(resposta, 409, 'CONFLITO_DE_EDICAO', 'Este registro foi alterado por outra pessoa. Recarregue os dados antes de editar novamente.', { atual: resultado.atual });
        } else {
          responderJson(resposta, 200, { registro: resultado.registro });
        }
        return;
      }

      if (idDetalhe && metodo === 'DELETE') {
        const removido = await repositorio.excluirCalculo(
          idDetalhe,
          normalizarClienteId(requisicao.headers['x-client-id'])
        );
        if (!removido) responderErro(resposta, 404, 'REGISTRO_NAO_ENCONTRADO', 'Registro não encontrado.');
        else responderJson(resposta, 200, { removido: true, id: idDetalhe });
        return;
      }

      const idRestaurar = rotaId(caminho, 'restaurar');
      if (idRestaurar && metodo === 'POST') {
        const restaurado = await repositorio.restaurarCalculo(
          idRestaurar,
          normalizarClienteId(requisicao.headers['x-client-id'])
        );
        if (!restaurado) responderErro(resposta, 404, 'REGISTRO_NAO_ENCONTRADO', 'Registro excluído não encontrado.');
        else responderJson(resposta, 200, { restaurado: true, id: idRestaurar });
        return;
      }

      if (caminho === '/api/admin/sessao' && metodo === 'POST') {
        const ip = obterIp(requisicao, configuracao.trustProxy);
        const cota = limitadorLogin.consumir(ip);
        if (!cota.permitido) {
          responderErro(resposta, 429, 'PIN_BLOQUEADO', 'Muitas tentativas incorretas. Aguarde antes de tentar novamente.');
          return;
        }
        const corpo = await lerCorpoJson(requisicao);
        if (!compararPin(corpo.pin, configuracao.adminPin)) {
          responderErro(resposta, 401, 'PIN_INVALIDO', 'PIN administrativo inválido.');
          return;
        }
        const token = criarTokenAdmin({
          segredo: configuracao.sessionSecret,
          duracaoMinutos: configuracao.sessaoAdminMinutos
        });
        responderJson(resposta, 200, { autenticado: true, expiraEmMinutos: configuracao.sessaoAdminMinutos }, {
          'Set-Cookie': criarCabecalhoCookieAdmin(token, {
            producao: configuracao.producao,
            duracaoMinutos: configuracao.sessaoAdminMinutos
          })
        });
        return;
      }

      if (caminho === '/api/admin/sessao' && metodo === 'GET') {
        responderJson(resposta, 200, {
          autenticado: validarTokenAdmin(obterCookieAdmin(requisicao), configuracao.sessionSecret)
        });
        return;
      }

      if (caminho === '/api/admin/sessao' && metodo === 'DELETE') {
        responderJson(resposta, 200, { autenticado: false }, {
          'Set-Cookie': criarCabecalhoRemoverCookieAdmin({ producao: configuracao.producao })
        });
        return;
      }

      if (caminho === '/api/admin/configuracao' && metodo === 'GET') {
        if (!exigeAdmin(requisicao, resposta, configuracao)) return;
        responderJson(resposta, 200, await repositorio.obterAdministracao());
        return;
      }

      if (caminho === '/api/admin/configuracoes' && metodo === 'PUT') {
        if (!exigeAdmin(requisicao, resposta, configuracao)) return;
        const dados = validarConfiguracoes(await lerCorpoJson(requisicao));
        responderJson(resposta, 200, { configuracoes: await repositorio.salvarConfiguracoes(dados) });
        return;
      }

      if (caminho === '/api/admin/recipientes' && metodo === 'PUT') {
        if (!exigeAdmin(requisicao, resposta, configuracao)) return;
        const recipientes = validarRecipientes(await lerCorpoJson(requisicao));
        responderJson(resposta, 200, { recipientes: await repositorio.salvarRecipientes(recipientes) });
        return;
      }

      if (caminho === '/api/admin/calculos' && metodo === 'DELETE') {
        if (!exigeAdmin(requisicao, resposta, configuracao)) return;
        await repositorio.limparCalculos();
        responderJson(resposta, 200, { limpo: true });
        return;
      }

      if (caminho.startsWith('/api/')) {
        responderErro(resposta, 404, 'ROTA_NAO_ENCONTRADA', 'Rota não encontrada.');
        return;
      }

      if (!['GET', 'HEAD'].includes(metodo)) {
        responderErro(resposta, 405, 'METODO_NAO_PERMITIDO', 'Método não permitido.');
        return;
      }

      await servirArquivo(requisicao, resposta, configuracao, url);
    } catch (erro) {
      if (erro instanceof ErroValidacao) {
        responderErro(resposta, 422, 'VALIDACAO', erro.message, { campos: erro.campos });
        return;
      }
      if (erro.codigoHttp) {
        responderErro(resposta, erro.codigoHttp, 'REQUISICAO_INVALIDA', erro.message);
        return;
      }
      console.error('Erro não tratado:', erro);
      responderErro(resposta, 500, 'ERRO_INTERNO', 'Não foi possível concluir a operação.');
    }
  };
}
