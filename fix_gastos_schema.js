require('dotenv').config();
const { query, pool } = require('./src/db');

async function fixGastosSchema() {
  try {
    console.log('🔧 Corrigindo schema da tabela gastos...\n');
    
    // 1. Converter timestamp para TIMESTAMPTZ
    console.log('1. Convertendo timestamp para TIMESTAMPTZ...');
    await query(`
      ALTER TABLE gastos 
        ALTER COLUMN timestamp TYPE TIMESTAMPTZ 
        USING timestamp::timestamptz;
      
      ALTER TABLE gastos 
        ALTER COLUMN timestamp SET DEFAULT CURRENT_TIMESTAMP;
    `);
    console.log('   ✓ Coluna timestamp convertida!\n');
    
    // 2. Converter data_efetivacao para TIMESTAMPTZ
    console.log('2. Convertendo data_efetivacao para TIMESTAMPTZ...');
    await query(`
      ALTER TABLE gastos 
        ALTER COLUMN data_efetivacao TYPE TIMESTAMPTZ 
        USING data_efetivacao::timestamptz;
    `);
    console.log('   ✓ Coluna data_efetivacao convertida!\n');
    
    // 3. Adicionar PRIMARY KEY se não existir
    console.log('3. Verificando PRIMARY KEY...');
    const pkCheck = await query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'gastos' AND constraint_type = 'PRIMARY KEY';
    `);
    
    if (pkCheck.rows.length === 0) {
      await query('ALTER TABLE gastos ADD PRIMARY KEY (id)');
      console.log('   ✓ PRIMARY KEY adicionada!\n');
    } else {
      console.log('   ✓ PRIMARY KEY já existe!\n');
    }
    
    // 4. Converter id para SERIAL
    console.log('4. Convertendo id para SERIAL...');
    await query(`
      CREATE SEQUENCE IF NOT EXISTS gastos_id_seq;
      ALTER TABLE gastos ALTER COLUMN id SET DEFAULT nextval('gastos_id_seq');
      SELECT setval('gastos_id_seq', COALESCE((SELECT MAX(id) FROM gastos), 1));
    `);
    console.log('   ✓ Sequência criada!\n');
    
    // 5. Adicionar NOT NULL constraints
    console.log('5. Ajustando campos NOT NULL...');
    await query(`
      ALTER TABLE gastos ALTER COLUMN descricao_gasto SET NOT NULL;
      ALTER TABLE gastos ALTER COLUMN valor SET NOT NULL;
      ALTER TABLE gastos ALTER COLUMN timestamp SET NOT NULL;
      ALTER TABLE gastos ALTER COLUMN tipo SET NOT NULL;
      ALTER TABLE gastos ALTER COLUMN data_efetivacao SET NOT NULL;
    `);
    console.log('   ✓ Campos ajustados!\n');
    
    // 6. Verificar schema final
    console.log('6. Schema final:');
    const finalSchema = await query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'gastos'
      ORDER BY ordinal_position;
    `);
    console.table(finalSchema.rows);
    
    console.log('\n✅ Schema da tabela gastos corrigido com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixGastosSchema();
