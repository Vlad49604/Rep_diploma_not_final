const API_BASE_URL = 'http://localhost:5002/api';

function getCleanId(idObj) {
    if (!idObj) return null;
    return typeof idObj === 'object' ? (idObj.$oid || idObj._id || idObj).toString() : idObj.toString();
}

function getAuthToken() {
    const userData = JSON.parse(localStorage.getItem('user'));
    return userData?.token || localStorage.getItem('token');
}

// Функція запису на курс
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
            alert('🎉 Успішно записано на курс!');
            localStorage.removeItem('user_courses_data'); 
            window.location.href = 'student.html'; // Перекидаємо на головну після запису
        } else {
            const data = await res.json();
            alert('Помилка: ' + data.message);
        }
    } catch (err) { alert("Сервер не відповідає"); }
};

document.addEventListener('DOMContentLoaded', async () => {
    const token = getAuthToken();
    if (!token) return;

    const userObj = JSON.parse(localStorage.getItem('user'));
    let enrolledIds = (userObj?.enrolledCourses || []).map(id => getCleanId(id));

    // Спроба відрендерити з кешу
    const cachedCourses = JSON.parse(localStorage.getItem('user_courses_data') || '[]');
    if (cachedCourses.length > 0) {
        renderCatalog(cachedCourses, enrolledIds);
        setupSearch(cachedCourses, enrolledIds);
    }

    // Оновлення даних з сервера
    try {
        const [coursesRes, userRes] = await Promise.all([
            fetch(`${API_BASE_URL}/courses/all`),
            fetch(`${API_BASE_URL}/auth/me`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        if (userRes.ok) {
            const freshUser = await userRes.json();
            enrolledIds = (freshUser.enrolledCourses || []).map(id => getCleanId(id));
            localStorage.setItem('user', JSON.stringify(freshUser));
        }

        if (coursesRes.ok) {
            const allCourses = await coursesRes.json();
            localStorage.setItem('user_courses_data', JSON.stringify(allCourses));
            renderCatalog(allCourses, enrolledIds);
            setupSearch(allCourses, enrolledIds);
        }
    } catch (e) {
        console.error("Помилка завантаження каталогу", e);
        document.getElementById('catalogCoursesContainer').innerHTML = `
            <div class="col-12 text-center py-5 text-danger">
                <p>Не вдалося завантажити курси. Перевірте підключення до сервера.</p>
            </div>`;
    }
});

function renderCatalog(allCourses, enrolledIds, searchTerm = '') {
    const container = document.getElementById('catalogCoursesContainer');
    container.innerHTML = '';

    let coursesToShow = allCourses.filter(course => {
        const courseIdStr = getCleanId(course._id);
        const isEnrolled = enrolledIds.includes(courseIdStr);
        return course.isPublic !== false || isEnrolled;
    });

    if (searchTerm) {
        coursesToShow = coursesToShow.filter(course => 
            course.title.toLowerCase().includes(searchTerm.toLowerCase()) 
        );
    }

    coursesToShow.forEach(course => {
        const courseIdStr = getCleanId(course._id);
        const isEnrolled = enrolledIds.includes(courseIdStr);
        const price = course.price || 0; // Беремо ціну з бази

        // --- ЛОГІКА КНОПКИ ---
        let actionButton = '';
        if (isEnrolled) {
            // Студент уже на курсі
            actionButton = `<button class="btn btn-lexora w-100 rounded-pill shadow-sm py-2">Продовжити навчання</button>`;
        } else if (price > 0) {
            // Курс платний - ведемо на student-checkout.html
            actionButton = `
                <a href="student-checkout.html?courseId=${courseIdStr}&title=${encodeURIComponent(course.title)}&price=${price}" 
                   class="btn btn-warning w-100 rounded-pill fw-bold py-2 text-white">
                   <i class="bi bi-cart-fill me-1"></i> Придбати за ${price} ₴
                </a>`;
        } else {
            // Курс безкоштовний - звичайна запис
            actionButton = `
                <button onclick="event.stopPropagation(); enrollInCourse('${courseIdStr}')" 
                        class="btn btn-outline-success w-100 rounded-pill fw-bold py-2">
                    Записатися безкоштовно
                </button>`;
        }

        // 1. Визначаємо картинку або заглушку (як на інших сторінках)
        const imageHtml = course.image 
            ? `<img src="${course.image}" class="card-img-top" style="height: 190px; object-fit: cover;">`
            : `<div class="course-fake-img">
                <div class="course-letter">${course.title.charAt(0)}</div>
                <i class="bi bi-book-half bi-book-overlay"></i>
            </div>`;

        // 2. Формуємо HTML картки
        const cardHTML = `
            <div class="col-md-6 col-lg-4 mb-4">
                <div class="card course-card h-100 shadow-sm border-0 stat-card" 
                    onclick="window.location.href='course-view.html?id=${courseIdStr}'"
                    style="cursor: pointer;">
                    <div class="position-relative">
                        ${imageHtml}
                        
                        ${isEnrolled ? `<span class="badge bg-success position-absolute top-0 end-0 m-3 px-3 py-2 rounded-pill shadow-sm" style="font-size: 0.8rem;">Активний</span>` : ''}
                        
                        ${(!isEnrolled && course.price > 0) ? `<span class="badge bg-warning text-dark position-absolute top-0 start-0 m-3 px-3 py-2 rounded-pill shadow-sm" style="font-size: 0.75rem; font-weight: 800;">Premium</span>` : ''}
                    </div>
                    <div class="card-body p-4 d-flex flex-column">
                        <h5 class="fw-bold mb-2" style="color: var(--heading-color);">${course.title}</h5>
                        <p class="small text-muted flex-grow-1 mb-4">${course.description.substring(0, 95)}...</p>
                        <div class="mt-auto">
                            ${actionButton}
                        </div>
                    </div>
                </div>
            </div>`;
        
        container.innerHTML += cardHTML;
    });
}

function setupSearch(allCourses, enrolledIds) {
    const searchInput = document.getElementById('catalogSearch');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            renderCatalog(allCourses, enrolledIds, e.target.value);
        });
    }
}