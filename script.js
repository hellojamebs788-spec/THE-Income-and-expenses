// Supabase Configuration
const SUPABASE_URL = "https://awnghrxbdsjyhatupnsf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3bmdocnhiZHNqeWhhdHVwbnNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMTY4NjUsImV4cCI6MjA5Nzc5Mjg2NX0.J0pbDTVQ6tEgrpZ53qtL0b8u-bsee73gV3hH75ug8CQ";

// Initialize Supabase Client
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM Elements
const balanceEl = document.getElementById('total-balance');
const incomeEl = document.getElementById('total-income');
const expenseEl = document.getElementById('total-expense');
const monthBalanceEl = document.getElementById('month-balance');
const todayAllowanceEl = document.getElementById('today-allowance');
const listEl = document.getElementById('transaction-list');
const formEl = document.getElementById('transaction-form');
const descriptionEl = document.getElementById('description');
const amountEl = document.getElementById('amount');
const typeEl = document.getElementById('type');

// Fetch Transactions from Supabase
async function getTransactions() {
    try {
        const { data, error } = await supabaseClient
            .from('transactions')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error fetching data:', error.message);
        return [];
    }
}

// Add Transaction to Supabase
async function addTransaction(description, amount, type) {
    try {
        const { data, error } = await supabaseClient
            .from('transactions')
            .insert([{ description, amount, type }]);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error inserting data:', error.message);
        alert('ไม่สามารถบันทึกข้อมูลได้: ' + error.message);
        return false;
    }
}

// Delete Transaction from Supabase
async function deleteTransaction(id) {
    if(!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้?')) return;
    
    try {
        const { error } = await supabaseClient
            .from('transactions')
            .delete()
            .eq('id', id);

        if (error) throw error;
        updateUI(); 
    } catch (error) {
        console.error('Error deleting data:', error.message);
        alert('ไม่สามารถลบข้อมูลได้: ' + error.message);
    }
}

// Format number to currency style (THB)
function formatCurrency(num) {
    return '฿' + parseFloat(num).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
}

// Format ISO date string to readable Thai format
function formatDate(dateString) {
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString('th-TH', options);
}

// Calculate totals and Update User Interface
async function updateUI() {
    listEl.innerHTML = '<li class="loading">กำลังโหลดข้อมูล...</li>';
    
    const transactions = await getTransactions();
    
    if (transactions.length === 0) {
        listEl.innerHTML = '<li class="empty-state">ไม่มีรายการบันทึกในขณะนี้</li>';
        balanceEl.innerText = '฿0.00';
        incomeEl.innerText = '฿0.00';
        expenseEl.innerText = '฿0.00';
        monthBalanceEl.innerText = '฿0.00';
        todayAllowanceEl.innerText = '฿0.00';
        return;
    }

    listEl.innerHTML = '';
    let totalIncome = 0;
    let totalExpense = 0;
    
    let monthIncome = 0;
    let monthExpense = 0;
    let todayExpense = 0;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDay = now.getDate();

    const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysRemaining = totalDaysInMonth - currentDay + 1;

    transactions.forEach(transaction => {
        const isIncome = transaction.type === 'income';
        const amount = parseFloat(transaction.amount);
        const tDate = new Date(transaction.created_at);

        // 1. ยอดรวมทั้งหมด (All-time)
        if (isIncome) {
            totalIncome += amount;
        } else {
            totalExpense += amount;
        }

        // 2. เช็ครายการของเดือนปัจจุบัน
        if (tDate.getFullYear() === currentYear && tDate.getMonth() === currentMonth) {
            if (isIncome) {
                monthIncome += amount;
            } else {
                monthExpense += amount;
            }

            // 3. เช็ครายการของวันนี้
            if (tDate.getDate() === currentDay) {
                if (!isIncome) {
                    todayExpense += amount;
                }
            }
        }

        const li = document.createElement('li');
        li.classList.add(transaction.type);
        
        li.innerHTML = `
            <div class="list-details">
                <span class="list-title">${transaction.description}</span>
                <span class="list-date">${formatDate(transaction.created_at)}</span>
            </div>
            <div class="list-amount ${transaction.type}">
                ${isIncome ? '+' : '-'}${formatCurrency(amount)}
                <button class="btn-delete" onclick="deleteTransaction(${transaction.id})">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        `;
        listEl.appendChild(li);
    });

    // ยอดรวมเดือนนี้คงเหลือ
    const monthBalance = monthIncome - monthExpense;
    
    // ปรับปรุงสูตร: คำนวณหาเงินคงเหลือปัจจุบันของเดือนนี้ก่อน แล้วค่อยนำมาหารเฉลี่ยจำนวนวันที่เหลืออยู่
    // วิธีนี้จะช่วยรองรับกรณีเพิ่งใส่รายรับเข้ามาในวันนี้ได้แม่นยำขึ้น
    let todayAllowance = 0;
    if (monthIncome > 0) {
        todayAllowance = (monthBalance + todayExpense) / daysRemaining - todayExpense;
    }

    // ป้องกันกรณีคำนวณแล้วติดลบ ให้แสดงเป็น 0
    if (todayAllowance < 0) {
        todayAllowance = 0;
    }

    // อัปเดตข้อมูลลงหน้าจอแสดงผล
    const totalBalance = totalIncome - totalExpense;
    balanceEl.innerText = formatCurrency(totalBalance);
    incomeEl.innerText = formatCurrency(totalIncome);
    expenseEl.innerText = formatCurrency(totalExpense);
    
    monthBalanceEl.innerText = formatCurrency(monthBalance);
    todayAllowanceEl.innerText = formatCurrency(todayAllowance);
}

// Form Submit Handler
formEl.addEventListener('submit', async (e) => {
    e.preventDefault();

    const desc = descriptionEl.value.trim();
    const amt = parseFloat(amountEl.value);
    const type = typeEl.value;

    if (!desc || isNaN(amt) || amt <= 0) return;

    const success = await addTransaction(desc, amt, type);
    if (success) {
        descriptionEl.value = '';
        amountEl.value = '';
        typeEl.value = 'income';
        updateUI();
    }
});

// Initial load
document.addEventListener('DOMContentLoaded', updateUI);
