// === Завантаження курсів для селектів ===
async function fetchCourses() {
  const res = await fetch('http://localhost:5002/api/courses');
  return await res.json();
}

async function loadUploadCourses() {
  const courses = await fetchCourses();
  const courseSelect = document.getElementById('uploadCourseSelect');
  courseSelect.innerHTML = '<option value="">-- Оберіть курс --</option>';
  courses.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c._id;
    opt.textContent = c.title;
    courseSelect.appendChild(opt);
  });

  // Скидаємо селекти секцій і завдань
  const sectionSelect = document.getElementById('uploadSectionSelect');
  const taskSelect = document.getElementById('uploadTaskSelect');
  sectionSelect.innerHTML = '<option value="">-- Спочатку виберіть курс --</option>';
  taskSelect.innerHTML = '<option value="">-- Спочатку виберіть секцію --</option>';
  sectionSelect.disabled = true;
  taskSelect.disabled = true;
}

// === Зміна типу об'єкта (course/section/task) ===
document.getElementById('uploadType').addEventListener('change', () => {
  const type = document.getElementById('uploadType').value;
  const sectionSelect = document.getElementById('uploadSectionSelect');
  const taskSelect = document.getElementById('uploadTaskSelect');

  if (type === 'course') {
    sectionSelect.disabled = true;
    taskSelect.disabled = true;
  } else if (type === 'section') {
    sectionSelect.disabled = false;
    taskSelect.disabled = true;
  } else if (type === 'task') {
    sectionSelect.disabled = false;
    taskSelect.disabled = false;
  }

  // Очистка попередніх значень
  sectionSelect.innerHTML = '<option value="">-- Спочатку виберіть курс --</option>';
  taskSelect.innerHTML = '<option value="">-- Спочатку виберіть секцію --</option>';
});

// === Завантаження секцій при виборі курсу ===
document.getElementById('uploadCourseSelect').addEventListener('change', async (e) => {
  const courseId = e.target.value;
  const sectionSelect = document.getElementById('uploadSectionSelect');
  const taskSelect = document.getElementById('uploadTaskSelect');
  const type = document.getElementById('uploadType').value;

  sectionSelect.innerHTML = '<option>Завантаження...</option>';
  taskSelect.innerHTML = '<option value="">-- Спочатку виберіть секцію --</option>';

  if (!courseId) {
    sectionSelect.innerHTML = '<option value="">-- Спочатку виберіть курс --</option>';
    return;
  }

  try {
    const res = await fetch(`http://localhost:5002/api/courses/${courseId}/sections`);
    const sections = await res.json();
    sectionSelect.innerHTML = '<option value="">-- Оберіть секцію --</option>';
    sections.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s._id;
      opt.textContent = s.title;
      sectionSelect.appendChild(opt);
    });
    sectionSelect.disabled = (type === 'course');
    taskSelect.disabled = (type !== 'task');
  } catch (err) {
    console.error(err);
    sectionSelect.innerHTML = '<option value="">(Помилка завантаження)</option>';
  }
});

// === Завантаження завдань при виборі секції ===
document.getElementById('uploadSectionSelect').addEventListener('change', async (e) => {
  const courseId = document.getElementById('uploadCourseSelect').value;
  const sectionId = e.target.value;
  const taskSelect = document.getElementById('uploadTaskSelect');
  const type = document.getElementById('uploadType').value;

  if (type !== 'task') return;

  taskSelect.innerHTML = '<option>Завантаження...</option>';
  if (!sectionId) {
    taskSelect.innerHTML = '<option value="">-- Спочатку виберіть секцію --</option>';
    return;
  }

  try {
    const res = await fetch(`http://localhost:5002/api/courses/${courseId}/sections`);
    const sections = await res.json();
    const section = sections.find(s => s._id === sectionId);
    taskSelect.innerHTML = '<option value="">-- Оберіть завдання --</option>';
    section.tasks.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t._id;
      opt.textContent = t.title;
      taskSelect.appendChild(opt);
    });
    taskSelect.disabled = false;
  } catch (err) {
    console.error(err);
    taskSelect.innerHTML = '<option value="">(Помилка завантаження)</option>';
  }
});

// === Завантаження файлу ===
document.getElementById('uploadFileBtn').addEventListener('click', async () => {
  const type = document.getElementById('uploadType').value;
  const courseId = document.getElementById('uploadCourseSelect').value;
  const sectionId = document.getElementById('uploadSectionSelect').value;
  const taskId = document.getElementById('uploadTaskSelect').value;

  if (!courseId) return alert('Оберіть курс');

  const formData = new FormData();
  const fileInput = document.getElementById('uploadFileInput');
  const audioInput = document.getElementById('uploadAudioInput');

  if (fileInput.files[0]) formData.append('file', fileInput.files[0]);
  if (audioInput.files[0] && type === 'task') formData.append('audio', audioInput.files[0]);

  let url = `http://localhost:5002/api/upload/${type}/${courseId}`;
  if (sectionId) url += `/${sectionId}`;
  if (taskId && type === 'task') url += `/${taskId}`;

  try {
    const res = await fetch(url, { method: 'POST', body: formData });
    const data = await res.json();
    if (res.ok) {
      alert('Файл успішно завантажено!');
      fileInput.value = '';
      audioInput.value = '';
    } else {
      alert(data.error || 'Помилка при завантаженні файлу');
    }
  } catch (err) {
    console.error(err);
    alert('Помилка сервера при завантаженні файлу');
  }
});

// === Ініціалізація ===
loadUploadCourses();
