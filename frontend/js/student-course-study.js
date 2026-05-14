const API_BASE_URL = 'http://localhost:5002/api';
let studyData = null;


/**
 * ПОРІВНЯННЯ ID (Бронебійне)
 * Перетворює будь-який формат ID (String, Object, ObjectId) у рядок для точного порівняння
 */
const compareIds = (id1, id2) => {
    if (!id1 || !id2) return false;
    const s1 = (typeof id1 === 'object' && id1._id) ? id1._id.toString() : id1.toString();
    const s2 = (typeof id2 === 'object' && id2._id) ? id2._id.toString() : id2.toString();
    return s1.trim() === s2.trim();
};

/**
 * ІНІЦІАЛІЗАЦІЯ СТОРІНКИ
 */
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const courseId = urlParams.get('id');
    
    // 1. ДІСТАЄМО ID ПРАВИЛЬНО
    let userId = localStorage.getItem('userId');

    if (!userId || userId === "null") {
        const userRaw = localStorage.getItem('user');
        if (userRaw) {
            try {
                const userData = JSON.parse(userRaw);
                userId = userData._id || userData.id;
                if (userId) localStorage.setItem('userId', userId);
            } catch (e) {
                console.error("Помилка парсингу localStorage.user", e);
            }
        }
    }

    console.log("🛠 Виправлений userId для запиту:", userId);

    if (!courseId) { 
        window.location.href = 'student.html'; 
        return; 
    }

    // 2. ЗАПИТ ДО БАЗИ (Результати + Чернетки)
    window.userResults = [];
    window.activeDrafts = []; // Новий масив для чернеток

    if (userId && userId !== "null") {
        try {
            // Виконуємо два запити одночасно для швидкості
            const [resStats, resDrafts] = await Promise.all([
                fetch(`${API_BASE_URL}/results/user-stats/${userId}`),
                fetch(`${API_BASE_URL}/results/get-drafts/${userId}/${courseId}`)
            ]);

            if (resStats.ok) {
                window.userResults = await resStats.json();
                console.log("✅ Результати отримано:", window.userResults.length);
            }

            if (resDrafts.ok) {
                window.activeDrafts = await resDrafts.json();
                console.log("✅ Чернетки отримано:", window.activeDrafts.length);
                
                // СИНХРОНІЗАЦІЯ: записуємо чернетки з бази в localStorage
                window.activeDrafts.forEach(d => {
                    const draftKey = `draft_${courseId}_sec${d.sectionIdx}`;
                    
                    // ФІКС: якщо юзер уже добив цей тест на 100%, не даємо старій чернетці з бази затерти результат
                    const perfectResult = window.userResults.find(r => 
                        compareIds(r.course, courseId) && 
                        r.sectionIdx === d.sectionIdx && 
                        (r.score / r.total) >= 0.99
                    );

                    if (!perfectResult) {
                        const draftData = { 
                            index: d.currentStep, 
                            results: d.savedAnswers,
                            fromServer: true 
                        };
                        localStorage.setItem(draftKey, JSON.stringify(draftData));
                    } else {
                        // Якщо є 100%, видаляємо чернетку нафіг
                        localStorage.removeItem(draftKey);
                    }
                });
            }
        } catch (e) { 
            console.error("Помилка завантаження прогресу", e); 
        }
    }

    // 3. ЗАВАНТАЖЕННЯ КУРСУ
// 3. ЗАВАНТАЖЕННЯ КУРСУ
    const cachedCourse = localStorage.getItem(`course_cache_${courseId}`);
    if (cachedCourse) {
        studyData = JSON.parse(cachedCourse);
        
        // 🔥 ДОДАНО ДЛЯ МЕСЕНДЖЕРА: ЗБЕРІГАЄМО ID ВЧИТЕЛЯ (АВТОРА КУРСУ) 🔥
        const teacherId = studyData.author?._id || studyData.author || studyData.teacher?._id || studyData.teacher;
        if (teacherId) {
            localStorage.setItem('teacherId', teacherId.toString());
        }
        
        renderDashboard(); 
        fetchCourseData(courseId, true); 
    } else {
        fetchCourseData(courseId, false);
    }
}); // <-- Це закриваюча дужка від DOMContentLoaded

