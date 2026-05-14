const API_BASE_URL = 'http://localhost:5002/api';

function getCleanId(idObj) {
    if (!idObj) return null;
    return typeof idObj === 'object' ? (idObj.$oid || idObj._id || idObj).toString() : idObj.toString();
}

function getAuthToken() {
    const userData = JSON.parse(localStorage.getItem('user'));
    return userData?.token || localStorage.getItem('token');
}

document.addEventListener('DOMContentLoaded', async () => {
    const token = getAuthToken();
    if (!token) {
        window.location.href = '../index.html';
        return;
    }

    const userObj = JSON.parse(localStorage.getItem('user'));
    let enrolledIds = (userObj?.enrolledCourses || []).map(id => getCleanId(id));
    let completedIds = (userObj?.completedCourses || []).map(id => getCleanId(id));

    // Спроба відрендерити з кешу
    const cachedCourses = JSON.parse(localStorage.getItem('user_courses_data') || '[]');
    if (cachedCourses.length > 0) {
        renderMyCourses(cachedCourses, enrolledIds, completedIds);
        setupSearch(cachedCourses, enrolledIds, completedIds);
    }

    // Оновлення з сервера
    try {
        const [coursesRes, userRes] = await Promise.all([
            fetch(`${API_BASE_URL}/courses/all`),
            fetch(`${API_BASE_URL}/auth/me`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        if (userRes.ok) {
            const freshUser = await userRes.ok ? await userRes.json() : userObj;
            enrolledIds = (freshUser.enrolledCourses || []).map(id => getCleanId(id));
            completedIds = (freshUser.completedCourses || []).map(id => getCleanId(id));
            localStorage.setItem('user', JSON.stringify(freshUser));
        }

        if (coursesRes.ok) {
            const allCourses = await coursesRes.json();
            localStorage.setItem('user_courses_data', JSON.stringify(allCourses));
            renderMyCourses(allCourses, enrolledIds, completedIds);
            setupSearch(allCourses, enrolledIds, completedIds);
        }
    } catch (e) {
        console.error("Помилка оновлення", e);
    }
});

function renderMyCourses(allCourses, enrolledIds, completedIds, searchTerm = '') {
    const activeContainer = document.getElementById('activeCoursesContainer');
    const completedContainer = document.getElementById('completedCoursesContainer');
    
    if (!activeContainer || !completedContainer) return;
    
    activeContainer.innerHTML = '';
    completedContainer.innerHTML = '';

    // Фільтруємо курси, які належать користувачу (або активні, або завершені)
    let myCourses = allCourses.filter(course => {
        const id = getCleanId(course._id);
        return enrolledIds.includes(id) || completedIds.includes(id);
    });

    // Пошук
    if (searchTerm) {
        myCourses = myCourses.filter(course => 
            course.title.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }

    myCourses.forEach(course => {
        const courseIdStr = getCleanId(course._id);
        const isCompleted = completedIds.includes(courseIdStr);

        // 1. Визначаємо, що малювати замість картинки (якщо її немає)
        const imageHtml = course.image 
            ? `<img src="${course.image}" class="card-img-top" style="height: 190px; object-fit: cover;">`
            : `<div class="course-fake-img">
                <div class="course-letter">${course.title.charAt(0)}</div>
                <i class="bi bi-book-half bi-book-overlay"></i>
            </div>`;

        // 2. Формуємо саму картку
        const cardHTML = `
            <div class="col-md-6 col-lg-4 mb-4">
                <div class="card h-100 shadow-sm course-card stat-card border-0" 
                    onclick="window.location.href='course-view.html?id=${courseIdStr}'"
                    style="cursor: pointer;">
                    
                    <div class="position-relative">
                        ${imageHtml}
                        <span class="badge bg-success position-absolute top-0 end-0 m-3 px-3 py-2 rounded-pill shadow-sm" style="font-size: 0.8rem;">
                            ${isCompleted ? 'Пройдено' : 'Активний'}
                        </span>
                    </div>

                    <div class="card-body p-4 d-flex flex-column">
                        <h5 class="fw-bold mb-2" style="color: var(--heading-color);">${course.title}</h5>
                        
                        <p class="small text-muted flex-grow-1 mb-4" style="line-height: 1.6;">
                            ${course.description.substring(0, 95)}...
                        </p>

                        <div class="mt-auto">
                            ${isCompleted ? 
                                `<button class="btn btn-outline-success w-100 rounded-pill py-2 fw-bold">
                                    <i class="bi me-1"></i> Переглянути знову
                                </button>` : 
                                `<button class="btn btn-lexora w-100 rounded-pill shadow-sm py-2">
                                    <i class="bi me-1"></i> Продовжити навчання
                                </button>`
                            }
                        </div>
                    </div>
                </div>
            </div>`;

        if (isCompleted) {
            completedContainer.innerHTML += cardHTML;
        } else {
            activeContainer.innerHTML += cardHTML;
        }
    });

    // Заглушки для порожніх станів
    if (activeContainer.innerHTML === '') {
        activeContainer.innerHTML = '<div class="col-12 text-center py-4 text-muted">Немає активних курсів у процесі по запиту.</div>';
    }
    if (completedContainer.innerHTML === '') {
        completedContainer.innerHTML = '<div class="col-12 text-center py-4 text-muted">У вас поки немає завершених курсів по запиту.</div>';
    }
}

function setupSearch(allCourses, enrolledIds, completedIds) {
    const searchInput = document.getElementById('myCourseSearch');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            renderMyCourses(allCourses, enrolledIds, completedIds, e.target.value);
        });
    }
}
