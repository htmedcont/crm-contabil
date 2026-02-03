// ============================================
// WEB-APP.JS - Aplicação Web com Supabase
// ============================================

// Estado global
const AppState = {
    currentUser: null,
    currentOffice: null,
    currentOfficeRole: null,
    offices: []
};

// ============================================
// INICIALIZAÇÃO
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Iniciando aplicação...');
    
    // Verificar sessão existente
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
        console.log('✅ Sessão encontrada');
        await handleAuthenticated(session.user);
    } else {
        console.log('📝 Sem sessão, mostrando tela de login');
        showScreen('auth-screen');
    }
    
    initEventListeners();
    hideLoading();
});

// ============================================
// AUTENTICAÇÃO
// ============================================

// Login
async function login(email, password) {
    showLoading('Entrando...');
    
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });
    
    if (error) {
        hideLoading();
        showAuthMessage(error.message, 'error');
        return;
    }
    
    await handleAuthenticated(data.user);
}

// Registro
async function register(name, email, password) {
    showLoading('Criando conta...');
    
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                name: name
            }
        }
    });
    
    if (error) {
        hideLoading();
        showAuthMessage(error.message, 'error');
        return;
    }
    
    hideLoading();
    showAuthMessage('Conta criada! Verifique seu email para confirmar.', 'success');
}

// Logout
async function logout() {
    await supabase.auth.signOut();
    AppState.currentUser = null;
    AppState.currentOffice = null;
    AppState.offices = [];
    showScreen('auth-screen');
}

// Após autenticação
async function handleAuthenticated(user) {
    showLoading('Carregando dados...');
    
    AppState.currentUser = user;
    
    // Buscar perfil
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
    
    if (profile) {
        AppState.currentUser.name = profile.name;
    }
    
    // Buscar escritórios do usuário
    const { data: userOffices } = await supabase
        .from('user_offices')
        .select(`
            *,
            offices (*)
        `)
        .eq('user_id', user.id)
        .eq('active', true);
    
    if (!userOffices || userOffices.length === 0) {
        // Usuário sem escritório, mostrar criação
        hideLoading();
        showOfficeSelection([]);
    } else {
        AppState.offices = userOffices.map(uo => ({
            ...uo.offices,
            role: uo.role
        }));
        
        if (AppState.offices.length === 1) {
            await selectOffice(AppState.offices[0]);
        } else {
            hideLoading();
            showOfficeSelection(AppState.offices);
        }
    }
}

// ============================================
// GERENCIAMENTO DE ESCRITÓRIOS
// ============================================

function showOfficeSelection(offices) {
    const list = document.getElementById('offices-list');
    list.innerHTML = '';
    
    if (offices.length === 0) {
        list.innerHTML = '<p class="text-center text-secondary">Você ainda não possui escritórios. Crie um para começar!</p>';
    } else {
        offices.forEach(office => {
            const item = document.createElement('div');
            item.className = 'office-item';
            item.innerHTML = `
                <h3>${office.name}</h3>
                <p>CNPJ: ${office.cnpj}</p>
                <p>Perfil: <span class="badge badge-${office.role}">${office.role === 'admin' ? 'Administrador' : 'Usuário'}</span></p>
            `;
            item.onclick = () => selectOffice(office);
            list.appendChild(item);
        });
    }
    
    showScreen('office-selection-screen');
}

async function selectOffice(office) {
    showLoading('Carregando escritório...');
    
    AppState.currentOffice = office;
    AppState.currentOfficeRole = office.role;
    
    showScreen('dashboard-screen');
    updateHeader();
    await loadDashboard();
    hideLoading();
}

