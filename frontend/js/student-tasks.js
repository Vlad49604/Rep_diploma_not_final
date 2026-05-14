const API_BASE_URL = 'http://localhost:5002/api';

let currentTaskIndex = 0;
let allTasks = [];
let selectedOptionIndex = null;
let userSessionResults = [];
let currentModalContext = null; // Глобальна змінна для контексту повідомлення

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const courseId = urlParams.get('courseId');
    const sectionIdx = urlParams.get('section');

    const cachedData = localStorage.getItem(`course_cache_${courseId}`);
    if (!cachedData || sectionIdx === null) {
        window.location.href = 'student.html';
        return;
    }

    const studyData = JSON.parse(cachedData);
    window.isSystemCourse = studyData.author?.role === 'admin' || !studyData.author;
    const section = studyData.sections[sectionIdx];
    allTasks = section.tasks || [];
    
    document.getElementById('breadcrumbCurrent').innerText = section.title;
    initTaskFrame();
});

// --- ДОПОМІЖНА ФУНКЦІЯ ВИДАЛЕННЯ ЧЕРНЕТКИ З БАЗИ ---
async function deleteDraftFromDB() {
    const urlParams = new URLSearchParams(window.location.search);
    const courseId = urlParams.get('courseId');
    const sectionIdx = urlParams.get('section');
    
    let userId = localStorage.getItem('userId');
    if (!userId || userId === "null") {
        const userRaw = localStorage.getItem('user');
        if (userRaw) userId = JSON.parse(userRaw)._id;
    }

    if (!userId || !courseId) return;

    try {
        await fetch(`${API_BASE_URL}/results/delete-draft/${userId}/${courseId}/${sectionIdx}`, {
            method: 'DELETE'
        });
        console.log("🧹 Чернетку видалено з бази даних");
    } catch (err) {
        console.error("Помилка видалення чернетки:", err);
    }
}

function initTaskFrame() {
    const wrapper = document.getElementById('mainTaskWrapper');
    
    const breadcrumb = document.querySelector('.breadcrumb');
    if (breadcrumb && !document.getElementById('saveExitBtn')) {
        const li = document.createElement('li');
        li.className = 'ms-auto';
        li.innerHTML = `
            <button id="saveExitBtn" onclick="exitAndSave()" class="btn btn-link text-secondary text-decoration-none fw-bold btn-sm">
                <i class="bi bi-pause-circle me-1"></i> Зберегти та вийти
            </button>`;
        breadcrumb.appendChild(li);
    }

    wrapper.innerHTML = `
        <div class="text-center mb-4 fade-in">
            <div class="progress mt-3" style="height: 10px; border-radius: 10px;">
                <div id="progressBar" class="progress-bar bg-success" role="progressbar" style="width: 0%; transition: 0.5s;"></div>
            </div>
            <small class="text-muted mt-2 d-block" id="progressText"></small>
        </div>
        <div id="currentTaskBox" class="fade-in"></div>
        <div id="actionBox" class="mt-4 text-center"></div> 
        <div id="feedbackBox" class="mt-4 fade-in" style="display: none;"></div>
    `;
    
    checkForDraft();
}

