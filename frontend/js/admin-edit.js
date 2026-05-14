let uploadedCourseImageUrl = "";
let uploadedSectionImageUrl = "";

// HTML елементи
const editTypeSelect = document.getElementById("editTypeSelect");
const editCourseSelect = document.getElementById("editCourseSelect");
const editSectionSelect = document.getElementById("editSectionSelect");
const editTaskSelect = document.getElementById("editTaskSelect");

const editTitle = document.getElementById("editTitle");
const editDescription = document.getElementById("editDescription");
const editImageUrl = document.getElementById("editImageUrl");
const courseImagePreview = document.getElementById("courseImagePreview");
const uploadForm = document.getElementById("uploadForm");
const imageFile = document.getElementById("imageFile");
const deleteImageBtn = document.getElementById("deleteImageBtn");
const editBtn = document.getElementById("editBtn");

const editSectionTitle = document.getElementById("editSectionTitle");
const editSectionDescription = document.getElementById("editSectionDescription");
const editSectionImageUrl = document.getElementById("editSectionImageUrl");
const sectionImagePreview = document.getElementById("sectionImagePreview");
const sectionUploadForm = document.getElementById("sectionUploadForm");
const sectionFile = document.getElementById("sectionFile");
const sectionDeleteBtn = document.getElementById("sectionDeleteBtn");
const editSectionBtn = document.getElementById("editSectionBtn");

// === Універсальні функції картинки ===
async function uploadImage(file) {
  const formData = new FormData();
  formData.append("image", file);
  const res = await fetch("http://localhost:5002/api/image", { method: "POST", body: formData });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Помилка завантаження");
  return data.url;
}

async function deleteImage(url) {
  const res = await fetch("http://localhost:5002/api/image", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) throw new Error("Помилка видалення");
  return true;
}

// === Курси ===
async function fetchCourses() {
  const res = await fetch('http://localhost:5002/api/courses');
  return await res.json();
}

function clearEditFields() {
  // Ховаємо форми
  document.getElementById("courseEditForm").style.display = 'none';
  document.getElementById("sectionEditForm").style.display = 'none';
  document.getElementById("taskEditBlock").style.display = 'none';

  [editTitle, editDescription, editImageUrl, courseImagePreview, uploadForm, deleteImageBtn, editBtn, document.getElementById("courseUploadZone")].forEach(el => el.style.display='none');
  [editSectionTitle, editSectionDescription, editSectionImageUrl, sectionImagePreview, sectionUploadForm, sectionDeleteBtn, editSectionBtn, document.getElementById("sectionUploadZone")].forEach(el => el.style.display='none');
}

function setEditFields(item) {
  document.getElementById("courseEditForm").style.display = 'block';
  [editTitle, editDescription, editImageUrl, courseImagePreview, uploadForm, deleteImageBtn, editBtn, document.getElementById("courseUploadZone")].forEach(el => el.style.display = 'block');
  
  editTitle.value = item.title || "";
  editDescription.value = item.description || "";
  editImageUrl.value = item.image || "";
  uploadedCourseImageUrl = item.image || "";
  courseImagePreview.src = item.image || "";
  if(!item.image) { courseImagePreview.style.display = 'none'; deleteImageBtn.style.display = 'none'; }
}

function setSectionFields(section){
  if(!section) return;
  document.getElementById("sectionEditForm").style.display = 'block';
  [editSectionTitle, editSectionDescription, editSectionImageUrl, sectionImagePreview, sectionUploadForm, sectionDeleteBtn, editSectionBtn, document.getElementById("sectionUploadZone")].forEach(el=>el.style.display='block');
  
  editSectionTitle.value = section.title || "";
  editSectionDescription.value = section.description || "";
  editSectionImageUrl.value = section.image || "";
  uploadedSectionImageUrl = section.image || "";
  sectionImagePreview.src = section.image || "";
  if(!section.image) { sectionImagePreview.style.display = 'none'; sectionDeleteBtn.style.display = 'none'; }
}

// --- Заповнення select ---
async function populateCourseSelect() {
  const allCourses = await fetchCourses();
  
  // 🔥 Фільтруємо: залишаємо тільки ті, де isSystem === true
  const systemCourses = allCourses.filter(c => c.isSystem === true);

  editCourseSelect.innerHTML = '<option value="">Виберіть курс</option>';
  systemCourses.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c._id; 
    opt.textContent = c.title;
    editCourseSelect.appendChild(opt);
  });
  
  editCourseSelect.style.display = 'block';
  return systemCourses;
}

