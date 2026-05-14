const API_BASE_URL = 'http://localhost:5002/api';

function getCleanId(idObj) {
    if (!idObj) return null;
    if (typeof idObj === 'string') return idObj;
    if (idObj.$oid) return idObj.$oid;
    if (idObj._id) return getCleanId(idObj._id);
    return idObj.toString();
}

function getAuthToken() {
    let token = localStorage.getItem('token');
    if (!token || token === "null") {
        const userData = localStorage.getItem('user');
        if (userData) {
            try {
                const parsed = JSON.parse(userData);
                token = parsed.token;
            } catch (e) { console.error("Помилка парсингу", e); }
        }
    }
    return token;
}

window.enrollInCourse = async function(courseId) {
    const token = getAuthToken();
    if (!token) { alert("Будь ласка, увійдіть знову."); return; }

    try {
        const res = await fetch(`${API_BASE_URL}/courses/enroll`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ courseId })
        });
        if (res.ok) {
            localStorage.removeItem('user_courses_data'); 
            location.reload();
        } else {
            const data = await res.json();
            alert('Помилка: ' + data.message);
        }
    } catch (err) { alert("Сервер не відповідає"); }
};

document.addEventListener('DOMContentLoaded', async () => {
    const token = getAuthToken();
    
    // 1. Перевірка наявності токена
    if (!token || token === "null") {
        window.location.href = '../index.html';
        return;
    }

    // --- НОВИЙ БЛОК: Швидке оновлення шапки з кешу (щоб не було порожньо) ---
    const cachedUser = JSON.parse(localStorage.getItem('user'));
    if (cachedUser) {
        updateNavbarUI(cachedUser);
    }
    // -------------------------------------------------------------------------

    // Допоміжна функція для отримання ID
    const getSafeId = (u) => {
        if (!u) return null;
        return u._id || u.id || (u.user ? (u.user._id || u.user.id) : null);
    };

    try {
        // 2. ПРІОРИТЕТНИЙ ЗАПИТ: Отримуємо свіжі дані користувача
        const userRes = await fetch(`${API_BASE_URL}/auth/me`, { 
            headers: { 'Authorization': `Bearer ${token}` } 
        });

        if (!userRes.ok) {
            console.error("Сесія застаріла");
            window.location.href = '../index.html';
            return;
        }

        const freshUser = await userRes.json();
        localStorage.setItem('user', JSON.stringify(freshUser));
        
        // --- НОВИЙ БЛОК: Оновлюємо шапку вже свіжими даними ---
        updateNavbarUI(freshUser);
        // ------------------------------------------------------
        
        const userId = getSafeId(freshUser);
        const enrolledIds = (freshUser.enrolledCourses || []).map(id => getCleanId(id));
        const completedIds = (freshUser.completedCourses || []).map(id => getCleanId(id));


        // 3. ТЕПЕР ВАНТАЖИМО ВСЕ ІНШЕ (Курси та Статистику)
        const [coursesRes, resultsRes] = await Promise.all([
            fetch(`${API_BASE_URL}/courses/all`),
            userId ? fetch(`${API_BASE_URL}/results/user-stats/${userId}`) : Promise.resolve({ ok: false })
        ]);

        // Обробка статистики
        if (resultsRes.ok) {
            const results = await resultsRes.json();
            const countEl = document.getElementById('countCompleted');
            if (countEl) countEl.innerText = results.length;
        }

        // Обробка списку курсів
        if (coursesRes.ok) {
            const allCourses = await coursesRes.json();
            localStorage.setItem('user_courses_data', JSON.stringify(allCourses));
            renderCourses(allCourses, enrolledIds, completedIds);
        }

    } catch (e) {
        console.error("Критична помилка завантаження кабінету:", e);
        // Фоллбек
        const cachedCourses = localStorage.getItem('user_courses_data');
        const userObj = JSON.parse(localStorage.getItem('user'));
        if (cachedCourses && userObj) {
            const all = JSON.parse(cachedCourses);
            const enr = (userObj.enrolledCourses || []).map(id => getCleanId(id));
            const com = (userObj.completedCourses || []).map(id => getCleanId(id));
            renderCourses(all, enr, com);
        }
    }
});

