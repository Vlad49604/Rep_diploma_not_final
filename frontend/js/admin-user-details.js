const API_URL = 'http://localhost:5002/api/admin/manage-users';
const token = localStorage.getItem('token');

// Дістаємо ID з URL (наприклад: admin-user-details.html?id=69f230a5...)
const urlParams = new URLSearchParams(window.location.search);
const userId = urlParams.get('id');

// --- ГЛОБАЛЬНІ ЗМІННІ (Усі вони мають бути ТУТ, поза межами функцій) ---
let banModal;
let testModal; 
let currentStudentResults = []; 

// 🔥 ДОДАЙ ОСЬ ЦІ 4 РЯДКИ:
let coursesModalObj;
let ticketsModalObj;
let currentStudentCourses = []; 
let currentStudentTickets = [];

document.addEventListener('DOMContentLoaded', () => {
    if (!userId) {
        alert('Помилка: ID користувача не передано');
        window.location.href = 'admin-users.html';
        return;
    }
    
    // Ініціалізуємо модалку при завантаженні
    const modalEl = document.getElementById('banModal');
    if (modalEl) {
        banModal = new bootstrap.Modal(modalEl);
    }
    
    loadUserDetails();
});

// ==========================================
// 1. ЗАВАНТАЖЕННЯ ДАНИХ
// ==========================================
async function loadUserDetails() {
    const content = document.getElementById('userDetailsContent');

    try {
        const res = await fetch(`${API_URL}/${userId}/details`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) throw new Error('Не вдалося завантажити дані');
        const data = await res.json();
        
        const p = data.profile;
        const regDate = new Date(p.createdAt).toLocaleDateString('uk-UA');
        
        // БАЗОВИЙ ПРОФІЛЬ
        let html = `
            <div class="card border-0 shadow-sm rounded-4 mb-4">
                <div class="card-body d-flex align-items-center gap-3 p-4">
                    <div class="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center fw-bold fs-1" style="width: 80px; height: 80px;">
                        ${p.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h3 class="mb-0 fw-bold">${p.name} <span class="badge bg-dark ms-2 align-middle" style="font-size: 0.8rem;">${p.role.toUpperCase()}</span></h3>
                        <div class="text-muted fs-5 mt-1">${p.email} | Реєстрація: ${regDate}</div>
                    </div>
                </div>
                <div class="card-footer bg-white border-top d-flex gap-5 p-3 px-4">
                    <div class="fs-6"><i class="bi bi-shield-lock-fill text-warning me-1"></i> Невдалих спроб входу: <b class="text-dark">${p.loginAttempts || 0}</b></div>
                </div>
            </div>
        `;

        // ЛОГІКА ДЛЯ СТУДЕНТА
        // ЛОГІКА ДЛЯ СТУДЕНТА
        if (p.role === 'student' && data.studentData) {
            const { transactions, results, tickets, enrolledCourses, pendingInvites, lastMessage } = data.studentData;
            currentStudentCourses = enrolledCourses;
            currentStudentTickets = tickets;
            // --- ОБЧИСЛЕННЯ АНАЛІТИКИ ---
            
            // 1. Середній бал (GPA)
            let gpa = 0;
            if (results.length > 0) {
                const totalPercent = results.reduce((acc, r) => acc + (r.score / r.total) * 100, 0);
                gpa = Math.round(totalPercent / results.length);
            }

            // 2. Останні 5 спроб
            // 2. Останні 5 спроб
            currentStudentResults = results; // 🔥 Зберігаємо результати глобально

            const recentAttempts = results.slice(0, 5).map(r => {
                const percent = Math.round((r.score / r.total) * 100);
                const badgeColor = percent >= 70 ? 'bg-success' : 'bg-danger';
                return `
                    <!-- 🔥 ДОДАНО: cursor-pointer, hover ефекти та onclick -->
                    <div class="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom rounded p-2" 
                         style="cursor: pointer; transition: background-color 0.2s;" 
                         onmouseover="this.classList.add('bg-light')" 
                         onmouseout="this.classList.remove('bg-light')"
                         onclick="openTestDetails('${r._id}')" title="Переглянути деталі">
                        <div>
                            <span class="fw-bold text-dark d-block" style="font-size: 0.9rem;">${r.course ? r.course.title : 'Курс'} (Секція ${r.sectionIdx + 1})</span>
                            <small class="text-muted">${new Date(r.completedAt).toLocaleDateString('uk-UA')}</small>
                        </div>
                        <div class="d-flex align-items-center gap-3">
                            <span class="badge ${badgeColor} rounded-pill fs-6">${percent}%</span>
                            <i class="bi bi-chevron-right text-muted"></i>
                        </div>
                    </div>`;
            }).join('') || '<p class="text-muted small">Немає пройдених тестів.</p>';

            // 3. Прогрес по курсах
            const coursesProgressHtml = enrolledCourses.map(course => {
                // Рахуємо унікальні пройдені секції (бал >= 70%)
                const passedSections = new Set(
                    results.filter(r => (r.course && r.course._id === course._id) && (r.score / r.total >= 0.7))
                           .map(r => r.sectionIdx)
                ).size;
                const totalSections = course.sections ? course.sections.length : 1;
                const progressPercent = Math.min(Math.round((passedSections / totalSections) * 100), 100);
                
                return `
                    <div class="mb-3">
                        <div class="d-flex justify-content-between mb-1">
                            <span class="fw-bold small text-dark">${course.title}</span>
                            <span class="small text-success fw-bold">${progressPercent}%</span>
                        </div>
                        <div class="progress" style="height: 8px;">
                            <div class="progress-bar bg-success" role="progressbar" style="width: ${progressPercent}%;"></div>
                        </div>
                        <small class="text-muted" style="font-size: 0.7rem;">Пройдено ${passedSections} з ${totalSections} тем</small>
                    </div>`;
            }).join('') || '<p class="text-muted small">Немає активних курсів.</p>';

            // 4. Фінанси
            const txsHtml = transactions.map(t => `
                <div class="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                    <div><b class="text-dark small">${t.course ? t.course.title : 'Курс'}</b><br><small class="text-muted" style="font-size: 0.7rem;">${new Date(t.createdAt).toLocaleDateString()}</small></div>
                    <span class="badge bg-success bg-opacity-10 text-success border border-success px-2 py-1">${t.totalAmount} ₴</span>
                </div>
            `).join('') || '<p class="text-muted small">Немає фінансових операцій.</p>';

            // 5. CRM Статистика
            const openTickets = tickets.filter(t => t.status === 'new' || t.status === 'open').length;
            const lastMsgDate = lastMessage ? new Date(lastMessage.createdAt).toLocaleString('uk-UA') : 'Немає переписок';

            // --- РЕНДЕР HTML БЛОКІВ ---
            html += `
                <!-- РЯД 1: ТОП СТАТИСТИКА -->
                <div class="row g-3 mb-4 text-center">
                    <div class="col-md-3">
                        <div class="p-3 bg-white border-0 shadow-sm rounded-4">
                            <h3 class="fw-bold text-primary mb-0">${gpa}%</h3>
                            <span class="text-muted small">Середній бал (GPA)</span>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="p-3 bg-white border-0 shadow-sm rounded-4">
                            <h3 class="fw-bold text-success mb-0">${results.length}</h3>
                            <span class="text-muted small">Пройдено тестів</span>
                        </div>
                    </div>
                    <div class="col-md-3" style="cursor: pointer;" onclick="openStudentCoursesModal()" title="Переглянути список">
                        <div class="p-3 bg-white border-0 shadow-sm rounded-4" style="transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                            <h3 class="fw-bold text-warning mb-0">${enrolledCourses.length}</h3>
                            <span class="text-muted small">Активних курсів <i class="bi bi-box-arrow-up-right ms-1 text-warning"></i></span>
                        </div>
                    </div>
                    <div class="col-md-3" style="cursor: pointer;" onclick="openStudentTicketsModal()" title="Відкрити Helpdesk">
                        <div class="p-3 bg-white border-0 shadow-sm rounded-4" style="transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                            <h3 class="fw-bold text-danger mb-0">${openTickets}</h3>
                            <span class="text-muted small">Відкритих тікетів <i class="bi bi-box-arrow-up-right ms-1 text-danger"></i></span>
                        </div>
                    </div>
                </div>

                <!-- РЯД 2: МАТРИЦЯ НАВИЧОК ТА ПРОГРЕС КУРСІВ -->
                <div class="row g-4 mb-4">
                    <div class="col-lg-6">
                        <div class="card border-0 shadow-sm rounded-4 p-4 h-100">
                            <h6 class="fw-bold mb-3"><i class="bi bi-radar text-primary me-2"></i> Матриця навичок (Skill Matrix)</h6>
                            <div style="position: relative; height: 250px; width: 100%;">
                                <canvas id="skillRadarChart"></canvas>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-6">
                        <div class="card border-0 shadow-sm rounded-4 p-4 h-100">
                            <h6 class="fw-bold mb-3"><i class="bi bi-book-half text-success me-2"></i> Прогрес навчання</h6>
                            <div style="max-height: 250px; overflow-y: auto; padding-right: 5px;">
                                ${coursesProgressHtml}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- РЯД 3: CRM АКТИВНІСТЬ ТА ОСТАННІ СПРОБИ -->
                <div class="row g-4 mb-4">
                    <div class="col-lg-6">
                        <div class="card border-0 shadow-sm rounded-4 p-4 h-100 bg-light border border-success border-opacity-10">
                            <h6 class="fw-bold mb-4"><i class="bi bi-headset text-success me-2"></i> CRM та Комунікація</h6>
                            <ul class="list-group list-group-flush bg-transparent">
                                <li class="list-group-item bg-transparent px-0 d-flex justify-content-between">
                                    <span class="text-muted small">Всього звернень у Helpdesk:</span>
                                    <span class="fw-bold">${tickets.length}</span>
                                </li>
                                <li class="list-group-item bg-transparent px-0 d-flex justify-content-between">
                                    <span class="text-muted small">Останній контакт з викладачем:</span>
                                    <span class="fw-bold small">${lastMsgDate}</span>
                                </li>
                                <li class="list-group-item bg-transparent px-0 d-flex justify-content-between">
                                    <span class="text-muted small">Очікують підтвердження інвайти:</span>
                                    <span class="fw-bold text-warning">${pendingInvites.length}</span>
                                </li>
                                <li class="list-group-item bg-transparent px-0 d-flex justify-content-between">
                                    <span class="text-muted small">Логінів з помилками (Спроби злому):</span>
                                    <span class="fw-bold text-danger">${p.loginAttempts || 0}</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                    <div class="col-lg-6">
                        <div class="card border-0 shadow-sm rounded-4 p-4 h-100">
                            <h6 class="fw-bold mb-3"><i class="bi bi-clock-history text-primary me-2"></i> Останні тести</h6>
                            <div style="max-height: 200px; overflow-y: auto;">
                                ${recentAttempts}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- РЯД 4: ФІНАНСИ -->
                <div class="card border-0 shadow-sm rounded-4 p-4 mb-4">
                    <h6 class="fw-bold mb-3"><i class="bi bi-wallet2 text-success me-2"></i> Фінансова історія</h6>
                    <div style="max-height: 200px; overflow-y: auto;">
                        ${txsHtml}
                    </div>
                </div>
            `;
            
            // ВАЖЛИВО: Викликаємо рендер графіку ПІСЛЯ того, як HTML вставлено в DOM
            setTimeout(() => renderSkillMatrix(results), 100);
        }
        
        // ЛОГІКА ДЛЯ ВИКЛАДАЧА
        else if (p.role === 'teacher' && data.teacherData) {
            const courses = data.teacherData.courses;
            const payouts = data.teacherData.payouts;

            // --- ОБЧИСЛЕННЯ АНАЛІТИКИ ВИКЛАДАЧА ---
            const publicCourses = courses.filter(c => c.isPublic).length;
            const privateCourses = courses.length - publicCourses;
            
            // Рахуємо суму успішних виплат
            const totalPayoutSum = payouts
                .filter(p => p.status === 'completed')
                .reduce((sum, p) => sum + p.amount, 0);

            // Формуємо список останніх виплат
            const payoutsHtml = payouts.slice(0, 5).map(p => {
                let badge = p.status === 'completed' ? 'bg-success' : (p.status === 'pending' ? 'bg-warning text-dark' : 'bg-danger');
                let statusText = p.status === 'completed' ? 'Виплачено' : (p.status === 'pending' ? 'В обробці' : 'Відхилено');
                return `
                    <div class="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                        <div>
                            <b class="text-dark fs-6">${p.amount} ₴</b><br>
                            <small class="text-muted" style="font-size: 0.75rem;">${new Date(p.createdAt).toLocaleDateString('uk-UA')}</small>
                        </div>
                        <span class="badge ${badge} rounded-pill px-3 py-2">${statusText}</span>
                    </div>`;
            }).join('') || '<p class="text-muted small">Немає запитів на виплату.</p>';

            // Формуємо панель управління курсами
            const coursesHtml = courses.map(c => `
                <div class="list-group-item d-flex justify-content-between align-items-center px-0 py-3 bg-transparent border-bottom">
                    <div>
                        <span class="fw-bold text-dark fs-6 d-block">${c.title}</span>
                        <small class="text-muted">Ціна: <b class="text-success">${c.price > 0 ? c.price + ' ₴' : 'Безкоштовно'}</b></small>
                    </div>
                    <button id="course-btn-${c._id}" 
                            onclick="toggleCoursePublish('${c._id}')" 
                            class="btn btn-sm ${c.isPublic ? 'btn-success' : 'btn-outline-secondary'} rounded-pill px-4 shadow-sm fw-bold">
                        ${c.isPublic ? '<i class="bi bi-eye-fill me-1"></i> Публічний' : '<i class="bi bi-eye-slash me-1"></i> Приватний'}
                    </button>
                </div>
            `).join('') || '<p class="text-muted small">Викладач ще не створив жодного курсу.</p>';

            // --- РЕНДЕР HTML БЛОКІВ ВИКЛАДАЧА ---
            html += `
                <!-- РЯД 1: ТОП СТАТИСТИКА ВИКЛАДАЧА -->
                <div class="row g-3 mb-4 text-center">
                    <div class="col-md-3">
                        <div class="p-3 bg-white border-0 shadow-sm rounded-4">
                            <h3 class="fw-bold text-primary mb-0">${courses.length}</h3>
                            <span class="text-muted small">Всього курсів</span>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="p-3 bg-white border-0 shadow-sm rounded-4">
                            <h3 class="fw-bold text-success mb-0">${publicCourses}</h3>
                            <span class="text-muted small">Опубліковано</span>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="p-3 bg-white border-0 shadow-sm rounded-4">
                            <h3 class="fw-bold text-warning mb-0">${payouts.length}</h3>
                            <span class="text-muted small">Запитів на виплату</span>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="p-3 bg-white border-0 shadow-sm rounded-4">
                            <h3 class="fw-bold text-success mb-0">${totalPayoutSum} ₴</h3>
                            <span class="text-muted small">Успішно виплачено</span>
                        </div>
                    </div>
                </div>

                <!-- РЯД 2: ГРАФІК КОНТЕНТУ ТА ІСТОРІЯ ВИПЛАТ -->
                <div class="row g-4 mb-4">
                    <div class="col-lg-6">
                        <div class="card border-0 shadow-sm rounded-4 p-4 h-100">
                            <h6 class="fw-bold mb-3"><i class="bi bi-pie-chart-fill text-primary me-2"></i> Статус портфеля курсів</h6>
                            <div style="position: relative; height: 230px; width: 100%; display: flex; justify-content: center;">
                                <canvas id="teacherPortfolioChart"></canvas>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-6">
                        <div class="card border-0 shadow-sm rounded-4 p-4 h-100 bg-light border border-success border-opacity-10">
                            <h6 class="fw-bold mb-3"><i class="bi bi-cash-coin text-success me-2"></i> Останні виплати</h6>
                            <div style="max-height: 230px; overflow-y: auto; padding-right: 5px;">
                                ${payoutsHtml}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- РЯД 3: ПАНЕЛЬ МОДЕРАЦІЇ КОНТЕНТУ -->
                <div class="card border-0 shadow-sm rounded-4 p-4 mb-4 border-top border-primary border-4">
                    <h6 class="fw-bold mb-2"><i class="bi bi-folder-check text-primary me-2"></i> Управління публікаціями (Модерація)</h6>
                    <p class="text-muted small mb-4">Тут ви можете знімати курси з публікації, якщо вони містять помилки або порушують правила.</p>
                    <div class="list-group list-group-flush">
                        ${coursesHtml}
                    </div>
                </div>
            `;

            // Викликаємо рендер графіку ПІСЛЯ вставки HTML
            setTimeout(() => renderTeacherChart(publicCourses, privateCourses), 100);
        }

        // ДОДАЄМО DANGER ZONE (БАН ТА СКИДАННЯ ПАРОЛЯ) ВНИЗУ СТОРІНКИ
        html += renderDangerZone(p);

        content.innerHTML = html;

    } catch (err) {
        content.innerHTML = `<div class="alert alert-danger shadow-sm rounded-4">Помилка завантаження даних. Сервер не відповідає.</div>`;
    }
}

