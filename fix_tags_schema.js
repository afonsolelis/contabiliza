require('dotenv').config();
const { query, pool } = require('./src/db');

async function fixTagsSchema() {
  try {
    console.log('🔧 Verificando e corrigindo schema da tabela tags...\n');
    
    // Verificar schema atual
    const currentSchema = await query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'tags'
      ORDER BY ordinal_position;
    `);
    
    console.log('Schema atual:');
    console.table(currentSchema.rows);
    
    const timestampCol = currentSchema.rows.find(r => r.column_name === 'timestamp');
    
    if (timestampCol && timestampCol.data_type !== 'timestamp with time zone') {
      console.log('\n1. Convertendo timestamp para TIMESTAMPTZ...');
      await query(`
        ALTER TABLE tags 
          ALTER COLUMN timestamp TYPE TIMESTAMPTZ 
          USING timestamp::timestamptz;
        
        ALTER TABLE tags 
          ALTER COLUMN timestamp SET DEFAULT CURRENT_TIMESTAMP;
        
        ALTER TABLE tags 
          ALTER COLUMN timestamp SET NOT NULL;
      `);
      console.log('   ✓ Coluna timestamp convertida!\n');
    } else {
      console.log('\n✓ Timestamp já está correto!\n');
    }
    
    // Verificar PRIMARY KEY
    const pkCheck = await query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'tags' AND constraint_type = 'PRIMARY KEY';
    `);
    
    if (pkCheck.rows.length === 0) {
      console.log('2. Adicionando PRIMARY KEY...');
      await query('ALTER TABLE tags ADD PRIMARY KEY (id)');
      console.log('   ✓ PRIMARY KEY adicionada!\n');
    }
    
    // Converter id para SERIAL
    console.log('3. Convertendo id para SERIAL...');
    await query(`
      CREATE SEQUENCE IF NOT EXISTS tags_id_seq;
      ALTER TABLE tags ALTER COLUMN id SET DEFAULT nextval('tags_id_seq');
      SELECT setval('tags_id_seq', COALESCE((SELECT MAX(id) FROM tags), 1));
    `);
    console.log('   ✓ Sequência criada!\n');
    
    // NOT NULL em tag
    console.log('4. Ajustando campos NOT NULL...');
    await query(`ALTER TABLE tags ALTER COLUMN tag SET NOT NULL;`);
    console.log('   ✓ Campos ajustados!\n');
    
    console.log('✅ Schema da tabela tags verificado e corrigido!');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

fixTagsSchema();
