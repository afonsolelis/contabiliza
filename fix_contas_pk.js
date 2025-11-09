require('dotenv').config();
const { query, pool } = require('./src/db');

async function fixContasPK() {
  try {
    console.log('🔧 Corrigindo PRIMARY KEY da tabela contas...\n');
    
    // 1. Adicionar PRIMARY KEY no campo id
    console.log('1. Adicionando PRIMARY KEY em contas.id...');
    await query('ALTER TABLE contas ADD PRIMARY KEY (id)');
    console.log('   ✓ PRIMARY KEY adicionada!\n');
    
    // 2. Converter id para SERIAL (sequência automática)
    console.log('2. Convertendo id para SERIAL...');
    await query(`
      CREATE SEQUENCE IF NOT EXISTS contas_id_seq;
      ALTER TABLE contas ALTER COLUMN id SET DEFAULT nextval('contas_id_seq');
      SELECT setval('contas_id_seq', COALESCE((SELECT MAX(id) FROM contas), 1));
    `);
    console.log('   ✓ Sequência criada!\n');
    
    // 3. Tornar campos NOT NULL
    console.log('3. Ajustando campos NOT NULL...');
    await query(`
      ALTER TABLE contas ALTER COLUMN banco SET NOT NULL;
      ALTER TABLE contas ALTER COLUMN agencia SET NOT NULL;
      ALTER TABLE contas ALTER COLUMN conta SET NOT NULL;
    `);
    console.log('   ✓ Campos ajustados!\n');
    
    // 4. Converter timestamp para TIMESTAMPTZ
    console.log('4. Convertendo timestamp para TIMESTAMPTZ...');
    await query(`
      ALTER TABLE contas 
        ALTER COLUMN timestamp TYPE TIMESTAMPTZ 
        USING timestamp::timestamptz;
      
      ALTER TABLE contas 
        ALTER COLUMN timestamp SET DEFAULT CURRENT_TIMESTAMP;
      
      ALTER TABLE contas 
        ALTER COLUMN timestamp SET NOT NULL;
    `);
    console.log('   ✓ Timestamp convertido!\n');
    
    console.log('✅ Schema da tabela contas corrigido com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixContasPK();
