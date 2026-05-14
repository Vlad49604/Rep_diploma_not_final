let globalCourses = [];

const deleteTypeSelect = document.getElementById('deleteTypeSelect');
const blocks = {
    course: document.getElementById('courseDeleteBlock'),
    section: document.getElementById('sectionDeleteBlock'),
    task: document.getElementById('taskDeleteBlock')
};

deleteTypeSelect.addEventListener('change', () => {
    Object.values(blocks).forEach(b => b.style.display = 'none');
    const type = deleteTypeSelect.value;
    if(type) {
        blocks[type].style.display = 'block';
        updateDeleteSelects();
    }
});

async function fetchCourses() {
    const res = await fetch('http://localhost:5002/api/courses');
    globalCourses = await res.json();
    return globalCourses;
}

// Універсальна функція для рендеру картки інфо
function renderPreview(containerId, data, type) {
    const container = document.getElementById(containerId);
    if (!data) { container.style.display = 'none'; return; }
    
    container.style.display = 'block';
    let extraInfo = '';
    let detailedContent = '';

    if (type === 'course') {
        extraInfo = `
            <div class="info-item mb-2">
                <span class="info-label">Структура:</span>
                <span class="badge bg-success bg-opacity-10 text-success rounded-pill px-3">${data.sections?.length || 0} секцій</span>
            </div>`;
    } 
    else if (type === 'section') {
        extraInfo = `
            <div class="info-item mb-2">
                <span class="info-label">Вміст:</span>
                <span class="badge bg-success bg-opacity-10 text-success rounded-pill px-3">${data.tasks?.length || 0} завдань</span>
            </div>`;
    } 
    else if (type === 'task') {
        extraInfo = `
            <div class="info-item mb-3">
                <span class="info-label">Тип механіки:</span>
                <span class="badge bg-danger bg-opacity-10 text-danger text-uppercase px-3">${data.taskType}</span>
            </div>`;
        
        if (data.taskType === 'multiple') {
            const list = data.options?.map(opt => `
                <div class="d-flex align-items-center mb-2 p-2 rounded ${opt.isCorrect ? 'bg-success bg-opacity-10 border border-success border-opacity-25' : 'bg-white border'}">
                    <i class="bi ${opt.isCorrect ? 'bi-check-circle-fill text-success' : 'bi-circle text-muted'} me-2"></i>
                    <span class="small">${opt.text}</span>
                    ${opt.isCorrect ? '<span class="ms-auto badge bg-success text-white small" style="font-size:0.6rem;">ВІРНО</span>' : ''}
                </div>
            `).join('') || '<div>Варіанти відсутні</div>';
            detailedContent = `<div class="info-label mb-2">Варіанти відповідей:</div><div class="mb-3">${list}</div>`;
        } 
        else if (data.taskType === 'matching') {
            const list = data.pairs?.map(p => `
                <div class="d-flex align-items-center gap-2 mb-2 p-2 bg-white border rounded small">
                    <span class="fw-bold text-success">${p.left}</span>
                    <i class="bi bi-arrow-left-right text-muted mx-1"></i>
                    <span>${p.right}</span>
                </div>
            `).join('') || '<div>Пари відсутні</div>';
            detailedContent = `<div class="info-label mb-2">Логічні пари:</div><div class="mb-3">${list}</div>`;
        } 
        else if (data.taskType === 'gap') {
            detailedContent = `
                <div class="info-label mb-2">Текст із пропуском:</div>
                <div class="p-3 bg-white border rounded-3 mb-3 small shadow-sm italic text-muted">"${data.gapText}"</div>
                <div class="info-label mb-1 text-success">Правильна відповідь:</div>
                <div class="info-value text-success fw-bold border-start border-3 border-success ps-2">${data.gapAnswer}</div>
            `;
        }
        
        if (data.explanation) {
            detailedContent += `
                <div class="mt-3 p-3 bg-light rounded-3 border-start border-3 border-secondary">
                    <div class="info-label mb-1" style="color:#666;"><i class="bi bi-info-circle me-1"></i>Пояснення:</div>
                    <div class="small text-muted italic">${data.explanation}</div>
                </div>`;
        }
    }

    container.innerHTML = `
        <div class="row align-items-start">
            <div class="col-md-4 text-center">
                ${data.image ? `<img src="${data.image}" class="preview-img img-fluid shadow-sm" alt="Прев'ю">` : 
                '<div class="bg-light d-flex flex-column align-items-center justify-content-center rounded-4 border-dashed" style="height:160px; color:#adb5bd;"><i class="bi bi-image fs-1 mb-1"></i><span class="small">Без фото</span></div>'}
            </div>
            <div class="col-md-8 border-start ps-4">
                <div class="info-label">Назва:</div>
                <div class="info-value fw-bold text-dark fs-5">${data.title}</div>
                
                <div class="info-label">Опис / Умова:</div>
                <div class="info-value small text-muted mb-3">${data.description || 'Опис відсутній'}</div>
                
                ${extraInfo}
                <hr class="my-3 opacity-10">
                ${detailedContent}
            </div>
        </div>
    `;
}

function showCourseInfo() {
    const id = document.getElementById('deleteCourseSelect').value;
    const course = globalCourses.find(c => c._id === id);
    renderPreview('coursePreview', course, 'course');
}

function updateSectionSelect() {
    const cId = document.getElementById('deleteCourseSelectSection').value;
    const sSelect = document.getElementById('deleteSectionSelect');
    sSelect.innerHTML = '<option value="">-- Виберіть секцію --</option>';
    
    const course = globalCourses.find(c => c._id === cId);
    if(course?.sections) {
        course.sections.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s._id; opt.textContent = s.title;
            sSelect.appendChild(opt);
        });
    }
    showSectionInfo();
}