/**
 * ОТРИМАННЯ ДАНИХ КУРСУ З СЕРВЕРА
 */
async function fetchCourseData(courseId, isBackgroundUpdate) {
    try {
        const res = await fetch(`${API_BASE_URL}/courses/full/${courseId}`);
        const newData = await res.json();
        
        if (JSON.stringify(newData) !== JSON.stringify(studyData)) {
            studyData = newData;
            localStorage.setItem(`course_cache_${courseId}`, JSON.stringify(studyData));
            
            // 🔥 ДОДАНО ДЛЯ МЕСЕНДЖЕРА: ЗБЕРІГАЄМО ID ВЧИТЕЛЯ ПРИ ОНОВЛЕННІ З СЕРВЕРА 🔥
            const teacherId = studyData.author?._id || studyData.author || studyData.teacher?._id || studyData.teacher;
            if (teacherId) {
                localStorage.setItem('teacherId', teacherId.toString());
            }

            renderDashboard();
        }
    } catch (err) { 
        console.error("❌ Помилка завантаження курсу:", err);
        hideGlobalLoader();
    }
}


/**
 * ПРИХОВУВАННЯ ЛОАДЕРА
 */
function hideGlobalLoader() {
    const loader = document.getElementById('globalLoader');
    document.body.classList.add('loaded');
    if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => {
            loader.style.display = 'none';
        }, 500);
    }
}

/**
 * ГОЛОВНИЙ ЕКРАН КУРСУ (DASHBOARD)
 */
