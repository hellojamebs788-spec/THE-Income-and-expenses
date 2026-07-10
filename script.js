// Supabase Configuration
const SUPABASE_URL = "https://awnghrxbdsjyhatupnsf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3bmdocnhiZHNqeWhhdHVwbnNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMTY4NjUsImV4cCI6MjA5Nzc5Mjg2NX0.J0pbDTVQ6tEgrpZ53qtL0b8u-bsee73gV3hH75ug8CQ";

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Tab Switcher Logic
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    event.currentTarget.classList.add('active');
    
    if(tabId === 'expense-tab') updateUI();
    if(tabId === 'debt-tab') updateDebtUI();
}

// ==================== CODE ZONE 1: EXPENSE SYSTEM ====================
const balanceEl = document.getElementById('total-balance');
const incomeEl = document.getElementById('total-income');
const expenseEl = document.getElementById('total-expense');
const todayExpenseEl = document.getElementById('today-expense');
const monthBalanceEl = document.getElementById('month-balance');
const todayAllowanceEl = document.getElementById('today-allowance');
const listEl = document.getElementById('transaction-list');
const formEl = document.getElementById('transaction-form');

async function getTransactions() {
    try {
        const { data, error } = await supabaseClient.from('transactions').select('*').order('created_at', { ascending: false });
        if (error) throw error; return data;
    } catch (error) { console.error(error.message); return []; }
}

async function addTransaction(description, amount, type) {
    try {
        const { error } = await supabaseClient.from('transactions').insert([{ description, amount, type }]);
        if (error) throw error; return true;
    } catch (error) { alert(error.message); return false; }
}

async function deleteTransaction(id) {
    if(!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้?')) return;
    try {
        const { error } = await supabaseClient.from('transactions').delete().eq('id', id);
        if (error) throw error; updateUI(); 
    } catch (error) { alert(error.message); }
}

function formatCurrency(num) {
    return '฿' + parseFloat(num).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function updateUI() {
    listEl.innerHTML = '<li class="loading">กำลังโหลดข้อมูล...</li>';
    const transactions = await getTransactions();
    
    if (transactions.length === 0) {
        listEl.innerHTML = '<li class="empty-state">ไม่มีรายการบันทึกในขณะนี้</li>';
        balanceEl.innerText = incomeEl.innerText = expenseEl.innerText = todayExpenseEl.innerText = monthBalanceEl.innerText = todayAllowanceEl.innerText = '฿0.00';
        return;
    }

    listEl.innerHTML = '';
    let totalIncome = 0, totalExpense = 0, monthIncome = 0, monthExpense = 0, todayExpense = 0;

    const now = new Date(), currentYear = now.getFullYear(), currentMonth = now.getMonth(), currentDay = now.getDate();
    const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysRemaining = totalDaysInMonth - currentDay + 1;

    transactions.forEach(transaction => {
        const isIncome = transaction.type === 'income', amount = parseFloat(transaction.amount), tDate = new Date(transaction.created_at);

        if (isIncome) totalIncome += amount; else totalExpense += amount;

        if (tDate.getFullYear() === currentYear && tDate.getMonth() === currentMonth) {
            if (isIncome) monthIncome += amount; else monthExpense += amount;
            if (tDate.getDate() === currentDay && !isIncome) todayExpense += amount;
        }

        const li = document.createElement('li');
        li.classList.add(transaction.type);
        li.innerHTML = `
            <div class="list-details"><span class="list-title">${transaction.description}</span><span class="list-date">${formatDate(transaction.created_at)}</span></div>
            <div class="list-amount ${transaction.type}">${isIncome ? '+' : '-'}${formatCurrency(amount)}
                <button class="btn-delete" onclick="deleteTransaction(${transaction.id})"><i class="fa-solid fa-trash-can"></i></button>
            </div>`;
        listEl.appendChild(li);
    });

    const monthBalance = monthIncome - monthExpense;
    let todayAllowance = 0;
    if (monthIncome > 0) todayAllowance = (monthBalance + todayExpense) / daysRemaining - todayExpense;
    if (todayAllowance < 0) todayAllowance = 0;

    balanceEl.innerText = formatCurrency(totalIncome - totalExpense);
    incomeEl.innerText = formatCurrency(monthIncome);
    expenseEl.innerText = formatCurrency(monthExpense);
    todayExpenseEl.innerText = formatCurrency(todayExpense);
    monthBalanceEl.innerText = formatCurrency(monthBalance);
    todayAllowanceEl.innerText = formatCurrency(todayAllowance);
}

formEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    const desc = document.getElementById('description').value.trim(), amt = parseFloat(document.getElementById('amount').value), type = document.getElementById('type').value;
    if (!desc || isNaN(amt) || amt <= 0) return;
    if (await addTransaction(desc, amt, type)) {
        document.getElementById('description').value = ''; document.getElementById('amount').value = ''; updateUI();
    }
});

