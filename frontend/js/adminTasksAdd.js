// --- Елементи керування ---
const courseSelect = document.getElementById("courseSelectTask");
const sectionSelect = document.getElementById("sectionSelectTask");
const taskTypeSelect = document.getElementById("taskType");
const taskExtraFields = document.getElementById("taskExtraFields");
const taskTitleInput = document.getElementById("newTaskTitle");
const taskDescriptionInput = document.getElementById("newTaskDescription");
const addTaskBtn = document.getElementById("addTaskBtn");

// --- Картинка завдання (Твоя логіка) ---
let uploadedTaskImageUrl = ""; 
const taskUploadForm = document.getElementById("taskUploadForm");
const taskFileInput = document.getElementById("taskFile");
const taskResult = document.getElementById("taskResult");
const taskDeleteUrl = document.getElementById("taskDeleteUrl");
const taskDeleteBtn = document.getElementById("taskDeleteBtn");
const newTaskImage = document.getElementById("newTaskImage");

// --- Словник автозаповнення ---
const defaultTitles = {
  multiple: "Вибір правильної відповіді",
  essay: "Розгорнута відповідь",
  gap: "Заповни пропуск",
  matching: "Відповідність",
};

// ==========================================
// 1. ЗАВАНТАЖЕННЯ ТА ВИДАЛЕННЯ ФОТО (Твоя логіка)
// ==========================================
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

taskUploadForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const file = taskFileInput.files[0];
  if (!file) return alert("Оберіть файл!");
  try {
    const url = await uploadImage(file);
    uploadedTaskImageUrl = url;
    newTaskImage.value = url;
    taskResult.innerHTML = `<img src="${url}" width="300" class="mt-2 rounded shadow">`;
    taskDeleteUrl.value = url;
    document.getElementById("taskDeleteContainer").style.display = "block";
  } catch (err) { taskResult.textContent = err.message; }
});

taskDeleteBtn.addEventListener("click", async () => {
  const url = taskDeleteUrl.value;
  if (!url) return;
  try {
    await deleteImage(url);
    taskResult.innerHTML = "";
    taskDeleteUrl.value = "";
    uploadedTaskImageUrl = "";
    newTaskImage.value = "";
    document.getElementById("taskDeleteContainer").style.display = "none";
    taskUploadForm.reset();
  } catch (err) { alert(err.message); }
});

// ==========================================
// 2. СЕЛЕКТОРИ ТА ЗАВАНТАЖЕННЯ ДАНИХ
// ==========================================
async function loadCourses() {
    // Отримуємо всі курси через твою існуючу функцію
    const allCourses = await fetchCourses(); 
    
    // 🔥 Фільтруємо: залишаємо лише ті, де isSystem === true
    const systemCourses = allCourses.filter(c => c.isSystem === true);

    // Очищаємо селекти в усіх формах (для секцій та завдань)
    const selects = [
        document.getElementById("courseSelectSection"),
        document.getElementById("courseSelectTask")
    ];

    selects.forEach(select => {
        if (!select) return;
        select.innerHTML = '<option value="">-- Оберіть системний курс --</option>';
        
        systemCourses.forEach((c) => {
            const opt = document.createElement("option");
            opt.value = c._id;
            opt.textContent = c.title;
            select.appendChild(opt);
        });
    });
}

async function loadSections(courseId) {
  sectionSelect.disabled = true;
  if (!courseId) return;
  try {
    const res = await fetch(`http://localhost:5002/api/courses/${courseId}/sections`);
    const sections = await res.json();
    sectionSelect.innerHTML = sections.map(s => `<option value="${s._id}">${s.title}</option>`).join('');
    sectionSelect.disabled = false;
  } catch (err) { console.error(err); }
}

courseSelect.addEventListener("change", () => loadSections(courseSelect.value));

