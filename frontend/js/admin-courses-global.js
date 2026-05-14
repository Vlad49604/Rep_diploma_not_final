const API_URL = 'http://localhost:5002/api/admin/manage-courses';
const token = localStorage.getItem('token');

// Зберігаємо всі курси глобально для пошуку
let allCoursesData = [];
let studentsModal;
let courseToToggleId = null;
let courseToToggleStatus = null;

document.addEventListener('DOMContentLoaded', loadAllCourses);

async function loadAllCourses() {
    try {
        const res = await fetch(API_URL, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        allCoursesData = await res.json();
        
        renderStats(allCoursesData);
        filterCourses(); // Рендеримо таблицю
        
    } catch (err) {
        console.error("Помилка:", err);
    }
}

// Функція пошуку
function filterCourses() {
    const searchEl = document.getElementById('searchCourse');
    if(!searchEl) return;

    const query = searchEl.value.toLowerCase();
    const filteredCourses = allCoursesData.filter(c => 
        c.title.toLowerCase().includes(query)
    );
    
    renderTable(filteredCourses);
}

// Рендер верхніх карток статистики
function renderStats(courses) {
    const totalEl = document.getElementById('totalCourses');
    if(totalEl) totalEl.textContent = courses.length;
    
    const badgeEl = document.getElementById('totalCoursesBadge');
    if(badgeEl) badgeEl.textContent = `Всього: ${courses.length}`;
    
    const publicCount = courses.filter(c => c.isPublic).length;
    const pubEl = document.getElementById('publicCount');
    if(pubEl) pubEl.textContent = publicCount;
    
    const studentsSum = courses.reduce((sum, c) => sum + (c.realStudentCount || 0), 0);
    const stuEl = document.getElementById('totalStudents');
    if(stuEl) stuEl.textContent = studentsSum;
}

// Рендер самої таблиці
function renderTable(courses) {
    const tbody = document.getElementById('coursesTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';

    if (courses.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Курсів не знайдено</td></tr>';
        return;
    }

    courses.forEach(c => {
        let authorHtml = '';
        if (c.author) {
            authorHtml = `
                <a href="admin-user-details.html?id=${c.author._id}" class="text-decoration-none shadow-none">
                    <div class="small fw-bold text-success hover-underline">${c.author.name} <i class="bi bi-box-arrow-in-right small"></i></div>
                    <div class="text-muted" style="font-size: 0.75rem;">${c.author.email}</div>
                </a>
            `;
        } else {
            authorHtml = `
                <div class="small fw-bold text-success">
                    <i class="bi bi-shield-check me-1"></i>Системний курс Lexora
                </div>
                <div class="text-muted" style="font-size: 0.75rem;">Базовий контент платформи</div>
            `;
        }
        
        const createdDate = c.createdAt 
            ? new Date(c.createdAt).toLocaleDateString('uk-UA') 
            : 'Базовий контент';

        const studentsCount = c.realStudentCount || 0;
        
        tbody.innerHTML += `
            <tr class="course-row">
                <td class="ps-4">
                    <div class="fw-bold text-dark fs-6">${c.title}</div>
                    <small class="text-muted">Створено: ${createdDate}</small>
                </td>
                <td>
                    ${authorHtml}
                </td>
                <td><b class="text-success">${c.price > 0 ? c.price + ' ₴' : 'Безкоштовно'}</b></td>
                <td>
                    <button onclick="viewCourseStudents('${c._id}', '${c.title.replace(/'/g, "\\'")}')" 
                            class="btn btn-sm btn-light border rounded-pill px-3 shadow-sm fw-bold text-success d-inline-flex align-items-center" 
                            style="height: 36px;" title="Переглянути список">
                        <i class="bi bi-people-fill me-1"></i> ${studentsCount}
                    </button>
                </td>
                <td>
                    <span class="badge ${c.isPublic ? 'bg-success' : 'bg-secondary'} rounded-pill px-3 py-2 shadow-sm" style="min-width: 90px; display: inline-block; text-align: center;">
                        ${c.isPublic ? 'Публічний' : 'Приватний'}
                    </span>
                </td>
                <td class="text-end pe-4">
                    <div class="d-flex justify-content-end align-items-center gap-2">
                        <button onclick="window.open('admin-course-view.html?id=${c._id}', '_blank')" 
                                class="btn btn-sm bg-success bg-opacity-10 text-success border-0 rounded-pill shadow-sm fw-bold d-inline-flex align-items-center justify-content-center" 
                                style="height: 36px; width: 40px;" title="Переглянути контент">
                            <i class="bi bi-eye-fill fs-6"></i>
                        </button>
                        
                        <button onclick="promptVisibilityToggle('${c._id}', ${c.isPublic})" 
                                class="btn btn-sm ${c.isPublic ? 'btn-outline-secondary' : 'btn-outline-success'} shadow-sm border rounded-pill fw-bold d-inline-flex align-items-center justify-content-center" 
                                style="height: 36px; width: 145px;" title="Змінити статус">
                            ${c.isPublic ? '<i class="bi bi-lock-fill me-2"></i> Сховати' : '<i class="bi bi-globe me-2"></i> Опублікувати'}
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
}

// ВІДКРИТТЯ МОДАЛКИ ЗМІНИ СТАТУСУ
window.promptVisibilityToggle = function(id, isCurrentlyPublic) {
    courseToToggleId = id;
    courseToToggleStatus = isCurrentlyPublic;
    
    const icon = document.getElementById('visibilityIconPlaceholder');
    const text = document.getElementById('visibilityTextPlaceholder');
    
    if (isCurrentlyPublic) {
        icon.className = 'bi bi-lock-fill fs-1 text-warning';
        text.innerText = 'Приховати цей курс від студентів?';
    } else {
        icon.className = 'bi bi-globe fs-1 text-success';
        text.innerText = 'Опублікувати цей курс на платформі?';
    }

    const modal = new bootstrap.Modal(document.getElementById('visibilityModal'));
    modal.show();
};

// ВІДПРАВКА ЗАПИТУ ПІСЛЯ ПІДТВЕРДЖЕННЯ
document.getElementById('confirmVisibilityBtn').addEventListener('click', async () => {
    if (!courseToToggleId) return;
    
    const btn = document.getElementById('confirmVisibilityBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Обробка...';

    try {
        const res = await fetch(`${API_URL}/${courseToToggleId}/toggle-publish`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
            const modalEl = document.getElementById('visibilityModal');
            bootstrap.Modal.getInstance(modalEl).hide();
            loadAllCourses(); // Оновлюємо таблицю
        } else {
            const data = await res.json();
            alert(data.message || 'Помилка зміни статусу');
        }
    } catch (err) {
        alert("Помилка з'єднання з сервером");
    } finally {
        btn.disabled = false;
        btn.innerText = 'Так, змінити';
    }
});

// ПЕРЕГЛЯД СТУДЕНТІВ (ПОЗБУЛИСЯ СИНЬОГО)
async function viewCourseStudents(courseId, courseTitle) {
    if (!studentsModal) {
        studentsModal = new bootstrap.Modal(document.getElementById('courseStudentsModal'));
    }
    
    document.getElementById('modalCourseTitle').textContent = courseTitle;
    const container = document.getElementById('studentsListContainer');
    container.innerHTML = '<div class="text-center p-5"><div class="spinner-border text-success"></div><p class="mt-2 text-muted small">Завантаження...</p></div>';
    
    studentsModal.show();

    try {
        const res = await fetch(`${API_URL}/${courseId}/students`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) throw new Error('Помилка сервера');
        const students = await res.json();

        if (students.length === 0) {
            container.innerHTML = `
                <div class="text-center p-5 text-muted">
                    <i class="bi bi-inbox fs-1 mb-2 d-block opacity-50"></i>
                    На цьому курсі ще немає студентів.
                </div>`;
            return;
        }

        container.innerHTML = students.map(s => `
            <div class="list-group-item d-flex justify-content-between align-items-center p-3 bg-white mb-1 border-0 border-bottom">
                <div class="d-flex align-items-center gap-3">
                    <div class="bg-success bg-opacity-10 text-success rounded-circle d-flex align-items-center justify-content-center fw-bold fs-5" style="width: 45px; height: 45px;">
                        ${s.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div class="fw-bold text-dark">${s.name}</div>
                        <div class="small text-muted">${s.email}</div>
                    </div>
                </div>
                <a href="admin-user-details.html?id=${s._id}" class="btn btn-sm btn-outline-success rounded-pill px-3 fw-bold shadow-sm">
                    Досьє <i class="bi bi-arrow-right ms-1"></i>
                </a>
            </div>
        `).join('');

    } catch (err) {
        console.error("Помилка:", err);
        container.innerHTML = '<div class="text-center p-4 text-danger"><i class="bi bi-exclamation-circle me-2"></i>Помилка завантаження даних.</div>';
    }
}