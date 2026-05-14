const API_BASE_URL = 'http://localhost:5002/api';
let allResults = [];
let doughnutChart = null; 
let radarChart = null; // <--- Додаємо змінну для Радара

// 1. ФУНКЦІЯ ПРОБУДЖЕННЯ (показує контент, ховає лоадер)
function finalizeMonitoringPage() {
    document.body.classList.add('loaded'); 
    const loader = document.getElementById('globalLoader');
    if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => loader.style.display = 'none', 500);
    }
}

// 2. ІНІЦІАЛІЗАЦІЯ ДАНИХ
async function initMonitoring() {
    let userId = localStorage.getItem('userId') || JSON.parse(localStorage.getItem('user'))?._id;
    
    if (!userId) {
        console.error("🚨 ID користувача не знайдено!");
        finalizeMonitoringPage();
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/results/user-stats/${userId}`);
        if (!response.ok) throw new Error("Сервер повернув помилку");

        allResults = await response.json();

        if (allResults.length > 0) {
            populateFilter();
            updateUI('all'); // Завантажуємо всі дані спочатку
            
            // Вішаємо слухач на фільтр
            const filterEl = document.getElementById('courseFilter');
            if (filterEl) {
                filterEl.addEventListener('change', e => updateUI(e.target.value));
            }
        } else {
            console.log("ℹ️ Результатів ще немає");
            document.getElementById('historyCollapse').innerHTML = '<p class="text-center text-muted my-4">У вас ще немає пройдених тестів. Почніть навчання!</p>';
            document.getElementById('historyCollapse').style.display = 'block';
            document.getElementById('toggleHistoryBtn').style.display = 'none';
        }
    } catch (err) {
        console.error("🚨 Помилка завантаження:", err);
    } finally {
        finalizeMonitoringPage();
    }
}

// 3. ДОДАЄМО КУРСИ У ВИПАДНЕ МЕНЮ
function populateFilter() {
    const filter = document.getElementById('courseFilter');
    if (!filter) return;

    // Шукаємо унікальні назви курсів, де студент проходив тести
    const uniqueCourses = [...new Set(allResults.map(r => r.course ? r.course.title : "Видалений курс"))];
    
    filter.innerHTML = '<option value="all">Усі курси разом</option>';
    uniqueCourses.forEach(title => {
        filter.innerHTML += `<option value="${title}">${title}</option>`;
    });
}

// 4. ОНОВЛЕННЯ ІНТЕРФЕЙСУ ПРИ ЗМІНІ ФІЛЬТРА
function updateUI(filterValue = 'all') {
    let currentProgress = 0;
    
    // 1. РОЗРАХУНОК ПРОГРЕСУ ДЛЯ КНОПКИ (СЕРТИФІКАТ VS ЗВІТ)
    if (filterValue !== 'all') {
        const courseData = JSON.parse(localStorage.getItem('user_courses_data')) || [];
        const course = courseData.find(c => c.title === filterValue);
        if (course) {
            const courseIdStr = (course._id?.$oid || course._id).toString();
            const courseResults = allResults.filter(r => (r.course?._id?.$oid || r.course?._id || r.course)?.toString() === courseIdStr);
            const completedSections = new Set(courseResults.map(r => r.sectionIdx)).size;
            const totalSections = course.totalSections || 1; 
            currentProgress = Math.round((completedSections / totalSections) * 100);
        }
    }

    const certBtn = document.querySelector('.stat-box-custom button');
    if (certBtn) {
        if (filterValue === 'all' || currentProgress < 100) {
            certBtn.innerHTML = '<i class="bi bi-file-earmark-pdf me-1"></i> Звіт успішності';
        } else {
            certBtn.innerHTML = '<i class="bi bi-patch-check-fill me-1"></i> Сертифікат';
        }
    }

    // 2. ФІЛЬТРАЦІЯ ДАНИХ ТА РОЗПОДІЛ ПО ЯКОСТІ
    const filteredData = filterValue === 'all' 
        ? allResults 
        : allResults.filter(r => r.course && r.course.title === filterValue);

    const quality = {
        excellent: filteredData.filter(r => (r.score/r.total) >= 0.9).length,
        good: filteredData.filter(r => (r.score/r.total) >= 0.7 && (r.score/r.total) < 0.9).length,
        bad: filteredData.filter(r => (r.score/r.total) < 0.7).length
    };

    document.getElementById('excellentCount').innerText = quality.excellent;
    document.getElementById('goodCount').innerText = quality.good;
    document.getElementById('badCount').innerText = quality.bad;

    // 3. РОЗРАХУНОК ДИНАМІКИ (СТРІЛОЧКА)
    const now = new Date();
    const msInDay = 24 * 60 * 60 * 1000;
    const sevenDaysAgo = new Date(now.getTime() - (7 * msInDay));
    const fourteenDaysAgo = new Date(now.getTime() - (14 * msInDay));

    // Поточний тиждень
    const currentPeriod = filteredData.filter(r => new Date(r.completedAt) >= sevenDaysAgo);
    const currentAvg = currentPeriod.length > 0 
        ? currentPeriod.reduce((acc, r) => acc + (r.score/r.total)*100, 0) / currentPeriod.length 
        : 0;

    // Минулий тиждень
    const previousPeriod = filteredData.filter(r => {
        const d = new Date(r.completedAt);
        return d >= fourteenDaysAgo && d < sevenDaysAgo;
    });
    const previousAvg = previousPeriod.length > 0 
        ? previousPeriod.reduce((acc, r) => acc + (r.score/r.total)*100, 0) / previousPeriod.length 
        : 0;

    const diffElement = document.getElementById('avgDiff');
    if (diffElement) {
        if (currentPeriod.length > 0 && previousPeriod.length > 0) {
            const diff = Math.round(currentAvg - previousAvg);
            diffElement.style.display = 'inline-block';
            
            if (diff > 0) {
                diffElement.className = 'badge rounded-pill bg-white bg-opacity-25 text-white';
                diffElement.innerHTML = `<i class="bi bi-arrow-up-short"></i> +${diff}%`;
            } else if (diff < 0) {
                diffElement.className = 'badge rounded-pill bg-danger bg-opacity-50 text-white';
                diffElement.innerHTML = `<i class="bi bi-arrow-down-short"></i> ${diff}%`;
            } else {
                diffElement.innerHTML = `0%`;
            }
        } else {
            diffElement.style.display = 'none';
        }
    }

    // 4. ЗАГАЛЬНИЙ СЕРЕДНІЙ БАЛ (ЗА ВЕСЬ ЧАС)
    const avgScoreElement = document.getElementById('avgScore');
    if(avgScoreElement) {
        const totalAvg = filteredData.length > 0 
            ? Math.round(filteredData.reduce((acc, r) => acc + (r.score/r.total)*100, 0) / filteredData.length)
            : 0;
        avgScoreElement.innerText = `${totalAvg}%`;
    }

    // 5. ВИКЛИК РЕНДЕРІВ
    renderQualityChart(quality);
    renderTable(filteredData);
    renderCourseCards();
    renderRadarChart(filteredData);
    renderWeeklyTracker();
}

// 5. РЕНДЕР ТАБЛИЦІ ІСТОРІЇ (БЕЗ ЛІМІТУ)
// 5. РЕНДЕР ТАБЛИЦІ ІСТОРІЇ (ТЕПЕР БЕРЕ ГОТОВІ ТЕКСТИ З БАЗИ)
function renderTable(data) {
    const tbody = document.getElementById('statsTable');
    const historyContainer = document.getElementById('historyCollapse'); // Контейнер всієї історії
    const toggleBtn = document.getElementById('toggleHistoryBtn'); // Кнопка "Показати всю історію"
    
    if (!tbody) return;

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">Немає результатів для цього фільтра</td></tr>';
        if (toggleBtn) toggleBtn.style.display = 'none';
        return;
    }

    // ТЕПЕР ПОКАЗУЄМО КОНТЕЙНЕР, БО ДАНІ Є
    if (historyContainer) historyContainer.style.display = 'block';

    const sortedData = [...data].sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

    tbody.innerHTML = sortedData.map((r, index) => {
        const percent = Math.round((r.score / r.total) * 100);
        let colorClass = percent >= 70 ? 'bg-success' : (percent >= 40 ? 'bg-warning' : 'bg-danger');

        // 🔥 ЛОГІКА "ДО 5":
        // Якщо індекс 5 і більше — додаємо клас для приховування та inline style
        const isExtra = index >= 5;
        const rowClass = isExtra ? "expandable-row extra-history-row" : "expandable-row";
        const rowStyle = isExtra ? 'style="display: none;"' : '';

        let detailsHtml = `<div class="p-4 bg-white rounded-4 shadow-sm border mt-2 mb-3 mx-2">
                            <h6 class="fw-bold mb-3" style="color: var(--heading-color);">
                                <i class="bi bi-list-check me-2"></i>Детальний аналіз:
                            </h6>
                            <div class="list-group list-group-flush gap-3">`;

        if (r.answers && r.answers.length > 0) {
            r.answers.forEach(ans => {
                const isOk = ans.isCorrect;
                const typeMap = { 'multiple': 'Тест', 'gap': 'Впишіть слово', 'matching': 'З\'єднання', 'essay': 'Есе' };
                const taskTypeName = typeMap[ans.taskType] || 'Завдання';
                const qText = ans.questionText || `Завдання №${ans.taskId + 1}`;
                const uAnswer = ans.userAnswerText || (typeof ans.userAnswer === 'number' ? `Варіант №${ans.userAnswer + 1}` : ans.userAnswer) || "Немає відповіді";
                const cAnswer = ans.correctAnswerText || "";

                let feedbackBox = isOk 
                    ? `<div class="mt-2 p-2 rounded-3 bg-success-subtle border border-success border-opacity-25 text-success small">
                            <i class="bi bi-check2-circle me-1"></i> Ваша відповідь: <b>${uAnswer}</b>
                       </div>`
                    : `<div class="mt-2 p-2 rounded-3 bg-danger-subtle border border-danger border-opacity-25 text-danger small mb-1">
                            <i class="bi bi-x-circle me-1"></i> Ви відповіли: <b>${uAnswer}</b>
                       </div>`;
                
                if (!isOk && cAnswer && cAnswer !== "Інформація недоступна") {
                    feedbackBox += `<div class="p-2 rounded-3 bg-light border border-secondary border-opacity-25 text-dark small">
                        <i class="bi bi-info-circle text-primary me-1"></i> Правильна відповідь: <b class="text-success">${cAnswer}</b>
                    </div>`;
                }

                if (!isOk || ans.taskType === 'essay') {
                    const safeQText = String(qText).replace(/'/g, "\\'").replace(/"/g, '&quot;');
                    const safeUAnswer = String(uAnswer).replace(/'/g, "\\'").replace(/"/g, '&quot;');
                    const safeCAnswer = String(cAnswer).replace(/'/g, "\\'").replace(/"/g, '&quot;');
                    const btnText = ans.taskType === 'essay' ? 'Проаналізувати есе з ШІ' : 'Пояснити помилку з ШІ';
                    feedbackBox += `<button class="btn btn-sm btn-outline-success mt-2 fw-bold shadow-sm" onclick="askAI('${safeQText}', '${safeUAnswer}', '${safeCAnswer}', '${ans.taskType}', this)"><i class="bi bi-magic text-warning"></i> ${btnText}</button>`;
                }

                const iconClass = isOk ? 'bi-check-circle-fill text-success' : 'bi-x-circle-fill text-danger';
                detailsHtml += `
                    <div class="list-group-item d-flex align-items-start gap-3 border-0 p-0 bg-transparent">
                        <i class="bi ${iconClass} fs-4 mt-1"></i>
                        <div class="w-100 pb-3 border-bottom border-opacity-10">
                            <div class="d-flex justify-content-between align-items-start mb-1">
                                <span class="fw-bold text-dark fs-6 lh-sm">${qText}</span>
                                <span class="badge bg-light text-secondary border ms-2 text-nowrap" style="font-size: 0.65rem;">${taskTypeName}</span>
                            </div>
                            ${feedbackBox}
                        </div>
                    </div>`;
            });
        } else {
            detailsHtml += `<div class="text-center text-muted small py-2">Деталі недоступні для старих спроб.</div>`;
        }
        detailsHtml += `</div></div>`;

        return `
            <tr data-bs-toggle="collapse" data-bs-target="#collapse-${r._id}" aria-expanded="false" class="${rowClass}" ${rowStyle}>
                <td class="fw-bold ps-4 text-dark border-bottom-0">${r.course ? r.course.title : 'Видалений курс'}</td>
                <td class="border-bottom-0">Секція ${r.sectionIdx + 1}</td>
                <td class="text-muted fw-bold border-bottom-0">${r.score} / ${r.total}</td>
                <td class="text-muted small border-bottom-0">${new Date(r.completedAt).toLocaleString()}</td>
                <td class="border-bottom-0">
                    <div class="d-flex align-items-center gap-3">
                        <span class="badge ${colorClass} rounded-pill px-3 py-2">${percent}%</span>
                        <i class="bi bi-chevron-down text-secondary chevron-icon fs-5"></i>
                    </div>
                </td>
            </tr>
            <tr ${rowStyle} class="${isExtra ? 'extra-history-row' : ''}">
                <td colspan="5" class="hidden-row p-0 border-0">
                    <div class="collapse" id="collapse-${r._id}">${detailsHtml}</div>
                </td>
            </tr>`;
    }).join('');

    // 🔥 КЕРУВАННЯ КНОПКОЮ:
    if (toggleBtn) {
        toggleBtn.style.display = sortedData.length > 5 ? 'inline-flex' : 'none';
        toggleBtn.innerHTML = '<i class="bi bi-chevron-down"></i> Показати всю історію';
        toggleBtn.classList.replace('btn-outline-secondary', 'btn-success');
    }
}

// 🔥 ОНОВЛЕНА ФУНКЦІЯ toggleHistory (має бути однаковою всюди)
function toggleHistory() {
    const extraRows = document.querySelectorAll('.extra-history-row');
    const btn = document.getElementById('toggleHistoryBtn');
    if (!extraRows.length) return;

    const isCurrentlyHidden = extraRows[0].style.display === 'none';

    extraRows.forEach(row => {
        row.style.display = isCurrentlyHidden ? 'table-row' : 'none';
    });

    if (btn) {
        btn.innerHTML = isCurrentlyHidden 
            ? '<i class="bi bi-chevron-up"></i> Сховати історію' 
            : '<i class="bi bi-chevron-down"></i> Показати всю історію';
        
        if (isCurrentlyHidden) {
            btn.classList.replace('btn-success', 'btn-outline-secondary');
        } else {
            btn.classList.replace('btn-outline-secondary', 'btn-success');
        }
    }
}

// 6. МАЛЮЄМО ГРАФІК-ПОНЧИК
function renderQualityChart(quality) {
    const ctx = document.getElementById('qualityChart').getContext('2d');
    if (doughnutChart) doughnutChart.destroy();

    doughnutChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Відмінно', 'Добре', 'Потребує уваги'],
            datasets: [{
                data: [quality.excellent, quality.good, quality.bad],
                backgroundColor: ['#2e7d32', '#ffa000', '#d32f2f'],
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            cutout: '75%',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }
        }
    });
}

// 7. МАЛЮЄМО КАРТКИ ПРОГРЕСУ ПО КУРСАХ
// 7. МАЛЮЄМО КАРТКИ ПРОГРЕСУ ПО КУРСАХ
function renderCourseCards() {
    const container = document.getElementById('courseProgressCards');
    if (!container) return;

    const userData = JSON.parse(localStorage.getItem('user'));
    const allAvailableCourses = JSON.parse(localStorage.getItem('user_courses_data'));

    if (!userData || !allAvailableCourses) return;

    // Отримуємо ID записаних та ЗАВЕРШЕНИХ курсів
    const subscribedIds = (userData.enrolledCourses || []).map(item => (item.$oid || item._id || item).toString());
    const completedIds = (userData.completedCourses || []).map(item => (item.$oid || item._id || item).toString());

    // Фільтруємо курси, які або активні, або вже завершені
    const userCourses = allAvailableCourses.filter(c => {
        const id = (c._id?.$oid || c._id).toString();
        return subscribedIds.includes(id) || completedIds.includes(id);
    });

    if (userCourses.length === 0) {
        container.innerHTML = `<div class="col-12 text-center py-5"><p class="text-secondary">Курси не знайдено.</p></div>`;
        return;
    }

    container.innerHTML = userCourses.map(course => {
        const courseIdStr = (course._id?.$oid || course._id).toString();
        
        // ПЕРЕВІРКА СТАТУСУ
        const isCompleted = completedIds.includes(courseIdStr);

        const courseResults = allResults.filter(r => (r.course?._id?.$oid || r.course?._id || r.course)?.toString() === courseIdStr);
        const completedSections = new Set(courseResults.map(r => r.sectionIdx)).size;
        
        let displayTotal = course.totalSections || (courseResults.length > 0 ? Math.max(...courseResults.map(r => r.sectionIdx || 0)) + 1 : 0);
        
        // Якщо курс завершений офіційно — ставимо 100% примусово
        const percent = isCompleted ? 100 : (displayTotal > 0 ? Math.round((completedSections / displayTotal) * 100) : 0);

        return `
            <div class="col-md-6">
                <div class="content-card mb-0 h-100 shadow-sm border-0" style="background: white; border-radius: 25px; padding: 30px;">
                    <div class="d-flex justify-content-between align-items-start mb-3">
                        <div style="max-width: 80%;">
                            <h5 class="fw-bold mb-1">${course.title}</h5>
                            <span class="badge ${isCompleted ? 'bg-success' : 'bg-success-subtle text-success'} rounded-pill px-3 py-2">
                                ${isCompleted ? 'Пройдено' : `${completedSections} з ${displayTotal} тем пройдено`}
                            </span>
                        </div>
                        <div class="course-percent-circle">${percent}%</div>
                    </div>
                    <div class="progress mb-4" style="height: 10px; border-radius: 10px; background: #e8f5e9;">
                        <div class="progress-bar bg-success progress-bar-striped progress-bar-animated" style="width: ${percent}%"></div>
                    </div>
                    <a href="course-study.html?id=${courseIdStr}" class="btn ${isCompleted ? 'btn-outline-success' : 'btn-lexora'} w-100 rounded-pill fw-bold py-2 shadow-sm">
                        ${isCompleted ? 'Повторити' : 'Продовжити навчання'} <i class="bi ${isCompleted ? 'bi-arrow-repeat' : 'bi-arrow-right'} ms-1"></i>
                    </a>
                </div>
            </div>
        `;
    }).join('');
}

// --- МАЛЮЄМО КАРТУ НАВИЧОК (РАДАР) ---
function renderRadarChart(data) {
    // 1. Ініціалізуємо лічильники для кожної навички
    const skills = {
        grammar: { correct: 0, total: 0 },   // Gap Fill
        vocabulary: { correct: 0, total: 0 },// Matching
        reading: { correct: 0, total: 0 },   // Multiple Choice
        writing: { correct: 0, total: 0 }    // Essay
    };

    // 2. Проходимося по всіх відповідях користувача
    data.forEach(attempt => {
        if (attempt.answers && Array.isArray(attempt.answers)) {
            attempt.answers.forEach(ans => {
                const type = ans.taskType;
                const isCorrect = ans.isCorrect;

                if (type === 'gap') {
                    skills.grammar.total++;
                    if (isCorrect) skills.grammar.correct++;
                } else if (type === 'matching') {
                    skills.vocabulary.total++;
                    if (isCorrect) skills.vocabulary.correct++;
                } else if (type === 'multiple') {
                    skills.reading.total++;
                    if (isCorrect) skills.reading.correct++;
                } else if (type === 'essay') {
                    skills.writing.total++;
                    if (isCorrect) skills.writing.correct++;
                }
            });
        }
    });

    // 3. Рахуємо відсотки (щоб уникнути ділення на 0, ставимо 0, якщо тестів ще не було)
    const getPercent = (skill) => skill.total > 0 ? Math.round((skill.correct / skill.total) * 100) : 0;

    const scores = [
        getPercent(skills.grammar),
        getPercent(skills.vocabulary),
        getPercent(skills.reading),
        getPercent(skills.writing)
    ];

    // 4. Малюємо сам графік Chart.js
    const canvas = document.getElementById('skillsRadarChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    if (radarChart) radarChart.destroy(); // Очищаємо старий, якщо фільтр змінився

    radarChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Граматика', 'Словник', 'Читання', 'Письмо'],
            datasets: [{
                label: 'Засвоєно (%)',
                data: scores,
                backgroundColor: 'rgba(46, 125, 50, 0.2)', // Напівпрозорий зелений
                borderColor: '#2e7d32', // Темно-зелений
                pointBackgroundColor: '#1b5e20',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: '#1b5e20',
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
                    pointLabels: {
                        font: { size: 12, weight: 'bold' },
                        color: '#2e7d32'
                    },
                    ticks: {
                        min: 0, max: 100, stepSize: 25,
                        display: false // Ховаємо цифри на самій павутині для краси
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: { label: function(context) { return context.raw + '% правильних'; } }
                }
            }
        }
    });
}

// --- ВІДОБРАЖЕННЯ ДЕТАЛЕЙ СПРОБИ (РОБОТА НАД ПОМИЛКАМИ) ---
window.showAttemptDetails = function(resultId) {
    // Шукаємо результат за його ID
    const attempt = allResults.find(r => r._id === resultId);
    if (!attempt) return;

    const body = document.getElementById('detailsModalBody');
    
    // Шапка модалки з назвою курсу
    let html = `<h6 class="fw-bold mb-4 text-center" style="color: var(--heading-color);">
                  ${attempt.course ? attempt.course.title : 'Курс'} — Тема ${attempt.sectionIdx + 1}
                </h6>`;
    
    html += `<div class="list-group list-group-flush gap-2">`;

    // Перевіряємо, чи є масив відповідей
    if (attempt.answers && attempt.answers.length > 0) {
        attempt.answers.forEach(ans => {
            // Візуальне оформлення залежно від правильності
            const isOk = ans.isCorrect;
            const icon = isOk ? '<i class="bi bi-check-circle-fill text-success fs-4"></i>' : '<i class="bi bi-x-circle-fill text-danger fs-4"></i>';
            const bgClass = isOk ? 'bg-success-subtle border-success' : 'bg-danger-subtle border-danger';
            
            // Назви типів завдань для гарного відображення
            const typeMap = { 'multiple': 'Тест', 'gap': 'Впишіть слово', 'matching': 'З\'єднання', 'essay': 'Есе' };
            const taskTypeName = typeMap[ans.taskType] || 'Завдання';

            // Форматуємо відповідь користувача (якщо вона є)
            let userAnswerHtml = '';
            if (!isOk && ans.userAnswer !== undefined && ans.userAnswer !== null && ans.userAnswer !== "") {
                // Якщо це індекс (для Multiple Choice)
                const answerText = typeof ans.userAnswer === 'number' ? `Варіант №${ans.userAnswer + 1}` : ans.userAnswer;
                userAnswerHtml = `<div class="small text-danger mt-2 bg-white p-2 rounded border border-danger opacity-75">
                                    <i class="bi bi-arrow-return-right"></i> Ваша відповідь: <b>${answerText}</b>
                                  </div>`;
            }

            html += `
                <div class="list-group-item d-flex align-items-start gap-3 border rounded-3 p-3 ${bgClass}" style="border-width: 2px !important;">
                    <div class="mt-1">${icon}</div>
                    <div class="w-100">
                        <div class="d-flex justify-content-between align-items-center mb-1">
                            <span class="fw-bold text-dark">Питання ${ans.taskId + 1}</span>
                            <span class="badge bg-white text-secondary border">${taskTypeName}</span>
                        </div>
                        ${userAnswerHtml}
                    </div>
                </div>
            `;
        });
    } else {
        html += `<div class="text-center text-muted p-4">
                    <i class="bi bi-inbox fs-1 d-block mb-2"></i>
                    Детальна історія питань недоступна для старих спроб.
                 </div>`;
    }

    html += `</div>`;
    body.innerHTML = html;

    // Відкриваємо модалку через вбудований API Bootstrap
    const modal = new bootstrap.Modal(document.getElementById('detailsModal'));
    modal.show();
};

async function downloadCertificate(event) {
    const userData = JSON.parse(localStorage.getItem('user'));
    const userName = userData ? userData.name : "Студент";
    
    const filterSelect = document.getElementById('courseFilter');
    const selectedCourseId = filterSelect.value;
    const selectedCourseName = filterSelect.options[filterSelect.selectedIndex].text;

    // 1. Визначаємо тип документу та прогрес
    let isFullCertificate = false;
    let docTitle = "Learning Progress Report"; // За замовчуванням - звіт
    let statusText = "IN PROGRESS";
    let courseDisplayName = "General English Program";

    if (selectedCourseId !== 'all') {
        courseDisplayName = selectedCourseName;
        
        // Знаходимо картку прогресу цього курсу на сторінці, щоб дізнатися %
        const courseCards = document.querySelectorAll('#courseProgressCards .content-card');
        let coursePercent = 0;
        
        courseCards.forEach(card => {
            if (card.innerText.includes(selectedCourseName)) {
                const percentEl = card.querySelector('.course-percent-circle');
                if (percentEl) coursePercent = parseInt(percentEl.innerText);
            }
        });

        if (coursePercent >= 100) {
            isFullCertificate = true;
            docTitle = "Certificate of Achievement";
            statusText = "COMPLETED";
        } else {
            docTitle = "Course Progress Report";
            statusText = "IN PROGRESS";
        }
    }

    // 2. Заповнюємо шаблон даними
    document.getElementById('cert-user-name').innerText = userName;
    document.getElementById('cert-avg-score').innerText = document.getElementById('avgScore').innerText;
    document.getElementById('cert-course-name').innerText = courseDisplayName;
    document.getElementById('cert-date').innerText = new Date().toLocaleDateString();
    
    // Динамічно змінюємо заголовки в самому шаблоні
    const mainHeading = document.querySelector('#certificate-template h1');
    const statusStamp = document.getElementById('cert-status-stamp');
    
    mainHeading.innerText = docTitle;
    statusStamp.innerText = statusText;
    
    // Колір печатки: червоний для Completed, сірий/синій для In Progress
    statusStamp.parentElement.style.borderColor = isFullCertificate ? "#d32f2f" : "#1976d2";
    statusStamp.parentElement.style.color = isFullCertificate ? "#d32f2f" : "#1976d2";

    // 3. Генерація PDF
    const element = document.getElementById('certificate-template');
    element.style.display = 'block'; 

    const opt = {
        margin: 0,
        filename: isFullCertificate ? `Lexora_Certificate_${selectedCourseName}.pdf` : `Lexora_Report.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'px', format: [1123, 794], orientation: 'landscape' }
    };

    const btn = event.currentTarget;
    const originalBtnContent = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Зачекайте...';

    try {
        await html2pdf().set(opt).from(element).save();
    } finally {
        element.style.display = 'none';
        btn.disabled = false;
        btn.innerHTML = originalBtnContent;
    }
}