async function createOffice(officeData) {
    showLoading('Criando escritório...');
    
    // Criar escritório
    const { data: office, error: officeError } = await supabase
        .from('offices')
        .insert([officeData])
        .select()
        .single();
    
    if (officeError) {
        hideLoading();
        alert('Erro ao criar escritório: ' + officeError.message);
        return;
    }
    
    // Associar usuário como admin
    const { error: userOfficeError } = await supabase
        .from('user_offices')
        .insert([{
            user_id: AppState.currentUser.id,
            office_id: office.id,
            role: 'admin',
            active: true
        }]);
    
    if (userOfficeError) {
        hideLoading();
        alert('Erro ao associar usuário: ' + userOfficeError.message);
        return;
    }
    
    hideLoading();
    closeModal('create-office-modal');
    
    // Recarregar escritórios
    await handleAuthenticated(AppState.currentUser);
}

// ============================================
// DASHBOARD
// ============================================

async function loadDashboard() {
    const officeId = AppState.currentOffice.id;
    
    // Carregar clientes
    const { data: clients } = await supabase
        .from('clients')
        .select('*')
        .eq('office_id', officeId);
    
    const activeClients = clients?.filter(c => c.status === 'ativo') || [];
    
    // Carregar leads
    const { data: leads } = await supabase
        .from('leads')
        .select('*')
        .eq('office_id', officeId);
    
    const activeLeads = leads?.filter(l => !['ganho', 'perdido'].includes(l.status)) || [];
    
    // Carregar honorários
    const { data: fees } = await supabase
        .from('fees')
        .select('*')
        .eq('office_id', officeId);
    
    const totalRevenue = fees?.reduce((sum, f) => sum + parseFloat(f.monthly_value), 0) || 0;
    const overdueFees = fees?.filter(f => f.payment_status === 'overdue') || [];
    
    // Atualizar cards
    document.getElementById('stat-clients').textContent = activeClients.length;
    document.getElementById('stat-revenue').textContent = formatCurrency(totalRevenue);
    document.getElementById('stat-overdue').textContent = overdueFees.length;
    document.getElementById('stat-leads').textContent = activeLeads.length;
    
    // Ações necessárias
    const actionItems = document.getElementById('action-items');
    actionItems.innerHTML = '';
    
    if (overdueFees.length > 0) {
        const li = document.createElement('li');
        li.textContent = `${overdueFees.length} cliente(s) com pagamento atrasado`;
        actionItems.appendChild(li);
    }
    
    if (actionItems.children.length === 0) {
        actionItems.innerHTML = '<li>✅ Nenhuma ação pendente no momento</li>';
    }
}

// ============================================
// LEADS
// ============================================