// Генерація блоку Danger Zone
// Генерація блоку Danger Zone + RBAC
function renderDangerZone(p) {
    const nextRole = p.role === 'student' ? 'teacher' : (p.role === 'teacher' ? 'admin' : 'student');
    
    // 🔥 Виводимо кнопку подарунка ТІЛЬКИ якщо користувач — студент
    const grantCourseButton = p.role === 'student' 
        ? `<button onclick="openGrantCourseModal()" class="btn btn-success rounded-pill px-4 fw-bold shadow-sm">
            <i class="bi bi-gift-fill me-2"></i> Подарувати доступ до курсу
           </button>` 
        : '';

    return `
    <div class="card p-4 mt-4 shadow-sm border-0 bg-white" style="border-top: 4px solid #6f42c1 !important;">
        <h5 class="fw-bold mb-4" style="color: #6f42c1;"><i class="bi bi-person-gear me-2"></i> Управління правами (RBAC)</h5>
        <div class="d-flex flex-wrap gap-3 mb-4 pb-4 border-bottom">
            <button onclick="changeUserRole('${p._id}', '${nextRole}')" class="btn btn-outline-dark rounded-pill px-4 fw-bold shadow-sm">
                <i class="bi bi-arrow-repeat me-2"></i> Зробити як ${nextRole.toUpperCase()}
            </button>
            ${grantCourseButton} <!-- 🔥 Кнопка з'явиться лише для студентів -->
        </div>

        <h5 class="text-danger fw-bold mb-4"><i class="bi bi-shield-exclamation me-2"></i> Панель модерації (Danger Zone)</h5>
        <div class="d-flex flex-wrap gap-3">
            ${p.isBanned 
                ? `<button onclick="unbanUser('${p._id}')" class="btn btn-success rounded-pill px-4 fw-bold shadow-sm">
                    <i class="bi bi-unlock-fill me-2"></i> Розблокувати
                   </button>`
                : `<button onclick="openBanModal()" class="btn btn-danger rounded-pill px-4 fw-bold shadow-sm">
                    <i class="bi bi-slash-circle me-2"></i> Заблокувати
                   </button>`
            }
            <button onclick="resetPassword('${p._id}')" class="btn btn-outline-warning text-dark rounded-pill px-4 fw-bold shadow-sm" style="border-width: 2px;">
                <i class="bi bi-key-fill me-2"></i> Скинути пароль
            </button>
        </div>
    </div>`;
}