function renderCourses(courses, enrolledIds, completedIds) {
    const myContainer = document.getElementById('myCourses');
    const allContainer = document.getElementById('allCourses');
    const completedContainer = document.getElementById('completedCourses');

    if (!allContainer || !myContainer) return;

    myContainer.innerHTML = '';
    allContainer.innerHTML = '';
    if (completedContainer) completedContainer.innerHTML = '';

    let activeCount = 0;

    courses.forEach(course => {
        const courseIdStr = getCleanId(course._id);
        const isCompleted = completedIds.includes(courseIdStr);
        const isEnrolled = enrolledIds.includes(courseIdStr);
        const price = course.price || 0; 

        if (course.isPublic === false && !isEnrolled) {
            return; 
        }
        
        let actionBtnHtml = '';

        if (isCompleted) {
            actionBtnHtml = `<button class="btn btn-outline-success w-100 rounded-pill py-2 fw-bold">Переглянути знову</button>`;
        } else if (isEnrolled) {
            actionBtnHtml = `<button class="btn btn-lexora w-100 rounded-pill shadow-sm py-2">Продовжити навчання</button>`;
        } else {
            if (price > 0) {
                actionBtnHtml = `
                    <a href="student-checkout.html?courseId=${courseIdStr}&title=${encodeURIComponent(course.title)}&price=${price}" 
                       onclick="event.stopPropagation();" 
                       class="btn btn-success w-100 rounded-pill fw-bold py-2 shadow-sm text-white">
                        <i class="bi bi-cart-fill me-1"></i> Придбати за ${price} ₴
                    </a>`;
            } else {
                actionBtnHtml = `
                    <button onclick="event.stopPropagation(); enrollInCourse('${courseIdStr}')" 
                             class="btn btn-outline-success w-100 rounded-pill fw-bold py-2">
                        Записатися безкоштовно
                    </button>`;
            }
        }

        // Логіка вибору: або картинка, або стильна заглушка
        const imageHtml = course.image 
            ? `<img src="${course.image}" class="card-img-top" style="height: 190px; object-fit: cover;">`
            : `<div class="course-fake-img">
                 <div class="course-letter">${course.title.charAt(0)}</div>
                 <i class="bi bi-book-half bi-book-overlay"></i>
               </div>`;

        const cardHTML = `
            <div class="col-md-6 col-lg-4 mb-4">
                <div class="card h-100 shadow-sm course-card border-0" onclick="window.location.href='course-view.html?id=${courseIdStr}'" style="cursor: pointer;">
                    <div class="position-relative">
                        ${imageHtml} ${isCompleted ? 
                            `<span class="badge bg-success position-absolute top-0 end-0 m-3 px-3 py-2 rounded-pill shadow-sm" style="font-size: 0.8rem;">Пройдено</span>` : 
                            (isEnrolled ? `<span class="badge bg-success position-absolute top-0 end-0 m-3 px-3 py-2 rounded-pill shadow-sm" style="font-size: 0.8rem;">Активний</span>` : '')
                        }
                        ${(!isEnrolled && price > 0) ? `<span class="badge bg-success text-dark position-absolute top-0 text-white start-0 m-3 px-3 py-2 rounded-pill shadow-sm" style="font-size: 0.75rem; font-weight: 800; ">Premium</span>` : ''}
                    </div>
                    <div class="card-body p-4 d-flex flex-column">
                        <h5 class="fw-bold mb-2" style="color: var(--heading-color);">${course.title}</h5>
                        <p class="small text-muted flex-grow-1 mb-4">${course.description.substring(0, 95)}...</p>
                        <div class="mt-auto">${actionBtnHtml}</div>
                    </div>
                </div>
            </div>`;

        if (isCompleted) {
            if (completedContainer) completedContainer.innerHTML += cardHTML;
        } else if (isEnrolled) {
            myContainer.innerHTML += cardHTML;
            activeCount++;
        } else {
            allContainer.innerHTML += cardHTML;
        }
    });

    document.getElementById('countActive').innerText = activeCount;

    if (myContainer.innerHTML.trim() === '') {
        myContainer.innerHTML = `
            <div class="col-12 text-center py-5 border rounded-4 bg-white shadow-sm" style="border-style: dashed !important; border-color: #cce8cd !important; border-width: 2px !important;">
                <i class="bi bi-box-seam text-success opacity-50 mb-3 d-block" style="font-size: 3rem;"></i>
                <h5 class="fw-bold text-muted">Тут поки порожньо</h5>
                <p class="text-muted small mb-0">Твої активні курси з'являться тут. Завершені курси будуть нижче.</p>
            </div>`;
    }
}