// ==================== CODE ZONE 2: DEBT SYSTEM ====================
const totalDebtEl = document.getElementById('total-debt');
const activeDebtEl = document.getElementById('active-debt');
const paidDebtEl = document.getElementById('paid-debt');
const debtListEl = document.getElementById('debt-list');
const debtFormEl = document.getElementById('debt-form');

async function getDebts() {
    try {
        const { data, error } = await supabaseClient.from('debts').select('*').order('status', { ascending: true }).order('created_at', { ascending: false });
        if (error) throw error; return data;
    } catch (error) { console.error(error.message); return []; }
}

async function addDebt(title, total_amount, monthly_payment) {
    try {
        const { error } = await supabaseClient.from('debts').insert([{ title, total_amount, monthly_payment, status: 'active' }]);
        if (error) throw error; return true;
    } catch (error) { alert(error.message); return false; }
}

async function toggleDebtStatus(id, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'paid' : 'active';
    try {
        const { error } = await supabaseClient.from('debts').update({ status: newStatus }).eq('id', id);
        if (error) throw error; updateDebtUI();
    } catch (error) { alert(error.message); }
}

async function deleteDebt(id) {
    if(!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบรายการหนี้สินนี้?')) return;
    try {
        const { error } = await supabaseClient.from('debts').delete().eq('id', id);
        if (error) throw error; updateDebtUI();
    } catch (error) { alert(error.message); }
}

async function updateDebtUI() {
    debtListEl.innerHTML = '<li class="loading">กำลังโหลดข้อมูล...</li>';
    const debts = await getDebts();

    if (debts.length === 0) {
        debtListEl.innerHTML = '<li class="empty-state">ไม่มีรายการหนี้สิน/ผ่อนสินค้า</li>';
        totalDebtEl.innerText = activeDebtEl.innerText = paidDebtEl.innerText = '฿0.00';
        return;
    }

    debtListEl.innerHTML = '';
    let allDebt = 0, activeDebt = 0, paidDebt = 0;

    debts.forEach(debt => {
        const amt = parseFloat(debt.total_amount);
        const monthly = parseFloat(debt.monthly_payment);
        allDebt += amt;
        
        if (debt.status === 'active') activeDebt += amt; else paidDebt += amt;

        const li = document.createElement('li');
        li.className = debt.status === 'paid' ? 'paid' : 'debt-active';
        
        li.innerHTML = `
            <div class="list-details">
                <span class="list-title">${debt.title}</span>
                <span class="list-date">ผ่อนเดือนละ: ${formatCurrency(monthly)}</span>
            </div>
            <div class="list-amount">
                ${formatCurrency(amt)}
                <div class="action-btns">
                    <button class="btn-action check-btn" onclick="toggleDebtStatus(${debt.id}, '${debt.status}')" title="เปลี่ยนสถานะการจ่าย">
                        <i class="fa-solid ${debt.status === 'paid' ? 'fa-rotate-left' : 'fa-circle-check'}"></i>
                    </button>
                    <button class="btn-delete" onclick="deleteDebt(${debt.id})"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            </div>`;
        debtListEl.appendChild(li);
    });

    totalDebtEl.innerText = formatCurrency(allDebt);
    activeDebtEl.innerText = formatCurrency(activeDebt);
    paidDebtEl.innerText = formatCurrency(paidDebt);
}

debtFormEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('debt-title').value.trim();
    const amt = parseFloat(document.getElementById('debt-amount').value);
    const monthly = parseFloat(document.getElementById('debt-monthly').value);

    if(!title || isNaN(amt) || amt <= 0) return;
    if(await addDebt(title, amt, monthly)) {
        document.getElementById('debt-title').value = '';
        document.getElementById('debt-amount').value = '';
        document.getElementById('debt-monthly').value = '';
        updateDebtUI();
    }
});

// Initial Load
document.addEventListener('DOMContentLoaded', updateUI);
