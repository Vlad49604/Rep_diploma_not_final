const API_BASE_URL = 'http://localhost:5002/api';
let currentCourseData = null;

// --- ДОПОМІЖНІ ФУНКЦІЇ З ОСНОВНОЇ СТОРІНКИ ---
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
            } catch (e) { console.error("Помилка парсингу токена", e); }
        }
    }
    return token;
}

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const courseId = urlParams.get('id');
    const token = getAuthToken();

    if (!courseId) { window.location.href = 'student.html'; return; }

    try {
        const [courseRes, userRes] = await Promise.all([
            fetch(`${API_BASE_URL}/courses/full/${courseId}`),
            fetch(`${API_BASE_URL}/auth/me`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        currentCourseData = await courseRes.json();
        const userData = await userRes.json();

        const enrolledIds = (userData.enrolledCourses || []).map(id => getCleanId(id));
        const isEnrolled = enrolledIds.includes(courseId);

        if (isEnrolled) {
            // Якщо вже записаний — одразу на навчання
            window.location.href = `course-study.html?id=${courseId}`;
        } else {
            setupPreviewMode(); 
        }

    } catch (err) { 
        console.error("Помилка завантаження даних:", err);
        finalizePage();
    }
});

function setupPreviewMode() {
    document.getElementById('mainRow').classList.add('preview-mode');
    const container = document.getElementById('sectionContent');
    const courseIdStr = getCleanId(currentCourseData._id);
    const price = currentCourseData.price || 0;

    // ЛОГІКА КНОПКИ: Платна (Помаранчева) або Безкоштовна (Зелена)
    let actionBtnHtml = '';
    if (price > 0) {
        actionBtnHtml = `
            <a href="student-checkout.html?courseId=${courseIdStr}&title=${encodeURIComponent(currentCourseData.title)}&price=${price}" 
               class="btn btn-buy-paid btn-lg shadow-sm">
                <i class="bi bi-cart-fill me-2"></i> ПРИДБАТИ ЗА ${price} ₴
            </a>`;
    } else {
        actionBtnHtml = `
            <button onclick="enrollFromView('${courseIdStr}')" class="btn btn-enroll-free btn-lg shadow-sm">
                ЗАПИСАТИСЯ БЕЗКОШТОВНО
            </button>`;
    }

    container.innerHTML = `
        <div class="fade-in">
            <div class="text-center mb-5">
                ${price > 0 ? `<span class="badge-premium mb-2"></span>` : ''}
                <h1 class="display-3 fw-bold" style="color: var(--heading-color);">${currentCourseData.title}</h1>
                <hr class="mx-auto" style="width: 80px; height: 4px; background: var(--lexora-green); opacity: 1;">
            </div>

            <div class="px-5 mb-5">
                <img src="${currentCourseData.image || '../img/placeholder.jpg'}" 
                     class="img-fluid rounded-4 shadow-sm" style="width: 100%; max-height: 450px; object-fit: cover;">
            </div>

            <div class="mt-5 px-2">
                <h3 class="fw-bold mb-4">Про цей курс</h3>
                <div class="course-description-text">
                    ${currentCourseData.description.replace(/\n/g, '<br>')}
                </div>
            </div>

            <div class="text-center mt-5">
                ${actionBtnHtml}
            </div>
        </div>
    `;

    finalizePage();
}

async function enrollFromView(courseId) {
    const token = getAuthToken();
    if (!token) return alert("Будь ласка, увійдіть в акаунт.");

    try {
        const res = await fetch(`${API_BASE_URL}/courses/enroll`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ courseId })
        });
        if (res.ok) {
            // Після запису рефрешимо, щоб спрацював редірект на course-study.html
            location.reload();
        } else {
            const data = await res.json();
            alert('Помилка: ' + data.message);
        }
    } catch (err) {
        alert("Сервер не відповідає");
    }
}

function finalizePage() {
    document.body.classList.add('loaded'); 
    document.body.classList.add('ready');
    const loader = document.getElementById('globalLoader');
    if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => { loader.style.display = 'none'; }, 500);
    }
}