window.renderDashboard = function() {
    const container = document.getElementById('sectionContent');
    if (!container || !studyData) return;

    const filteredResults = window.userResults ? window.userResults.filter(r => compareIds(r.course, studyData._id)) : [];
    
    // Керуємо кнопкою Назад
    const backBtnText = document.getElementById('backButtonText');
    if (backBtnText) backBtnText.textContent = "ПОВЕРНУТИСЯ ДО КУРСІВ";

    // Логіка системного курсу
    const isSystemCourse = studyData.author?.role === 'admin' || !studyData.author;

    const completedTasksCount = [...new Set(filteredResults.filter(r => (r.score / r.total) >= 0.7).map(r => r.sectionIdx))].length;

    container.innerHTML = `
        <div class="fade-in mb-5 text-center">
            <h1 class="display-4 fw-bold mb-4" style="color: var(--heading-color);">${studyData.title}</h1>
            <img src="${studyData.image || '../img/placeholder.jpg'}" class="dashboard-img shadow-sm mb-5">

            <div class="row g-4 mb-5 justify-content-center">
                <div class="col-md-5"><div class="stat-box shadow-sm p-4 bg-white rounded-4 border-0"><h2 class="fw-bold text-success mb-1">${studyData.sections.length}</h2><small class="text-uppercase fw-bold opacity-50">Всього секцій</small></div></div>
                <div class="col-md-5"><div class="stat-box shadow-sm p-4 bg-white rounded-4 border-0"><h2 class="fw-bold text-success mb-1">${completedTasksCount}</h2><small class="text-uppercase fw-bold opacity-50">Пройдено тем</small></div></div>
            </div>

            <div class="mb-5 shadow-sm rounded-4 overflow-hidden border bg-white text-start">
                <button class="btn w-100 p-4 d-flex justify-content-between align-items-center bg-white border-0 shadow-none" type="button" id="customDescToggle">
                    <span class="fw-bold fs-5 text-dark">
                        <i class="bi bi-info-circle text-success me-2"></i> Про цей курс
                    </span>
                    <i class="bi bi-chevron-down fs-4 text-secondary" id="customDescChevron" style="transition: 0.3s;"></i>
                </button>
                <div id="customDescContent" style="max-height: 0; overflow: hidden; transition: max-height 0.4s ease-out; background-color: #fcfdfc;">
                    <div class="p-4 border-top">
                        <p class="text-secondary mb-0" style="line-height: 1.7; white-space: pre-line;">${studyData.description}</p>
                    </div>
                </div>
            </div>

            <h3 class="fw-bold mb-4 text-start px-2">Програма навчання:</h3>
            <div class="list-group list-group-flush border rounded-4 overflow-hidden shadow-sm mb-5 text-start">
                ${studyData.sections.map((s, i) => {
                    const results = filteredResults.filter(r => r.sectionIdx === i);
                    const bestAttempt = results.length > 0 ? Math.max(...results.map(a => (a.score / a.total) * 100)) : null;
                    const isPassed = bestAttempt >= 70;
                    const isPerfect = bestAttempt >= 99.9;
                    const isUnlocked = i === 0 || filteredResults.some(r => r.sectionIdx === (i - 1) && (r.score / r.total >= 0.7));
                    return `
                        <div class="list-group-item p-4 d-flex justify-content-between align-items-center bg-white ${!isUnlocked ? 'opacity-75' : ''}">
                            <div class="d-flex align-items-center flex-grow-1">
                                <span class="badge ${isPerfect ? 'bg-success text-white' : 'bg-light text-success'} rounded-circle me-3 border" style="width: 40px; height:40px; display: flex; align-items:center; justify-content:center; font-size: 1.1rem;">${isPerfect ? '<i class="bi bi-check-lg"></i>' : i + 1}</span>
                                <div><span class="fw-bold fs-5 d-block text-dark">${s.title}</span>${bestAttempt !== null ? `<small class="fw-bold ${isPassed ? 'text-success' : 'text-danger'}">Результат: ${Math.round(bestAttempt)}%</small>` : ''}</div>
                            </div>
                            <div class="ms-3">
                                ${isUnlocked ? `<button class="btn ${isPerfect ? 'btn-outline-success' : 'btn-success'} rounded-pill px-4 fw-bold shadow-sm" onclick="loadLesson(${i})">${isPerfect ? 'Повторити' : 'Відкрити'}</button>` : `<button class="btn btn-outline-secondary rounded-pill px-4 fw-bold" disabled>Заблоковано</button>`}
                            </div>
                        </div>`;
                }).join('')}
            </div>

            <div class="mt-5 p-4 bg-white rounded-4 border shadow-sm d-flex justify-content-between align-items-center text-start">
                <div class="d-flex align-items-center">
                    <div class="bg-success bg-opacity-10 text-success rounded-circle d-flex align-items-center justify-content-center me-3" style="width: 50px; height: 50px; font-size: 1.5rem;">
                        <i class="bi ${isSystemCourse ? 'bi-headset' : 'bi-chat-dots-fill'}"></i>
                    </div>
                    <div>
                        <h5 class="fw-bold text-dark mb-1">${isSystemCourse ? 'Технічна підтримка' : 'Є запитання по курсу?'}</h5>
                        <p class="text-muted mb-0 small">${isSystemCourse ? 'Це системний курс Lexora. Зверніться до підтримки при виникненні питань.' : 'Ми допоможемо вам розібратися з будь-якими труднощами.'}</p>
                    </div>
                </div>
                ${isSystemCourse ? `
                    <button class="btn btn-outline-success text-dark rounded-pill px-4 fw-bold shadow-sm" onclick="window.location.href='student-messages.html?ticketId=new'">
                        <i class="bi"></i>Створити тікет
                    </button>
                ` : `
                    <button class="btn btn-outline-success rounded-pill px-4 fw-bold shadow-sm" onclick="askTeacherGeneralQuestion()">
                        Написати викладачу
                    </button>
                `}
            </div>
        </div>`;

    // Логіка акордеона
    const toggleBtn = document.getElementById('customDescToggle'), 
          content = document.getElementById('customDescContent'), 
          chevron = document.getElementById('customDescChevron');
          
    if (toggleBtn) toggleBtn.onclick = () => {
        if (content.style.maxHeight === "0px" || !content.style.maxHeight) { 
            content.style.maxHeight = content.scrollHeight + "px"; 
            chevron.style.transform = "rotate(180deg)"; 
        } else { 
            content.style.maxHeight = "0px"; 
            chevron.style.transform = "rotate(0deg)"; 
        }
    };
    hideGlobalLoader();
};