function showTask(index) {
    const task = allTasks[index];
    const box = document.getElementById('currentTaskBox');
    const actionBox = document.getElementById('actionBox');
    const feedback = document.getElementById('feedbackBox');
    
    selectedOptionIndex = null;
    feedback.style.display = 'none';
    actionBox.innerHTML = '';

    const progress = (index / allTasks.length) * 100;
    document.getElementById('progressBar').style.width = `${progress}%`;
    document.getElementById('progressText').innerText = `Завдання ${index + 1} з ${allTasks.length}`;

    let content = `<div class="card p-4 shadow-sm border-0 rounded-4 task-card">
        <h4 class="fw-bold mb-3" style="color: var(--heading-color);">${task.title}</h4>
        <p class="text-secondary fs-5 mb-4">${task.description}</p>`;

    if (task.taskType === 'multiple') {
        content += task.options.map((opt, i) => `
            <div class="form-check p-3 border rounded-3 mb-2 ps-5 option-item" id="option_${i}" onclick="selectOption(${i})">
                <label class="form-check-label w-100 fs-5" style="cursor:pointer">${opt.text}</label>
            </div>
        `).join('');
    } 
    else if (task.taskType === 'gap') {
        const sentence = task.gapText.replace('______', '<span class="text-success fw-bold">...</span>');
        content += `
            <div class="p-4 bg-light rounded-4 mb-3 text-center border">
                <p class="fs-4 mb-4 italic">"${sentence}"</p>
                <input type="text" id="gapInput" class="form-control form-control-lg text-center border-success shadow-sm" 
                       placeholder="Введіть відповідь..." oninput="showConfirmButton(this.value)">
            </div>`;
    }
    else if (task.taskType === 'essay') {
        content += `
            <div class="mt-3">
                ${task.image ? `<img src="${task.image}" class="img-fluid rounded-4 mb-3 shadow-sm" style="max-height: 300px; object-fit: cover;">` : ''}
                <textarea id="essayInput" class="form-control border-success rounded-4 p-3 shadow-sm" 
                          rows="5" placeholder="Напишіть вашу відповідь тут..." 
                          oninput="showConfirmButton(this.value)"></textarea>
                <div class="form-text mt-2 text-muted">
                    <i class="bi bi-info-circle me-1"></i> Напишіть розгорнуту відповідь.
                </div>
            </div>`;
    }
    else if (task.taskType === 'matching') {
        const allRights = task.pairs.map(p => p.right);
        const shuffledRights = [...allRights].sort(() => Math.random() - 0.5);
        
        content += `<div class="matching-container p-2">`;
        task.pairs.forEach((pair, i) => {
            content += `
                <div class="row align-items-center mb-3 fade-in">
                    <div class="col-5 p-3 bg-white border rounded-4 fw-bold text-center shadow-sm">${pair.left}</div>
                    <div class="col-1 text-center text-muted"><i class="bi bi-arrow-right fs-4"></i></div>
                    <div class="col-6">
                        <select class="form-select form-select-lg border-success rounded-4 matching-select" 
                                onchange="validateMatchingUniqueness()">
                            <option value="" selected disabled>Оберіть відповідність...</option>
                            ${shuffledRights.map(text => `<option value="${text}">${text}</option>`).join('')}
                        </select>
                    </div>
                </div>`;
        });
        content += `</div>`;
    }

    content += `</div>`;
    box.innerHTML = content;
}

window.selectOption = function(idx) {
    selectedOptionIndex = idx;
    // Візуально виділяємо картку
    document.querySelectorAll('.option-item').forEach(el => el.classList.remove('selected-option'));
    document.getElementById(`option_${idx}`).classList.add('selected-option');
    
    // Показуємо кнопку підтвердження (рядок з радіокнопкою видалено)
    showConfirmButton("ready");
};

window.showConfirmButton = function(val) {
    const actionBox = document.getElementById('actionBox');
    if (val.trim().length > 0) {
        actionBox.innerHTML = `
            <button class="btn btn-success btn-lg rounded-pill px-5 fw-bold shadow fade-in" onclick="confirmAnswer()">
                Підтвердити відповідь <i class="bi "></i>
            </button>`;
    } else {
        actionBox.innerHTML = '';
    }
};

