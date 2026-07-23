import crypto from 'node:crypto';

function mapearRecipiente(linha) {
  return {
    id: linha.id,
    nome: linha.name,
    taraKg: Number(linha.tare_kg),
    cor: linha.color,
    ativo: linha.active,
    ordem: linha.sort_order
  };
}

function mapearCalculo(linha) {
  return {
    id: linha.id,
    produtoId: linha.product_id,
    endereco: linha.address,
    recipiente: {
      id: linha.container_id,
      nome: linha.container_name,
      taraKg: Number(linha.container_tare_kg),
      cor: linha.container_color
    },
    entrada: {
      pesoBrutoKg: Number(linha.gross_weight_kg),
      gramaturaG: Number(linha.unit_weight_g)
    },
    calculo: {
      pesoLiquidoKg: Number(linha.net_weight_kg),
      taxaRendimento: Number(linha.yield_rate),
      politicaArredondamento: linha.rounding_policy,
      quantidadeCalculadaOriginal: linha.original_quantity,
      quantidadeFinal: linha.final_quantity,
      versaoFormula: linha.formula_version
    },
    versao: linha.version,
    criadoPorCliente: linha.created_by_client,
    atualizadoPorCliente: linha.updated_by_client,
    criadoEm: linha.created_at.toISOString(),
    atualizadoEm: linha.updated_at.toISOString(),
    excluidoEm: linha.deleted_at?.toISOString() ?? null
  };
}

export class RepositorioPostgres {
  constructor({ databaseUrl, databaseSsl }) {
    this.databaseUrl = databaseUrl;
    this.databaseSsl = databaseSsl;
    this.pool = null;
  }

  async inicializar() {
    const { Pool } = await import('pg');
    this.pool = new Pool({
      connectionString: this.databaseUrl,
      ssl: this.databaseSsl ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000
    });
    await this.pool.query('SELECT 1');
  }

  async encerrar() {
    await this.pool?.end();
  }

  async obterBootstrap() {
    const [configuracoes, recipientes] = await Promise.all([
      this.obterConfiguracoes(),
      this.pool.query('SELECT * FROM containers WHERE active = true ORDER BY sort_order, name')
    ]);
    return { configuracoes, recipientes: recipientes.rows.map(mapearRecipiente) };
  }

  async listarCalculos({ produtoId = '', limite = 50 }) {
    const parametros = [];
    let filtro = 'WHERE deleted_at IS NULL';
    if (produtoId) {
      parametros.push(`${produtoId}%`);
      filtro += ` AND product_id LIKE $${parametros.length}`;
    }
    parametros.push(limite);
    const resultado = await this.pool.query(
      `SELECT * FROM calculations ${filtro} ORDER BY created_at DESC, id DESC LIMIT $${parametros.length}`,
      parametros
    );
    return resultado.rows.map(mapearCalculo);
  }

