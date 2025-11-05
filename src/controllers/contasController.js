const express = require('express');
const { query, loadSql } = require('../db');

const router = express.Router();

const insertContaSql = loadSql('contas/insert.sql');
const listContasSql = loadSql('contas/list.sql');

router.get('/new', async (req, res) => {
  const message = req.query.message || '';
  const { rows: contas } = await query(listContasSql);
  res.render('contas/new', { message, contas });
});

router.post('/', async (req, res) => {
  const banco = (req.body.banco || '').trim();
  const agencia = (req.body.agencia || '').trim();
  const conta = (req.body.conta || '').trim();

  if (!banco || !agencia || !conta) {
    const { rows: contas } = await query(listContasSql);
    return res.status(400).render('contas/new', { message: 'Preencha todos os campos', contas });
  }

  try {
    await query(insertContaSql, [banco, agencia, conta]);
    return res.redirect('/contas/new?message=Conta cadastrada');
  } catch (e) {
    const { rows: contas } = await query(listContasSql);
    return res.status(500).render('contas/new', { message: 'Erro ao cadastrar conta', contas });
  }
});

module.exports = { router };