// ==========================================
// 2. ФУНКЦІЇ БЕЗПЕКИ ТА МОДЕРАЦІЇ
// ==========================================

// Відкриття модалки бану
// Відкриття модалки бану
function openBanModal() {
    if (!banModal) {
        banModal = new bootstrap.Modal(document.getElementById('banModal'));
    }
    
    // Рядок document.getElementById('banUserId').value = userId; — ВИДАЛЕНО!
    
    document.getElementById('banReason').value = ''; // Очищаємо поле причини
    banModal.show(); // Показуємо модалку
}

// Виконання бану
async function executeBan() {
    const durationDays = document.getElementById('banDuration').value;
    const reason = document.getElementById('banReason').value;
    
    // Знаходимо кнопку і робимо лоадер, щоб було видно, що процес пішов
    const btn = document.querySelector('#banModal .btn-danger');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Зачекайте...';
    btn.disabled = true;

    try {
        const res = await fetch(`${API_URL}/${userId}/ban`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`, 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ durationDays, reason })
        });
        
        const data = await res.json();
        
        btn.innerHTML = originalText;
        btn.disabled = false;

        if (res.ok) {
            alert(data.message);
            banModal.hide();
            loadUserDetails(); // Перемальовуємо сторінку
        } else {
            alert(data.message || data.error || 'Виникла помилка на сервері');
        }
    } catch (err) {
        console.error(err);
        btn.innerHTML = originalText;
        btn.disabled = false;
        alert("Помилка з'єднання з сервером.");
    }
}

// Розблокування
async function unbanUser(id) {
    if(!confirm('Розблокувати користувача?')) return;
    
    try {
        const res = await fetch(`${API_URL}/${id}/unban`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if(res.ok) {
            alert(data.message);
            loadUserDetails();
        } else {
            alert(data.message || 'Помилка');
        }
    } catch (err) {
        alert("Помилка з'єднання з сервером");
    }
}

// Скидання пароля
async function resetPassword(id) {
    if(!confirm('Пароль буде змінено на Lexora2026. Продовжити?')) return;
    
    try {
        const res = await fetch(`${API_URL}/${id}/reset-password`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if(res.ok) {
            alert(data.message);
        } else {
            alert(data.message || 'Помилка');
        }
    } catch (err) {
        alert("Помилка з'єднання з сервером");
    }
}

// Зміна статусу публікації курсу (для викладачів)
async function toggleCoursePublish(courseId) {
    if(!confirm('Змінити статус видимості цього курсу для студентів?')) return;
    try {
        const res = await fetch(`http://localhost:5002/api/admin/manage-courses/${courseId}/toggle-publish`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) {
            const btn = document.getElementById(`course-btn-${courseId}`);
            if (data.isPublic) {
                btn.className = 'btn btn-success rounded-pill px-4 shadow-sm fw-bold';
                btn.innerHTML = '<i class="bi bi-eye-fill me-1"></i> Публічний';
            } else {
                btn.className = 'btn btn-outline-secondary rounded-pill px-4 shadow-sm fw-bold';
                btn.innerHTML = '<i class="bi bi-eye-slash me-1"></i> Приватний';
            }
        } else {
            alert(data.message || 'Помилка');
        }
    } catch (err) {
        alert("Помилка з'єднання з сервером");
    }
}

