const API_BASE_URL = 'http://localhost:5002/api/courses';

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '../index.html';
        return;
    }

    // ==========================================
    // 1. ЛОГІКА СТОРІНКИ СТВОРЕННЯ КУРСУ
    // ==========================================
    const createForm = document.getElementById('standaloneCreateCourseForm');
    if (createForm) {
        createForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const submitBtn = document.getElementById('submitBtn');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Створюємо...';

            const data = {
                title: document.getElementById('courseTitle').value.trim(),
                description: document.getElementById('courseDesc').value.trim(),
                image: document.getElementById('courseImage').value.trim(),
                isPublic: document.getElementById('isPublicSwitch').checked
            };

            try {
                const response = await fetch(`${API_BASE_URL}/teacher-create`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json', 
                        'Authorization': `Bearer ${token}` 
                    },
                    body: JSON.stringify(data)
                });

                if (response.ok) {
                    const newCourse = await response.json();
                    window.location.href = `teacher-course-edit.html?id=${newCourse._id}`;
                } else {
                    alert('Помилка при створенні курсу');
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = 'Створити та перейти до уроків <i class="bi bi-arrow-right ms-2"></i>';
                }
            } catch (err) {
                console.error(err);
                alert('Помилка сервера');
                submitBtn.disabled = false;
            }
        });
    }

    // ==========================================
    // 2. ЛОГІКА ГОЛОВНОЇ СТОРІНКИ (Завантаження списку курсів)
    // ==========================================
    if (document.getElementById('teacherCoursesList')) {
        loadMyCourses(token);
    }
});

// ==========================================
// ФУНКЦІЇ ДЛЯ КУРСІВ
// ==========================================
// ==========================================
// ФУНКЦІЇ ДЛЯ КУРСІВ
// ==========================================
async function loadMyCourses(token) {
    const listContainer = document.getElementById('teacherCoursesList');

    try {
        const response = await fetch(`${API_BASE_URL}/my-courses`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Помилка завантаження');
        const courses = await response.json();

        if (courses.length === 0) {
            listContainer.innerHTML = `
                <div class="col-12 text-center py-5 border rounded-4 bg-white shadow-sm" style="border-style: dashed !important; border-color: #cce8cd !important; border-width: 2px !important;">
                    <i class="bi bi-box-seam text-success opacity-50 mb-3 d-block" style="font-size: 3rem;"></i>
                    <h5 class="fw-bold text-muted">У вас ще немає створених курсів</h5>
                    <p class="text-muted small mb-0">Створіть свій перший курс, щоб розпочати навчання студентів.</p>
                    <a href="teacher-builder.html" class="btn btn-success mt-3 rounded-pill px-4 shadow-sm fw-bold">Створити курс</a>
                </div>`;
            return;
        }

        listContainer.innerHTML = courses.map(course => {
            // Логіка вибору: або картинка, або стильна заглушка
            const imageHtml = course.image && course.image.trim() !== ''
                ? `<img src="${course.image}" class="card-img-top" style="height: 190px; object-fit: cover;">`
                : `<div class="course-fake-img">
                     <div class="course-letter">${(course.title || 'К').charAt(0)}</div>
                     <i class="bi bi-book-half bi-book-overlay"></i>
                   </div>`;

            // Визначаємо бейдж статусу: Публічний чи Приватний
            const statusBadge = course.isPublic
                ? `<span class="badge bg-success position-absolute top-0 end-0 m-3 px-3 py-2 rounded-pill shadow-sm" style="font-size: 0.8rem;"><i class="bi bi-globe me-1"></i>Публічний</span>`
                : `<span class="badge bg-secondary position-absolute top-0 end-0 m-3 px-3 py-2 rounded-pill shadow-sm" style="font-size: 0.8rem;"><i class="bi bi-lock-fill me-1"></i>Приватний</span>`;

            // Якщо курс платний, показуємо бейдж Premium
            const premiumBadge = course.price > 0 
                ? `<span class="badge bg-success text-dark position-absolute top-0 text-white start-0 m-3 px-3 py-2 rounded-pill shadow-sm" style="font-size: 0.75rem; font-weight: 800;">Premium</span>` 
                : '';

            return `
            <div class="col-md-6 col-lg-4 mb-4">
                <div class="card h-100 shadow-sm course-card border-0" onclick="window.location.href='teacher-course-edit.html?id=${course._id}'" style="cursor: pointer;">
                    <div class="position-relative">
                        ${imageHtml}
                        ${statusBadge}
                        ${premiumBadge}
                    </div>
                    <div class="card-body p-4 d-flex flex-column">
                        <h5 class="fw-bold mb-2" style="color: var(--heading-color);">${course.title || 'Без назви'}</h5>
                        <p class="small text-muted flex-grow-1 mb-4">${(course.description || 'Немає опису').substring(0, 95)}...</p>
                        
                        <div class="mt-auto">
                            <button class="btn btn-outline-success w-100 rounded-pill py-2 fw-bold" onclick="event.stopPropagation(); window.location.href='teacher-course-edit.html?id=${course._id}'">
                                <i class="bi bi-pencil-square me-1"></i> Редагувати
                            </button>
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('');

    } catch (err) {
        listContainer.innerHTML = `<div class="text-danger text-center">Не вдалося завантажити курси: ${err.message}</div>`;
    }
}

// ==========================================
// ====== МОДУЛЬ ПОВІДОМЛЕНЬ ВИКЛАДАЧА =====
// ==========================================
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

// Виклик при завантаженні
document.addEventListener('DOMContentLoaded', loadMessageCenter);