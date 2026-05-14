const API_URL = 'http://localhost:5002/api';

let globalTransactions = []; // Зберігаємо транзакції для експорту

document.addEventListener('DOMContentLoaded', async () => {
    await loadFinanceDashboard();
});

// Функції для перемикання екранів
// 🔥 Функції для перемикання екранів
function showPayoutsView() {
    document.getElementById('dashboardView').classList.add('d-none');
    document.getElementById('analyticsView').classList.add('d-none');
    document.getElementById('payoutsView').classList.remove('d-none');
}

function showDashboardView() {
    document.getElementById('payoutsView').classList.add('d-none');
    document.getElementById('analyticsView').classList.add('d-none');
    document.getElementById('dashboardView').classList.remove('d-none');
}

function showAnalyticsView() {
    document.getElementById('dashboardView').classList.add('d-none');
    document.getElementById('payoutsView').classList.add('d-none');
    document.getElementById('analyticsView').classList.remove('d-none');
    
    // 🔥 Запускаємо малювання всіх графіків відразу
    renderAllAnalytics(globalTransactions);
}

async function loadFinanceDashboard() {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/admin/finance/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error("Помилка сервера");
        const data = await res.json();

        globalTransactions = data.transactions; // Зберігаємо для фільтрів і графіка

        // 🔥 РАХУЄМО ОБІГ САМОСТІЙНО (захист від порожніх значень з бекенду)
        const calculatedTurnover = globalTransactions.reduce((sum, tr) => {
            return sum + (tr.amount || tr.totalAmount || 0); // Беремо будь-яке поле, яке існує
        }, 0);

        // 1. Заповнюємо базові KPI
        document.getElementById('totalTurnover').innerText = `${calculatedTurnover.toLocaleString()} ₴`;
        document.getElementById('totalNet').innerText = `${(data.summary.totalPlatformNet || 0).toLocaleString()} ₴`;
        
        // Тепер борг приходить готовою цифрою з бекенду
        document.getElementById('totalDebt').innerText = `${(data.summary.totalTeacherDebt || 0).toLocaleString()} ₴`;

        // 2. Рахуємо Середній Чек (AOV)
        const aov = globalTransactions.length > 0 ? (calculatedTurnover / globalTransactions.length) : 0;
        document.getElementById('averageCheck').innerText = `${Math.round(aov).toLocaleString()} ₴`;

        // Малюємо таблицю та графік
        renderTransactionsTable(globalTransactions);
        renderSparklineChart(globalTransactions);

        // 2. Черга виплат (тепер вона в окремому екрані)
        // 2. Черга запитів на виплату (Імітуємо реальні запити)
        // Черга запитів на виплату (РЕАЛЬНІ ДАНІ)
        const queueContainer = document.getElementById('payoutQueue');
        const pendingRequests = data.payoutQueue || [];
        
        document.getElementById('requestsCount').innerText = pendingRequests.length;

        if (pendingRequests.length === 0) {
            queueContainer.innerHTML = '<div class="text-center py-5 text-muted"><i class="bi bi-inbox fs-1 text-secondary d-block mb-3 opacity-50"></i> Немає нових запитів на виплату</div>';
        } else {
            queueContainer.innerHTML = pendingRequests.map(t => {
                const reqDate = new Date(t.createdAt).toLocaleDateString('uk-UA');
                const shortId = `REQ-${t._id.substring(t._id.length - 6).toUpperCase()}`;
                
                // 🔥 Дістаємо картку викладача з об'єкта teacher
                const cardNumber = t.teacher?.cardNumber || '';
                
                // 🔥 Формуємо красивий блок з карткою і кнопкою "Копіювати"
                const cardDisplay = cardNumber 
                    ? `<div class="mt-2 bg-light p-2 rounded border d-inline-flex align-items-center">
                           <i class="bi bi-credit-card-2-front me-2 text-secondary"></i>
                           <span class="font-monospace fw-bold text-dark me-3 tracking-widest">${cardNumber}</span>
                           <button onclick="navigator.clipboard.writeText('${cardNumber.replace(/\s/g, '')}'); alert('Картку скопійовано!');" class="btn btn-sm btn-outline-secondary py-0 px-2" title="Копіювати номер">
                               <i class="bi bi-copy"></i>
                           </button>
                       </div>`
                    : `<div class="mt-2 text-danger small bg-danger bg-opacity-10 p-1 px-2 rounded d-inline-block"><i class="bi bi-exclamation-triangle me-1"></i> Викладач не вказав реквізити</div>`;

                return `
                <div class="list-group-item py-4 border rounded-3 mb-3 shadow-sm bg-white">
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="d-flex align-items-start">
                            <div class="bg-warning bg-opacity-10 text-warning p-3 rounded-circle me-3 mt-1">
                                <i class="bi bi-bank fs-4"></i>
                            </div>
                            <div>
                                <div class="fw-bold fs-5 text-dark">${t.teacher?.name || 'Невідомий'}</div>
                                <div class="text-muted small mt-1">
                                    Запит №${shortId} від ${reqDate}
                                </div>
                                <!-- Виводимо блок з карткою -->
                                ${cardDisplay}
                            </div>
                        </div>
                        <div class="text-end">
                            <div class="fw-bold text-dark fs-3 mb-2">${t.amount} ₴</div>
                            <div class="d-flex gap-2 justify-content-end">
                                <button onclick="rejectPayout('${t._id}', '${t.teacher?.name}')" class="btn btn-outline-danger rounded-pill px-3 shadow-sm fw-bold">
                                    <i class="bi bi-x-lg"></i>
                                </button>
                                <button onclick="confirmPayout('${t._id}', '${t.teacher?.name}', ${t.amount})" class="btn btn-success rounded-pill px-4 shadow-sm fw-bold" ${!cardNumber ? 'disabled' : ''}>
                                    <i class="bi bi-check-lg me-1"></i> Підтвердити
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                `;
            }).join('');
        
        }

        // 🔥 3. Генерація Архіву Виплат
        // На бекенді у тебе ще немає таблиці Payouts, тому для захисту диплому 
        // ми витягнемо логіку з існуючих транзакцій або просто згенеруємо "Заглушку" архіву.
        // Якщо у тебе є реальний масив виплат з бази, використовуй його. Тут показано, як це має виглядати:
        // 🔥 3. Генерація Архіву Виплат (ТЕПЕР БЕРЕМО РЕАЛЬНІ З БАЗИ)
        const archiveContainer = document.getElementById('payoutArchiveTable');
        
        // data.payoutArchive приходить з нашого оновленого бекенду
        if (!data.payoutArchive || data.payoutArchive.length === 0) {
            archiveContainer.innerHTML = '<tr><td colspan="5" class="text-center py-5 text-muted"><i class="bi bi-clock-history fs-2 d-block mb-2 opacity-50"></i>Історія виплат порожня</td></tr>';
        } else {
            archiveContainer.innerHTML = data.payoutArchive.map(p => {
                const dateObj = new Date(p.createdAt);
                const dateStr = dateObj.toLocaleDateString('uk-UA');
                const timeStr = dateObj.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
                
                // Генеруємо красивий ID на основі MongoDB _id (беремо останні 6 символів)
                const shortId = `PAY-${p._id.substring(p._id.length - 6).toUpperCase()}`;

                return `
                <tr>
                    <td class="ps-3 text-muted small fw-bold">${shortId}</td>
                    <td>
                        <div class="text-dark">${dateStr}</div>
                        <div class="small text-muted" style="font-size: 0.75rem;">${timeStr}</div>
                    </td>
                    <td class="fw-bold text-dark">${p.teacher?.name || 'Видалений акаунт'}</td>
                    <td class="fw-bold">${p.amount} ₴</td>
                    <td><span class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25"><i class="bi bi-check-circle me-1"></i> Виплачено</span></td>
                </tr>
                `;
            }).join('');
        }

        // 3. Таблиця останніх транзакцій (з логікою 14 днів)
        const tableBody = document.getElementById('transactionsTable');
        tableBody.innerHTML = data.transactions.map(tr => {
            const date = new Date(tr.createdAt);
            const dateStr = date.toLocaleDateString('uk-UA');
            
            const total = tr.amount || tr.totalAmount || 0; 
            const fee = tr.platformFee || Math.round(total * 0.25);

            // ЛОГІКА ХОЛДУ 14 ДНІВ
            let statusHtml = '';
            if (tr.isSystemCourse) {
                // Системні курси - весь прибуток наш, виплачувати нікому не треба
                statusHtml = `<span class="badge bg-light text-muted border">Платформа</span>`;
            } else {
                // Рахуємо дату розморозки
                const availableAt = new Date(date);
                availableAt.setDate(availableAt.getDate() + 14);
                
                const now = new Date();
                if (now >= availableAt) {
                    statusHtml = `<span class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25">Available</span>`;
                } else {
                    const availableStr = availableAt.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' });
                    statusHtml = `<span class="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25">Pending до ${availableStr}</span>`;
                }
            }

            return `
                <tr>
                    <td class="ps-3 fw-bold text-dark">${dateStr}</td>
                    <td><div class="text-dark">${tr.user?.name || 'Студент'}</div></td>
                    <td><span class="badge bg-light text-dark border fw-normal">${tr.course?.title || 'Видалений курс'}</span></td>
                    <td class="fw-bold">${total} ₴</td>
                    <td class="text-success fw-bold">+${fee} ₴</td>
                    <td>${statusHtml}</td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error("Frontend Finance Error:", err);
    }
}

window.confirmPayout = async function(id, name, amount) {
    if (!confirm(`Підтвердити виплату ${amount} ₴ для ${name}?`)) return;

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/admin/finance/payout/${id}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            alert("✅ Баланс вчителя оновлено (виплачено).");
            location.reload();
        }
    } catch (err) { alert("Помилка сервера"); }
};

// Функція експорту в Excel / CSV
window.exportTransactionsCSV = function() {
    if (!globalTransactions || globalTransactions.length === 0) {
        return alert('Немає транзакцій для експорту');
    }

    // Додаємо BOM (\uFEFF), щоб Excel правильно читав кирилицю
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; 
    
    // Заголовки колонок
    csvContent += "Дата,Час,Студент,Курс,Сума (UAH),Прибуток платформи (UAH),Статус\n";

    // Перебираємо всі транзакції і формуємо рядки
    globalTransactions.forEach(tr => {
        const d = new Date(tr.createdAt);
        const dateStr = d.toLocaleDateString('uk-UA');
        const timeStr = d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
        
        // Видаляємо коми з імен та назв, щоб не поламати формат CSV
        const student = (tr.user?.name || 'Невідомий студент').replace(/,/g, '');
        const course = (tr.course?.title || 'Видалений курс').replace(/,/g, '');
        
        const total = tr.amount || tr.totalAmount || 0;
        const fee = tr.platformFee || Math.round(total * 0.25);
        const status = tr.isSystemCourse ? 'Системний' : 'Курс викладача';

        csvContent += `${dateStr},${timeStr},${student},${course},${total},${fee},${status}\n`;
    });

    // Створюємо віртуальне посилання і клікаємо по ньому для завантаження
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    
    // Генеруємо красиву назву файлу з поточною датою
    const today = new Date().toLocaleDateString('uk-UA').replace(/\./g, '-');
    link.setAttribute("download", `Lexora_Finance_${today}.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// 🔥 ФІЛЬТРАЦІЯ ТАБЛИЦІ
window.applyFilters = function() {
    const filterValue = document.getElementById('courseTypeFilter').value;
    let filtered = globalTransactions;
    
    if (filterValue === 'system') {
        filtered = globalTransactions.filter(tr => tr.isSystemCourse === true);
    } else if (filterValue === 'teacher') {
        filtered = globalTransactions.filter(tr => !tr.isSystemCourse);
    }
    
    renderTransactionsTable(filtered);
};

// 🔥 РЕНДЕР ТАБЛИЦІ (винесли в окрему функцію, щоб оновлювати при фільтрації)
function renderTransactionsTable(transactions) {
    const tableBody = document.getElementById('transactionsTable');
    
    if (transactions.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">За цим фільтром транзакцій не знайдено</td></tr>';
        return;
    }

    tableBody.innerHTML = transactions.map(tr => {
        const date = new Date(tr.createdAt);
        const dateStr = date.toLocaleDateString('uk-UA');
        
        const total = tr.amount || tr.totalAmount || 0; 
        const fee = tr.platformFee || Math.round(total * 0.25);

        let statusHtml = '';
        if (tr.isSystemCourse) {
            statusHtml = `<span class="badge bg-light text-muted border">Платформа</span>`;
        } else {
            const availableAt = new Date(date);
            availableAt.setDate(availableAt.getDate() + 14);
            const now = new Date();
            
            if (now >= availableAt) {
                statusHtml = `<span class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25">Available</span>`;
            } else {
                const availStr = availableAt.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' });
                statusHtml = `<span class="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25">Pending до ${availStr}</span>`;
            }
        }

        return `
            <tr>
                <td class="ps-3 fw-bold text-dark">${dateStr}</td>
                <td><div class="text-dark">${tr.user?.name || 'Студент'}</div></td>
                <td><span class="badge bg-light text-dark border fw-normal text-truncate d-inline-block" style="max-width: 200px;">${tr.course?.title || 'Курс'}</span></td>
                <td class="fw-bold">${total} ₴</td>
                <td class="text-success fw-bold">+${fee} ₴</td>
                <td>${statusHtml}</td>
            </tr>
        `;
    }).join('');
}

// 🔥 ГРАФІК ДИНАМІКИ ПРОДАЖІВ
let gmvChartInstance = null; // Зберігаємо графік, щоб видаляти старий при оновленні
function renderSparklineChart(transactions) {
    const ctx = document.getElementById('gmvChart');
    if (!ctx) return;

    // Сортуємо транзакції від найстарішої до найновішої (зліва направо)
    const sortedTx = [...transactions].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    
    // Групуємо суми по датах
    const dailyData = {};
    sortedTx.forEach(tr => {
        const d = new Date(tr.createdAt).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' });
        const amount = tr.amount || tr.totalAmount || 0;
        dailyData[d] = (dailyData[d] || 0) + amount;
    });

    if (gmvChartInstance) gmvChartInstance.destroy(); // Очищаємо попередній графік

    gmvChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Object.keys(dailyData),
            datasets: [{
                data: Object.values(dailyData),
                borderColor: '#198754', // Зелений колір Lexora
                backgroundColor: 'rgba(25, 135, 84, 0.1)',
                borderWidth: 2,
                tension: 0.4, // Робить лінію плавною (хвилястою)
                pointRadius: 0, // Ховаємо точки
                fill: true // Заливка під графіком
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { enabled: true } },
            scales: { x: { display: false }, y: { display: false, beginAtZero: true } }, // Ховаємо осі повністю
            layout: { padding: 0 }
        }
    });
}

// 🔥 ВЕЛИКИЙ ГРАФІК АНАЛІТИКИ
let bigChartInstance = null;
function renderBigChart(transactions) {
    const ctx = document.getElementById('bigAnalyticsChart');
    if (!ctx) return;

    // Сортуємо транзакції
    const sortedTx = [...transactions].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    
    // Групуємо суми по датах
    const dailyData = {};
    sortedTx.forEach(tr => {
        // Форматуємо дату (наприклад: "01.05.2026")
        const d = new Date(tr.createdAt).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const amount = tr.amount || tr.totalAmount || 0;
        dailyData[d] = (dailyData[d] || 0) + amount;
    });

    if (bigChartInstance) bigChartInstance.destroy(); // Очищаємо попередній

    bigChartInstance = new Chart(ctx, {
        type: 'bar', // Стовпчастий графік
        data: {
            labels: Object.keys(dailyData),
            datasets: [{
                label: 'Обіг платформи (GMV)',
                data: Object.values(dailyData),
                backgroundColor: 'rgba(13, 110, 253, 0.85)', // Синій колір
                borderColor: '#0a58ca',
                borderWidth: 1,
                borderRadius: 6 // Робимо стовпчики заокругленими
            }]
        },
        options: {
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { 
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) { return context.parsed.y + ' ₴'; }
                    }
                }
            },
            scales: { 
                y: { 
                    beginAtZero: true,
                    grid: { borderDash: [5, 5] }, // Пунктирні лінії фону
                    ticks: {
                        callback: function(value) { return value + ' ₴'; }
                    }
                },
                x: {
                    grid: { display: false } // Ховаємо вертикальні лінії фону
                }
            }
        }
    });
}

