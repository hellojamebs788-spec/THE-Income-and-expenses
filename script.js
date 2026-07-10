// Supabase Configuration
const SUPABASE_URL = "https://awnghrxbdsjyhatupnsf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3bmdocnhiZHNqeWhhdHVwbnNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMTY4NjUsImV4cCI6MjA5Nzc5Mjg2NX0.J0pbDTVQ6tEgrpZ53qtL0b8u-bsee73gV3hH75ug8CQ";

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Tab Switcher Controller
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    event.currentTarget.classList.add('active');
    
    if(tabId === 'expense-tab') updateUI();
    if(tabId === 'debt-tab') updateDebtUI();
}

function formatCurrency(num) {
    return '฿' + parseFloat(num).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
}

// ==================== ZONE 1: EXPENSE SYSTEM LOGIC ====================
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
            <div class="list-details">
                <span class="list-title">${transaction.description}</span>
                <span class="list-date">${tDate.toLocaleDateString('th-TH', {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'})}</span>
            </div>
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

// ==================== ZONE 2: MASTER DEBT SYSTEM LOGIC ====================
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

// ฟังก์ชันสำหรับ "แก้ไขยอดผ่อนต่อเดือน"
async function editMonthlyPayment(id, currentMonthly, title) {
    const newMonthlyStr = prompt(`แก้ไขยอดผ่อนต่อเดือนสำหรับ "${title}":`, currentMonthly);
    if (newMonthlyStr === null) return;
    
    const newMonthly = parseFloat(newMonthlyStr);
    if (isNaN(newMonthly) || newMonthly <= 0) {
        alert("กรุณากรอกจำนวนเงินให้ถูกต้องและมากกว่า 0 บาท");
        return;
    }

    try {
        const { error } = await supabaseClient.from('debts').update({ monthly_payment: newMonthly }).eq('id', id);
        if (error) throw error;
        alert('แก้ไขยอดผ่อนเรียบร้อยแล้ว!');
        updateDebtUI();
    } catch (error) { alert('เกิดข้อผิดพลาดในการแก้ไข: ' + error.message); }
}

// ฟังก์ชันสำหรับ "แก้ไขยอดหนี้คงเหลือปัจจุบัน" (ฟีเจอร์ใหม่ที่คุณเลือก)
async function editRemainingAmount(id, currentRemaining, title) {
    const newRemainingStr = prompt(`แก้ไขยอดหนี้คงเหลือปัจจุบันสำหรับ "${title}":`, currentRemaining);
    if (newRemainingStr === null) return;
    
    const newRemaining = parseFloat(newRemainingStr);
    if (isNaN(newRemaining) || newRemaining < 0) {
        alert("กรุณากรอกจำนวนเงินให้ถูกต้องและไม่ต่ำกว่า 0 บาท");
        return;
    }

    try {
        const newStatus = newRemaining <= 0 ? 'paid' : 'active';
        const { error } = await supabaseClient.from('debts').update({ remaining_amount: newRemaining, status: newStatus }).eq('id', id);
        if (error) throw error;
        alert('แก้ไขยอดหนี้คงเหลือเรียบร้อยแล้ว!');
        updateDebtUI();
    } catch (error) { alert('เกิดข้อผิดพลาดในการแก้ไข: ' + error.message); }
}

async function payInstallment(id, title, monthlyPayment, remainingAmount) {
    const payment = Math.min(parseFloat(monthlyPayment), parseFloat(remainingAmount));
    if (payment <= 0) return;

    if (!confirm(`ยืนยันการชำระค่างวดสำหรับ "${title}" จำนวน ${formatCurrency(payment)}? \n(ระบบจะตัดหนี้และเพิ่มในบันทึกรายจ่ายให้อัตโนมัติ)`)) return;

    try {
        const newRemaining = parseFloat(remainingAmount) - payment;
        const newStatus = newRemaining <= 0 ? 'paid' : 'active';

        const { error: debtError } = await supabaseClient.from('debts').update({ remaining_amount: newRemaining, status: newStatus }).eq('id', id);
        if (debtError) throw debtError;

        await addTransaction(`จ่ายค่างวด: ${title}`, payment, 'expense');

        alert('ชำระค่างวดสำเร็จและบันทึกลงในรายจ่ายเรียบร้อยแล้ว!');
        updateDebtUI();
    } catch (error) { alert('เกิดข้อผิดพลาด: ' + error.message); }
}

async function deleteDebt(id) {
    if(!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบหนี้หลักนี้ออกจากทะเบียน?')) return;
    try {
        const { error } = await supabaseClient.from('debts').delete().eq('id', id);
        if (error) throw error; updateDebtUI();
    } catch (error) { alert(error.message); }
}

async function updateDebtUI() {
    debtListEl.innerHTML = '<li class="loading">กำลังโหลดข้อมูล...</li>';
    const debts = await getDebts();

    if (debts.length === 0) {
        debtListEl.innerHTML = '<li class="empty-state">ไม่มีรายการหนี้สินใน Master List</li>';
        totalDebtEl.innerText = activeDebtEl.innerText = paidDebtEl.innerText = '฿0.00';
        return;
    }

    debtListEl.innerHTML = '';
    let totalInitialDebt = 0, currentActiveDebt = 0, clearedDebt = 0;

    debts.forEach(debt => {
        const initial = parseFloat(debt.total_amount);
        const remaining = parseFloat(debt.remaining_amount);
        const monthly = parseFloat(debt.monthly_payment);

        totalInitialDebt += initial;
        if (debt.status === 'active') {
            currentActiveDebt += remaining;
        } else {
            clearedDebt += initial;
        }

        let monthsLeftStr = "";
        if (debt.status === 'paid' || remaining <= 0) {
            monthsLeftStr = `<span class="badge-countdown">ชำระหมดเกลี้ยงแล้ว 🎉</span>`;
        } else {
            const monthsLeft = Math.ceil(remaining / monthly);
            monthsLeftStr = `<span class="badge-countdown"><i class="fa-solid fa-hourglass-half"></i> เหลืออีกประมาณ ${monthsLeft} เดือน</span>`;
        }

        const li = document.createElement('li');
        li.className = debt.status === 'paid' ? 'paid' : 'debt-active';
        
        li.innerHTML = `
            <div class="list-details">
                <span class="list-title">${debt.title}</span>
                <span class="list-date">
                    ยอดผ่อนต่อเดือน: ${formatCurrency(monthly)}
                    ${debt.status === 'active' ? `
                        <button class="btn-delete" style="color: #4299e1; padding: 0 4px; display: inline-block; vertical-align: middle;" onclick="editMonthlyPayment(${debt.id}, ${monthly}, '${debt.title}')" title="แก้ไขค่างวด">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                    ` : ''}
                </span>
                ${monthsLeftStr}
            </div>
            <div class="list-amount text-danger">
                <div style="text-align: right; display: flex; align-items: center; gap: 8px;">
                    <div>
                        <div style="font-weight: 700;">
                            ${formatCurrency(remaining)}
                            ${debt.status === 'active' ? `
                                <button class="btn-delete" style="color: #4a5568; padding: 0 2px; font-size: 0.8rem;" onclick="editRemainingAmount(${debt.id}, ${remaining}, '${debt.title}')" title="แก้ไขยอดหนี้คงเหลือ">
                                    <i class="fa-solid fa-pen-to-square"></i>
                                </button>
                            ` : ''}
                        </div>
                        <div style="font-size: 0.7rem; color: #a0aec0; font-weight: normal;">จากเดิม ${formatCurrency(initial)}</div>
                    </div>
                </div>
                <div class="action-btns">
                    ${debt.status === 'active' ? `
                        <button class="btn-pay" onclick="payInstallment(${debt.id}, '${debt.title}', ${monthly}, ${remaining})">
                            <i class="fa-solid fa-hand-holding-dollar"></i> จ่ายงวด
                        </button>
                    ` : ''}
                    <button class="btn-delete" onclick="deleteDebt(${debt.id})"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            </div>`;
        debtListEl.appendChild(li);
    });

    totalDebtEl.innerText = formatCurrency(totalInitialDebt);
    activeDebtEl.innerText = formatCurrency(currentActiveDebt);
    paidDebtEl.innerText = formatCurrency(clearedDebt);
}

debtFormEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('debt-title').value.trim();
    const amt = parseFloat(document.getElementById('debt-amount').value);
    const monthly = parseFloat(document.getElementById('debt-monthly').value);

    if(!title || isNaN(amt) || amt <= 0 || isNaN(monthly) || monthly <= 0) return;
    
    try {
        const { error } = await supabaseClient.from('debts').insert([{ title, total_amount: amt, remaining_amount: amt, monthly_payment: monthly, status: 'active' }]);
        if (error) throw error;
        
        document.getElementById('debt-title').value = '';
        document.getElementById('debt-amount').value = '';
        document.getElementById('debt-monthly').value = '';
        updateDebtUI();
    } catch (error) { alert(error.message); }
});

// Initial Load
document.addEventListener('DOMContentLoaded', updateUI);
