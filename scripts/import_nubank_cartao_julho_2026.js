const fs = require('fs');
const { Client } = require('pg');

const session = '/var/home/afonsolelis/.codex/sessions/2026/07/28/rollout-2026-07-28T10-45-04-019fa8f8-c98d-7123-a1d7-566c158f0ec1.jsonl';
const records = fs.readFileSync(session, 'utf8').trim().split('\n').map(JSON.parse);
const item = records.findLast((r) => r.type === 'response_item' && r.payload?.role === 'user' &&
  r.payload.content?.[0]?.text?.includes('Movida Rac Beae'));
if (!item) throw new Error('Extrato do cartão não encontrado');

const lines = item.payload.content[0].text.split('\n').filter((l) => /^2026-07-\d{2}\t/.test(l));
const all = lines.map((line) => {
  const [date, title, rawAmount] = line.split('\t');
  return { date, title: title.trim(), amount: Number(rawAmount.replace(/\s/g, '').replace(',', '.')) };
});
const excluded = all.filter((r) => r.amount < 0 || /^Pix no Crédito/i.test(r.title));
const candidates = all.filter((r) => r.amount > 0 && !/^Pix no Crédito/i.test(r.title));

const tagName = (title) => {
  const s = title.toLowerCase();
  if (/movida|spacecar|aliansce/.test(s)) return 'carro';
  if (/drogaria/.test(s)) return 'farmacia';
  if (/tesko cards/.test(s)) return 'pokemon_tcg';
  if (/google|youtube/.test(s)) return 'google_play';
  if (/mercadol|tiktok|ri happy|dex comercio/.test(s)) return 'diversos';
  if (/bar|restaurant|outback|meals|shibata|sorveteria|convenien|frangoassado|galpaozin|chosungalbi|ifd\\*/.test(s)) return 'alimentacao';
  return 'diversos';
};

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_PUBLIC_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    const tags = new Map((await c.query('SELECT tag,id FROM tags')).rows.map((r) => [r.tag, r.id]));
    const duplicates = [], pending = [];
    for (const row of candidates) {
      const merchant = /spacecar/i.test(row.title) ? 'spacecar'
        : /ri happy/i.test(row.title) ? 'ri happy'
        : /mercadolivre.*4\/6/i.test(row.title) ? 'mercadolivre (parcela 4/6)'
        : null;
      const found = await c.query(
        `SELECT id,descricao_gasto,valor,tipo,data_efetivacao::date AS data
           FROM gastos WHERE conta_id=1 AND tipo='cartao' AND (
            (data_efetivacao >= $1::date - interval '1 day'
             AND data_efetivacao < $1::date + interval '2 days' AND valor = $2)
            OR ($3::text IS NOT NULL AND lower(descricao_gasto) LIKE '%' || $3 || '%')
           )`,
        [row.date, row.amount, merchant]
      );
      if (found.rows.length) duplicates.push({ extrato: row, existentes: found.rows });
      else pending.push({ ...row, tag: tagName(row.title) });
    }
    if (process.env.CONFIRM_IMPORT !== '1') {
      console.log(JSON.stringify({
        total_linhas: all.length,
        excluidos: excluded.length,
        duplicados: duplicates,
        novos: pending.length,
        total_novos: pending.reduce((s, r) => s + r.amount, 0).toFixed(2)
      }, null, 2));
      return;
    }
    await c.query('BEGIN');
    const ids = [];
    for (const r of pending) {
      const out = await c.query(
        `INSERT INTO gastos (descricao_gasto,valor,tag_id,tipo,conta_id,data_efetivacao,
          parcela_numero,parcela_total,parcela_grupo_id)
         VALUES ($1,$2,$3,'cartao',1,$4::date,NULL,NULL,NULL) RETURNING id`,
        [r.title, r.amount, tags.get(r.tag), r.date]
      );
      ids.push(out.rows[0].id);
    }
    await c.query('COMMIT');
    console.log(JSON.stringify({ importados: ids.length, total: pending.reduce((s,r)=>s+r.amount,0).toFixed(2), primeiro_id:ids[0], ultimo_id:ids.at(-1) }));
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally { await c.end(); }
}
main().catch((e) => { console.error(e); process.exit(1); });
