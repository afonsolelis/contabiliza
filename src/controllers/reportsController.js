const express = require('express');
const { query, loadSql } = require('../db');

const router = express.Router();

const tagsMonthlySql = loadSql('reports/tags_monthly.sql');

router.get('/tags-mensal', async (req, res) => {
  try {
    const now = new Date();
    const year = Number(req.query.year || now.getFullYear());
    const { rows } = await query(tagsMonthlySql, [year]);
    return res.render('reports/tagsMonthly', { year, rows });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Erro em /relatorios/tags-mensal:', err);
    return res.status(500).send('Erro ao carregar relatório mensal por tag.');
  }
});

module.exports = { router };