window.confirmAnswer = function() {
    const task = allTasks[currentTaskIndex];
    let isCorrect = false;

    // Змінні для збереження реальних текстів у базу
    let qText = task.title || task.description || `Завдання №${currentTaskIndex + 1}`;
    let uAnswerText = "";
    let cAnswerText = "";
    
    // 🔥 НОВА ЗМІННА: Сюди ми будемо записувати те, що реально вибрав студент
    let rawAnswer = ""; 

    if (task.taskType === 'multiple') {
        if (selectedOptionIndex === null) return; 
        isCorrect = task.options[selectedOptionIndex].isCorrect;
        
        rawAnswer = selectedOptionIndex; // Зберігаємо індекс
        
        // Витягуємо тексти
        uAnswerText = task.options[selectedOptionIndex].text;
        const correctOpt = task.options.find(o => o.isCorrect);
        if (correctOpt) cAnswerText = correctOpt.text;

    } 
    else if (task.taskType === 'gap') {
        const input = document.getElementById('gapInput');
        const userVal = input.value.trim().toLowerCase();
        const correctVal = task.gapAnswer.trim().toLowerCase();
        isCorrect = (userVal === correctVal);
        
        rawAnswer = input.value.trim(); // Зберігаємо введений текст
        
        // Витягуємо тексти
        qText = task.gapText || qText;
        uAnswerText = input.value.trim();
        cAnswerText = task.gapAnswer;
    }
    else if (task.taskType === 'matching') {
        const selects = document.querySelectorAll('.matching-select');
        let correctCount = 0;
        let studentPairs = []; // 🔥 МАСИВ ДЛЯ ЗБЕРЕЖЕННЯ ПАР СТУДЕНТА

        selects.forEach((s, i) => {
            // Зберігаємо те, що вибрав студент (його логічну пару)
            studentPairs.push({
                left: task.pairs[i].left,
                right: s.value
            });

            if (s.value === task.pairs[i].right) {
                s.classList.add('is-valid');
                s.classList.remove('is-invalid');
                correctCount++;
            } else {
                s.classList.add('is-invalid');
                s.classList.remove('is-valid');
            }
        });
        
        isCorrect = (correctCount === task.pairs.length);
        rawAnswer = studentPairs; // 🔥 Зберігаємо масив пар як сиру відповідь!

        if (!isCorrect) {
            const correctPath = task.pairs.map(p => `<li><b>${p.left}</b> → ${p.right}</li>`).join('');
            if (!task.explanation.includes("Правильна послідовність:")) {
                task.explanation += `<div class="mt-3 p-3 bg-white rounded-3 text-dark shadow-sm border-start border-danger border-4">
                    <p class="fw-bold mb-2">Правильна послідовність:</p>
                    <ul class="list-unstyled mb-0 small">${correctPath}</ul>
                </div>`;
            }
        }
        
        uAnswerText = isCorrect ? "Усі пари з'єднано правильно" : "Є помилки в з'єднанні пар";
        cAnswerText = "Правильна логіка в матеріалах уроку";
    }
    else if (task.taskType === 'essay') {
        const essayVal = document.getElementById('essayInput').value.trim();
        isCorrect = essayVal.length > 10;
        task.explanation = isCorrect ? "Вашу відповідь прийнято!" : "Будь ласка, напишіть розгорнуту відповідь.";
        
        rawAnswer = essayVal; // Зберігаємо текст есе
        
        uAnswerText = essayVal;
        cAnswerText = "Перевіряється викладачем";
    }

    // --- НОВИЙ ОБ'ЄКТ РЕЗУЛЬТАТУ (З ТЕКСТАМИ) ---
    const taskResult = {
        taskId: currentTaskIndex,
        isCorrect: isCorrect,
        taskType: task.taskType,
        userAnswer: rawAnswer, // 🔥 ТЕПЕР ТУТ ПРАВИЛЬНІ ДАНІ ДЛЯ КОЖНОГО ТИПУ (індекс, текст або масив)
        // Записуємо готові тексти для історії!
        questionText: qText,
        userAnswerText: uAnswerText,
        correctAnswerText: cAnswerText
    };

    const existingIdx = userSessionResults.findIndex(r => r.taskId === currentTaskIndex);
    if (existingIdx !== -1) userSessionResults[existingIdx] = taskResult;
    else userSessionResults.push(taskResult);

    document.getElementById('actionBox').innerHTML = '';
    disableInputsAfterConfirm(task.taskType);
    renderFeedback(isCorrect, task.explanation);
};