// --- ЛОГІКА ТЕПЛОВОЇ КАРТИ (HEATMAP) ---
let currentWeekOffset = 0; // 0 - поточний тиждень, -1 - минулий, і т.д.

function changeWeek(direction) {
    currentWeekOffset += direction;
    renderWeeklyTracker();
}

function renderWeeklyTracker() {
    const grid = document.getElementById('weeklyGrid');
    const rangeLabel = document.getElementById('weekRangeLabel');
    if (!grid) return;

    grid.innerHTML = '';
    
    const activityMap = {};
    allResults.forEach(r => {
        const d = new Date(r.completedAt);
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        activityMap[key] = (activityMap[key] || 0) + 1;
    });

    const now = new Date();
    const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;

    let startDay = new Date();
    const dayOfWeek = startDay.getDay(); 
    const diffToMonday = (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
    startDay.setDate(startDay.getDate() - diffToMonday + (currentWeekOffset * 7));
    
    let totalTasks = 0;
    const daysNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

    // 1. Очищуємо заголовок перед циклом, щоб не було дублювання дат
    if (rangeLabel) rangeLabel.innerText = '';
    let firstDayText = "";
    let lastDayText = "";

    for (let i = 0; i < 7; i++) {
        let tempDate = new Date(startDay);
        tempDate.setDate(startDay.getDate() + i);
        
        const dateKey = `${tempDate.getFullYear()}-${tempDate.getMonth()}-${tempDate.getDate()}`;
        const count = activityMap[dateKey] || 0;
        totalTasks += count;

        let level = 0;
        if (count >= 5) level = 3;
        else if (count >= 2) level = 2;
        else if (count >= 1) level = 1;

        const isToday = (dateKey === todayKey);
        
        const col = document.createElement('div');
        col.className = 'col';
        col.innerHTML = `
            <div class="day-card day-level-${level} ${isToday ? 'active-day shadow-sm' : ''}">
                <div class="day-name">${daysNames[i]}</div>
                <div class="day-date">${tempDate.getDate()}</div>
                <div class="task-count">${count} завдань</div>
            </div>
        `;
        grid.appendChild(col);

        // 2. Збираємо текст для дат
        if (i === 0) firstDayText = tempDate.toLocaleDateString('uk', {day:'numeric', month:'short'});
        if (i === 6) lastDayText = tempDate.toLocaleDateString('uk', {day:'numeric', month:'short'});
    }

    // 3. Виводимо чистий діапазон один раз
    if (rangeLabel) {
        rangeLabel.innerText = `${firstDayText} — ${lastDayText}`;
    }

    document.getElementById('weekTotalTasks').innerText = totalTasks;
}


// Запускаємо логіку після завантаження сторінки
document.addEventListener('DOMContentLoaded', initMonitoring);

// Глобальна функція для запиту до AI
async function askAI(taskText, userAnswer, correctAnswer, type, btnElement) {
    // 1. Змінюємо кнопку на "спіннер" (лоадер)
    const originalText = btnElement.innerHTML;
    btnElement.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Аналізую...`;
    btnElement.disabled = true;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/ai/explain`,  { // або твій API_BASE_URL + '/ai/explain'
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
