const express = require('express');
const { query, loadSql } = require('../db');

const router = express.Router();

const insertGastoSql = loadSql('gastos/insert.sql');
const findGastoByIdSql = loadSql('gastos/find_by_id.sql');
const updateGastoSql = loadSql('gastos/update.sql');
const deleteGastoSql = loadSql('gastos/delete.sql');
const listTagsSql = loadSql('tags/list.sql');
const listContasSql = loadSql('contas/list.sql');

router.get('/new', async (req, res) => {
  const message = req.query.message || '';
  const { rows: tags } = await query(listTagsSql);
  const { rows: contas } = await query(listContasSql);
  res.render('gastos/new', { message, tags, contas });
});

function parseYmdToUtcStart(ymd) {
  if (!ymd) return null;
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
}

router.post('/', async (req, res) => {
  const descricao = (req.body.descricao_gasto || '').trim();
  const valorRaw = (req.body.valor || '').toString().trim();
  const tagId = req.body.tag_id ? Number(req.body.tag_id) : null;
  const contaId = req.body.conta_id ? Number(req.body.conta_id) : null;
  const tipo = (req.body.tipo || 'pix').toString().toLowerCase();
  const dataEfetivacaoInput = (req.body.data_efetivacao || '').toString();

  const valor = Number(valorRaw.replace(',', '.'));
  const allowed = new Set(['pix', 'cartao', 'debito']);
  if (!descricao || Number.isNaN(valor) || valor < 0 || !allowed.has(tipo)) {
    const { rows: tags } = await query(listTagsSql);
    const { rows: contas } = await query(listContasSql);
    return res.status(400).render('gastos/new', { message: 'Dados inválidos', tags, contas });
  }

  try {
    const efetivacaoDate = parseYmdToUtcStart(dataEfetivacaoInput) || new Date();
    await query(insertGastoSql, [descricao, valor, tagId, tipo, contaId, efetivacaoDate.toISOString()]);
    return res.redirect('/gastos/new?message=Gasto inserido');
  } catch (e) {
    const { rows: tags } = await query(listTagsSql);
    const { rows: contas } = await query(listContasSql);
    return res.status(500).render('gastos/new', { message: 'Erro ao inserir gasto', tags, contas });
  }
});

module.exports = { router };

// Editar
router.get('/:id/edit', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.redirect('/dashboard');
  const { rows } = await query(findGastoByIdSql, [id]);
  if (!rows[0]) return res.redirect('/dashboard');
  const { rows: tags } = await query(listTagsSql);
  const { rows: contas } = await query(listContasSql);
  return res.render('gastos/edit', { gasto: rows[0], tags, contas, message: '' });
});

router.post('/:id/update', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.redirect('/dashboard');
  const descricao = (req.body.descricao_gasto || '').trim();
  const valorRaw = (req.body.valor || '').toString().trim();
  const tagId = req.body.tag_id ? Number(req.body.tag_id) : null;
  const contaId = req.body.conta_id ? Number(req.body.conta_id) : null;
  const tipo = (req.body.tipo || 'pix').toString().toLowerCase();
  const dataEfetivacaoInput = (req.body.data_efetivacao || '').toString();
  const valor = Number(valorRaw.replace(',', '.'));
  const allowed = new Set(['pix', 'cartao', 'debito']);
  if (!descricao || Number.isNaN(valor) || valor < 0 || !allowed.has(tipo)) {
    const { rows: tags } = await query(listTagsSql);
    const { rows: contas } = await query(listContasSql);
    const { rows } = await query(findGastoByIdSql, [id]);
    return res.status(400).render('gastos/edit', { gasto: rows[0], tags, contas, message: 'Dados inválidos' });
  }
  try {
    const efetivacaoDate = parseYmdToUtcStart(dataEfetivacaoInput) || new Date();
    await query(updateGastoSql, [id, descricao, valor, tipo, tagId, contaId, efetivacaoDate.toISOString()]);
    return res.redirect('/dashboard');
  } catch (e) {
    const { rows: tags } = await query(listTagsSql);
    const { rows: contas } = await query(listContasSql);
    const { rows } = await query(findGastoByIdSql, [id]);
    return res.status(500).render('gastos/edit', { gasto: rows[0], tags, contas, message: 'Erro ao atualizar gasto' });
  }
});

router.post('/:id/delete', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.redirect('/dashboard');
  try {
    await query(deleteGastoSql, [id]);
    return res.redirect('/dashboard');
  } catch (e) {
    const { rows } = await query(findGastoByIdSql, [id]);
    const { rows: tags } = await query(listTagsSql);
    const { rows: contas } = await query(listContasSql);
    return res.status(500).render('gastos/edit', { gasto: rows[0], tags, contas, message: 'Erro ao deletar gasto' });
  }
});