// --- ГЕНЕРАЦІЯ РАДАРНОЇ ДІАГРАМИ ---
function renderSkillMatrix(results) {
    const ctx = document.getElementById('skillRadarChart');
    if (!ctx) return;

    // Збираємо статистику по типах завдань
    const skills = { grammar: {c:0, t:0}, vocabulary: {c:0, t:0}, reading: {c:0, t:0}, writing: {c:0, t:0} };

    results.forEach(r => {
        if(r.answers && Array.isArray(r.answers)) {
            r.answers.forEach(a => {
                if (a.taskType === 'gap') { skills.grammar.t++; if(a.isCorrect) skills.grammar.c++; }
                else if (a.taskType === 'matching') { skills.vocabulary.t++; if(a.isCorrect) skills.vocabulary.c++; }
                else if (a.taskType === 'multiple') { skills.reading.t++; if(a.isCorrect) skills.reading.c++; }
                else if (a.taskType === 'essay') { skills.writing.t++; if(a.isCorrect) skills.writing.c++; }
            });
        }
    });

    const getPct = (skill) => skill.t > 0 ? Math.round((skill.c / skill.t) * 100) : 0;
    const scores = [getPct(skills.grammar), getPct(skills.vocabulary), getPct(skills.reading), getPct(skills.writing)];

    new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Граматика (Grammar)', 'Словник (Vocabulary)', 'Читання/Логіка', 'Письмо (Writing)'],
            datasets: [{
                label: 'Засвоєно (%)',
                data: scores,
                backgroundColor: 'rgba(25, 135, 84, 0.2)', // Зелений Lexora
                borderColor: '#198754',
                pointBackgroundColor: '#198754',
                pointBorderColor: '#fff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    angleLines: { color: 'rgba(0,0,0,0.1)' },
                    grid: { color: 'rgba(0,0,0,0.1)' },
                    pointLabels: { font: { size: 11, weight: 'bold' }, color: '#333' },
                    ticks: { min: 0, max: 100, stepSize: 25, display: false }
                }
            },
            plugins: { legend: { display: false } }
        }
    });
}

