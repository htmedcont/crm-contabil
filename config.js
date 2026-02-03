// ============================================
// CONFIG.JS - Configuração do Supabase
// ============================================

// ⚠️ IMPORTANTE: Substitua pelas suas credenciais do Supabase
// Obter em: Supabase Dashboard → Settings → API

const SUPABASE_CONFIG = {
    url: 'SUA_URL_AQUI', // Ex: https://xxxxx.supabase.co
    anonKey: 'SUA_CHAVE_ANON_AQUI' // Chave pública (anon/public)
};

// ============================================
// EXEMPLO DE COMO PEGAR AS CREDENCIAIS:
// ============================================
/*
1. Acesse: https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá em Settings → API
4. Copie:
   - Project URL → cole em 'url' acima
   - anon public → cole em 'anonKey' acima

EXEMPLO:
const SUPABASE_CONFIG = {
    url: 'https://abcdefghijk.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTAwMDAwMDAsImV4cCI6MjAwNTU3NjAwMH0.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
};
*/

// ============================================
// VALIDAÇÃO AUTOMÁTICA
// ============================================
if (SUPABASE_CONFIG.url === 'SUA_URL_AQUI' || SUPABASE_CONFIG.anonKey === 'SUA_CHAVE_ANON_AQUI') {
    console.error('⚠️ ATENÇÃO: Configure suas credenciais do Supabase no arquivo config.js!');
    console.error('Veja instruções no arquivo ou em DEPLOY-WEB-GRATUITO.md');
}

// ============================================
// INICIALIZAR CLIENTE SUPABASE
// ============================================
const supabase = window.supabase.createClient(
    SUPABASE_CONFIG.url,
    SUPABASE_CONFIG.anonKey
);

console.log('✅ Supabase inicializado:', supabase ? 'OK' : 'ERRO');

// ============================================
// CONFIGURAÇÕES ADICIONAIS
// ============================================

// Configuração de autenticação
const AUTH_CONFIG = {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
};

// Configuração de tempo de cache (em segundos)
const CACHE_CONFIG = {
    dashboard: 30,  // Dashboard atualiza a cada 30s
    lists: 60,      // Listas atualizam a cada 60s
    details: 300    // Detalhes atualizam a cada 5min
};

// ============================================
// HELPERS DE VALIDAÇÃO
// ============================================

// Verificar se Supabase está configurado corretamente
async function validateSupabaseConnection() {
    try {
        const { data, error } = await supabase
            .from('offices')
            .select('count')
            .limit(1);
        
        if (error && error.code === '42P01') {
            console.error('❌ Tabelas não criadas! Execute o SQL no Supabase.');
            return false;
        }
        
        console.log('✅ Conexão com Supabase: OK');
        return true;
    } catch (error) {
        console.error('❌ Erro ao conectar com Supabase:', error);
        return false;
    }
}

// Executar validação ao carregar
document.addEventListener('DOMContentLoaded', async () => {
    const isValid = await validateSupabaseConnection();
    if (!isValid) {
        alert('Erro ao conectar com banco de dados. Verifique configurações.');
    }
});