/**
 * ЕКРАН КОНКРЕТНОЇ СЕКЦІЇ
 */
/**
 * ЕКРАН КОНКРЕТНОЇ СЕКЦІЇ
 */
window.loadLesson = function(i) {
    const section = studyData.sections[i];
    const container = document.getElementById('sectionContent');
    if (document.getElementById('backButtonText')) document.getElementById('backButtonText').textContent = "НАЗАД ДО ОГЛЯДУ КУРСУ";

    const isSystemCourse = studyData.author?.role === 'admin' || !studyData.author;
    const filteredResults = window.userResults.filter(r => compareIds(r.course, studyData._id));
    const sectionAttempts = filteredResults.filter(r => r.sectionIdx === i);
    const bestScore = sectionAttempts.length > 0 ? Math.max(...sectionAttempts.map(a => (a.score / a.total) * 100)) : null;

    // 🔥 ТУТ ПОВЕРТАЄМО ЛОГІКУ ПЕРЕВІРКИ ЧЕРНЕТКИ 🔥
    const draftDataStr = localStorage.getItem(`draft_${studyData._id}_sec${i}`);
    const draftData = draftDataStr ? JSON.parse(draftDataStr) : null;
    const isPerfect = bestScore !== null && bestScore >= 99.9;
    
    // Показуємо чернетку, тільки якщо є реальний прогрес (індекс > 0) і тест ще не здано на 100%
    const hasActiveDraft = draftData && draftData.index > 0 && !isPerfect;

    let taskButtonsHtml = '';
    
    if (hasActiveDraft) {
        // ЯКЩО Є ЧЕРНЕТКА — ВИВОДИМО ДВІ КНОПКИ (в твоєму оригінальному стилі)
        taskButtonsHtml = `
            <div class="mt-4 d-flex justify-content-center gap-3">
                <button class="btn btn-warning btn-lg rounded-pill px-5 fw-bold shadow-sm" onclick="startTasks(${i})">Продовжити</button>
                <button class="btn btn-outline-danger btn-lg rounded-pill px-4 fw-bold" onclick="resetAndStart(${i})">Почати заново</button>
            </div>
        `;
    } else {
        // ЯКЩО НЕМАЄ ЧЕРНЕТКИ — ТВОЯ ОРИГІНАЛЬНА КНОПКА
        taskButtonsHtml = `
            <br>
            <button class="btn btn-success btn-lg rounded-pill px-5 fw-bold shadow-sm" onclick="startTasks(${i})">
                ${bestScore !== null ? 'Повторити вправи' : 'Перейти до завдань'} <i class="bi bi-arrow-right ms-2"></i>
            </button>
        `;
    }

    container.innerHTML = `
        <div class="fade-in">
            <h1 class="display-5 fw-bold mb-4" style="color: var(--heading-color);">${section.title}</h1>
            <div class="mb-5 text-secondary" style="font-size: 1.25rem; line-height: 1.8; text-align: justify; white-space: pre-line;">${section.description}</div>
            ${section.image ? `<img src="${section.image}" class="img-fluid rounded-4 shadow-sm w-100 mb-5" style="max-height: 450px; object-fit: cover;">` : ''}

            ${!isSystemCourse ? `
                <div class="p-4 bg-white rounded-4 border shadow-sm d-flex flex-column flex-md-row justify-content-between align-items-center gap-3 mb-5" style="border-left: 5px solid var(--lexora-green) !important;">
                    <div class="d-flex align-items-center">
                        <div class="bg-success bg-opacity-10 text-success rounded-circle d-flex align-items-center justify-content-center me-3" style="width: 50px; height: 50px; font-size: 1.4rem;">
                            <i class="bi bi-chat-quote-fill"></i>
                        </div>
                        <div>
                            <h5 class="fw-bold text-dark mb-1">Щось незрозуміло в теорії?</h5>
                            <p class="text-muted mb-0 small">Напишіть викладачу, щоб уточнити деталі уроку.</p>
                        </div>
                    </div>
                    <button class="btn btn-outline-success rounded-pill px-4 fw-bold shadow-sm" onclick="askTeacherAboutTheory(${i}, '${section.title.replace(/'/g, "\\'")}')">
                        Запитати викладача
                    </button>
                </div>
            ` : `
                <div class="p-4 bg-white rounded-4 border shadow-sm d-flex flex-column flex-md-row justify-content-between align-items-center gap-3 mb-5" style="border-left: 5px solid var(--lexora-green) !important;">
                    <div class="d-flex align-items-center">
                        <div class="bg-success bg-opacity-10 text-success rounded-circle d-flex align-items-center justify-content-center me-3" style="width: 50px; height: 50px; font-size: 1.4rem;">
                            <i class="bi bi-headset"></i>
                        </div>
                        <div>
                            <h5 class="fw-bold text-dark mb-1">Технічна підтримка</h5>
                            <p class="text-muted mb-0 small">Це загальний курс. Маєте питання? Зверніться до адміна.</p>
                        </div>
                    </div>
                    <button class="btn btn-outline-success rounded-pill px-4 fw-bold shadow-sm" onclick="window.location.href='student-messages.html?ticketId=new'">
                        Створити тікет
                    </button>
                </div>
            `}

            <div class="p-5 bg-light rounded-4 border text-center shadow-sm" style="background-color: #fcfdfc !important;">
                <h4 class="fw-bold mb-3"><i class="bi bi-pencil-square text-success me-2"></i>Завдання уроку</h4>
                ${bestScore !== null ? `<div class="mb-4 d-inline-block px-4 py-2 rounded-pill bg-success text-white fw-bold shadow-sm">Найкращий бал: ${Math.round(bestScore)}%</div>` : ''}
                
                ${taskButtonsHtml}
            </div>
            
            <div class="text-center mt-5"><button class="btn btn-link text-success text-decoration-none fw-bold" onclick="renderDashboard()"><i class="bi bi-list-ul me-2"></i> Повернутися до списку тем</button></div>
        </div>`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
};
/**
 * СКИДАННЯ ТА СТАРТ
 */
