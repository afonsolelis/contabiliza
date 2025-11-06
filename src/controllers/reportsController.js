const express = require('express');
const { query, loadSql } = require('../db');

const router = express.Router();

const tagsMonthlySql = loadSql('reports/tags_monthly.sql');
const totalsByTagRangeSql = loadSql('reports/totals_by_tag_range.sql');

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

router.get('/totais-periodo', async (req, res) => {
  try {
    const now = new Date();
    const todayStartUtc = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      0, 0, 0, 0
    ));
    const defaultStart = addDays(todayStartUtc, -29);
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
