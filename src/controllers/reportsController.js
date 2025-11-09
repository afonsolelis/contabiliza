const express = require('express');
const { query, loadSql } = require('../db');

const router = express.Router();

const tagsMonthlySql = loadSql('reports/tags_monthly.sql');
const totalsByTagRangeSql = loadSql('reports/totals_by_tag_range.sql');
const tagMonthDetailsSql = loadSql('reports/tag_month_details.sql');

function parseYmdToUtcStart(ymd) {
  if (!ymd) return null;
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
}

function addDays(date, days) {
  const ms = date.getTime() + days * 24 * 60 * 60 * 1000;
  return new Date(ms);
}

function formatLocalYmd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

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

router.get('/tag-mes-detalhes', async (req, res) => {
  try {
    const now = new Date();
    const year = Number(req.query.year || now.getFullYear());
    const month = Number(req.query.month);
    const tagId = req.query.tag_id === 'null' ? null : Number(req.query.tag_id);
    const tagName = req.query.tag_name || '';

    if (!month || month < 1 || month > 12) {
      return res.status(400).send('Mês inválido');
    }

    const { rows } = await query(tagMonthDetailsSql, [year, month, tagId]);

    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    const total = rows.reduce((acc, row) => acc + Number(row.valor || 0), 0);

    return res.render('reports/tagMonthDetails', {
      year,
      month,
      monthName: monthNames[month - 1],
      tagName,
      rows,
      total
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Erro em /relatorios/tag-mes-detalhes:', err);
    return res.status(500).send('Erro ao carregar detalhes do mês.');
  }
});

router.get('/totais-periodo', async (req, res) => {
  try {
    const now = new Date();
    const todayLocalYmd = formatLocalYmd(now);
    const todayStartUtc = parseYmdToUtcStart(todayLocalYmd);
    const defaultStart = addDays(todayStartUtc, -6);
    const defaultEndExclusive = addDays(todayStartUtc, 1);

    const startParsed = parseYmdToUtcStart(req.query.start);
    const endParsed = parseYmdToUtcStart(req.query.end);

    const startDate = startParsed || defaultStart;
    const endExclusive = endParsed ? addDays(endParsed, 1) : defaultEndExclusive;

    const startIso = startDate.toISOString();
    const endIso = endExclusive.toISOString();

    const { rows } = await query(totalsByTagRangeSql, [startIso, endIso]);
    const totalRange = rows.reduce((acc, row) => acc + Number(row.total || 0), 0);

    return res.render('reports/periodTotals', {
      filters: {
        start: (req.query.start || new Date(defaultStart).toISOString().slice(0, 10)),
        end: (req.query.end || new Date(todayStartUtc).toISOString().slice(0, 10))
      },
      rows,
      totalRange
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Erro em /relatorios/totais-periodo:', err);
    return res.status(500).send('Erro ao carregar totais do período.');
  }
});

module.exports = { router };