// --- Події ---
editTypeSelect.addEventListener('change', async ()=>{
  clearEditFields();
  editCourseSelect.style.display='none'; editSectionSelect.style.display='none'; editTaskSelect.style.display='none';
  const type = editTypeSelect.value;
  if(!type) return;
  await populateCourseSelect();
});

editCourseSelect.addEventListener('change', async () => {
  clearEditFields();
  const allCourses = await fetchCourses();
  // Шукаємо серед системних (хоча в селекті й так будуть тільки вони)
  const course = allCourses.find(c => c._id === editCourseSelect.value && c.isSystem === true);
  if (!course) return;

  const type = editTypeSelect.value;
  if (type === 'course') setEditFields(course);
  
  if (type === 'section' || type === 'task') {
    editSectionSelect.innerHTML = '<option value="">Виберіть секцію</option>';
    course.sections.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s._id; 
      opt.textContent = s.title;
      editSectionSelect.appendChild(opt);
    });
    editSectionSelect.style.display = 'block';
  }
});

editSectionSelect.addEventListener('change', async ()=>{
  clearEditFields();
  const courses = await fetchCourses();
  const course = courses.find(c=>c._id===editCourseSelect.value);
  const section = course?.sections.find(s=>s._id===editSectionSelect.value);
  
  if(editTypeSelect.value==='section') setSectionFields(section);
  
  if(editTypeSelect.value==='task' && section){
    editTaskSelect.innerHTML='<option value="">Виберіть завдання</option>';
    section.tasks.forEach(t=>{
      const opt=document.createElement('option');
      opt.value=t._id; opt.textContent=t.title;
      editTaskSelect.appendChild(opt);
    });
    editTaskSelect.style.display='block';
  }
});

// --- Оновлення курс/секція ---
editBtn.addEventListener('click', async ()=>{
  const body = { title: editTitle.value, description: editDescription.value, image: editImageUrl.value };
  const res = await fetch(`http://localhost:5002/api/courses/${editCourseSelect.value}`, {
    method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body)
  });
  if(res.ok) alert("Курс оновлено!");
});

editSectionBtn.addEventListener('click', async ()=>{
  const body = { title: editSectionTitle.value, description: editSectionDescription.value, image: editSectionImageUrl.value };
  const res = await fetch(`http://localhost:5002/api/courses/${editCourseSelect.value}/section/${editSectionSelect.value}`, {
    method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)
  });
  if(res.ok) alert("Секцію оновлено!");
});

// ==========================================
// --- ЛОГІКА ЗАВДАНЬ (РЕДАГУВАННЯ) ---
// ==========================================
const taskEditBlock = document.getElementById("taskEditBlock");
const taskTypeSelect = document.getElementById("taskType");
const taskTitleInput = document.getElementById("taskTitle");
const taskDescriptionInput = document.getElementById("taskDescription");
const taskImageUrlInput = document.getElementById("taskImageUrl");
const taskImagePreview = document.getElementById("taskImagePreview");
const taskExtraFields = document.getElementById("taskExtraFields");
let currentTask = null;

// --- Допоміжні функції для динамічних полів ---

// Додати варіант (Multiple Choice)
window.addOptionRow = function() {
    const container = document.getElementById("optionsContainer");
    const index = container.children.length;
    const div = document.createElement("div");
    div.className = "d-flex gap-2 mb-2 align-items-center option-row";
    div.innerHTML = `
        <input type="radio" name="correct" value="${index}">
        <input type="text" class="form-control task-opt" placeholder="Варіант ${index + 1}">
        <button type="button" class="btn btn-outline-danger btn-sm" onclick="this.parentElement.remove()">×</button>
    `;
    container.appendChild(div);
};

// Додати пару (Matching)
window.addPairRow = function() {
    const container = document.getElementById("pairsContainer");
    const div = document.createElement("div");
    div.className = "d-flex gap-2 mb-2 pair-row";
    div.innerHTML = `
        <input type="text" class="form-control pair-left" placeholder="Ліворуч">
        <input type="text" class="form-control pair-right" placeholder="Праворуч">
        <button type="button" class="btn btn-outline-danger btn-sm" onclick="this.parentElement.remove()">×</button>
    `;
    container.appendChild(div);
};