function disableInputsAfterConfirm(type) {
    if (type === 'multiple') document.querySelectorAll('.option-item').forEach(el => el.style.pointerEvents = 'none');
    else if (type === 'gap') document.getElementById('gapInput').disabled = true;
    else if (type === 'matching') document.querySelectorAll('.matching-select').forEach(s => s.disabled = true);
    else if (type === 'essay') document.getElementById('essayInput').disabled = true;
}

function renderFeedback(isCorrect, explanation) {
    const feedback = document.getElementById('feedbackBox');
    feedback.style.display = 'block';
    
    // Дістаємо поточне завдання та результати юзера, щоб передати їх в ШІ
    const task = allTasks[currentTaskIndex];
    const currentResult = userSessionResults[userSessionResults.length - 1];
    
    let extraBtnsHtml = '';
    
    // 🔥 Логіка для кнопок 🔥
    // Показуємо додаткові кнопки, якщо відповідь НЕПРАВИЛЬНА АБО якщо це ЕСЕ
    if (!isCorrect || task.taskType === 'essay') {
        extraBtnsHtml += `
            <div class="mt-3 pt-3 border-top border-opacity-25 d-flex justify-content-between flex-wrap gap-2 ${!isCorrect ? 'border-danger' : 'border-success'}">
        `;

        // Кнопка "Запитати викладача" (показуємо тільки для помилок або есе)
        if (!window.isSystemCourse) {
            extraBtnsHtml += `
                <button class="btn btn-sm rounded-pill fw-bold ${!isCorrect ? 'btn-outline-danger' : 'btn-outline-secondary'}" onclick="askTeacherAboutTask()">
                    <i class="bi"></i> Запитати викладача
                </button>
            `;
        }

        // 🌟 Кнопка ШІ 🌟 (Показуємо для помилок АБО для есе)
        const safeQText = String(currentResult.questionText || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
        const safeUAnswer = String(currentResult.userAnswerText || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
        const safeCAnswer = String(currentResult.correctAnswerText || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
        
        const btnText = task.taskType === 'essay' ? 'Проаналізувати есе з ШІ' : 'Пояснити з ШІ';

        extraBtnsHtml += `
            <button class="btn btn-sm btn-outline-success rounded-pill fw-bold" 
                onclick="askAI('${safeQText}', '${safeUAnswer}', '${safeCAnswer}', '${task.taskType}', this)">
                <i class="bi"></i> ${btnText}
            </button>
        `;
        
        extraBtnsHtml += `</div>`;
    }

    // Формуємо основний блок
    feedback.innerHTML = `
        <div class="alert ${isCorrect ? 'alert-success' : 'alert-danger'} rounded-4 shadow-sm p-4 border-0 mb-5">
            <h4 class="fw-bold">${isCorrect ? '' + (task.taskType === 'essay' ? 'Відповідь збережено' : 'Правильно!') : 'Неправильно...'}</h4>
            <p class="fs-5 mb-3">${explanation || ''}</p>
            <button class="btn ${isCorrect ? 'btn-success' : 'btn-danger'} btn-lg rounded-pill px-5 fw-bold w-100" onclick="nextTask()">
                ${currentTaskIndex === allTasks.length - 1 ? 'Завершити тестування' : 'Йдемо далі'}
            </button>
            ${extraBtnsHtml}
        </div>`;
    
    // Скролимо до фітбеку, щоб юзер побачив кнопки
    setTimeout(() => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }, 100);
}

// ==========================================
// 🔥 ФУНКЦІЯ ДЛЯ ВІДПРАВКИ ПИТАННЯ ВЧИТЕЛЮ
// ==========================================
window.askTeacherAboutTask = async function() {
    const question = prompt("Що саме вам незрозуміло в цьому завданні?");
    
    if (!question || question.trim() === '') return;

    // Дістаємо дані поточного завдання, на якому студент "застряг"
    // Оскільки ми вже викликали confirmAnswer, остання спроба зберігається в userSessionResults
    const currentResult = userSessionResults[userSessionResults.length - 1];
    
    const urlParams = new URLSearchParams(window.location.search);
    const courseId = urlParams.get('courseId');
    const sectionIdx = urlParams.get('section');
    
    const token = localStorage.getItem('token');
    
    // Щоб знайти вчителя (адміна курсу), нам потрібен бекенд, але для простоти 
    // ми можемо відправити повідомлення з courseId, а на бекенді знайти вчителя.
    // Але оскільки твоє API очікує receiverId, ми відправимо пустий receiverId 
    // і покладемо логіку пошуку вчителя на бекенд (якщо він це підтримує), 
    // або просто додамо спеціальний ідентифікатор 'teacher'.
    // Найпростіше: змінити бекенд так, щоб якщо receiverId відсутній, але є courseId, він знаходив автора курсу.

    try {
        const res = await fetch(`${API_BASE_URL}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                // Ми відправляємо ID курсу. Бекенд має сам зрозуміти, кому це (вчителю)
                // Якщо твій бекенд вимагає receiverId, доведеться додати його в localStorage
                // під час завантаження сторінки курсу.
                receiverId: localStorage.getItem('teacherId') || "need_backend_fix", 
                courseId: courseId,
                text: question,
                resultId: null, // Результату в базі ще немає, бо тест не завершено
                context: {
                    sectionIdx: parseInt(sectionIdx, 10),
                    taskId: currentTaskIndex,
                    taskTitle: currentResult.questionText,
                    studentError: currentResult.userAnswerText
                }
            })
        });

        if (res.ok) {
            alert('Ваше запитання надіслано викладачу!');
        } else {
            const data = await res.json();
            alert('Помилка: ' + (data.message || 'Не вдалося надіслати'));
        }
    } catch (err) {
        console.error("Помилка відправки запитання:", err);
        alert("Помилка з'єднання з сервером.");
    }
};

window.nextTask = function() {
    currentTaskIndex++;
    if (currentTaskIndex < allTasks.length) showTask(currentTaskIndex);
    else renderFinish();
}

window.renderFinish = async function() {
    const urlParams = new URLSearchParams(window.location.search);
    const courseId = urlParams.get('courseId');
    const sectionIdx = urlParams.get('section');
    
    // Видаляємо локально
    localStorage.removeItem(`draft_${courseId}_sec${sectionIdx}`);

    // ВИДАЛЯЄМО В БАЗІ
    let userId = localStorage.getItem('userId') || JSON.parse(localStorage.getItem('user'))?._id;
    if (userId && courseId) {
        await fetch(`${API_BASE_URL}/results/delete-draft/${userId}/${courseId}/${sectionIdx}`, {
            method: 'DELETE'
        });
    }

    const score = userSessionResults.filter(r => r.isCorrect).length;
    const total = allTasks.length;

    // --- НОВА ЛОГІКА ОЦІНЮВАННЯ (%) ---
    const percent = Math.round((score / total) * 100);
    const passScore = 70; // Прохідний бал
    
    let resultTitle, resultText, iconClass, colorClass, btnHtml;

    if (percent >= passScore) {
        resultTitle = "Вітаємо! Секцію пройдено!";
        resultText = "Чудова робота! Ви успішно засвоїли цей матеріал.";
        iconClass = "bi bi-trophy-fill text-warning"; // Золотий кубок
        colorClass = "text-success"; // Зелений текст
        btnHtml = `<button class="btn btn-success btn-lg rounded-pill px-5 fw-bold shadow-sm" onclick="history.back()">До списку уроків</button>`;
    } else {
        resultTitle = "Потрібно ще трохи практики";
        resultText = `Для проходження потрібно мінімум ${passScore}%. Не здавайтесь, спробуйте ще раз!`;
        iconClass = "bi bi-exclamation-circle-fill text-danger"; // Червона іконка уваги
        colorClass = "text-danger"; // Червоний текст
        // Якщо не здав, кнопка "Назад" стає сірою, щоб стимулювати натиснути "Спробувати ще раз"
        btnHtml = `<button class="btn btn-outline-secondary btn-lg rounded-pill px-4" onclick="history.back()">Повернутися до курсу</button>`;
    }

    const attemptData = {
        lastAttempt: new Date().toLocaleString(),
        results: userSessionResults,
        score: score,
        total: total,
        percent: percent // Зберігаємо відсоток для бази
    };

    localStorage.setItem(`results_${courseId}_sec${sectionIdx}`, JSON.stringify(attemptData));
    syncResultWithDB(attemptData);

    // Ховаємо дрібні елементи інтерфейсу завдань
    document.getElementById('feedbackBox').style.display = 'none';
    const topProgressBar = document.getElementById('progressBar').parentElement;
    if (topProgressBar) topProgressBar.style.display = 'none';
    document.getElementById('progressText').innerText = '';

    let teacherQuestionBtn = '';
    if (!window.isSystemCourse) {
        teacherQuestionBtn = `
            <div class="mb-4">
                <button class="btn btn-outline-success text-dark btn-sm rounded-pill px-4 fw-bold shadow-sm" onclick="askTeacherAboutSection()">
                    <i class="text-success"></i> Залишились питання по темі?
                </button>
            </div>`;
    }

    // --- МАЛЮЄМО НОВИЙ ФІНАЛЬНИЙ ЕКРАН ---
    // --- МАЛЮЄМО НОВИЙ ФІНАЛЬНИЙ ЕКРАН ---
    document.getElementById('currentTaskBox').innerHTML = `
        <div class="card p-5 text-center border-0 shadow-lg rounded-4 fade-in mt-2">
            <div class="display-1 mb-3"><i class="${iconClass}"></i></div>
            <h2 class="fw-bold ${colorClass}">${resultTitle}</h2>
            
            <div class="my-4">
                <span class="display-3 fw-bold">${percent}%</span>
                <p class="text-secondary mt-2 mb-0">Правильних відповідей: <b>${score}</b> з <b>${total}</b></p>
            </div>
            
            <div class="progress mb-4 w-75 mx-auto shadow-sm" style="height: 15px; border-radius: 10px;">
                <div class="progress-bar ${percent >= passScore ? 'bg-success' : 'bg-danger'} progress-bar-striped progress-bar-animated" 
                     role="progressbar" style="width: ${percent}%"></div>
            </div>

            <p class="fs-5 text-muted mb-4">${resultText}</p>
            
            ${teacherQuestionBtn}
            
            <div class="d-flex gap-3 justify-content-center flex-wrap">
                <button class="btn btn-primary btn-lg rounded-pill px-4" onclick="location.reload()">
                    <i class="bi bi-arrow-repeat"></i> Спробувати ще
                </button>
                ${btnHtml}
            </div>
        </div>`;
} // <--- Це кінець функції renderFinish

// ==========================================
// 🔥 НОВА ФУНКЦІЯ: ЗАГАЛЬНЕ ПИТАННЯ ПО СЕКЦІЇ
// ==========================================
// 🔥 ФУНКЦІЯ: ПИТАННЯ ПО ВСІЙ ТЕМІ (ПІСЛЯ ТЕСТУ)
window.askTeacherAboutSection = function() {
    // 1. Очищуємо поле
    document.getElementById('modalMessageText').value = '';

    // 2. Налаштовуємо заголовки модалки
    const sectionTitle = document.getElementById('breadcrumbCurrent').innerText;
    document.getElementById('contactModalLabel').innerHTML = '<i class="bi  me-2"></i> Питання по темі';
    document.getElementById('modalContextText').textContent = sectionTitle;

    // 3. Формуємо контекст для відправки
    const urlParams = new URLSearchParams(window.location.search);
    currentModalContext = {
        sectionIdx: parseInt(urlParams.get('section'), 10),
        taskId: -1, // -1 означає, що це загальне питання по секції
        taskTitle: `Загальне питання по темі: ${sectionTitle}`,
        studentError: null
    };

    // 4. Відкриваємо модалку
    const contactModal = new bootstrap.Modal(document.getElementById('contactModal'));
    contactModal.show();
};

window.validateMatchingUniqueness = function() {
    const allSelects = document.querySelectorAll('.matching-select');
    allSelects.forEach(currentSelect => {
        const options = currentSelect.querySelectorAll('option');
        options.forEach(option => {
            if (option.value === "") return;
            const isUsedElsewhere = Array.from(allSelects).some(otherSelect => otherSelect !== currentSelect && otherSelect.value === option.value);
            option.disabled = isUsedElsewhere;
        });
    });
    
    const allSelected = Array.from(allSelects).every(s => s.value !== "");
    if (allSelected) showConfirmButton("ready");
};

async function syncResultWithDB(attemptData) {
    const urlParams = new URLSearchParams(window.location.search);
    const courseId = urlParams.get('courseId');
    const sectionIdx = parseInt(urlParams.get('section'));
    let userId = localStorage.getItem('userId');

    if (!userId || userId === "null") {
        const userRaw = localStorage.getItem('user');
        if (userRaw) userId = JSON.parse(userRaw)._id;
    }

    if (!userId) return;

    try {
        await fetch(`${API_BASE_URL}/results/save-result`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user: userId, 
                course: courseId,
                sectionIdx: sectionIdx,
                score: attemptData.score,
                total: attemptData.total,
                answers: attemptData.results
            })
        });
    } catch (err) { console.error("Помилка синхронізації:", err); }
}

window.exitAndSave = function() {
    const urlParams = new URLSearchParams(window.location.search);
    const courseId = urlParams.get('courseId');
    const sectionIdx = urlParams.get('section');
    
    let userId = localStorage.getItem('userId');
    if (!userId || userId === "null") {
        const userRaw = localStorage.getItem('user');
        if (userRaw) userId = JSON.parse(userRaw)._id;
    }

    if (currentTaskIndex === 0 && userSessionResults.length === 0) {
        history.back();
        return;
    }

    const draftData = {
        index: currentTaskIndex,
        results: userSessionResults,
        timestamp: new Date().getTime()
    };

    localStorage.setItem(`draft_${courseId}_sec${sectionIdx}`, JSON.stringify(draftData));
    
    fetch(`${API_BASE_URL}/results/save-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId,
            courseId,
            sectionIdx: parseInt(sectionIdx),
            currentStep: currentTaskIndex,
            savedAnswers: userSessionResults
        })
    }).finally(() => {
        alert("🌿 Прогрес збережено!");
        const urlParams = new URLSearchParams(window.location.search);
        const courseId = urlParams.get('courseId');
        window.location.href = `course-study.html?id=${courseId}`;
    });
};