// ==========================================
// ====== ІНВАЙТИ =======
// ==========================================
// ==========================================
// 🛠️ СИСТЕМА МОДАЛОК (БЕЗ ALERT/CONFIRM)
// ==========================================
function showAlert(title, text, type = 'success') {
    const titleEl = document.getElementById('alertModalTitle');
    const textEl = document.getElementById('alertModalText');
    const iconEl = document.getElementById('alertModalIcon');
    const iconBox = document.getElementById('alertModalIconBox');
    const btnEl = document.getElementById('alertModalBtn');

    titleEl.textContent = title;
    textEl.textContent = text;

    if (type === 'error') {
        iconBox.className = 'bg-danger bg-opacity-10 text-danger rounded-circle d-inline-flex align-items-center justify-content-center mb-3';
        iconEl.className = 'bi bi-x-circle-fill fs-2';
        btnEl.className = 'btn btn-danger rounded-pill w-100 fw-bold py-2 shadow-sm';
    } else {
        iconBox.className = 'bg-success bg-opacity-10 text-success rounded-circle d-inline-flex align-items-center justify-content-center mb-3';
        iconEl.className = 'bi bi-check-circle-fill fs-2';
        btnEl.className = 'btn btn-success rounded-pill w-100 fw-bold py-2 shadow-sm';
    }
    new bootstrap.Modal(document.getElementById('lexoraAlertModal')).show();
}

// ==========================================
// 📩 ОНОВЛЕНЕ ЗАВАНТАЖЕННЯ ЗАПРОШЕНЬ
// ==========================================
async function loadMyInvitations() {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const res = await fetch('http://localhost:5002/api/invitations/my-invitations', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const invites = await res.json();

        const section = document.getElementById('invitationsSection');
        const container = document.getElementById('invitationsContainer');

        if (res.ok && invites.length > 0) {
            section.style.display = 'block'; 
            container.innerHTML = invites.map(invite => `
                <div class="card border-0 shadow-sm rounded-4 p-4 mb-4 animate__animated animate__fadeIn" style="border-left: 5px solid #28a745 !important; background: #fff;">
                    <div class="row align-items-center">
                        <div class="col-lg-8">
                            <div class="d-flex align-items-center mb-3">
                                <div class="bg-success text-white rounded-circle d-flex align-items-center justify-content-center me-3 shadow-sm" style="width: 45px; height: 45px;">
                                    <i class="bi bi-person-badge-fill fs-5"></i>
                                </div>
                                <h4 class="fw-bold mb-0 text-success">Запрошення на курс: "${invite.course.title}"</h4>
                            </div>
                            <p class="text-muted mb-4 fs-5">Викладач <b>${invite.teacher.name || invite.teacher.email}</b> запрошує вас до спільного навчання.</p>
                            <div class="p-3 bg-light rounded-3 mb-4 mb-lg-0 fst-italic shadow-sm border" style="border-left: 4px solid #28a745 !important;">
                                <i class="bi bi-quote fs-4 text-success opacity-50"></i>
                                ${invite.message}
                            </div>
                        </div>
                        <div class="col-lg-4 text-center text-lg-end">
                            <div class="d-grid d-md-flex justify-content-lg-end gap-3">
                                <button onclick="handleInvitationWithConfirm('${invite._id}', 'accepted')" class="btn btn-lexora fw-bold rounded-pill px-5 py-3 shadow-sm">
                                    Прийняти
                                </button>
                                <button onclick="handleInvitationWithConfirm('${invite._id}', 'rejected')" class="btn btn-outline-danger fw-bold rounded-pill px-4">
                                    Відхилити
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');
        } else {
            section.style.display = 'none'; 
        }
    } catch (err) { console.error(err); }
}

// ==========================================
// 🛠️ ОБРОБКА ІНВАЙТУ З ПІДТВЕРДЖЕННЯМ
// ==========================================
window.handleInvitationWithConfirm = function(inviteId, action) {
    const title = action === 'accepted' ? 'Прийняти курс?' : 'Відхилити запит?';
    const text = action === 'accepted' ? 'Ви отримаєте доступ до всіх матеріалів курсу.' : 'Ви більше не побачите це запрошення.';
    
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmText').textContent = text;
    
    const confirmBtn = document.getElementById('confirmActionBtn');
    confirmBtn.onclick = () => executeHandleInvitation(inviteId, action);
    
    new bootstrap.Modal(document.getElementById('confirmActionModal')).show();
}

async function executeHandleInvitation(inviteId, action) {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`http://localhost:5002/api/invitations/handle/${inviteId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status: action })
        });

        const data = await res.json();
        
        // Закриваємо модалку підтвердження
        bootstrap.Modal.getInstance(document.getElementById('confirmActionModal')).hide();

        if (res.ok) {
            showAlert("Успішно!", data.message);
            // Перезавантажуємо через секунду
            setTimeout(() => window.location.reload(), 1500);
        } else {
            showAlert("Помилка", data.message, "error");
        }
    } catch (err) {
        showAlert("Помилка", "Сервер не відповідає", "error");
    }
}