async function loadTask() {
    const allCourses = await fetchCourses();
    const courseId = editCourseSelect.value;
    const sectionId = editSectionSelect.value;
    const taskId = editTaskSelect.value;

    const course = allCourses.find(c => c._id === courseId && c.isSystem === true);
    const section = course?.sections.find(s => s._id === sectionId);
    const task = section?.tasks.find(t => t._id === taskId);
    
    if (!task) return;

    currentTask = JSON.parse(JSON.stringify(task)); 

    taskTitleInput.value = task.title || "";
    taskDescriptionInput.value = task.description || "";
    taskImageUrlInput.value = task.image || "";
    taskImagePreview.src = task.image || "";
    taskImagePreview.style.display = task.image ? 'block' : 'none';
    document.getElementById("taskDeleteContainer").style.display = task.image ? 'block' : 'none';

    taskTypeSelect.value = task.taskType || "multiple";
    buildTaskFields(taskTypeSelect.value, currentTask);
    taskEditBlock.style.display = 'block';
}

function buildTaskFields(type, task = {}) {
    taskExtraFields.innerHTML = "";
    
    if (type === "multiple") {
        const options = (task.options && task.options.length > 0) 
                        ? task.options 
                        : [{text:'', isCorrect:true}, {text:'', isCorrect:false}];
        
        let html = '<h6>Варіанти відповідей:</h6><div id="optionsContainer" class="mb-3">';
        options.forEach((opt, i) => {
            html += `
                <div class="d-flex gap-2 mb-2 align-items-center option-row">
                    <input type="radio" name="correct" ${opt.isCorrect ? 'checked' : ''}>
                    <input type="text" class="form-control task-opt" value="${opt.text || ''}" placeholder="Варіант ${i+1}">
                    <button type="button" class="btn btn-outline-danger btn-sm" onclick="this.parentElement.remove()">×</button>
                </div>`;
        });
        html += '</div>';
        html += `<button type="button" class="btn btn-sm btn-outline-success mb-3" onclick="addOptionRow()">+ Додати варіант</button>`;
        html += `<div class="mt-2"><label class="form-label">Пояснення (Explanation)</label>
                 <textarea id="explanation" class="form-control" rows="2">${task.explanation || ''}</textarea></div>`;
        taskExtraFields.innerHTML = html;

    } else if (type === "matching") {
        const pairs = (task.pairs && task.pairs.length > 0) ? task.pairs : [{left:'', right:''}];
        
        let html = '<h6>Пари для зіставлення:</h6><div id="pairsContainer" class="mb-3">';
        pairs.forEach(p => {
            html += `
                <div class="d-flex gap-2 mb-2 pair-row">
                    <input type="text" class="form-control pair-left" value="${p.left || ''}" placeholder="Ліворуч">
                    <input type="text" class="form-control pair-right" value="${p.right || ''}" placeholder="Праворуч">
                    <button type="button" class="btn btn-outline-danger btn-sm" onclick="this.parentElement.remove()">×</button>
                </div>`;
        });
        html += '</div>';
        html += `<button type="button" class="btn btn-sm btn-outline-success mb-3" onclick="addPairRow()">+ Додати пару</button>`;
        html += `<div class="mt-2"><label class="form-label">Пояснення</label>
                 <textarea id="explanation" class="form-control" rows="2">${task.explanation || ''}</textarea></div>`;
        taskExtraFields.innerHTML = html;

    } else if (type === "gap") {
        taskExtraFields.innerHTML = `
            <label class="form-label">Текст із пропусками (___)</label>
            <textarea id="gapText" class="form-control mb-2" rows="3">${task.gapText || ''}</textarea>
            <label class="form-label">Правильна відповідь</label>
            <input type="text" id="gapAnswer" class="form-control mb-2" value="${task.gapAnswer || ''}">
            <label class="form-label">Пояснення</label>
            <textarea id="explanation" class="form-control" rows="2">${task.explanation || ''}</textarea>`;
    } else if (type === "essay") {
        taskExtraFields.innerHTML = `
            <p class="text-muted">Для есе студент вводить вільний текст.</p>
            <label class="form-label">Пояснення/Тези</label>
            <textarea id="explanation" class="form-control" rows="3">${task.explanation || ''}</textarea>`;
    }
}