  async obterCalculo(id) {
    const resultado = await this.pool.query(
      'SELECT * FROM calculations WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    if (!resultado.rowCount) return null;
    const revisoes = await this.pool.query(
      `SELECT id, revision_number, changed_by_client, changed_at, previous_values, new_values
       FROM calculation_revisions WHERE calculation_id = $1 ORDER BY revision_number DESC`,
      [id]
    );
    return {
      ...mapearCalculo(resultado.rows[0]),
      revisoes: revisoes.rows.map((linha) => ({
        id: linha.id,
        numero: linha.revision_number,
        alteradoPorCliente: linha.changed_by_client,
        alteradoEm: linha.changed_at.toISOString(),
        anterior: linha.previous_values,
        atual: linha.new_values
      }))
    };
  }

  async obterRecipiente(id) {
    const resultado = await this.pool.query('SELECT * FROM containers WHERE id = $1 AND active = true', [id]);
    return resultado.rowCount ? mapearRecipiente(resultado.rows[0]) : null;
  }

  async obterConfiguracoes() {
    const resultado = await this.pool.query('SELECT yield_rate, rounding_policy FROM app_settings WHERE id = 1');
    const linha = resultado.rows[0];
    return { taxaRendimento: Number(linha.yield_rate), politicaArredondamento: linha.rounding_policy };
  }

  async criarCalculo(dados) {
    const id = dados.id ?? crypto.randomUUID();
    const r = dados.recipiente;
    const e = dados.entrada;
    const c = dados.calculo;
    const resultado = await this.pool.query(
      `INSERT INTO calculations (
        id, product_id, address, container_id, container_name, container_tare_kg, container_color,
        gross_weight_kg, unit_weight_g, net_weight_kg, yield_rate, rounding_policy,
        original_quantity, final_quantity, formula_version, created_by_client, updated_by_client
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$16
      ) RETURNING *`,
      [
        id, dados.produtoId, dados.endereco, r.id, r.nome, r.taraKg, r.cor,
        e.pesoBrutoKg, e.gramaturaG, c.pesoLiquidoKg, c.taxaRendimento,
        c.politicaArredondamento, c.quantidadeCalculadaOriginal, c.quantidadeFinal,
        c.versaoFormula, dados.criadoPorCliente
      ]
    );
    return mapearCalculo(resultado.rows[0]);
  }

  async atualizarCalculo(id, { produtoId, endereco, quantidadeFinal, versao, clienteId }) {
    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');
      const bloqueado = await cliente.query(
        'SELECT * FROM calculations WHERE id = $1 AND deleted_at IS NULL FOR UPDATE',
        [id]
      );
      if (!bloqueado.rowCount) {
        await cliente.query('ROLLBACK');
        return { tipo: 'nao_encontrado' };
      }
      const atual = bloqueado.rows[0];
      if (atual.version !== versao) {
        await cliente.query('ROLLBACK');
        return { tipo: 'conflito', atual: mapearCalculo(atual) };
      }

      const anterior = {
        produtoId: atual.product_id,
        endereco: atual.address,
        quantidadeFinal: atual.final_quantity,
        versao: atual.version
      };
      const novaVersao = atual.version + 1;
      const atualizado = await cliente.query(
        `UPDATE calculations
         SET product_id = $2, address = $3, final_quantity = $4, version = $5,
             updated_by_client = $6, updated_at = NOW()
         WHERE id = $1 RETURNING *`,
        [id, produtoId, endereco, quantidadeFinal, novaVersao, clienteId]
      );
      await cliente.query(
        `INSERT INTO calculation_revisions (
          id, calculation_id, revision_number, changed_by_client, previous_values, new_values
        ) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb)`,
        [
          crypto.randomUUID(), id, versao, clienteId,
          JSON.stringify(anterior),
          JSON.stringify({ produtoId, endereco, quantidadeFinal, versao: novaVersao })
        ]
      );
      await cliente.query('COMMIT');
      return { tipo: 'atualizado', registro: mapearCalculo(atualizado.rows[0]) };
    } catch (erro) {
      await cliente.query('ROLLBACK');
      throw erro;
    } finally {
      cliente.release();
    }
  }

  async excluirCalculo(id, clienteId) {
    const resultado = await this.pool.query(
      `UPDATE calculations SET deleted_at = NOW(), updated_at = NOW(), updated_by_client = $2
       WHERE id = $1 AND deleted_at IS NULL`,
      [id, clienteId]
    );
    return resultado.rowCount > 0;
  }

  async restaurarCalculo(id, clienteId) {
    const resultado = await this.pool.query(
      `UPDATE calculations SET deleted_at = NULL, updated_at = NOW(), updated_by_client = $2
       WHERE id = $1 AND deleted_at IS NOT NULL`,
      [id, clienteId]
    );
    return resultado.rowCount > 0;
  }

  async obterAdministracao() {
    const [configuracoes, recipientes] = await Promise.all([
      this.obterConfiguracoes(),
      this.pool.query('SELECT * FROM containers ORDER BY sort_order, name')
    ]);
    return { configuracoes, recipientes: recipientes.rows.map(mapearRecipiente) };
  }

  async salvarConfiguracoes(configuracoes) {
    const resultado = await this.pool.query(
      `UPDATE app_settings SET yield_rate = $1, rounding_policy = $2, updated_at = NOW()
       WHERE id = 1 RETURNING yield_rate, rounding_policy`,
      [configuracoes.taxaRendimento, configuracoes.politicaArredondamento]
    );
    return {
      taxaRendimento: Number(resultado.rows[0].yield_rate),
      politicaArredondamento: resultado.rows[0].rounding_policy
    };
  }

  async salvarRecipientes(recipientes) {
    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');
      const ids = recipientes.map((item) => item.id);
      for (const item of recipientes) {
        await cliente.query(
          `INSERT INTO containers (id, name, tare_kg, color, active, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name, tare_kg = EXCLUDED.tare_kg, color = EXCLUDED.color,
             active = EXCLUDED.active, sort_order = EXCLUDED.sort_order, updated_at = NOW()`,
          [item.id, item.nome, item.taraKg, item.cor, item.ativo, item.ordem]
        );
      }
      await cliente.query('UPDATE containers SET active = false, updated_at = NOW() WHERE NOT (id = ANY($1::text[]))', [ids]);
      await cliente.query('COMMIT');
      return recipientes;
    } catch (erro) {
      await cliente.query('ROLLBACK');
      throw erro;
    } finally {
      cliente.release();
    }
  }

  async limparCalculos() {
    await this.pool.query('UPDATE calculations SET deleted_at = NOW(), updated_at = NOW() WHERE deleted_at IS NULL');
  }
}
