const express = require('express');
const { query, loadSql } = require('../db');

const router = express.Router();

const insertTagSql = loadSql('tags/insert.sql');
const listTagsSql = loadSql('tags/list.sql');
const updateTagSql = loadSql('tags/update.sql');
const deleteTagSql = loadSql('tags/delete.sql');

router.get('/new', async (req, res) => {
  const message = req.query.message || '';
  const error = req.query.error || '';
  const { rows: tags } = await query(listTagsSql);
  res.render('tags/new', { message, error, tags });
});

router.post('/', async (req, res) => {
  const tag = (req.body.tag || '').trim();
  if (!tag) {
    const { rows: tags } = await query(listTagsSql);
    return res.status(400).render('tags/new', { message: '', error: 'Informe uma tag válida', tags });
  }
  try {
    console.log('Tentando inserir tag:', tag);
    const result = await query(insertTagSql, [tag]);
    console.log('Resultado da inserção:', result);
    console.log('Linhas afetadas:', result.rowCount);
    console.log('Linhas retornadas:', result.rows);

    // Se não inseriu nenhuma linha, significa que a tag já existe (ON CONFLICT DO NOTHING)
    if (result.rowCount === 0) {
      console.log('Tag duplicada detectada via rowCount');
      const { rows: tags } = await query(listTagsSql);
      return res.status(400).render('tags/new', { message: '', error: 'Já existe uma tag com esse nome', tags });
    }

    return res.redirect('/tags/new?message=Tag cadastrada');
  } catch (e) {
    console.error('Erro ao cadastrar tag:', e);
    console.error('Código do erro:', e.code);
    console.error('Mensagem do erro:', e.message);
    console.error('Stack:', e.stack);
    const { rows: tags } = await query(listTagsSql);
    const error = e.code === '23505' ? 'Já existe uma tag com esse nome' : 'Erro ao cadastrar tag';
    return res.status(500).render('tags/new', { message: '', error, tags });
  }
});

router.post('/:id/update', async (req, res) => {
  const id = Number(req.params.id);
  const tag = (req.body.tag || '').trim();
  if (Number.isNaN(id)) return res.redirect('/tags/new?error=Tag inválida');
  if (!tag) {
    const { rows: tags } = await query(listTagsSql);
    return res.status(400).render('tags/new', { message: '', error: 'Informe uma tag válida', tags });
  }
  try {
    const result = await query(updateTagSql, [id, tag]);
    if (!result.rowCount) {
      return res.redirect('/tags/new?error=Tag não encontrada');
    }
    return res.redirect('/tags/new?message=Tag atualizada');
  } catch (e) {
    const { rows: tags } = await query(listTagsSql);
    const error = e.code === '23505' ? 'Já existe uma tag com esse nome' : 'Erro ao atualizar tag';
    return res.status(500).render('tags/new', { message: '', error, tags });
  }
});

router.post('/:id/delete', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.redirect('/tags/new?error=Tag inválida');
  try {
    const result = await query(deleteTagSql, [id]);
    if (!result.rowCount) {
      return res.redirect('/tags/new?error=Tag não encontrada');
    }
    return res.redirect('/tags/new?message=Tag removida');
  } catch (e) {
    const { rows: tags } = await query(listTagsSql);
    return res.status(500).render('tags/new', { message: '', error: 'Erro ao remover tag', tags });
  }
});

module.exports = { router };