document.addEventListener('DOMContentLoaded', loadMyInvitations);

// ==========================================
// ====== МОДУЛЬ ПОВІДОМЛЕНЬ СТУДЕНТА =======
// ==========================================

async function updateStudentUnreadBadge() {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const res = await fetch(`http://localhost:5002/api/messages/unread-count`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const badge = document.getElementById('studentNavUnreadCount');
        
        if (badge && data.count > 0) {
            badge.textContent = data.count;
            badge.classList.remove('d-none');
        } else if (badge) {
            badge.classList.add('d-none');
        }
    } catch (err) {
        console.error("Помилка лічильника:", err);
    }
}

async function loadMessageCenter() {
    const token = localStorage.getItem('token');
    
    // Автоматично визначаємо контейнери (для вчителя або студента)
    const container = document.getElementById('teacherDialogsContainer') || document.getElementById('studentDialogsContainer');
    const section = document.getElementById('teacherMessagesSection') || document.getElementById('messagesSection');

    if (!container || !section) return;

    try {
        const res = await fetch(`http://localhost:5002/api/messages/dialogs`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const dialogs = await res.json();
        
        if (!dialogs || dialogs.length === 0) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';
        container.innerHTML = '';

        // 1. БЕРЕМО ОСТАННЬОГО (найсвіжішого) співрозмовника
        const lastChat = dialogs[0];

        // 2. РАХУЄМО ЗАГАЛЬНУ СУМУ ВСІХ НЕПРОЧИТАНИХ
        const totalUnread = dialogs.reduce((sum, chat) => sum + (chat.unreadCount || 0), 0);

        // Логіка аватарки
        const avatarHtml = lastChat.avatar 
            ? `<img src="${lastChat.avatar}" class="w-100 h-100 object-fit-cover" alt="Avatar">`
            : `${(lastChat.name || "?").charAt(0).toUpperCase()}`;

        // Визначаємо роль для підпису
        const isTeacherPage = window.location.pathname.includes('teacher');
        const roleLabel = isTeacherPage ? 'Студент' : 'Викладач';
        const chatPage = isTeacherPage ? 'teacher-messages.html' : 'student-messages.html';

        // 3. ГЕНЕРУЄМО ОДНУ КАРТКУ (стиль як у студента)
        container.innerHTML = `
            <div class="col-12 mb-2"> 
                <div class="card stat-card p-3 border-0 shadow-sm transition-all" 
                     style="cursor: pointer; border-radius: 20px; background-color: ${totalUnread > 0 ? '#f8fcf9' : '#ffffff'}; border-left: 4px solid ${totalUnread > 0 ? '#44BF69' : 'transparent'} !important;" 
                     onclick="window.location.href='${chatPage}?chatWith=${lastChat._id}'">
                    
                    <div class="d-flex align-items-center position-relative z-1">
                        <div class="bg-success text-white rounded-circle d-flex align-items-center justify-content-center fw-bold me-3 shadow-sm overflow-hidden flex-shrink-0" 
                             style="width: 52px; height: 52px; font-size: 1.3rem; background: linear-gradient(135deg, #4caf50, #1b5e20);">
                            ${avatarHtml}
                        </div>
                        
                        <div class="flex-grow-1 overflow-hidden d-flex flex-column flex-md-row align-items-md-center gap-1 gap-md-2">
                            <h6 class="fw-bold mb-0 text-dark text-truncate" style="font-size: 1.1rem;">${lastChat.name || "Співрозмовник"}</h6>
                            <div class="d-flex align-items-center gap-2">
                                <span class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25" style="font-size: 0.7rem; padding: 4px 10px;">${roleLabel}</span>
                                
                                ${totalUnread > 0 ? `<span class="badge rounded-pill badge-notification shadow-sm" style="background-color: #ff5b5b; font-size: 0.7rem;">+${totalUnread} нових</span>` : ''}
                            </div>
                        </div>
                        
                        <div class="ms-3 flex-shrink-0">
                            <div class="rounded-circle d-flex align-items-center justify-content-center shadow-sm" style="width: 38px; height: 38px; background-color: #f1f8e9;">
                                <i class="bi bi-chevron-right text-success fs-5"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } catch (err) {
        console.error("Помилка повідомлень:", err);
    }
}


document.addEventListener('DOMContentLoaded', () => {
    updateStudentUnreadBadge();
    loadMessageCenter();
});

// ==========================================
// ====== ОНОВЛЕННЯ НАВБАРУ ТА АВАТАРКИ ======
// ==========================================
function updateNavbarUI(user) {
    if (!user || !user.name) return;

    // 1. Оновлюємо імена в шапці та на банері
    const navNameEl = document.getElementById('studentNavName');
    const mainNameEl = document.getElementById('studentMainName'); // Це для банера "Привіт, Student!"
    if (navNameEl) navNameEl.textContent = user.name;
    if (mainNameEl) mainNameEl.textContent = user.name;

    // 2. Оновлюємо аватарку в навбарі
    const navPhoto = document.getElementById('navUserPhoto');
    const navInitials = document.getElementById('navUserInitials');
    const navAvatarContainer = document.getElementById('navAvatarContainer');

    if (user.avatar && navPhoto && navInitials) {
        // Якщо є фото — показуємо його
        navPhoto.src = user.avatar + '?t=' + new Date().getTime();
        navPhoto.classList.remove('d-none');
        navInitials.classList.add('d-none');
    } else if (navInitials) {
        // Якщо фото немає — ставимо першу літеру імені
        navInitials.textContent = user.name.charAt(0).toUpperCase();
        navInitials.classList.remove('d-none');
        if (navPhoto) navPhoto.classList.add('d-none');
    }

    // 3. Підтягуємо кастомний колір фону (якщо ти його міняв у профілі)
    const colorIndex = localStorage.getItem('avatarColorIndex');
    if (colorIndex && navAvatarContainer) {
        const avatarColors = [
            'linear-gradient(135deg, #4caf50, #1b5e20)', // Зелений
            'linear-gradient(135deg, #2196f3, #0d47a1)', // Синій
            'linear-gradient(135deg, #ff9800, #e65100)', // Оранжевий
            'linear-gradient(135deg, #9c27b0, #4a148c)', // Фіолетовий
            'linear-gradient(135deg, #e91e63, #880e4f)'  // Рожевий
        ];
        if (avatarColors[colorIndex]) {
            navAvatarContainer.style.background = avatarColors[colorIndex];
        }
    }
}

// Функція для виходу з акаунту
window.logout = function() {
    localStorage.clear();
    window.location.href = '../index.html';
};