// --- ГЕНЕРАЦІЯ КІЛЬЦЕВОЇ ДІАГРАМИ ДЛЯ ВИКЛАДАЧА ---
function renderTeacherChart(publicCount, privateCount) {
    const ctx = document.getElementById('teacherPortfolioChart');
    if (!ctx) return;

    if (publicCount === 0 && privateCount === 0) {
        ctx.parentElement.innerHTML = '<div class="d-flex align-items-center justify-content-center h-100 w-100"><p class="text-muted">Немає створених курсів</p></div>';
        return;
    }

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Опубліковано (Доступні)', 'Чернетки (Приховані)'],
            datasets: [{
                data: [publicCount, privateCount],
                backgroundColor: ['#198754', '#adb5bd'], // Зелений для активних, сірий для прихованих
                borderWidth: 0,
                hoverOffset: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%', // Робить дірку всередині більшою (сучасний вигляд)
            plugins: {
                legend: { 
                    position: 'bottom', 
                    labels: { usePointStyle: true, padding: 20, font: { family: "'Plus Jakarta Sans', sans-serif" } } 
                }
            }
        }
    });
}

// --- ВІДКРИТТЯ ДЕТАЛЕЙ ТЕСТУ ---
function openTestDetails(resultId) {
    if (!testModal) {
        testModal = new bootstrap.Modal(document.getElementById('testDetailsModal'));
    }

    // Знаходимо конкретний результат з нашого глобального сховища
    const r = currentStudentResults.find(x => x._id === resultId);
    if (!r) return;

    // Встановлюємо заголовок (Назва курсу + Секція)
    document.getElementById('testModalCourseTitle').textContent = `${r.course ? r.course.title : 'Курс'} (Секція ${r.sectionIdx + 1})`;

    // Малюємо загальний бал
    const percent = Math.round((r.score / r.total) * 100);
    const isPassed = percent >= 70;
    
    let bodyHtml = `
        <div class="card border-0 shadow-sm rounded-4 mb-4 ${isPassed ? 'border-success border-bottom border-4' : 'border-danger border-bottom border-4'}">
            <div class="card-body d-flex justify-content-between align-items-center p-3">
                <span class="fw-bold text-muted text-uppercase small">Загальний бал:</span>
                <h3 class="mb-0 fw-bold ${isPassed ? 'text-success' : 'text-danger'}">${r.score} / ${r.total} <span class="fs-6 text-muted">(${percent}%)</span></h3>
            </div>
        </div>
    `;

    // Малюємо список відповідей
    if (r.answers && r.answers.length > 0) {
        bodyHtml += `<div class="list-group shadow-sm border-0 rounded-4">`;
        
        r.answers.forEach((ans, idx) => {
            const isCorrect = ans.isCorrect;
            const icon = isCorrect ? '<i class="bi bi-check-circle-fill text-success fs-4"></i>' : '<i class="bi bi-x-circle-fill text-danger fs-4"></i>';
            const bgClass = isCorrect ? 'bg-success bg-opacity-10 border-success border-opacity-25' : 'bg-danger bg-opacity-10 border-danger border-opacity-25';
            
            // Якщо відповідь - це масив (наприклад, з multiple choice або matching), з'єднуємо через кому
            let userAnswerText = Array.isArray(ans.userAnswer) ? ans.userAnswer.join(', ') : (ans.userAnswer || '<i class="text-muted">Немає відповіді</i>');

            bodyHtml += `
                <div class="list-group-item d-flex align-items-start gap-3 p-3 mb-1 border-bottom-0 ${bgClass}">
                    <div class="mt-1">${icon}</div>
                    <div class="w-100">
                        <div class="d-flex justify-content-between align-items-center mb-1">
                            <span class="badge bg-white text-dark border shadow-sm" style="font-size: 0.7rem;">Питання ${idx + 1} (${ans.taskType.toUpperCase()})</span>
                            ${isCorrect ? '<span class="text-success small fw-bold"></span>' : '<span class="text-danger small fw-bold"></span>'}
                        </div>
                        <div class="text-dark mt-2" style="font-size: 0.95rem;"><b>Відповідь студента:</b> ${userAnswerText}</div>
                    </div>
                </div>`;
        });
        bodyHtml += `</div>`;
    } else {
        bodyHtml += `<div class="alert alert-light text-center border">Деталі відповідей не збережено.</div>`;
    }

    document.getElementById('testModalBody').innerHTML = bodyHtml;
    testModal.show();
}