function showSectionInfo() {
    const cId = document.getElementById('deleteCourseSelectSection').value;
    const sId = document.getElementById('deleteSectionSelect').value;
    const course = globalCourses.find(c => c._id === cId);
    const section = course?.sections.find(s => s._id === sId);
    renderPreview('sectionPreview', section, 'section');
}

function updateSectionTaskSelect() {
    const cId = document.getElementById('deleteCourseSelectTask').value;
    const sSelect = document.getElementById('deleteSectionSelectTask');
    sSelect.innerHTML = '<option value="">-- Оберіть секцію --</option>';
    
    const course = globalCourses.find(c => c._id === cId);
    if(course?.sections) {
        course.sections.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s._id; opt.textContent = s.title;
            sSelect.appendChild(opt);
        });
    }
    updateTaskSelect();
}

function updateTaskSelect() {
    const cId = document.getElementById('deleteCourseSelectTask').value;
    const sId = document.getElementById('deleteSectionSelectTask').value;
    const tSelect = document.getElementById('deleteTaskSelect');
    tSelect.innerHTML = '<option value="">-- Оберіть завдання --</option>';

    const course = globalCourses.find(c => c._id === cId);
    const section = course?.sections.find(s => s._id === sId);
    if(section?.tasks) {
        section.tasks.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t._id; opt.textContent = t.title;
            tSelect.appendChild(opt);
        });
    }
    showTaskInfo();
}

function showTaskInfo() {
    const cId = document.getElementById('deleteCourseSelectTask').value;
    const sId = document.getElementById('deleteSectionSelectTask').value;
    const tId = document.getElementById('deleteTaskSelect').value;
    const course = globalCourses.find(c => c._id === cId);
    const section = course?.sections.find(s => s._id === sId);
    const task = section?.tasks.find(t => t._id === tId);
    renderPreview('taskPreview', task, 'task');
}

// Слухачі для інфо
document.getElementById('deleteCourseSelect').addEventListener('change', showCourseInfo);
document.getElementById('deleteCourseSelectSection').addEventListener('change', updateSectionSelect);
document.getElementById('deleteSectionSelect').addEventListener('change', showSectionInfo);
document.getElementById('deleteCourseSelectTask').addEventListener('change', updateSectionTaskSelect);
document.getElementById('deleteSectionSelectTask').addEventListener('change', updateTaskSelect);
document.getElementById('deleteTaskSelect').addEventListener('change', showTaskInfo);

// Видалення залишається таким самим...
document.getElementById('deleteCourseBtn').addEventListener('click', async () => {
    const id = document.getElementById('deleteCourseSelect').value;
    if(!id || !confirm('Видалити КУРС і все, що всередині?')) return;
    const res = await fetch(`http://localhost:5002/api/courses/${id}`, { method: 'DELETE' });
    if(res.ok) { alert("Курс видалено"); updateDeleteSelects(); }
});

document.getElementById('deleteSectionBtn').addEventListener('click', async () => {
    const cId = document.getElementById('deleteCourseSelectSection').value;
    const sId = document.getElementById('deleteSectionSelect').value;
    if(!sId || !confirm('Видалити секцію?')) return;
    const res = await fetch(`http://localhost:5002/api/courses/${cId}/section/${sId}`, { method: 'DELETE' });
    if(res.ok) { alert("Секцію видалено"); updateDeleteSelects(); }
});

document.getElementById('deleteTaskBtn').addEventListener('click', async () => {
    const cId = document.getElementById('deleteCourseSelectTask').value;
    const sId = document.getElementById('deleteSectionSelectTask').value;
    const tId = document.getElementById('deleteTaskSelect').value;
    if(!tId || !confirm('Видалити завдання?')) return;
    const res = await fetch(`http://localhost:5002/api/courses/${cId}/section/${sId}/task/${tId}`, { method: 'DELETE' });
    if(res.ok) { alert("Завдання видалено"); updateDeleteSelects(); }
});

let showAllCourses = false; // Початковий стан

// 1. Слухач перемикача
document.getElementById('unlockAllToggle').addEventListener('change', (e) => {
    showAllCourses = e.target.checked;
    updateDeleteSelects(); // Оновлюємо списки при зміні режиму
});

// 2. Оновлена функція заповнення селектів
async function updateDeleteSelects() {
    const allCourses = await fetchCourses();
    
    // 🔥 Фільтруємо: якщо режим "Unlock" вимкнено — лишаємо тільки системні
    const filteredCourses = showAllCourses 
        ? allCourses 
        : allCourses.filter(c => c.isSystem === true);

    const courseSelects = [
        document.getElementById('deleteCourseSelect'),
        document.getElementById('deleteCourseSelectSection'),
        document.getElementById('deleteCourseSelectTask')
    ];

    courseSelects.forEach(s => {
        if(!s) return;
        s.innerHTML = '<option value="">-- Виберіть курс --</option>';
        filteredCourses.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c._id; 
            opt.textContent = `${c.isSystem ? '📗' : '👤'} ${c.title}`; // Додав іконку для наочності
            s.appendChild(opt);
        });
    });

    // Очищаємо прев'ю, щоб не висіло старе інфо при зміні списку
    Object.keys(blocks).forEach(type => {
        const preview = document.getElementById(`${type}Preview`);
        if(preview) preview.innerHTML = '';
    });
}