taskTypeSelect.addEventListener('change', () => {
    buildTaskFields(taskTypeSelect.value, currentTask);
});

editTaskSelect.addEventListener('change', loadTask);

document.getElementById("updateTaskBtn").addEventListener('click', async () => {
    const type = taskTypeSelect.value;
    const body = { 
        title: taskTitleInput.value, 
        description: taskDescriptionInput.value, 
        taskType: type, 
        image: taskImageUrlInput.value,
        explanation: document.getElementById("explanation")?.value || ""
    };
    
    if (type === "multiple") {
        const opts = [];
        const rows = document.querySelectorAll(".option-row");
        rows.forEach(row => {
            const text = row.querySelector(".task-opt").value;
            const isCorrect = row.querySelector('input[type="radio"]').checked;
            if(text.trim() !== "") opts.push({ text, isCorrect });
        });
        body.options = opts;
    } else if (type === "gap") {
        body.gapText = document.getElementById("gapText").value;
        body.gapAnswer = document.getElementById("gapAnswer").value;
    } else if (type === "matching") {
        const pairs = [];
        document.querySelectorAll(".pair-row").forEach(row => {
            const left = row.querySelector(".pair-left").value;
            const right = row.querySelector(".pair-right").value;
            if(left && right) pairs.push({ left, right });
        });
        body.pairs = pairs;
    }

    try {
        const res = await fetch(`http://localhost:5002/api/courses/${editCourseSelect.value}/section/${editSectionSelect.value}/task/${editTaskSelect.value}`, {
            method: 'PUT', 
            headers: {'Content-Type':'application/json'}, 
            body: JSON.stringify(body)
        });
        if(res.ok) alert("Завдання оновлено!");
        else alert("Помилка при оновленні");
    } catch (err) {
        alert("Помилка мережі");
    }
});

// ==========================================
// ОБРОБНИКИ ЗАВАНТАЖЕННЯ ТА ВИДАЛЕННЯ ФОТО
// ==========================================

// 1. Завантаження фото для КУРСУ
uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const file = imageFile.files[0];
    if (!file) return alert("Виберіть файл для курсу");

    try {
        const url = await uploadImage(file);
        editImageUrl.value = url;
        courseImagePreview.src = url;
        courseImagePreview.style.display = 'block';
        deleteImageBtn.style.display = 'block';
        alert("Фото курсу завантажено! Тепер натисніть 'Оновити дані', щоб зберегти зміни.");
    } catch (err) {
        alert("Помилка: " + err.message);
    }
});

// 2. Завантаження фото для СЕКЦІЇ
sectionUploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const file = sectionFile.files[0];
    if (!file) return alert("Виберіть файл для секції");

    try {
        const url = await uploadImage(file);
        editSectionImageUrl.value = url;
        sectionImagePreview.src = url;
        sectionImagePreview.style.display = 'block';
        sectionDeleteBtn.style.display = 'block';
        alert("Фото секції завантажено! Тепер натисніть 'Оновити секцію'.");
    } catch (err) {
        alert("Помилка: " + err.message);
    }
});

// 3. Завантаження фото для ЗАВДАННЯ
const taskUploadForm = document.getElementById("taskUploadForm");
taskUploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const file = document.getElementById("taskFile").files[0];
    if (!file) return alert("Виберіть файл для завдання");

    try {
        const url = await uploadImage(file);
        taskImageUrlInput.value = url;
        taskImagePreview.src = url;
        taskImagePreview.style.display = 'block';
        document.getElementById("taskDeleteContainer").style.display = 'block';
        alert("Фото завдання завантажено!");
    } catch (err) {
        alert("Помилка: " + err.message);
    }
});

// 4. Логіка видалення (щоб кнопки "Видалити фото" теж працювали)
deleteImageBtn.addEventListener('click', () => {
    if (confirm("Видалити прев'ю? (Зміни наберуть сили після оновлення)")) {
        editImageUrl.value = "";
        courseImagePreview.style.display = 'none';
        deleteImageBtn.style.display = 'none';
    }
});

sectionDeleteBtn.addEventListener('click', () => {
    if (confirm("Видалити прев'ю секції?")) {
        editSectionImageUrl.value = "";
        sectionImagePreview.style.display = 'none';
        sectionDeleteBtn.style.display = 'none';
    }
});

// Запуск
populateCourseSelect();