// ==========================================
// 3. РЕНДЕР ПОЛІВ (Виправлено: дані не зникають)
// ==========================================
function renderTaskExtraFields(type) {
  taskExtraFields.innerHTML = "";
  if (!taskTitleInput.value.trim()) taskTitleInput.value = defaultTitles[type];

  if (type === "multiple") {
    taskExtraFields.innerHTML = `
      <h4>Варіанти відповіді</h4>
      <div id="optionsContainer">
        <div class="option-row mb-2"><input type="text" class="form-control opt-text" placeholder="Варіант 1"></div>
        <div class="option-row mb-2"><input type="text" class="form-control opt-text" placeholder="Варіант 2"></div>
      </div>
      <button type="button" class="btn btn-sm btn-outline-success mb-2" id="addOptionBtn">+ Додати варіант</button>
      <div class="mb-3">
        <label>Індекс правильної відповіді (0, 1, 2...):</label>
        <input type="number" id="correctOptionIndex" class="form-control" value="0" min="0">
      </div>
      <label>Пояснення:</label>
      <textarea id="explanation" class="form-control" placeholder="Пояснення..."></textarea>
    `;
    document.getElementById("addOptionBtn").onclick = () => {
      document.getElementById("optionsContainer").insertAdjacentHTML('beforeend', 
        `<div class="option-row mb-2"><input type="text" class="form-control opt-text" placeholder="Варіант"></div>`);
    };

  } else if (type === "matching") {
    taskExtraFields.innerHTML = `
      <h4>Пари для співставлення</h4>
      <div id="pairsContainer">
        <div class="pair-row d-flex gap-2 mb-2">
          <input type="text" class="form-control pair-left" placeholder="Слово">
          <input type="text" class="form-control pair-right" placeholder="Переклад">
        </div>
      </div>
      <button type="button" class="btn btn-sm btn-outline-success mb-2" id="addPairBtn">+ Додати пару</button>
      <label>Пояснення:</label>
      <textarea id="explanation" class="form-control"></textarea>
    `;
    document.getElementById("addPairBtn").onclick = () => {
      document.getElementById("pairsContainer").insertAdjacentHTML('beforeend', `
        <div class="pair-row d-flex gap-2 mb-2">
          <input type="text" class="form-control pair-left" placeholder="Слово">
          <input type="text" class="form-control pair-right" placeholder="Переклад">
        </div>`);
    };

  } else if (type === "gap") {
    taskExtraFields.innerHTML = `
      <label>Текст із пропуском (___):</label>
      <textarea id="gapText" class="form-control mb-2"></textarea>
      <input type="text" id="gapAnswer" class="form-control mb-2" placeholder="Правильна відповідь">
      <label>Пояснення:</label>
      <textarea id="explanation" class="form-control"></textarea>
    `;
  } else if (type === "essay") {
    taskExtraFields.innerHTML = `<label>Пояснення/Тези:</label><textarea id="explanation" class="form-control"></textarea>`;
  }
}

taskTypeSelect.addEventListener("change", () => renderTaskExtraFields(taskTypeSelect.value));

// ==========================================
// 4. ДОДАВАННЯ ЗАВДАННЯ (Збір усіх даних)
// ==========================================
addTaskBtn.addEventListener("click", async () => {
  const courseId = courseSelect.value;
  const sectionId = sectionSelect.value;
  const type = taskTypeSelect.value;

  if (!courseId || !sectionId) return alert("Оберіть курс та секцію");

  const payload = {
    title: taskTitleInput.value.trim(),
    description: taskDescriptionInput.value.trim(),
    taskType: type,
    image: uploadedTaskImageUrl || newTaskImage.value,
    explanation: document.getElementById("explanation")?.value || ""
  };

  if (type === "multiple") {
    const correctIdx = parseInt(document.getElementById("correctOptionIndex").value);
    payload.options = Array.from(document.querySelectorAll(".opt-text")).map((el, i) => ({
      text: el.value.trim(),
      isCorrect: i === correctIdx
    }));
  } else if (type === "matching") {
    payload.pairs = Array.from(document.querySelectorAll(".pair-row")).map(row => ({
      left: row.querySelector(".pair-left").value.trim(),
      right: row.querySelector(".pair-right").value.trim()
    })).filter(p => p.left && p.right);
  } else if (type === "gap") {
    payload.gapText = document.getElementById("gapText").value;
    payload.gapAnswer = document.getElementById("gapAnswer").value;
  }

  try {
    const res = await fetch(`http://localhost:5002/api/courses/${courseId}/section/${sectionId}/task`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      alert("Завдання додано!");
      location.reload();
    } else {
      const data = await res.json();
      alert(data.error || "Помилка");
    }
  } catch (err) { alert("Помилка сервера"); }
});

// Ініціалізація
loadCourses();
renderTaskExtraFields(taskTypeSelect.value || "multiple");