// --- ВІДКРИТТЯ МОДАЛКИ КУРСІВ ---
function openStudentCoursesModal() {
    if (!coursesModalObj) coursesModalObj = new bootstrap.Modal(document.getElementById('studentCoursesModal'));
    const container = document.getElementById('studentCoursesList');
    
    if (currentStudentCourses.length === 0) {
        container.innerHTML = '<div class="p-4 text-center text-muted">Студент ще не записався на жоден курс</div>';
    } else {
        container.innerHTML = currentStudentCourses.map(c => `
            <div class="list-group-item d-flex justify-content-between align-items-center p-3 bg-white mb-1 border-0 shadow-sm">
                <div>
                    <div class="fw-bold text-dark fs-6">${c.title}</div>
                    <div class="small text-muted">Укладач: <b class="text-primary">${c.author ? c.author.name : 'Системний курс'}</b></div>
                </div>
                <button onclick="window.open('admin-course-view.html?id=${c._id}', '_blank')" class="btn btn-sm btn-warning text-dark fw-bold rounded-pill px-3 shadow-sm">
                    <i class="bi bi-eye-fill"></i> Огляд
                </button>
            </div>
        `).join('');
    }
    coursesModalObj.show();
}

// --- ВІДКРИТТЯ МОДАЛКИ ТІКЕТІВ ---
function openStudentTicketsModal() {
    if (!ticketsModalObj) ticketsModalObj = new bootstrap.Modal(document.getElementById('studentTicketsModal'));
    const container = document.getElementById('studentTicketsList');
    
    // Відфільтровуємо тільки відкриті тікети
    const openTickets = currentStudentTickets.filter(t => t.status === 'new' || t.status === 'open');
    
    if (openTickets.length === 0) {
        container.innerHTML = '<div class="p-4 text-center text-muted">У студента немає активних запитів у підтримку</div>';
    } else {
        container.innerHTML = openTickets.map(t => {
            const statusBadge = t.status === 'new' 
                ? '<span class="badge bg-primary rounded-pill">Новий</span>' 
                : '<span class="badge bg-success rounded-pill">В роботі</span>';
                
            return `
            <div class="list-group-item p-3 bg-white mb-1 border-0 shadow-sm">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <div class="fw-bold text-dark text-truncate pe-3" style="max-width: 70%;">${t.subject}</div>
                    ${statusBadge}
                </div>
                <div class="d-flex justify-content-between align-items-center">
                    <small class="text-muted"><i class="bi bi-tag-fill me-1"></i> ${t.category}</small>
                    <button onclick="window.open('admin-tickets.html?ticketId=${t._id}', '_blank')" class="btn btn-sm btn-outline-danger fw-bold rounded-pill px-3 shadow-sm">
                        Відповісти <i class="bi bi-arrow-right"></i>
                    </button>
                </div>
            </div>
        `}).join('');
    }
    ticketsModalObj.show();
}

