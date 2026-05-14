const API_BASE = "http://localhost:5002/api";
const token = localStorage.getItem('token');

if (!token) window.location.href = '../index.html';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Перемикання форм
    const addTypeSelect = document.getElementById("addTypeSelect");
    addTypeSelect.addEventListener("change", (e) => {
        document.getElementById("sectionForm").style.display = e.target.value === "section" ? "block" : "none";
        document.getElementById("taskForm").style.display = e.target.value === "task" ? "block" : "none";
    });

    // 2. Ініціалізація
    loadTeacherCourses();
    renderTaskExtraFields("multiple");
});

// ==========================================
// 1. ЗАВАНТАЖЕННЯ ДАНИХ ТА СЕЛЕКТІВ
// ==========================================
async function loadTeacherCourses() {
    try {
        const res = await fetch(`${API_BASE}/courses/my-courses`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const courses = await res.json();
        
        const optionsHtml = '<option value="">-- Виберіть курс --</option>' + 
                            courses.map(c => `<option value="${c._id}">${c.title}</option>`).join('');
        
        document.getElementById("courseSelectSection").innerHTML = optionsHtml;
        document.getElementById("courseSelectTask").innerHTML = optionsHtml;
        
        // АВТОМАТИЧНИЙ ВИБІР КУРСУ (якщо прийшли після створення)
        const urlParams = new URLSearchParams(window.location.search);
        const courseIdFromUrl = urlParams.get('courseId');
        if(courseIdFromUrl) {
            document.getElementById("courseSelectSection").value = courseIdFromUrl;
            document.getElementById("courseSelectTask").value = courseIdFromUrl;
            loadSections(courseIdFromUrl); // Відразу вантажимо секції для тасок
            
            // За замовчуванням відкриваємо форму секції, якщо щойно створили курс
            document.getElementById("addTypeSelect").value = "section";
            document.getElementById("sectionForm").style.display = "block";
        }
    } catch (err) { console.error("Помилка завантаження курсів", err); }
}

async function loadSections(courseId) {
    const sectionSelect = document.getElementById("sectionSelectTask");
    sectionSelect.disabled = true;
    sectionSelect.innerHTML = '<option value="">Завантаження...</option>';
    if (!courseId) return;

    try {
        const res = await fetch(`${API_BASE}/courses/${courseId}/sections`);
        const sections = await res.json();
        sectionSelect.innerHTML = '<option value="">-- Виберіть секцію --</option>' + 
                                  sections.map(s => `<option value="${s._id}">${s.title}</option>`).join('');
        sectionSelect.disabled = false;
    } catch (err) { console.error(err); }
}

document.getElementById("courseSelectTask").addEventListener("change", (e) => loadSections(e.target.value));


// ==========================================
// 2. ЗАВАНТАЖЕННЯ ЗОБРАЖЕНЬ
// ==========================================
async function uploadImage(file) {
    const formData = new FormData();
    formData.append("image", file);
    const res = await fetch(`${API_BASE}/image`, { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Помилка");
    return data.url;
}

document.getElementById("sectionUploadBtn").addEventListener("click", async () => {
    const file = document.getElementById("sectionFile").files[0];
    if (!file) return alert("Оберіть файл");
    document.getElementById("sectionResult").innerText = "Завантаження...";
    try {
        const url = await uploadImage(file);
        document.getElementById("newSectionImage").value = url;
        document.getElementById("sectionResult").innerHTML = `<img src="${url}" class="mt-2 shadow-sm" style="max-height:150px;">`;
    } catch (e) { document.getElementById("sectionResult").innerText = e.message; }
});

document.getElementById("taskUploadBtn").addEventListener("click", async () => {
    const file = document.getElementById("taskFile").files[0];
    if (!file) return alert("Оберіть файл");
    document.getElementById("taskResult").innerText = "Завантаження...";
    try {
        const url = await uploadImage(file);
        document.getElementById("newTaskImage").value = url;
        document.getElementById("taskResult").innerHTML = `<img src="${url}" class="mt-2 shadow-sm" style="max-height:150px;">`;
    } catch (e) { document.getElementById("taskResult").innerText = e.message; }
});


// ==========================================
// 3. ДОДАВАННЯ СЕКЦІЇ ТА ЗАВДАНЬ (ТВІЙ КОД)
// ==========================================
document.getElementById("addSectionBtn").addEventListener("click", async () => {
    const courseId = document.getElementById("courseSelectSection").value;
    const title = document.getElementById("newSectionTitle").value.trim();
    const description = document.getElementById("newSectionDescription").value.trim();
    const image = document.getElementById("newSectionImage").value;

    if (!courseId || !title) return alert("Курс і назва обов'язкові!");

    try {
        const res = await fetch(`${API_BASE}/courses/${courseId}/section`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ title, description, image })
        });

        if (res.ok) {
            alert("Секцію успішно додано!");
            document.getElementById("newSectionTitle").value = "";
            document.getElementById("newSectionDescription").value = "";
            document.getElementById("newSectionImage").value = "";
            document.getElementById("sectionResult").innerHTML = "";
            loadSections(courseId); // Оновлюємо список секцій для тасок
        } else {
            alert("Помилка при додаванні");
        }
    } catch (err) { console.error(err); }
});