function checkForDraft() {
    const urlParams = new URLSearchParams(window.location.search);
    const courseId = urlParams.get('courseId');
    const sectionIdx = urlParams.get('section');
    const draftKey = `draft_${courseId}_sec${sectionIdx}`;
    const savedDraft = localStorage.getItem(draftKey);
    
    if (savedDraft) {
        try {
            const draft = JSON.parse(savedDraft);
            currentTaskIndex = draft.index;
            userSessionResults = draft.results;
            console.log("Відновлено з питання:", currentTaskIndex + 1);
        } catch (e) { localStorage.removeItem(draftKey); }
    }
    showTask(currentTaskIndex);
}

// ==========================================
// 🔥 ФУНКЦІЯ ДЛЯ ЗАПИТУ ДО ШІ
// ==========================================
window.askAI = async function(taskText, userAnswer, correctAnswer, type, btnElement) {
    const originalText = btnElement.innerHTML;
    btnElement.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Аналізую...`;
    btnElement.disabled = true;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/ai/explain`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ taskText, userAnswer, correctAnswer, type })
        });

        const data = await response.json();
        
        if (data.success) {
            const explainBlock = document.createElement('div');
            explainBlock.className = 'alert mt-3 shadow-sm border-0 fade-in';
            explainBlock.style.backgroundColor = '#e8f5e9'; 
            explainBlock.style.color = '#1b5e20';
            
            let formattedText = data.explanation
                .replace(/\n/g, '<br>')
                .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');

            explainBlock.innerHTML = `
                <div class="d-flex align-items-center mb-2 pb-2 border-bottom border-success border-opacity-25">
                    <i class="bi bi-robot fs-5 me-2"></i> 
                    <strong>AI Lexora:</strong>
                </div>
                <div style="font-size: 0.95rem;">${formattedText}</div>
            `;
            
            btnElement.parentNode.insertBefore(explainBlock, btnElement.nextSibling);
            btnElement.style.display = 'none'; 
        } else {
            alert('ШІ зараз відпочиває. Спробуйте пізніше.');
            btnElement.innerHTML = originalText;
            btnElement.disabled = false;
        }
    } catch (error) {
        console.error("AI Error:", error);
        alert('Помилка мережі при зверненні до ШІ.');
        btnElement.innerHTML = originalText;
        btnElement.disabled = false;
    }
};

