const express = require('express');
const { query, loadSql } = require('../db');

const router = express.Router();

const aggregateSql = loadSql('gastos/aggregate.sql');
const listByRangeSql = loadSql('gastos/list_by_range.sql');
const sumByRangeSql = loadSql('gastos/sum_by_range.sql');

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

router.get('/', async (req, res) => {
  try {
    const now = new Date();
    // início do dia (UTC) para hoje
    const todayStartUtc = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      0, 0, 0, 0
    ));
    const defaultStart = todayStartUtc; // filtro abre no dia atual
    const defaultEndExclusive = addDays(todayStartUtc, 1); // até o fim do dia atual (exclusivo)

    const period = (req.query.period || 'day').toLowerCase();
    const startParsed = parseYmdToUtcStart(req.query.start);
    const endParsed = parseYmdToUtcStart(req.query.end);

    const startDate = startParsed || defaultStart;
    const endExclusive = endParsed ? addDays(endParsed, 1) : defaultEndExclusive;

    const startIso = startDate.toISOString();
    const endIso = endExclusive.toISOString();

    const validPeriods = new Set(['day', 'week', 'month']);
    const chosen = validPeriods.has(period) ? period : 'day';

    const { rows: series } = await query(aggregateSql, [chosen, startIso, endIso]);
    const { rows: gastos } = await query(listByRangeSql, [startIso, endIso]);
    const { rows: sumRows } = await query(sumByRangeSql, [startIso, endIso]);
    const totalRange = Number(sumRows?.[0]?.total || 0);

    return res.render('dashboard/index', {
      filters: {
        period: chosen,
        start: (req.query.start || new Date(defaultStart).toISOString().slice(0, 10)),
        end: (req.query.end || new Date(defaultStart).toISOString().slice(0, 10))
      },
      series,
      gastos,
      totalRange
    });
  } catch (err) {
    return res.status(500).send('Erro ao carregar dashboard. Verifique a conexão com o banco de dados.');
  }
});

module.exports = { router };