let sourceChartInstance = null;
let topCoursesChartInstance = null;

// Функція, яка запускає всі графіки аналітики
function renderAllAnalytics(transactions) {
    renderBigChart(transactions);       // Твій старий графік
    renderSourceChart(transactions);    // Співвідношення Платформа/Вчитель
    renderTopCoursesChart(transactions); // Топ курсів
}

// 1. Графік: Джерела доходу (Doughnut)
function renderSourceChart(transactions) {
    const ctx = document.getElementById('sourceChart');
    if (!ctx) return;

    let systemIncome = 0;
    let teacherIncome = 0;

    transactions.forEach(tr => {
        const amount = tr.amount || tr.totalAmount || 0;
        if (tr.isSystemCourse) systemIncome += amount;
        else teacherIncome += amount;
    });

    if (sourceChartInstance) sourceChartInstance.destroy();
    sourceChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Платформа', 'Викладачі'],
            datasets: [{
                data: [systemIncome, teacherIncome],
                backgroundColor: ['#1b5e20', '#ffc107'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } },
            cutout: '70%' // Робить кільце тоншим
        }
    });
}

// 2. Графік: Топ-5 курсів (Horizontal Bar)
function renderTopCoursesChart(transactions) {
    const ctx = document.getElementById('topCoursesChart');
    if (!ctx) return;

    const courseStats = {};
    transactions.forEach(tr => {
        const title = tr.course?.title || 'Невідомий курс';
        const amount = tr.amount || tr.totalAmount || 0;
        courseStats[title] = (courseStats[title] || 0) + amount;
    });

    // Сортуємо та беремо топ-5
    const sortedCourses = Object.entries(courseStats)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    if (topCoursesChartInstance) topCoursesChartInstance.destroy();
    topCoursesChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedCourses.map(c => c[0].length > 20 ? c[0].substring(0, 20) + '...' : c[0]),
            datasets: [{
                label: 'Дохід ₴',
                data: sortedCourses.map(c => c[1]),
                backgroundColor: '#0d6efd',
                borderRadius: 5
            }]
        },
        options: {
            indexAxis: 'y', // Робить графік горизонтальним
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { beginAtZero: true } }
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const reqTab = document.getElementById('requests-tab');
    const archTab = document.getElementById('archive-tab');
    
    if(reqTab && archTab) {
        reqTab.addEventListener('click', () => {
            reqTab.style.borderBottom = '3px solid #ffc107';
            reqTab.classList.replace('text-muted', 'text-dark');
            archTab.style.borderBottom = 'none';
            archTab.classList.replace('text-dark', 'text-muted');
        });
        archTab.addEventListener('click', () => {
            archTab.style.borderBottom = '3px solid #ffc107';
            archTab.classList.replace('text-muted', 'text-dark');
            reqTab.style.borderBottom = 'none';
            reqTab.classList.replace('text-dark', 'text-muted');
        });
    }
});

async function rejectPayout(requestId, teacherName) {
    const reason = prompt(`Вкажіть причину відмови для ${teacherName} (наприклад: "Неправильний формат картки"):`);
    
    // Якщо адмін натиснув "Скасувати" у віконці
    if (reason === null) return; 

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/admin/finance/payout/${requestId}/reject`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ reason: reason || 'Відхилено адміністратором' })
        });

        const data = await res.json();
        if (res.ok) {
            alert('Виплату відхилено!');
            loadFinanceDashboard(); // Оновлюємо дашборд
        } else {
            alert(data.error);
        }
    } catch (err) {
        alert('Помилка сервера');
    }
}