// --- ЗМІНА РОЛІ (RBAC) ---
async function changeUserRole(id, newRole) {
    if(!confirm(`Ви впевнені, що хочете змінити роль користувача на ${newRole.toUpperCase()}?`)) return;
    
    try {
        const res = await fetch(`${API_URL}/${id}/change-role`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ newRole })
        });
        const data = await res.json();
        if(res.ok) {
            alert(data.message);
            loadUserDetails(); // Перемальовуємо сторінку, щоб побачити новий статус
        } else {
            alert(data.message || 'Помилка');
        }
    } catch (err) {
        alert("Помилка з'єднання з сервером");
    }
}

// --- ВИДАЧА ДОСТУПУ ДО КУРСУ ---
let grantCourseModalObj;

async function openGrantCourseModal() {
    if (!grantCourseModalObj) grantCourseModalObj = new bootstrap.Modal(document.getElementById('grantCourseModal'));
    
    const selectBox = document.getElementById('courseSelectForGrant');
    selectBox.innerHTML = '<option value="">Завантаження...</option>';
    grantCourseModalObj.show();

    try {
        // Отримуємо всі курси для випадаючого списку
        // ПРИМІТКА: Переконайся, що цей роут (/api/courses/all) існує у тебе на бекенді і віддає публічні курси
        const res = await fetch(`http://localhost:5002/api/courses/all`); 
        const courses = await res.json();
        
        selectBox.innerHTML = '<option value="" disabled selected>-- Оберіть курс зі списку --</option>' + 
            courses.map(c => `<option value="${c._id || c._id.$oid}">${c.title}</option>`).join('');
    } catch (err) {
        selectBox.innerHTML = '<option value="">Помилка завантаження курсів</option>';
    }
}

async function executeGrantCourse() {
    const courseId = document.getElementById('courseSelectForGrant').value;
    if (!courseId) return alert("Будь ласка, оберіть курс");

    const btn = document.querySelector('#grantCourseModal .btn-success');
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Зачекайте...';
    btn.disabled = true;

    try {
        const res = await fetch(`${API_URL}/${userId}/grant-course`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ courseId })
        });
        
        const data = await res.json();
        
        if (res.ok) {
            alert("✅ " + data.message);
            grantCourseModalObj.hide();
            loadUserDetails(); // Оновлюємо дані, щоб курс з'явився у списку студента
        } else {
            alert("❌ " + (data.message || 'Помилка'));
        }
    } catch (err) {
        alert("Помилка з'єднання з сервером");
    } finally {
        btn.innerHTML = 'Відкрити доступ';
        btn.disabled = false;
    }
}