// -- Логіка завдань --
const taskTypeSelect = document.getElementById("taskType");
const taskExtraFields = document.getElementById("taskExtraFields");
const taskTitleInput = document.getElementById("newTaskTitle");

const defaultTitles = { multiple: "Вибір правильної відповіді", essay: "Розгорнута відповідь", gap: "Заповни пропуск", matching: "Відповідність" };

function renderTaskExtraFields(type) {
    taskExtraFields.innerHTML = "";
    if (!taskTitleInput.value.trim() || Object.values(defaultTitles).includes(taskTitleInput.value)) {
        taskTitleInput.value = defaultTitles[type];
    }

    if (type === "multiple") {
        taskExtraFields.innerHTML = `
            <h5 class="fw-bold">Варіанти відповіді</h5>
            <div id="optionsContainer">
                <div class="mb-2"><input type="text" class="form-control opt-text" placeholder="Варіант 1"></div>
                <div class="mb-2"><input type="text" class="form-control opt-text" placeholder="Варіант 2"></div>
            </div>
            <button type="button" class="btn btn-sm btn-outline-success mb-3" id="addOptionBtn">+ Додати варіант</button>
            <div class="mb-3">
                <label class="fw-bold">Індекс правильної відповіді (0 = перший, 1 = другий...):</label>
                <input type="number" id="correctOptionIndex" class="form-control" value="0" min="0">
            </div>
            <label class="fw-bold">Пояснення (необов'язково):</label>
            <textarea id="explanation" class="form-control"></textarea>
        `;
        document.getElementById("addOptionBtn").onclick = () => document.getElementById("optionsContainer").insertAdjacentHTML('beforeend', `<div class="mb-2"><input type="text" class="form-control opt-text" placeholder="Варіант"></div>`);
    } else if (type === "matching") {
        taskExtraFields.innerHTML = `
            <h5 class="fw-bold">Пари</h5>
            <div id="pairsContainer">
                <div class="d-flex gap-2 mb-2 pair-row"><input type="text" class="form-control pair-left" placeholder="Слово"><input type="text" class="form-control pair-right" placeholder="Переклад"></div>
            </div>
            <button type="button" class="btn btn-sm btn-outline-success mb-3" id="addPairBtn">+ Додати пару</button>
        `;
        document.getElementById("addPairBtn").onclick = () => document.getElementById("pairsContainer").insertAdjacentHTML('beforeend', `<div class="d-flex gap-2 mb-2 pair-row"><input type="text" class="form-control pair-left" placeholder="Слово"><input type="text" class="form-control pair-right" placeholder="Переклад"></div>`);
    } else if (type === "gap") {
        taskExtraFields.innerHTML = `
            <label class="fw-bold">Текст із пропуском (використовуйте ___):</label>
            <textarea id="gapText" class="form-control mb-3"></textarea>
            <label class="fw-bold">Правильна відповідь:</label>
            <input type="text" id="gapAnswer" class="form-control">
        `;
    } else if (type === "essay") {
        taskExtraFields.innerHTML = `<label class="fw-bold">Критерії оцінювання:</label><textarea id="explanation" class="form-control" rows="3"></textarea>`;
    }
}

taskTypeSelect.addEventListener("change", () => renderTaskExtraFields(taskTypeSelect.value));

document.getElementById("addTaskBtn").addEventListener("click", async () => {
    const courseId = document.getElementById("courseSelectTask").value;
    const sectionId = document.getElementById("sectionSelectTask").value;
    const type = taskTypeSelect.value;

    if (!courseId || !sectionId) return alert("Оберіть курс та секцію!");

    const payload = {
        title: taskTitleInput.value.trim(),
        description: document.getElementById("newTaskDescription").value.trim(),
        taskType: type,
        image: document.getElementById("newTaskImage").value,
        explanation: document.getElementById("explanation")?.value || ""
    };

    if (type === "multiple") {
        const correctIdx = parseInt(document.getElementById("correctOptionIndex").value);
        payload.options = Array.from(document.querySelectorAll(".opt-text")).map((el, i) => ({ text: el.value.trim(), isCorrect: i === correctIdx }));
    } else if (type === "matching") {
        payload.pairs = Array.from(document.querySelectorAll(".pair-row")).map(row => ({ left: row.querySelector(".pair-left").value.trim(), right: row.querySelector(".pair-right").value.trim() })).filter(p => p.left && p.right);
    } else if (type === "gap") {
        payload.gapText = document.getElementById("gapText").value;
        payload.gapAnswer = document.getElementById("gapAnswer").value;
    }

    try {
        const res = await fetch(`${API_BASE}/courses/${courseId}/section/${sectionId}/task`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            alert("Завдання успішно додано!");
            taskTitleInput.value = defaultTitles[type];
            document.getElementById("newTaskDescription").value = "";
            renderTaskExtraFields(type);
        } else alert("Помилка при додаванні");
    } catch (err) { alert("Помилка сервера"); }
});