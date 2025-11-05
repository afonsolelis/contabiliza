const express = require('express');
const { query, loadSql } = require('../db');

const router = express.Router();

const insertTagSql = loadSql('tags/insert.sql');
const listTagsSql = loadSql('tags/list.sql');

router.get('/new', async (req, res) => {
  const message = req.query.message || '';
  const { rows: tags } = await query(listTagsSql);
  res.render('tags/new', { message, tags });
});

router.post('/', async (req, res) => {
  const tag = (req.body.tag || '').trim();
  if (!tag) {
    return res.status(400).render('tags/new', { message: 'Informe uma tag válida', tags: (await query(listTagsSql)).rows });
  }
  try {
    await query(insertTagSql, [tag]);
    return res.redirect('/tags/new?message=Tag cadastrada');
  } catch (e) {
    return res.status(500).render('tags/new', { message: 'Erro ao cadastrar tag', tags: (await query(listTagsSql)).rows });
  }
});

module.exports = { router };