// Функція, яка відкриває модалку (замість prompt)
window.askTeacherAboutTask = function() {
    // 1. Очищуємо поле вводу
    document.getElementById('modalMessageText').value = '';
    
    // 2. Отримуємо контекст поточного завдання
    const currentResult = userSessionResults[userSessionResults.length - 1];
    const taskTitle = currentResult ? currentResult.questionText : "Це завдання";
    
    // 3. Оновлюємо текст контексту в модалці
    document.getElementById('modalContextText').textContent = taskTitle;
    
    // 4. Показуємо модалку
    const contactModal = new bootstrap.Modal(document.getElementById('contactModal'));
    contactModal.show();
};

// Функція відправки повідомлення з модалки
// 🔥 ФУНКЦІЯ ВІДПРАВКИ (Синхронізована з student-course-study.js)
window.submitModalMessage = async function() {
    const text = document.getElementById('modalMessageText').value.trim();
    const btn = document.getElementById('btnModalSend');
    
    // Перевірка на порожній текст (через Toast)
    if (!text) {
        if (typeof showToast === 'function') showToast('Увага', 'Введіть текст вашого запитання.');
        else alert("Введіть текст");
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const courseId = urlParams.get('courseId');
    const token = localStorage.getItem('token');

    // Візуальна зміна кнопки (spinner)
    btn.disabled = true;
    const originalBtnContent = btn.innerHTML;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`;

    try {
        const res = await fetch(`${API_BASE_URL}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                receiverId: localStorage.getItem('teacherId'), 
                courseId: courseId,
                text: text,
                context: currentModalContext // Використовуємо глобальний контекст завдання/секції
            })
        });

        if (res.ok) {
            // 1. Закриваємо модалку
            const modalEl = document.getElementById('contactModal');
            const modalInstance = bootstrap.Modal.getInstance(modalEl);
            if (modalInstance) modalInstance.hide();

            // 2. Очищуємо поле для наступного разу
            document.getElementById('modalMessageText').value = '';

            // 3. Показуємо красивий Toast справа внизу
            if (typeof showToast === 'function') {
                showToast('Успішно', 'Повідомлення надіслано викладачу!');
            }
        } else {
            const data = await res.json();
            if (typeof showToast === 'function') showToast('Помилка', data.message || 'Не вдалося надіслати');
        }
    } catch (err) {
        console.error("Помилка відправки повідомлення:", err);
        if (typeof showToast === 'function') showToast('Помилка', 'Помилка з\'єднання з сервером');
    } finally {
        // Повертаємо кнопку в початковий стан
        btn.disabled = false;
        btn.innerHTML = originalBtnContent;
    }
};