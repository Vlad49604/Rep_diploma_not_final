const API_BASE = 'http://localhost:5002/api/auth'; // Переконайся, що шлях відповідає твоєму бекенду
const token = localStorage.getItem('token');

document.addEventListener('DOMContentLoaded', () => {
    if (!token) {
        window.location.href = '../index.html';
        return;
    }
    loadProfileData();
    
    document.getElementById('changePasswordForm').addEventListener('submit', handleChangePassword);
});

// Завантаження реальних даних з бази
// Завантаження реальних даних з бази
async function loadProfileData() {
    try {
        const res = await fetch(`${API_BASE}/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) throw new Error('Не вдалося завантажити профіль');
        
        const user = await res.json();
        
        // Підставляємо дані в HTML
        document.getElementById('profileName').textContent = user.name;
        document.getElementById('profileEmail').textContent = user.email;
        
        // Оновлюємо ім'я у верхньому меню (навбарі)
        const navName = document.getElementById('navAdminName');
        if (navName) navName.textContent = user.name;
        
        // Перша літера для аватара
        document.getElementById('profileAvatar').textContent = user.name.charAt(0).toUpperCase();
        
        // Форматуємо дату
        const regDate = new Date(user.createdAt).toLocaleDateString('uk-UA', { 
            year: 'numeric', month: 'long', day: 'numeric' 
        });
        document.getElementById('profileDate').textContent = regDate;

    } catch (err) {
        console.error("Помилка JS або Мережі:", err);
        showAlert('Помилка відображення даних', 'danger');
    }
}

// Обробка зміни пароля
async function handleChangePassword(e) {
    e.preventDefault();
    
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const btn = document.getElementById('submitBtn');

    // Базова валідація на фронтенді
    if (newPassword !== confirmPassword) {
        return showAlert('Нові паролі не співпадають!', 'danger');
    }

    // Блокуємо кнопку під час запиту
    const originalBtnText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Обробка...';
    btn.disabled = true;

    try {
        // Змінено на change-password та метод POST, як у студента
        const res = await fetch(`${API_BASE}/change-password`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ currentPassword, newPassword })
        });
        
        const data = await res.json();
        
        if (res.ok) {
            showAlert('Пароль успішно змінено!', 'success');
            document.getElementById('changePasswordForm').reset();
        } else {
            // Змінено на data.message, бо твій бекенд віддає помилку саме так
            showAlert(data.message || 'Сталася помилка', 'danger');
        }
    } catch (err) {
        showAlert('Помилка з\'єднання з сервером', 'danger');
    } finally {
        btn.innerHTML = originalBtnText;
        btn.disabled = false;
    }
}

// Допоміжна функція для показів сповіщень
function showAlert(message, type) {
    const alertBox = document.getElementById('passwordAlert');
    alertBox.className = `alert alert-${type} rounded-3`;
    alertBox.innerHTML = `<i class="bi ${type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'} me-2"></i> ${message}`;
    alertBox.classList.remove('d-none');
    
    // Ховаємо через 5 секунд
    setTimeout(() => alertBox.classList.add('d-none'), 5000);
}

// Функція виходу
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    window.location.href = '../index.html'; // Шлях до сторінки логіну
}

let healthModalObj;

async function openSystemHealth() {
    if (!healthModalObj) healthModalObj = new bootstrap.Modal(document.getElementById('systemHealthModal'));
    healthModalObj.show();

    const token = localStorage.getItem('token'); 

    try {
        const res = await fetch('http://localhost:5002/api/admin/system-health', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) throw new Error(`Сервер повернув статус ${res.status}`);
        const data = await res.json();

        // 1. РЕНДЕР КАРТОК СТАТУСУ (СВІТЛІ)
        document.getElementById('healthMetricsContainer').innerHTML = `
            <div class="col-6 col-md-3">
                <div class="bg-white p-3 rounded-4 text-center h-100 shadow-sm border-0">
                    <div class="mb-1 text-muted small fw-bold" style="letter-spacing: 0.5px;">MONGODB</div>
                    <div class="fw-bold fs-6 ${data.health.database === 'OK' ? 'text-success' : 'text-danger'}">
                        <i class="bi ${data.health.database === 'OK' ? 'bi-check-circle-fill' : 'bi-x-circle-fill'} me-1"></i>${data.health.database === 'OK' ? 'ONLINE' : 'OFFLINE'}
                    </div>
                </div>
            </div>
            <div class="col-6 col-md-3">
                <div class="bg-white p-3 rounded-4 text-center h-100 shadow-sm border-0">
                    <div class="mb-1 text-muted small fw-bold" style="letter-spacing: 0.5px;">CLOUDINARY</div>
                    <div class="fw-bold ${data.health.cloudinary === 'OK' ? 'text-success' : 'text-warning'} fs-6">
                        ${data.health.cloudinary}
                    </div>
                </div>
            </div>
            <div class="col-6 col-md-3">
                <div class="bg-white p-3 rounded-4 text-center h-100 shadow-sm border-0">
                    <div class="mb-1 text-muted small fw-bold" style="letter-spacing: 0.5px;">MEMORY (RAM)</div>
                    <div class="fw-bold fs-6 text-primary">${data.health.memoryMB} MB</div>
                </div>
            </div>
            <div class="col-6 col-md-3">
                <div class="bg-white p-3 rounded-4 text-center h-100 shadow-sm border-0">
                    <div class="mb-1 text-muted small fw-bold" style="letter-spacing: 0.5px;">SERVER UPTIME</div>
                    <div class="fw-bold fs-6 text-primary">${data.health.uptimeHours} h</div>
                </div>
            </div>
        `;

        // 2. РЕНДЕР ЛОГІВ АУДИТУ (БІЛІ КАРТКИ З БОКОВИМИ СМУЖКАМИ)
        const logsHtml = data.logs.length === 0 
            ? '<div class="text-muted small">Логи порожні.</div>' 
            : data.logs.map(log => {
                const date = new Date(log.createdAt).toLocaleString('uk-UA', { hour: '2-digit', minute:'2-digit', day:'2-digit', month:'2-digit' });
                
                let actionColor = 'primary'; 
                if (log.action.includes('BAN') || log.action.includes('DELETE')) actionColor = 'danger';
                if (log.action.includes('CHANGE_ROLE') || log.action.includes('GRANT') || log.action.includes('PUBLISH')) actionColor = 'success';

                return `
                <div class="bg-white p-3 rounded-3 shadow-sm border-0 mb-2 d-flex flex-column flex-md-row align-items-md-center gap-3 border-start border-${actionColor} border-4">
                    <div class="text-muted small" style="min-width: 100px;"><i class="bi bi-clock me-1"></i> ${date}</div>
                    <div class="badge bg-${actionColor} bg-opacity-10 text-${actionColor} border border-${actionColor} border-opacity-25" style="min-width: 120px;">${log.action}</div>
                    <div class="text-dark small">
                        <span class="fw-bold text-muted">(${log.admin ? log.admin.name : 'System'}):</span> 
                        ${log.description}
                    </div>
                </div>`;
            }).join('');

        document.getElementById('auditLogsContainer').innerHTML = logsHtml;
        
    } catch (err) {
        document.getElementById('healthMetricsContainer').innerHTML = `<div class="text-danger w-100 text-center py-3">Помилка: ${err.message}</div>`;
        document.getElementById('auditLogsContainer').innerHTML = '';
    }
}