/**
 * СКИДАННЯ ТА СТАРТ (з видаленням у базі)
 */

window.resetAndStart = async (idx) => { 
    if(confirm("Ви впевнені, що хочете почати тест заново?")) { 
        const urlParams = new URLSearchParams(window.location.search);
        const courseId = urlParams.get('id'); // Отримуємо ID курсу
        const userId = localStorage.getItem('userId');

        // 1. Негайно чистимо локально
        localStorage.removeItem(`draft_${courseId}_sec${idx}`); 

        // 2. Відправляємо запит на видалення
        if (userId && courseId) {
            try {
                const response = await fetch(`${API_BASE_URL}/results/delete-draft/${userId}/${courseId}/${idx}`, {
                    method: 'DELETE'
                });
                
                if (!response.ok) {
                    const errData = await response.json();
                    console.error("Сервер не зміг видалити:", errData);
                } else {
                    console.log("🔥 База очищена");
                }
            } catch (err) {
                console.error("🚨 Помилка мережі:", err);
            }
        }

        // 3. Перехід
        window.startTasks(idx); 
    } 
};

/**
 * ПЕРЕХІД ДО ТАСКІВ
 */
window.startTasks = (idx) => { 
    const courseId = new URLSearchParams(window.location.search).get('id');
    window.location.href = `tasks.html?courseId=${courseId}&section=${idx}`; 
};