async function loadLeads() {
    showLoading('Carregando leads...');
    
    const { data: leads, error } = await supabase
        .from('leads')
        .select(`
            *,
            profiles (name)
        `)
        .eq('office_id', AppState.currentOffice.id)
        .order('created_at', { ascending: false });
    
    const tbody = document.getElementById('leads-table-body');
    tbody.innerHTML = '';
    
    if (!leads || leads.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhum lead encontrado</td></tr>';
    } else {
        leads.forEach(lead => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${lead.name}</td>
                <td>${lead.company || '-'}</td>
                <td>${lead.phone || '-'}</td>
                <td><span class="status-badge status-${lead.status}">${getStatusLabel(lead.status)}</span></td>
                <td>${lead.profiles?.name || '-'}</td>
                <td>
                    <button class="btn btn-sm btn-secondary" onclick="viewLead('${lead.id}')">Ver</button>
                    ${lead.status !== 'ganho' ? `<button class="btn btn-sm btn-success" onclick="convertLead('${lead.id}')">✓</button>` : ''}
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
    
    hideLoading();
}

// ============================================
// CLIENTES
// ============================================

async function loadClients() {
    showLoading('Carregando clientes...');
    
    const { data: clients } = await supabase
        .from('clients')
        .select(`
            *,
            fees (*)
        `)
        .eq('office_id', AppState.currentOffice.id)
        .order('created_at', { ascending: false });
    
    const tbody = document.getElementById('clients-table-body');
    tbody.innerHTML = '';
    
    if (!clients || clients.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhum cliente encontrado</td></tr>';
    } else {
        clients.forEach(client => {
            const currentFee = client.fees?.[0];
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${client.name}</td>
                <td>${client.document || '-'}</td>
                <td>${client.phone || '-'}</td>
                <td>${currentFee ? formatCurrency(currentFee.monthly_value) : '-'}</td>
                <td>${currentFee ? `<span class="status-badge status-${currentFee.payment_status}">${getPaymentStatusLabel(currentFee.payment_status)}</span>` : '-'}</td>
                <td>
                    <button class="btn btn-sm btn-secondary" onclick="viewClient('${client.id}')">Ver</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
    
    hideLoading();
}

// ============================================
// UTILITÁRIOS
// ============================================

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

function showLoading(message = 'Carregando...') {
    const overlay = document.getElementById('loading-overlay');
    overlay.querySelector('p').textContent = message;
    overlay.classList.add('active');
}

function hideLoading() {
    document.getElementById('loading-overlay').classList.remove('active');
}

function showAuthMessage(message, type = 'info') {
    const messageDiv = document.getElementById('auth-message');
    messageDiv.textContent = message;
    messageDiv.className = `auth-message ${type}`;
    messageDiv.style.display = 'block';
    
    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 5000);
}

function updateHeader() {
    document.getElementById('user-name').textContent = AppState.currentUser.name || AppState.currentUser.email;
    
    const selector = document.getElementById('current-office');
    selector.innerHTML = '';
    
    AppState.offices.forEach(office => {
        const option = document.createElement('option');
        option.value = office.id;
        option.textContent = office.name;
        option.selected = office.id === AppState.currentOffice.id;
        selector.appendChild(option);
    });
}

function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

function getStatusLabel(status) {
    const labels = {
        'novo': 'Novo',
        'contato': 'Em Contato',
        'proposta': 'Proposta',
        'ganho': 'Ganho',
        'perdido': 'Perdido'
    };
    return labels[status] || status;
}

function getPaymentStatusLabel(status) {
    const labels = {
        'pending': 'Pendente',
        'paid': 'Pago',
        'overdue': 'Atrasado',
        'cancelled': 'Cancelado'
    };
    return labels[status] || status;
}

function closeModal(modalId) {
    document.getElementById(modalId || 'modal').classList.remove('active');
}

function showTab(tabName) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.tab === tabName) {
            item.classList.add('active');
        }
    });
    
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`tab-${tabName}`).classList.add('active');
    
    switch(tabName) {
        case 'dashboard': loadDashboard(); break;
        case 'leads': loadLeads(); break;
        case 'clients': loadClients(); break;
    }
}

// ============================================
// EVENT LISTENERS
// ============================================

function initEventListeners() {
    // Auth tabs
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
            
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab + '-form').classList.add('active');
        });
    });
    
    // Login form
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        await login(email, password);
    });
    
    // Register form
    document.getElementById('register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('register-name').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const confirm = document.getElementById('register-confirm').value;
        
        if (password !== confirm) {
            showAuthMessage('As senhas não coincidem', 'error');
            return;
        }
        
        await register(name, email, password);
    });
    
    // Create office
    document.getElementById('create-office-btn').addEventListener('click', () => {
        document.getElementById('create-office-modal').classList.add('active');
    });
    
    document.getElementById('create-office-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const officeData = {
            name: document.getElementById('office-name').value,
            cnpj: document.getElementById('office-cnpj').value,
            phone: document.getElementById('office-phone').value,
            email: document.getElementById('office-email').value,
            active: true
        };
        await createOffice(officeData);
    });
    
    // Logout
    document.getElementById('logout-btn').addEventListener('click', logout);
    document.getElementById('logout-selection-btn').addEventListener('click', logout);
    
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => showTab(item.dataset.tab));
    });
    
    // Modal close
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.modal').classList.remove('active');
        });
    });
    
    // Office selector change
    document.getElementById('current-office').addEventListener('change', async (e) => {
        const office = AppState.offices.find(o => o.id === e.target.value);
        if (office) {
            await selectOffice(office);
        }
    });
}

// Funções placeholder
function viewLead(id) { console.log('View lead:', id); }
function convertLead(id) { console.log('Convert lead:', id); }
function viewClient(id) { console.log('View client:', id); }

console.log('✅ Web-app.js carregado');
