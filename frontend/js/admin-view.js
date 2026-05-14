const API_BASE_URL = 'http://localhost:5002/api/courses';
    const urlParams = new URLSearchParams(window.location.search);
    const courseId = urlParams.get('id');
    let currentCourse = null;

    document.addEventListener('DOMContentLoaded', async () => {
        if (!localStorage.getItem('token') || !courseId) {
            alert("Помилка доступу або не вказано ID курсу");
            window.close();
            return;
        }
        await loadCourseData();
    });

    async function loadCourseData() {
        try {
            const res = await fetch(`${API_BASE_URL}/${courseId}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (!res.ok) throw new Error("Курс не знайдено");
            
            currentCourse = await res.json();
            
            document.getElementById('displayCourseTitle').textContent = currentCourse.title;
            document.getElementById('displayCourseDesc').textContent = currentCourse.description || "Опис відсутній.";
            
// --- ЛОГІКА РОЗРАХУНКУ ДЛЯ АДМІНА ---
        const price = currentCourse.price || 0;
        let fee = 0;
        let teacher = 0;

        if (price === 0) {
            document.getElementById('adminPriceBadge').className = 'd-none'; // Ховаємо якщо безкоштовно
        } else {
            document.getElementById('adminPriceBadge').className = 'mt-3 p-3 rounded-4 bg-white border d-inline-flex align-items-center gap-4 shadow-sm';
            
            if (currentCourse.isSystem) {
                fee = price;
                teacher = 0;
            } else {
                fee = Math.round(price * 0.25);
                if (fee < 50) fee = 50;
                if (fee > price) fee = price; // запобіжник
                teacher = price - fee;
            }

            document.getElementById('adminDisplayPrice').textContent = `${price} ₴`;
            document.getElementById('adminDisplayFee').textContent = `${fee} ₴`;
            document.getElementById('adminDisplayTeacher').textContent = `${teacher} ₴`;
        }

        const authorName = currentCourse.author ? currentCourse.author.name : "Адміністрація (System)";
        document.getElementById('adminDisplayAuthor').textContent = authorName;

            if (currentCourse.image) {
                document.getElementById('displayCourseImage').src = currentCourse.image;
                document.getElementById('courseBannerContainer').style.display = 'flex';
            }

            renderSectionsAccordion();
        } catch (err) {
            console.error(err);
            document.getElementById('sectionsAccordion').innerHTML = `<div class="alert alert-danger text-center">Помилка завантаження контенту курсу.</div>`;
        }
    }

    function renderSectionsAccordion() {
        const container = document.getElementById('sectionsAccordion');
        container.innerHTML = "";

        if (!currentCourse.sections || currentCourse.sections.length === 0) {
            container.innerHTML = `<div class="text-center py-5 bg-white rounded-4 border">Курс порожній.</div>`;
            return;
        }

        currentCourse.sections.forEach((section, index) => {
            const sectionId = section._id?.$oid || section._id; 
            const tasksCount = section.tasks ? section.tasks.length : 0;
            // Просто прибираємо перевірку на індекс. Тепер всі закриті.
            const isExpanded = ''; 
            const isCollapsedBtn = 'collapsed';

            container.innerHTML += `
            <div class="mb-4">
                <div class="accordion-item border-0 shadow-sm rounded-4 overflow-hidden">
                    <div class="accordion-header d-flex align-items-center bg-white pe-3" id="heading${index}">
                        <button class="accordion-button ${isCollapsedBtn} fw-bold py-4 text-dark fs-5" type="button" data-bs-toggle="collapse" data-bs-target="#collapse${index}">
                            <span class="badge bg-success text-white me-3 fs-6">${index + 1}</span>
                            <span class="me-2">${section.title}</span>
                            <span class="badge bg-light text-muted border fw-normal fs-6 ms-2">${tasksCount} вправ</span>
                        </button>
                    </div>

                    <div id="collapse${index}" class="accordion-collapse collapse ${isExpanded}" data-bs-parent="#sectionsAccordion">
                        <div class="accordion-body bg-light-subtle p-4">
                            ${section.image ? `<img src="${section.image}" class="rounded-3 mb-4 shadow-sm" style="max-height: 200px; display: block;">` : ''}
                            
                            <div class="text-dark fs-6 mb-4" style="white-space: pre-wrap; line-height: 1.6;">${(section.description || 'Опис секції відсутній.').trim()}</div>
                            
                            <div class="task-list-container bg-white p-4 rounded-4 shadow-sm border">
                                <h5 class="fw-bold mb-4 pb-3 border-bottom text-dark"><i class="bi bi-list-task me-2 text-success"></i>Список вправ</h5>
                                <div class="list-group list-group-flush overflow-hidden">
                                    ${renderTasksList(section.tasks, sectionId)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
        });
    }

    function renderTasksList(tasks, sectionId) {
        if (!tasks || tasks.length === 0) return `<div class="p-4 text-center bg-light text-muted fs-6 rounded-4">В цій секції немає завдань.</div>`;
        
        const icons = { multiple: 'bi-check2-square', matching: 'bi-grid-3x3-gap', gap: 'bi-textarea-t', essay: 'bi-card-text' };
        let tasksHTML = `<div class="accordion" id="tasksAccordion-${sectionId}">`;

        tasks.forEach((task) => {
            const taskId = task._id?.$oid || task._id;
            const iconClass = icons[task.taskType] || 'bi-journal-text';

            tasksHTML += `
            <div class="mb-3">
                <div class="accordion-item border rounded-4 overflow-hidden shadow-sm">
                    <h2 class="accordion-header bg-white">
                        <button class="accordion-button collapsed py-3 px-4 fw-bold text-dark fs-5" type="button" data-bs-toggle="collapse" data-bs-target="#taskCollapse-${taskId}">
                            <div class="task-icon-circle bg-success-subtle text-success me-3"><i class="bi ${iconClass}"></i></div>
                            ${task.title}
                        </button>
                    </h2>
                    <div id="taskCollapse-${taskId}" class="accordion-collapse collapse" data-bs-parent="#tasksAccordion-${sectionId}">
                        <div class="accordion-body bg-light-subtle p-4 border-top">
                            ${task.image ? `<img src="${task.image}" class="rounded-4 mb-4 d-block shadow-sm" style="max-height: 200px; border: 1px solid rgba(0,0,0,0.05);">` : ''}
                            ${task.description ? `<p class="text-dark mb-4 fw-medium" style="font-size: 1.1rem; line-height: 1.6; white-space: pre-wrap;">${task.description}</p>` : ''}
                            
                            <div class="bg-white p-4 pt-5 rounded-4 shadow-sm border border-success-subtle mb-4 position-relative">
                                <span class="position-absolute top-0 start-0 badge rounded-bottom-4 rounded-top-0 bg-success px-3 py-2 ms-4">Прев'ю завдання</span>
                                ${renderTaskPreviewLogic(task)}
                            </div>
                            
                            ${task.explanation ? `
                            <div class="p-3 bg-white rounded-4 border-start border-4 border-success shadow-sm">
                                <h6 class="fw-bold text-success mb-2"><i class="bi bi-info-circle me-1"></i>Пояснення:</h6>
                                <p class="text-muted mb-0 fst-italic" style="font-size: 1rem;">${task.explanation}</p>
                            </div>` : ''}
                        </div>
                    </div>
                </div>
            </div>`;
        });
        tasksHTML += `</div>`;
        return tasksHTML;
    }

    function renderTaskPreviewLogic(task) {
        if (task.taskType === 'multiple') {
            return `<ul class="list-unstyled mb-0 fs-6" style="line-height: 1.8;">
                ${task.options.map(o => `
                    <li class="mb-2 d-flex align-items-center">
                        <i class="bi ${o.isCorrect ? 'bi-check-circle-fill text-success fs-5' : 'bi-circle text-muted fs-5'} me-3"></i>
                        <span class="${o.isCorrect ? 'fw-bold text-success' : 'text-dark'}">${o.text}</span>
                    </li>
                `).join('')}
            </ul>`;
        } else if (task.taskType === 'gap') {
            return `
                <p class="mb-3 fs-5" style="line-height: 1.6;">${task.gapText.replace('___', '<span class="text-muted border-bottom border-secondary d-inline-block px-3" style="width: 60px;"></span>')}</p>
                <div class="d-inline-flex align-items-center bg-success-subtle px-3 py-2 rounded-3 text-success fw-bold border border-success-subtle">
                    <i class="bi bi-check2-all me-2 fs-5"></i> Правильна відповідь: <span class="ms-2 text-dark bg-white px-2 py-1 rounded shadow-sm">${task.gapAnswer}</span>
                </div>
            `;
        } else if (task.taskType === 'matching') {
            return `<div class="d-flex flex-column gap-2">
                ${task.pairs.map(p => `
                    <div class="d-flex align-items-center bg-light p-2 rounded-3 border shadow-sm">
                        <div class="flex-grow-1 text-center fw-medium">${p.left}</div>
                        <i class="bi bi-arrow-left-right text-muted px-3"></i>
                        <div class="flex-grow-1 text-center fw-bold text-success">${p.right}</div>
                    </div>
                `).join('')}
            </div>`;
        } else if (task.taskType === 'essay') {
            return `<div class="text-center py-3">
                <i class="bi bi-text-paragraph fs-1 text-muted opacity-50 mb-2"></i>
                <p class="mb-0 text-muted fs-6 fst-italic">Студент має надати розгорнуту текстову відповідь у цьому полі.</p>
            </div>`;
        }
        return '';
    }