/**
 * АВТООНОВЛЕННЯ ПРИ ПОВЕРНЕННІ НА ВКЛАДКУ
 */
window.onfocus = () => { 
    const userId = localStorage.getItem('userId');
    if (!userId) return;
    fetch(`${API_BASE_URL}/results/user-stats/${userId}`)
        .then(res => res.json())
        .then(data => { window.userResults = data; if (studyData) renderDashboard(); }); 
};

window.addEventListener('pageshow', function(event) {
    const userId = localStorage.getItem('userId');
    if (userId && userId !== "null") {
        fetch(`${API_BASE_URL}/results/user-stats/${userId}`)
            .then(res => res.json())
            .then(data => {
                window.userResults = data;
                if (typeof renderDashboard === 'function' && studyData) renderDashboard();
            })
            .catch(err => console.error("Помилка оновлення:", err));
    }
});

async function markCourseAsCompleted(courseId) {
    const userId = localStorage.getItem('userId');
    const userRaw = localStorage.getItem('user');
    if (!userId || !userRaw) return;

    const userObj = JSON.parse(userRaw);
    
    // Перевіряємо, чи курс уже в завершених у локальних даних
    const isAlreadyMarked = userObj.completedCourses && userObj.completedCourses.some(id => compareIds(id, courseId));
    if (isAlreadyMarked) return;

    console.log("🏆 Усі секції пройдено! Фіксуємо завершення курсу в базі...");

    try {
        // ВИПРАВЛЕНО: прибираємо '/api', бо воно вже є в API_BASE_URL
        const response = await fetch(`${API_BASE_URL}/results/complete`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, courseId })
        });

        if (response.ok) {
            const data = await response.json();
            // Оновлюємо дані юзера в локалстореджі
            localStorage.setItem('user', JSON.stringify(data.user));
            console.log("✅ Статус курсу оновлено на 'Завершений'");
        } else {
            console.error("Помилка сервера:", response.status);
        }
    } catch (err) {
        console.error("🚨 Помилка мережі:", err);
    }
}

// ==========================================
// 🔥 ФУНКЦІЯ: ЗАГАЛЬНЕ ПИТАННЯ ПО КУРСУ
// ==========================================
let currentModalContext = null;

// Функція для відкриття модалки (Загальне питання)
window.askTeacherGeneralQuestion = function() {
    document.getElementById('modalMessageText').value = '';
    document.getElementById('contactModalLabel').innerHTML = '<i class="bi"></i> Питання викладачу';
    document.getElementById('modalContextText').textContent = `Курс: ${studyData.title}`;
    currentModalContext = { sectionIdx: -1, taskId: -1, taskTitle: `Загальне питання: ${studyData.title}` };
    new bootstrap.Modal(document.getElementById('contactModal')).show();
};

// Функція для відкриття модалки (Питання по теорії)
// Функція для відкриття модалки саме з УРОКУ (секції)
window.askTeacherAboutTheory = function(sectionIdx, sectionTitle) {
    // 1. Очищуємо поле вводу
    const textarea = document.getElementById('modalMessageText');
    if (textarea) textarea.value = '';

    // 2. Міняємо заголовок та інфо-текст у модалці
    document.getElementById('contactModalLabel').innerHTML = '<i class="bi bi-book-half me-2"></i> Питання по теорії';
    document.getElementById('modalContextText').textContent = `Секція: ${sectionTitle}`;
    
    // 3. Зберігаємо дані для відправки
    currentModalContext = {
        sectionIdx: sectionIdx,
        taskId: -1, // -1 означає теорія
        taskTitle: `Питання по теорії: ${sectionTitle}`,
        studentError: null
    };

    // 4. Показуємо модалку (вона у тебе в HTML має id="contactModal")
    const modalEl = document.getElementById('contactModal');
    const myModal = new bootstrap.Modal(modalEl);
    myModal.show();
};

// ==========================================
// 🔥 ФУНКЦІЯ: ПИТАННЯ ПО ТЕОРІЇ СЕКЦІЇ
// ==========================================
window.askTeacherAboutTheory = function(idx, title) {
    document.getElementById('modalMessageText').value = '';
    document.getElementById('contactModalLabel').innerHTML = '<i class="bi "></i> Питання по теорії';
    document.getElementById('modalContextText').textContent = `Секція: ${title}`;
    currentModalContext = { sectionIdx: idx, taskId: -1, taskTitle: `Питання по теорії: ${title}` };
    new bootstrap.Modal(document.getElementById('contactModal')).show();
};

// Глобальна функція для запиту до AI
async function askAI(taskText, userAnswer, correctAnswer, type, btnElement) {
    // 1. Змінюємо кнопку на "спіннер" (лоадер)
    const originalText = btnElement.innerHTML;
    btnElement.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Аналізую...`;
    btnElement.disabled = true;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/ai/explain`, { // або твій API_BASE_URL + '/ai/explain'
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ taskText, userAnswer, correctAnswer, type })
        });

        const data = await response.json();
        
        if (data.success) {
            // 2. Створюємо красиву картку з відповіддю від ШІ
            const explainBlock = document.createElement('div');
            explainBlock.className = 'alert alert-info mt-3 shadow-sm border-0';
            explainBlock.style.backgroundColor = '#f0fdf4'; // Легкий зеленуватий відтінок
            explainBlock.style.color = '#166534';
            
            // Форматуємо відповідь (замінюємо переноси рядків на <br> та **жирний текст** на <b>)
            let formattedText = data.explanation
                .replace(/\n/g, '<br>')
                .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');

            explainBlock.innerHTML = `
                <div class="d-flex align-items-center mb-2">
                    <span class="fs-4 me-2"></span> 
                    <strong>AI Lexora:</strong>
                </div>
                <div>${formattedText}</div>
            `;
            
            // 3. Вставляємо блок після кнопки та приховуємо саму кнопку
            btnElement.parentNode.insertBefore(explainBlock, btnElement.nextSibling);
            btnElement.style.display = 'none'; 
        } else {
            alert('AI зараз відпочиває. Спробуйте пізніше.');
            btnElement.innerHTML = originalText;
            btnElement.disabled = false;
        }
    } catch (error) {
        console.error(error);
        alert('Помилка мережі.');
        btnElement.innerHTML = originalText;
        btnElement.disabled = false;
    }
}

window.handleBackAction = function(event) {
    if (event) event.preventDefault(); // На всякий випадок зупиняємо стандартну дію

    const backBtnText = document.getElementById('backButtonText')?.textContent;

    // Якщо на кнопці написано "НАЗАД ДО ОГЛЯДУ", значить ми в уроці
    if (backBtnText === "НАЗАД ДО ОГЛЯДУ КУРСУ") {
        console.log("🔙 Повертаємось до огляду курсу (Dashboard)");
        renderDashboard(); // Просто перемальовуємо контент без релоаду
    } else {
        // Якщо написано "ПОВЕРНУТИСЯ ДО КУРСІВ", значить ми на дашборді
        console.log("🏠 Йдемо в загальний кабінет");
        window.location.href = 'student.html';
    }
};

window.submitModalMessage = async function() {
    const text = document.getElementById('modalMessageText').value.trim();
    const btn = document.getElementById('btnModalSend');
    if (!text) return alert("Введіть текст");

    const token = localStorage.getItem('token');
    const teacherId = localStorage.getItem('teacherId');
    const courseId = new URLSearchParams(window.location.search).get('id');

    btn.disabled = true;
    try {
        const res = await fetch(`${API_BASE_URL}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ receiverId: teacherId, courseId, text, context: currentModalContext })
        });
        if (res.ok) {
            bootstrap.Modal.getInstance(document.getElementById('contactModal')).hide();
            if (typeof showToast === 'function') showToast('Успішно', 'Повідомлення надіслано!');
        }
    } catch (e) {} finally { btn.disabled = false; }
};