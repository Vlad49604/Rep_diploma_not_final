const API_BASE_URL = 'http://localhost:5002/api/courses';
const IMAGE_API_URL = 'http://localhost:5002/api/image';

const urlParams = new URLSearchParams(window.location.search);
const courseId = urlParams.get('id');

let currentCourse = null;
let lastInvitesList = [];
let allCourseStudents = []; 

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token || !courseId) {
        window.location.href = 'teacher.html';
        return;
    }

    await loadCourseData();
    setupCourseSettingsForm();
    setupPublicToggle();

    const contentTab = document.getElementById('content-tab');
    if (contentTab) {
        contentTab.addEventListener('shown.bs.tab', () => {
            if (typeof window.checkTextOverflows === 'function') {
                window.checkTextOverflows();
            }
        });
    }
    
    window.addEventListener('resize', () => {
        if (typeof window.checkTextOverflows === 'function') {
            window.checkTextOverflows();
        }
    });

    // 1. ВАЖЛИВО: Чекаємо, поки завантажиться список студентів (додано await)
    await loadCourseInvitations();

    await loadAllEnrolledStudents();// Завантажуємо загальний список студентів
    // ==========================================
    // 🔥 МАГІЯ ДЛЯ СПОВІЩЕНЬ: Відкриваємо есе автоматично
    // ==========================================
    const studentIdToOpen = urlParams.get('student'); 
    const resultIdToOpen = urlParams.get('result');   // Витягуємо ID спроби
    const taskIdToOpen = urlParams.get('task');       // Витягуємо ID завдання
    const viewToOpen = urlParams.get('view');

    if (studentIdToOpen) {
        showTab('students');
        setTimeout(async () => {
            if (typeof window.showStudentDetails === 'function') {
                await window.showStudentDetails(studentIdToOpen);
                
                if (resultIdToOpen) {
                    setTimeout(() => {
                        const attemptCollapse = document.getElementById(`collapse-attempt-${resultIdToOpen}`);
                        if (attemptCollapse) {
                            new bootstrap.Collapse(attemptCollapse, { toggle: false }).show();
                            if (taskIdToOpen) {
                                const targetBtn = attemptCollapse.querySelector(`button[data-task="${taskIdToOpen}"]`);
                                if (targetBtn) {
                                    const innerCollapse = targetBtn.closest('.accordion-collapse');
                                    if (innerCollapse) {
                                        new bootstrap.Collapse(innerCollapse, { toggle: false }).show();
                                        setTimeout(() => {
                                            targetBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            targetBtn.closest('.accordion-body').style.backgroundColor = '#e8f5e9';
                                        }, 400);
                                    }
                                }
                            }
                        }
                    }, 500);
                }
            }
        }, 300);
    } 
    // 2. ЯКЩО ПЕРЕХІД ДО ВІДХИЛЕНИХ ЗАПИТІВ
    else if (viewToOpen === 'rejected') {
        // Перемикаємо на вкладку "Студенти"
        showTab('students');
        
        setTimeout(() => {
            // Шукаємо блок відхилених (у тебе він має ID rejectedBlock)
            const rejectedSection = document.getElementById('rejectedBlock');
            if (rejectedSection) {
                // Скролимо до нього
                rejectedSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                // Додаємо тимчасовий червоний контур, щоб вчитель одразу побачив, де це
                rejectedSection.style.outline = '3px solid #dc3545';
                rejectedSection.style.transition = 'outline 0.3s ease';
                rejectedSection.style.borderRadius = '15px';
                
                // Через 3 секунди прибираємо підсвітку
                setTimeout(() => {
                    rejectedSection.style.outline = 'none';
                }, 3000);
            }
        }, 600);
    }
});

// Функція для перемикання вкладок
function showTab(tabId) {
    const tabEl = document.querySelector(`#${tabId}-tab`);
    if(tabEl) {
        const tab = new bootstrap.Tab(tabEl);
        tab.show();
    }
}

function getAuthHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
    };
}

// ==========================================
// 0. УНІВЕРСАЛЬНЕ ЗАВАНТАЖЕННЯ ТА ВИДАЛЕННЯ ФОТО
// ==========================================
// ==========================================
// 0. УНІВЕРСАЛЬНЕ ЗАВАНТАЖЕННЯ ТА ВИДАЛЕННЯ ФОТО
// ==========================================
async function uploadImageAPI(file) {
    const formData = new FormData();
    formData.append("image", file);
    document.body.style.cursor = 'wait';
    try {
        const res = await fetch(IMAGE_API_URL, { method: "POST", body: formData });
        const data = await res.json();
        document.body.style.cursor = 'default';
        if (!res.ok) throw new Error(data.error || "Помилка завантаження");
        return data.url;
    } catch (err) {
        document.body.style.cursor = 'default';
        throw err;
    }
}

async function deleteImageAPI(url) {
    try {
        const res = await fetch(IMAGE_API_URL, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url })
        });
        if (!res.ok) throw new Error("Помилка видалення на сервері");
        return true;
    } catch (err) {
        console.error(err);
        return false;
    }
}

// Завантаження обкладинки курсу
window.uploadCourseCover = async function() {
    const fileInput = document.getElementById('courseImageFile');
    const file = fileInput.files[0];
    if (!file) return alert("Оберіть файл!");

    try {
        const url = await uploadImageAPI(file);
        document.getElementById('editCourseImage').value = url;
        document.getElementById('courseImagePreview').src = url;
        document.getElementById('courseImagePreview').style.display = 'block';
        document.getElementById('deleteCourseImageBtn').style.display = 'block';
        alert("Зображення завантажено. Натисніть 'Зберегти зміни', щоб оновити курс.");
    } catch(err) { alert(err.message); }
};

// ВИДАЛЕННЯ обкладинки курсу (з сервера та бази)
window.removeCourseCover = async function() {
    const imageUrl = document.getElementById('editCourseImage').value;
    if (!imageUrl) return;

    if (!confirm("Видалити обкладинку курсу назавжди?")) return;

    // 1. Видаляємо фізично з Cloudinary/сервера
    await deleteImageAPI(imageUrl);

    // 2. Очищаємо інтерфейс
    document.getElementById('editCourseImage').value = "";
    document.getElementById('courseImagePreview').style.display = 'none';
    document.getElementById('deleteCourseImageBtn').style.display = 'none';
    document.getElementById('courseImageFile').value = "";

    // 3. Миттєво зберігаємо курс без картинки
    const body = {
        title: document.getElementById('editCourseTitle').value.trim(),
        description: document.getElementById('editCourseDesc').value.trim(),
        image: "" // Передаємо порожній рядок
    };

    try {
        const res = await fetch(`${API_BASE_URL}/${courseId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(body)
        });
        
        if (res.ok) {
            alert("Обкладинку видалено!");
            await loadCourseData(); // Оновлюємо сторінку, щоб банер зник
        }
    } catch (err) { console.error("Помилка при збереженні", err); }
};

// Завантаження картинки для Секції
window.uploadSectionImageInline = async function() {
    const fileInput = document.getElementById('sectionImageFile');
    const file = fileInput.files[0];
    if (!file) return alert("Оберіть файл!");

    try {
        const url = await uploadImageAPI(file);
        document.getElementById('inlineSectionImage').value = url;
        document.getElementById('inlineSectionImagePreview').src = url;
        document.getElementById('inlineSectionImagePreview').style.display = 'block';
        document.getElementById('deleteSectionImageBtn').style.display = 'block';
    } catch(err) { alert(err.message); }
};

// ==========================================
// ОСЬ ЦЯ ВІДСУТНЯ ФУНКЦІЯ (ДОДАЙ ЇЇ СЮДИ):
// ==========================================
window.removeSectionImageInline = async function() {
    const urlInput = document.getElementById('inlineSectionImage');
    const imageUrl = urlInput.value;
    
    if (imageUrl && confirm("Видалити зображення для цієї нової секції?")) {
        try {
            await deleteImageAPI(imageUrl); // Видаляємо з Cloudinary
            
            // Очищаємо інпути
            urlInput.value = "";
            const fileInput = document.getElementById('sectionImageFile');
            if (fileInput) fileInput.value = '';
            
            // Ховаємо прев'ю і кнопку
            const previewImg = document.getElementById('inlineSectionImagePreview');
            if (previewImg) {
                previewImg.style.display = 'none';
                previewImg.src = "";
            }
            
            const delBtn = document.getElementById('deleteSectionImageBtn');
            if (delBtn) delBtn.style.display = 'none';
            
            alert("Фото видалено.");
        } catch (err) {
            console.error("Помилка видалення:", err);
            alert("Не вдалося видалити фото: " + err.message);
        }
    }
};
// ==========================================

// ВИДАЛЕННЯ картинки секції

// Завантаження картинки для Завдання
// Завантаження картинки для Завдання
window.uploadTaskImageInline = async function(sectionId, event) {
    const fileInput = document.getElementById(`taskImageFile-${sectionId}`);
    const file = fileInput.files[0];
    if (!file) return alert("Оберіть файл!");

    const btn = event ? event.target : null;
    let oldText = "";
    if (btn) {
        oldText = btn.innerHTML;
        btn.innerHTML = "Завантажую...";
        btn.disabled = true;
    }

    try {
        const url = await uploadImageAPI(file);
        document.getElementById(`inlineTaskImage-${sectionId}`).value = url;
        const previewImg = document.getElementById(`inlineTaskImagePreview-${sectionId}`);
        previewImg.src = url;
        previewImg.style.display = 'block';
        document.getElementById(`deleteTaskImageBtn-${sectionId}`).style.display = 'inline-flex';
    } catch(err) { 
        alert("Помилка завантаження: " + err.message); 
    } finally {
        if (btn) {
            btn.innerHTML = oldText;
            btn.disabled = false;
        }
    }
};

// ВИДАЛЕННЯ картинки завдання
window.removeTaskImageInline = async function(sectionId) {
    const imageUrl = document.getElementById(`inlineTaskImage-${sectionId}`).value;
    if (imageUrl && confirm("Видалити зображення завдання?")) {
        await deleteImageAPI(imageUrl);
        document.getElementById(`inlineTaskImage-${sectionId}`).value = "";
        document.getElementById(`inlineTaskImagePreview-${sectionId}`).style.display = 'none';
        document.getElementById(`deleteTaskImageBtn-${sectionId}`).style.display = 'none';
        document.getElementById(`taskImageFile-${sectionId}`).value = "";
    }
};

// ==========================================
// 1. ЗАВАНТАЖЕННЯ ДАНИХ КУРСУ
// ==========================================
async function loadCourseData() {
    try {
        const res = await fetch(`${API_BASE_URL}/${courseId}`);
        if (!res.ok) throw new Error("Курс не знайдено");
        
        currentCourse = await res.json();

        const priceInput = document.getElementById('editCoursePrice');
        if (priceInput) {
            priceInput.value = currentCourse.price || 0;
            // Викликаємо розрахунок одразу після завантаження
            calculateEditEarnings(); 
        }
        
        // Оновлюємо UI (Хедер та Налаштування)
        // document.getElementById('courseHeaderTitle').textContent = currentCourse.title;
        document.getElementById('editCourseTitle').value = currentCourse.title;
        document.getElementById('editCourseDesc').value = currentCourse.description;
        
        const imgInput = document.getElementById('editCourseImage');
        const imgPreview = document.getElementById('courseImagePreview');
        const deleteBtn = document.getElementById('deleteCourseImageBtn'); // Знаходимо кнопку
        
        imgInput.value = currentCourse.image || "";
        if (currentCourse.image) {
            imgPreview.src = currentCourse.image;
            imgPreview.style.display = 'inline-block';
            if (deleteBtn) deleteBtn.style.display = 'inline-block'; // Показуємо кнопку, якщо є фото
        } else {
            imgPreview.style.display = 'none';
            if (deleteBtn) deleteBtn.style.display = 'none'; // Ховаємо кнопку, якщо фото нема
        }

        // Рендеримо секції у вкладці "Контент"
        renderSectionsAccordion();

    } catch (err) {
        console.error(err);
        alert("Помилка завантаження курсу");
        window.location.href = 'teacher.html';
    }
}

// ==========================================
// 2. НАЛАШТУВАННЯ КУРСУ (Вкладка 2)
// ==========================================
function setupCourseSettingsForm() {
    const form = document.getElementById('courseSettingsForm');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const body = {
            title: document.getElementById('editCourseTitle').value.trim(),
            description: document.getElementById('editCourseDesc').value.trim(),
            image: document.getElementById('editCourseImage').value.trim(),
            price: parseInt(document.getElementById('editCoursePrice').value) || 0
        };

        try {
            const res = await fetch(`${API_BASE_URL}/${courseId}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(body)
            });

            if (res.ok) {
                alert("Налаштування курсу збережено!");
                loadCourseData(); 
            } else {
                alert("Помилка збереження");
            }
        } catch (err) {
            alert("Помилка сервера");
        }
    });
}

// ==========================================
// ОНОВЛЕНА ЛОГІКА ПУБЛІКАЦІЇ КУРСУ (ПРЕМОДЕРАЦІЯ)
// ==========================================
// ==========================================
// ОНОВЛЕНА ЛОГІКА ПУБЛІКАЦІЇ КУРСУ (ПРЕМОДЕРАЦІЯ)
// ==========================================
function setupPublicToggle() {
    const toggle = document.getElementById('publicToggle');
    const label = document.getElementById('publicToggleLabel');
    
    if (!toggle) return;

    // Встановлюємо початковий візуал
    toggle.checked = currentCourse.isPublic;
    updateToggleVisuals(currentCourse.isPublic);

    // Використовуємо 'click' замість 'change' для контролю e.preventDefault()
    toggle.addEventListener('click', (e) => {
        e.preventDefault(); // Забороняємо автоматичне перемикання

        if (currentCourse.isPublic) {
            // Якщо зараз публічний — відкриваємо модалку приватності
            const modal = new bootstrap.Modal(document.getElementById('makePrivateModal'));
            modal.show();
        } else {
            // Якщо зараз приватний — відкриваємо модалку запиту на публікацію
            const modal = new bootstrap.Modal(document.getElementById('requestPublishModal'));
            modal.show();
        }
    });
}

// --- ОБРОБНИКИ ДЛЯ МОДАЛОК ---

// 1. ПІДТВЕРДЖЕННЯ ПРИВАТНОСТІ (Пряме оновлення)
window.confirmMakePrivate = async function() {
    const modalEl = document.getElementById('makePrivateModal');
    const toggle = document.getElementById('publicToggle');

    try {
        const res = await fetch(`${API_BASE_URL}/${courseId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ isPublic: false })
        });

        if (res.ok) {
            currentCourse.isPublic = false;
            toggle.checked = false;
            updateToggleVisuals(false);
            bootstrap.Modal.getInstance(modalEl).hide();
            if (typeof showToast === 'function') showToast('Успішно', 'Курс знято з публікації');
        } else {
            alert("Не вдалося змінити статус");
        }
    } catch (err) {
        alert("Помилка сервера");
    }
};

// 2. ПІДТВЕРДЖЕННЯ ПУБЛІКАЦІЇ (Створення тікета)
window.confirmRequestPublish = async function() {
    const btn = document.getElementById('btnConfirmPublish');
    const modalEl = document.getElementById('requestPublishModal');
    const originalText = btn.innerHTML;

    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Надсилаємо...`;

    try {
        const TICKETS_API_URL = 'http://localhost:5002/api/tickets'; 
        const ticketData = {
            subject: `Запит на публікацію: ${currentCourse.title}`,
            category: 'publish_request', 
            courseId: courseId,
            message: `Прошу перевірити та опублікувати мій курс "${currentCourse.title}".\nID: ${courseId}`
        };

        const res = await fetch(TICKETS_API_URL, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(ticketData)
        });

        if (res.ok) {
            bootstrap.Modal.getInstance(modalEl).hide();
            alert("✅ Запит успішно надіслано! Щойно адміністратор перевірить курс, він стане публічним.");
            
            const label = document.getElementById('publicToggleLabel');
            label.textContent = "Очікує модерації...";
            label.className = 'form-check-label text-warning fw-bold';
        } else {
            const errorData = await res.json();
            alert("❌ Помилка: " + (errorData.message || "Запит вже було надіслано раніше."));
        }
    } catch(err) {
        alert("❌ Помилка з'єднання з сервером");
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
};

// Допоміжна функція для візуалу
function updateToggleVisuals(isPublic) {
    const label = document.getElementById('publicToggleLabel');
    if (!label) return;
    label.textContent = isPublic ? "Публічний" : "Приватний (Чернетка)";
    label.className = isPublic ? 'form-check-label text-success fw-bold' : 'form-check-label text-muted';
}

// ==========================================
// 3. НАВЧАЛЬНИЙ КОНТЕНТ ТА АКОРДЕОН
// ==========================================
// ==========================================
// 3. НАВЧАЛЬНИЙ КОНТЕНТ ТА АКОРДЕОН
// ==========================================
function renderSectionsAccordion() {
    const container = document.getElementById('sectionsAccordion');
    container.innerHTML = "";

    document.getElementById('displayCourseTitle').textContent = currentCourse.title;
    
    const bannerContainer = document.getElementById('courseBannerContainer');
    const heroImage = document.getElementById('displayCourseImage');
    if (currentCourse.image) {
        heroImage.src = currentCourse.image;
        heroImage.style.maxHeight = '300px';
        bannerContainer.style.display = 'flex';
    } else {
        bannerContainer.style.display = 'none';
    }

    const descText = document.getElementById('displayCourseDesc');
    descText.textContent = currentCourse.description || "Опис відсутній.";
    
    // Ставимо обмеження висоти одразу
    const descContainer = document.getElementById('courseDescContainer');
    if (descContainer) descContainer.style.maxHeight = '12em';

    if (!currentCourse.sections || currentCourse.sections.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5 bg-white rounded-4 border-dashed">
                <i class="bi bi-journal-plus fs-1 text-success opacity-25"></i>
                <p class="text-muted mt-2">Ваш курс поки порожній. Час додати першу секцію!</p>
            </div>`;
        
        // Викликаємо нову функцію перевірки після рендеру
        setTimeout(window.checkTextOverflows, 150);
        return;
    }

    currentCourse.sections.forEach((section, index) => {
        const sectionId = section._id?.$oid || section._id; 
        const tasksCount = section.tasks ? section.tasks.length : 0;
        const isExpanded = index === 0 ? 'show' : '';
        const isCollapsedBtn = index === 0 ? '' : 'collapsed';

        container.innerHTML += `
        <div id="section-wrapper-${sectionId}" class="mb-4">
            <div class="accordion-item border-0 shadow-sm rounded-4 overflow-hidden">
                <div class="accordion-header d-flex align-items-center bg-white pe-3" id="heading${index}">
                    <button class="accordion-button ${isCollapsedBtn} fw-bold py-4 text-dark fs-5" type="button" data-bs-toggle="collapse" data-bs-target="#collapse${index}">
                        <span class="badge bg-success text-white me-3 fs-6">${index + 1}</span>
                        <span class="me-2">${section.title}</span>
                        <span class="badge bg-light text-muted border fw-normal fs-6 ms-2">${tasksCount} вправ</span>
                    </button>
                    
                    <div class="d-flex gap-2 ms-auto ps-4 border-start">
                        <button onclick="replaceSectionWithEditForm('${sectionId}')" class="btn btn-light text-success rounded-circle shadow-sm" style="width: 44px; height: 44px;" title="Редагувати">
                            <i class="bi bi-pencil-square fs-5"></i>
                        </button>
                        <button onclick="deleteSection('${sectionId}')" class="btn btn-light text-danger rounded-circle shadow-sm" style="width: 44px; height: 44px;" title="Видалити">
                            <i class="bi bi-trash fs-5"></i>
                        </button>
                    </div>
                </div>

                <div id="collapse${index}" class="accordion-collapse collapse ${isExpanded}" data-bs-parent="#sectionsAccordion">
                    <div class="accordion-body bg-light-subtle p-4">
                        
                        ${section.image ? `<img src="${section.image}" class="rounded-3 mb-4 shadow-sm" style="max-height: 200px; display: block;">` : ''}
                        
                        <div class="position-relative mb-2">
                            <div id="secDescContainer-${sectionId}" class="text-muted fs-6" style="max-height: 6em; overflow: hidden; transition: all 0.3s ease;">
                                <p class="mb-0" style="white-space: pre-wrap; line-height: 1.6;">${section.description || 'Опис відсутній.'}</p>
                            </div>
                            <div id="secDescGradient-${sectionId}" class="position-absolute bottom-0 w-100" style="height: 40px; background: linear-gradient(transparent, #f8f9fa); display: none; pointer-events: none;"></div>
                        </div>

                        <button id="toggleSecDescBtn-${sectionId}" class="btn btn-link text-success p-0 mb-4 text-decoration-none fw-bold fs-5" style="display: none;" onclick="toggleSectionDescription('${sectionId}')">
                            Читати далі <i class="bi bi-chevron-down"></i>
                        </button>
                        
                        <div class="task-list-container bg-white p-4 rounded-4 shadow-sm border border-success-subtle">
                            <div class="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom">
                                <h5 class="fw-bold mb-0 text-dark"><i class="bi bi-list-task me-2 text-success"></i>Список вправ</h5>
                                
                                <button id="addTaskBtn-${sectionId}" onclick="toggleInlineTaskForm('${sectionId}')" class="btn btn-success rounded-pill fw-bold shadow-sm px-4 py-2">
                                    <i class="bi bi-plus-lg me-1"></i> Додати вправу
                                </button>
                            </div>
                            
                            <div id="inlineTaskFormContainer-${sectionId}" style="display: none;" class="mb-4 p-3 border border-success border-2 rounded-3 bg-light">
                            </div>

                            <div class="list-group list-group-flush overflow-hidden">
                                ${renderTasksList(section.tasks, sectionId)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
    });

    setTimeout(() => {
        currentCourse.sections.forEach((section) => {
            const sectionId = section._id?.$oid || section._id;
            const container = document.getElementById(`secDescContainer-${sectionId}`);
            const btn = document.getElementById(`toggleSecDescBtn-${sectionId}`);
            const gradient = document.getElementById(`secDescGradient-${sectionId}`);
            
            if (container && btn && gradient) {
                if (container.scrollHeight > container.offsetHeight + 10) {
                    btn.style.display = 'inline-block';
                    gradient.style.display = 'block';
                }
            }
        });
    }, 150);

    setTimeout(window.checkTextOverflows, 150);
}

// 1. Відкриває форму замість секції
window.replaceSectionWithEditForm = function(sectionId) {
    const section = currentCourse.sections.find(s => (s._id?.$oid || s._id) === sectionId);
    if (!section) return;

    const wrapper = document.getElementById(`section-wrapper-${sectionId}`);
    wrapper.style.display = 'none'; 

    const editContainer = document.createElement('div');
    editContainer.id = `section-edit-container-${sectionId}`;
    editContainer.className = "edit-card mb-4 border-0 shadow-lg overflow-hidden bg-white";
    editContainer.style.borderRadius = "24px";
    editContainer.style.fontFamily = "'Plus Jakarta Sans', sans-serif";
    
    editContainer.innerHTML = `
        <div class="p-4 border-bottom d-flex justify-content-between align-items-center bg-white">
            <h5 class="fw-bold text-success mb-0">
                <i class="bi bi-pencil-square me-2"></i>Редагування секції
            </h5>
            <button type="button" class="btn-close" onclick="cancelSectionEdit('${sectionId}')"></button>
        </div>

        <form onsubmit="handleSectionSubmit(event, '${sectionId}')" class="p-4">
            <div class="mb-4">
                <label class="form-label fw-bold text-success ms-1 fs-6">Назва секції</label>
                <input type="text" class="form-control border-0 bg-light py-3 px-4 fs-5 shadow-sm" id="edit-sec-title-${sectionId}" value="${section.title}" required style="border-radius: 12px; font-family: inherit;">
            </div>
            
            <div class="mb-4">
                <label class="form-label fw-bold text-success ms-1 fs-6">Опис секції</label>
                <textarea class="form-control border-0 bg-light py-3 px-4 fs-6 shadow-sm" id="edit-sec-desc-${sectionId}" rows="3" style="border-radius: 12px; font-family: inherit; white-space: pre-wrap;">${section.description || ''}</textarea>
            </div>
            
            <div class="p-4 border border-success-subtle rounded-4 bg-white mb-4 shadow-sm">
                <div class="d-flex align-items-center mb-3">
                    <div class="bg-success text-white rounded-3 p-2 me-3" style="width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">
                        <i class="bi bi-image fs-5"></i>
                    </div>
                    <h6 class="fw-bold mb-0 text-success fs-6">Зображення секції</h6>
                </div>
                
                <input type="hidden" id="edit-sec-img-url-${sectionId}" value="${section.image || ''}">
                
                <div class="row align-items-center">
                    <div class="col-lg-7">
                        <div class="d-flex flex-wrap gap-2">
                            <input type="file" id="edit-sec-file-${sectionId}" class="form-control bg-light border-0" accept="image/*" style="max-width: 350px; border-radius: 10px; font-family: inherit;">
                            <button type="button" class="btn btn-secondary fw-bold px-4 rounded-3" onclick="uploadSectionImageInlineEdit('${sectionId}', event)">Завантажити</button>
                            <button type="button" id="edit-sec-del-btn-${sectionId}" class="btn btn-outline-danger fw-bold px-3 rounded-3" style="display: ${section.image ? 'inline-flex' : 'none'}; align-items: center;" onclick="removeSectionImageInlineEdit('${sectionId}')">
                                <i class="bi bi-trash3"></i>
                            </button>
                        </div>
                    </div>
                    <div class="col-lg-5 text-center mt-3 mt-lg-0">
                        <img id="edit-sec-preview-img-${sectionId}" src="${section.image || ''}" class="shadow-sm border" style="max-height: 150px; display: ${section.image ? 'block' : 'none'}; border-radius: 15px; object-fit: cover;">
                    </div>
                </div>
            </div>

            <div class="d-flex justify-content-end gap-3 pt-4 border-top mt-4">
                <button type="button" class="btn btn-light fw-bold px-5 py-3 rounded-pill fs-6" onclick="cancelSectionEdit('${sectionId}')">Скасувати</button>
                <button type="submit" class="btn btn-success fw-bold px-5 py-3 rounded-pill shadow-sm fs-6">
                    <i class="bi me-2"></i> Зберегти зміни
                </button>
            </div>
        </form>
    `;

    wrapper.parentNode.insertBefore(editContainer, wrapper.nextSibling);
};

window.uploadSectionImageInlineEdit = async function(sectionId, event) {
    const fileInput = document.getElementById(`edit-sec-file-${sectionId}`);
    const file = fileInput.files[0];
    if (!file) return alert("Оберіть файл!");

    const btn = event.target;
    const oldText = btn.innerHTML;
    btn.innerHTML = "Завантажую...";
    btn.disabled = true;

    try {
        const url = await uploadImageAPI(file); 
        document.getElementById(`edit-sec-img-url-${sectionId}`).value = url;
        
        // Показуємо нову картинку і кнопку видалення
        const previewImg = document.getElementById(`edit-sec-preview-img-${sectionId}`);
        previewImg.src = url;
        previewImg.style.display = 'block';
        
        document.getElementById(`edit-sec-del-btn-${sectionId}`).style.display = 'inline-flex';
    } catch(err) { 
        alert("Не вдалося завантажити: " + err.message); 
    } finally {
        btn.innerHTML = oldText;
        btn.disabled = false;
    }
};

window.removeSectionImageInlineEdit = async function(sectionId) {
    const urlInput = document.getElementById(`edit-sec-img-url-${sectionId}`);
    const imageUrl = urlInput.value;
    
    if (imageUrl && confirm("Видалити зображення секції?")) {
        try {
            await deleteImageAPI(imageUrl); 
            urlInput.value = "";
            
            // Ховаємо картинку і кнопку видалення
            const previewImg = document.getElementById(`edit-sec-preview-img-${sectionId}`);
            if (previewImg) {
                previewImg.style.display = 'none';
                previewImg.src = "";
            }
            
            const delBtn = document.getElementById(`edit-sec-del-btn-${sectionId}`);
            if (delBtn) delBtn.style.display = 'none';
            
            const fileInput = document.getElementById(`edit-sec-file-${sectionId}`);
            if (fileInput) fileInput.value = '';
            
            alert("Фото видалено. Натисніть 'Зберегти зміни', щоб оновити секцію.");
        } catch (err) {
            alert("Не вдалося видалити фото: " + err.message);
        }
    }
};

window.cancelSectionEdit = function(sectionId) {
    const editForm = document.getElementById(`section-edit-container-${sectionId}`);
    if (editForm) editForm.remove();
    document.getElementById(`section-wrapper-${sectionId}`).style.display = 'block';
};

// Рендер списку завдань у вигляді вкладених блоків
function renderTasksList(tasks, sectionId) {
    if (!tasks || tasks.length === 0) return `<div class="p-4 text-center bg-light text-muted fs-6 rounded-4 border-dashed">В цій секції ще немає завдань.</div>`;
    
    const icons = {
        multiple: 'bi-check2-square',
        matching: 'bi-grid-3x3-gap',
        gap: 'bi-textarea-t',
        essay: 'bi-card-text'
    };

    let tasksHTML = `<div class="accordion custom-accordion" id="tasksAccordion-${sectionId}">`;

    tasks.forEach((task) => {
        const taskId = task._id?.$oid || task._id;
        const iconClass = icons[task.taskType] || 'bi-journal-text';
        
        // Перевіряємо наявність пояснення (очищаємо від пробілів)
        const hasExplanation = task.explanation && task.explanation.trim().length > 0;

        tasksHTML += `
        <div id="task-wrapper-${taskId}" class="mb-3">
            <div class="accordion-item border border-success-subtle rounded-4 overflow-hidden shadow-sm">
                <div class="accordion-header d-flex align-items-center bg-white pe-3" id="taskHeading-${taskId}">
                    <button class="accordion-button collapsed py-3 px-4 fw-bold text-dark bg-white fs-5" type="button" 
                            data-bs-toggle="collapse" data-bs-target="#taskCollapse-${taskId}" style="box-shadow: none;">
                        <div class="task-icon-circle me-3 bg-success-subtle text-success border border-success-subtle" 
                             style="width: 40px; height: 40px; font-size: 1.2rem; display: flex; align-items: center; justify-content: center; border-radius: 10px;">
                            <i class="bi ${iconClass}"></i>
                        </div>
                        <span>${task.title}</span>
                    </button>
                    
                    <div class="d-flex gap-2 ms-auto ps-3 border-start">
                        <button onclick="replaceTaskWithEditForm('${sectionId}', '${taskId}')" class="btn btn-light text-primary rounded-circle shadow-sm" style="width: 36px; height: 36px;" title="Редагувати">
                            <i class="bi bi-pencil-square"></i>
                        </button>
                        <button onclick="deleteTask('${sectionId}', '${taskId}')" class="btn btn-light text-danger rounded-circle shadow-sm" style="width: 36px; height: 36px;" title="Видалити">
                            <i class="bi bi-trash3-fill"></i>
                        </button>
                    </div>
                </div>

                <div id="taskCollapse-${taskId}" class="accordion-collapse collapse" data-bs-parent="#tasksAccordion-${sectionId}">
                    <div class="accordion-body bg-light-subtle p-4 border-top">
                        <div class="fs-6">
                            ${task.image ? `<img src="${task.image}" class="rounded-4 mb-4 d-block shadow-sm" style="max-height: 200px; border: 1px solid rgba(0,0,0,0.05);">` : ''}
                            
                            ${task.description ? `<p class="text-dark mb-4 fw-medium" style="font-size: 1.1rem; line-height: 1.6; white-space: pre-wrap;">${task.description}</p>` : ''}
                            
                            <div class="bg-white p-4 pt-5 rounded-4 shadow-sm border border-success-subtle mb-4 position-relative">
                                <span class="position-absolute top-0 start-0 badge rounded-bottom-4 rounded-top-0 bg-success px-3 py-2 ms-4">
                                    <i class="bi bi-eye me-1"></i> Прев'ю завдання
                                </span>
                                ${typeof renderTaskPreviewLogic === 'function' ? renderTaskPreviewLogic(task) : 'Попередній перегляд недоступний'}
                            </div>
                            
                            ${hasExplanation ? `
                            <div class="p-3 bg-white rounded-4 border-start border-4 border-success shadow-xs">
                                <h6 class="fw-bold text-success mb-2"><i class="bi bi-info-circle me-1"></i>Пояснення для студента:</h6>
                                <p class="text-muted mb-0 italic" style="font-size: 1rem; line-height: 1.5;">${task.explanation}</p>
                            </div>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
    });

    tasksHTML += `</div>`;
    return tasksHTML;
}

// 2. Закриває форму і повертає секцію
window.cancelSectionEdit = function(sectionId) {
    const editForm = document.getElementById(`section-edit-container-${sectionId}`);
    if (editForm) editForm.remove();
    document.getElementById(`section-wrapper-${sectionId}`).style.display = 'block';
};

// 3. Зберігає відредаговану секцію на сервер
window.handleSectionSubmit = async function(e, sectionId) {
    e.preventDefault();
    
    // Блокуємо кнопку, щоб не було подвійних кліків
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Зберігаємо...';

    // Збираємо дані
    const body = {
        title: document.getElementById(`edit-sec-title-${sectionId}`).value.trim(),
        description: document.getElementById(`edit-sec-desc-${sectionId}`).value.trim(),
        // ДУЖЕ ВАЖЛИВО: Передаємо значення, навіть якщо воно порожнє
        image: document.getElementById(`edit-sec-img-url-${sectionId}`).value || ""
    };

    try {
        const res = await fetch(`${API_BASE_URL}/${courseId}/section/${sectionId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(body)
        });

        if (res.ok) {
            cancelSectionEdit(sectionId); // Закриваємо форму
            await loadCourseData(); // Перезавантажуємо дані курсу
        } else {
            const errorData = await res.json();
            alert("Помилка при збереженні: " + (errorData.message || errorData.error || "Невідома помилка"));
        }
    } catch (err) {
        alert("Помилка сервера: неможливо зберегти зміни.");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
};

window.replaceTaskWithEditForm = function(sectionId, taskId) {
    const section = currentCourse.sections.find(s => s._id === sectionId);
    const task = section.tasks.find(t => t._id === taskId);
    if (!task) return;

    // Знаходимо обгортку вправи
    const wrapper = document.getElementById(`task-wrapper-${taskId}`);
    
    // Тимчасово ховаємо основний контент вправи
    wrapper.style.display = 'none';

    // Створюємо контейнер для форми редагування
    const editFormContainer = document.createElement('div');
    editFormContainer.id = `edit-container-${taskId}`;
    editFormContainer.className = "mb-4 p-4 border border-success border-2 rounded-4 bg-light shadow-sm";
    editFormContainer.style.fontFamily = "'Plus Jakarta Sans', sans-serif";
    
    // Вставляємо HTML форми
    editFormContainer.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h5 class="fw-bold text-success mb-0"><i class="bi bi-pencil-square me-2"></i>Редагування вправи</h5>
            <button type="button" class="btn-close" onclick="cancelTaskEdit('${taskId}')"></button>
        </div>
        <form onsubmit="submitInlineTaskForm(event, '${sectionId}', '${taskId}')">
            <div class="row g-4 mb-4">
                <div class="col-md-5">
                    <label class="form-label fw-bold text-success fs-6">Тип</label>
                    <select id="taskTypeSelect-${sectionId}" class="form-select border-0 bg-white py-3 px-4 fs-6 shadow-sm" onchange="buildInlineDynamicTaskFields('${sectionId}', this.value)" style="border-radius: 12px; font-family: inherit;">
                        <option value="multiple" ${task.taskType === 'multiple' ? 'selected' : ''}>Multiple Choice</option>
                        <option value="gap" ${task.taskType === 'gap' ? 'selected' : ''}>Gap (Пропуск)</option>
                        <option value="matching" ${task.taskType === 'matching' ? 'selected' : ''}>Matching (Пари)</option>
                        <option value="essay" ${task.taskType === 'essay' ? 'selected' : ''}>Essay (Есе)</option>
                    </select>
                </div>
                <div class="col-md-7">
                    <label class="form-label fw-bold text-success fs-6">Заголовок</label>
                    <input type="text" class="form-control border-0 bg-white py-3 px-4 fs-5 shadow-sm" id="taskTitle-${sectionId}" value="${task.title}" required style="border-radius: 12px; font-family: inherit;">
                </div>
            </div>

            <div class="mb-4">
                <label class="form-label fw-bold text-success fs-6">Умова (опис)</label>
                <textarea class="form-control border-0 bg-white py-3 px-4 fs-6 shadow-sm" id="taskDesc-${sectionId}" rows="3" style="border-radius: 12px; font-family: inherit;">${task.description || ''}</textarea>
            </div>

            <div id="dynamicTaskFields-${sectionId}" class="p-4 bg-white rounded-4 border border-success-subtle shadow-sm mb-4">
            </div>

            <div class="d-flex justify-content-end gap-3 pt-3 border-top">
                <button type="button" class="btn btn-light fw-bold px-4 py-3 rounded-pill fs-6" onclick="cancelTaskEdit('${taskId}')">Скасувати</button>
                <button type="submit" class="btn btn-success fw-bold px-5 py-3 rounded-pill shadow-sm fs-6" id="taskSubmitBtn-${sectionId}">
                    <i class="bi me-2"></i> Зберегти зміни
                </button>
            </div>
        </form>
    `;

    // Вставляємо форму ПІСЛЯ прихованого ваппера
    wrapper.parentNode.insertBefore(editFormContainer, wrapper.nextSibling);

    // Заповнюємо поля через існуючу логіку
    buildInlineDynamicTaskFields(sectionId, task.taskType);
    
    // Викликаємо функцію заповнення даних 
    fillTaskDataForEdit(sectionId, task);
};

// Функція скасування
window.cancelTaskEdit = function(taskId) {
    const editContainer = document.getElementById(`edit-container-${taskId}`);
    const wrapper = document.getElementById(`task-wrapper-${taskId}`);
    if(editContainer) editContainer.remove();
    if(wrapper) wrapper.style.display = 'block';
};

// Допоміжна функція заповнення даних (винесена для чистоти)
function fillTaskDataForEdit(sectionId, task) {
    // 1. Загальні поля
    document.getElementById(`taskTitle-${sectionId}`).value = task.title || "";
    document.getElementById(`taskDesc-${sectionId}`).value = task.description || "";

    // 2. Обробка картинки завдання
    const imageInput = document.getElementById(`inlineTaskImage-${sectionId}`);
    const imagePreview = document.getElementById(`inlineTaskImagePreview-${sectionId}`);
    const deleteImgBtn = document.getElementById(`deleteTaskImageBtn-${sectionId}`);

    if (task.image) {
        if (imageInput) imageInput.value = task.image;
        if (imagePreview) {
            imagePreview.src = task.image;
            imagePreview.style.display = 'block';
        }
        if (deleteImgBtn) deleteImgBtn.style.display = 'block';
    }

    // 3. Специфічні поля за типами
    if (task.taskType === "multiple") {
        const container = document.getElementById(`multipleOptions-${sectionId}`);
        container.innerHTML = "";
        task.options.forEach((opt, idx) => {
            container.insertAdjacentHTML('beforeend', `
                <div class="d-flex gap-3 mb-2 align-items-center option-row p-2 border rounded-3 ${opt.isCorrect ? 'bg-light border-success-subtle border-2' : 'bg-white'} shadow-sm transition-all" onclick="selectRadio(this, '${sectionId}')">
                    <div class="form-check m-0 ms-2">
                        <input class="form-check-input border-success" type="radio" name="isCorrect-${sectionId}" ${opt.isCorrect ? 'checked' : ''} style="transform: scale(1.3); cursor: pointer;" onclick="event.stopPropagation(); highlightSelected(this, '${sectionId}')">
                    </div>
                    <input type="text" class="form-control border-0 bg-white px-3 py-2 opt-text fw-medium" value="${opt.text}" placeholder="Варіант ${idx + 1}" onclick="event.stopPropagation();">
                    <button type="button" class="btn btn-light text-danger border-0 rounded-circle me-1" onclick="event.stopPropagation(); this.parentElement.remove()" title="Видалити"><i class="bi bi-trash3"></i></button>
                </div>
            `);
        });
        document.getElementById(`taskExplanation-${sectionId}`).value = task.explanation || "";

    } else if (task.taskType === "gap") {
        document.getElementById(`gapText-${sectionId}`).value = task.gapText || "";
        document.getElementById(`gapAnswer-${sectionId}`).value = task.gapAnswer || "";
        document.getElementById(`taskExplanation-${sectionId}`).value = task.explanation || "";

    } else if (task.taskType === "matching") {
        const container = document.getElementById(`matchingPairs-${sectionId}`);
        container.innerHTML = ""; // Очищаємо перед заповненням

        task.pairs.forEach(p => {
            container.insertAdjacentHTML('beforeend', `
                <div class="d-flex gap-2 mb-2 pair-row align-items-center p-2 border rounded-3 bg-light shadow-sm">
                    <input type="text" class="form-control border-0 bg-white pair-left" value="${p.left}" placeholder="Слово">
                    <i class="bi bi-arrow-left-right text-muted"></i>
                    <input type="text" class="form-control border-0 bg-white pair-right" value="${p.right}" placeholder="Переклад">
                    <button type="button" class="btn btn-sm btn-outline-danger border-0 rounded-circle" onclick="this.closest('.pair-row').remove()"><i class="bi bi-x-lg"></i></button>
                </div>
            `);
        });
        document.getElementById(`taskExplanation-${sectionId}`).value = task.explanation || "";

    } else if (task.taskType === "essay") {
        document.getElementById(`taskExplanation-${sectionId}`).value = task.explanation || "";
    }
}

// Допоміжна функція для короткого перегляду контенту завдання
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
            <p class="mb-0 text-muted fs-6 italic">Студент має надати розгорнуту текстову відповідь у цьому полі.</p>
        </div>`;
    }
    return '';
}

// Функція для відкриття форми редагування завдання (Inline)
window.openEditTaskInline = function(sectionId, taskId) {
    const section = currentCourse.sections.find(s => s._id === sectionId);
    const task = section.tasks.find(t => t._id === taskId);
    if (!task) return;

    // Відкриваємо форму через існуючу логіку toggle
    toggleInlineTaskForm(sectionId, true, taskId);

    // Заповнюємо дані завдання
    document.getElementById(`taskTypeSelect-${sectionId}`).value = task.taskType;
    document.getElementById(`taskTitle-${sectionId}`).value = task.title;
    document.getElementById(`taskDesc-${sectionId}`).value = task.description || "";
    
    // Рендеримо динамічні поля під тип
    buildInlineDynamicTaskFields(sectionId, task.taskType);

    // Заповнюємо динамічні поля залежно від типу
    if (task.taskType === "multiple") {
        const container = document.getElementById(`multipleOptions-${sectionId}`);
        container.innerHTML = ""; // Очищаємо дефолтні
        task.options.forEach((opt) => {
            container.insertAdjacentHTML('beforeend', `
                <div class="d-flex gap-3 mb-2 align-items-center option-row p-2 border rounded-3 ${opt.isCorrect ? 'bg-light border-success-subtle border-2' : 'bg-white'} shadow-sm transition-all" onclick="selectRadio(this, '${sectionId}')">
                    <div class="form-check m-0 ms-2">
                        <input class="form-check-input border-success" type="radio" name="isCorrect-${sectionId}" ${opt.isCorrect ? 'checked' : ''} style="transform: scale(1.3); cursor: pointer;" onclick="event.stopPropagation(); highlightSelected(this, '${sectionId}')">
                    </div>
                    <input type="text" class="form-control border-0 bg-white px-3 py-2 opt-text fw-medium" value="${opt.text}" onclick="event.stopPropagation();">
                    <button type="button" class="btn btn-light text-danger border-0 rounded-circle me-1" onclick="event.stopPropagation(); this.parentElement.remove()" title="Видалити"><i class="bi bi-trash3"></i></button>
                </div>
            `);
        });
        document.getElementById(`taskExplanation-${sectionId}`).value = task.explanation || "";
    } else if (task.taskType === "gap") {
        document.getElementById(`gapText-${sectionId}`).value = task.gapText || "";
        document.getElementById(`gapAnswer-${sectionId}`).value = task.gapAnswer || "";
        document.getElementById(`taskExplanation-${sectionId}`).value = task.explanation || "";
    } else if (task.taskType === "matching") {
        const container = document.getElementById(`matchingPairs-${sectionId}`);
        container.innerHTML = "";
        task.pairs.forEach(p => {
            container.insertAdjacentHTML('beforeend', `
                <div class="d-flex gap-2 mb-2 pair-row align-items-center p-2 border rounded-3 bg-light shadow-sm">
                    <input type="text" class="form-control border-0 bg-white" value="${p.left}">
                    <i class="bi bi-arrow-left-right text-muted"></i>
                    <input type="text" class="form-control border-0 bg-white" value="${p.right}">
                    <button type="button" class="btn btn-sm btn-outline-danger border-0 rounded-circle" onclick="this.closest('.pair-row').remove()"><i class="bi bi-x-lg"></i></button>
                </div>
            `);
        });
    }

    // Робота з картинкою завдання
    if (task.image) {
        document.getElementById(`inlineTaskImage-${sectionId}`).value = task.image;
        const preview = document.getElementById(`inlineTaskImagePreview-${sectionId}`);
        preview.src = task.image;
        preview.style.display = 'block';
        document.getElementById(`deleteTaskImageBtn-${sectionId}`).style.display = 'block';
    }
};

// Функція для логіки Згорнути/Розгорнути опис
window.toggleCourseDescription = function() {
    const container = document.getElementById('courseDescContainer');
    const btn = document.getElementById('toggleDescBtn');
    const gradient = document.getElementById('descGradient');

    if (!container) return;

    // Перевіряємо, чи він зараз згорнутий (12em)
    if (container.style.maxHeight === '12em' || container.style.maxHeight === '') {
        // Розгортаємо на повну висоту контенту + запас для відступів
        container.style.maxHeight = container.scrollHeight + 50 + "px"; 
        gradient.style.display = 'none';
        btn.innerHTML = 'Згорнути <i class="bi bi-chevron-up"></i>';
    } else {
        // Згортаємо назад
        container.style.maxHeight = '12em';
        gradient.style.display = 'block';
        btn.innerHTML = 'Читати далі <i class="bi bi-chevron-down"></i>';
    }
};

window.toggleSectionDescription = function(sectionId) {
    const container = document.getElementById(`secDescContainer-${sectionId}`);
    const btn = document.getElementById(`toggleSecDescBtn-${sectionId}`);
    const gradient = document.getElementById(`secDescGradient-${sectionId}`);

    if (!container) return;

    if (container.style.maxHeight === '6em' || container.style.maxHeight === '') {
        container.style.maxHeight = '2000px'; 
        gradient.style.display = 'none';
        btn.innerHTML = 'Згорнути <i class="bi bi-chevron-up"></i>';
    } else {
        container.style.maxHeight = '6em';
        gradient.style.display = 'block';
        btn.innerHTML = 'Читати далі <i class="bi bi-chevron-down"></i>';
    }
};

// ==========================================
// 4. INLINE УПРАВЛІННЯ СЕКЦІЯМИ (ДОДАВАННЯ/РЕДАГУВАННЯ)
// ==========================================
const inlineSectionFormContainer = document.getElementById('inlineSectionFormContainer');
const inlineSectionForm = document.getElementById('inlineSectionForm');
const toggleSectionFormBtn = document.getElementById('toggleSectionFormBtn');

window.toggleInlineSectionForm = function(isEditing = false) {
    if (inlineSectionFormContainer.style.display === 'none' || isEditing) {
        inlineSectionFormContainer.style.display = 'block';
        toggleSectionFormBtn.style.display = 'none'; 
        
        if (!isEditing) {
            inlineSectionForm.reset();
            document.getElementById('inlineSectionId').value = "";
            document.getElementById('inlineSectionFormTitle').textContent = "Нова секція";
            document.getElementById('inlineSectionSubmitBtn').textContent = "Додати секцію";
        }
        
        inlineSectionFormContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
        inlineSectionFormContainer.style.display = 'none';
        toggleSectionFormBtn.style.display = 'block'; 
    }
};

window.openEditSectionInline = function(sectionId) {
    const section = currentCourse.sections.find(s => s._id === sectionId);
    if (!section) return;

    document.getElementById('inlineSectionId').value = section._id;
    document.getElementById('inlineSectionTitle').value = section.title || "";
    document.getElementById('inlineSectionDesc').value = section.description || "";
    document.getElementById('inlineSectionImage').value = section.image || "";
    
    document.getElementById('inlineSectionFormTitle').textContent = "Редагування секції";
    document.getElementById('inlineSectionSubmitBtn').textContent = "Зберегти зміни";
    
    toggleInlineSectionForm(true); 
};

inlineSectionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = document.getElementById('inlineSectionSubmitBtn');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Зберігаємо...';

    const sectionId = document.getElementById('inlineSectionId').value;
    const isEditing = !!sectionId;
    
    const body = {
        title: document.getElementById('inlineSectionTitle').value.trim(),
        description: document.getElementById('inlineSectionDesc').value.trim(),
        image: document.getElementById('inlineSectionImage').value.trim()
    };

    const url = isEditing 
        ? `${API_BASE_URL}/${courseId}/section/${sectionId}` 
        : `${API_BASE_URL}/${courseId}/section`;

    try {
        const res = await fetch(url, {
            method: isEditing ? 'PUT' : 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(body)
        });

        if (res.ok) {
            toggleInlineSectionForm(); 
            await loadCourseData(); 
        } else {
            const data = await res.json();
            alert(data.error || "Помилка при збереженні секції");
        }
    } catch (err) { 
        alert("Помилка сервера"); 
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
});

// ==========================================
// 5. INLINE УПРАВЛІННЯ ЗАВДАННЯМИ
// ==========================================

// Показати/сховати форму завдання для конкретної секції
window.toggleInlineTaskForm = function(sectionId, isEditing = false, taskId = null) {
    // Спочатку ховаємо всі інші відкриті форми завдань
    document.querySelectorAll('[id^="inlineTaskFormContainer-"]').forEach(el => {
        if(el.id !== `inlineTaskFormContainer-${sectionId}`) {
            el.style.display = 'none';
        }
    });
    document.querySelectorAll('[id^="addTaskBtn-"]').forEach(el => el.style.display = 'block');

    const formContainer = document.getElementById(`inlineTaskFormContainer-${sectionId}`);
    const addBtn = document.getElementById(`addTaskBtn-${sectionId}`);

    if (formContainer.style.display === 'none' || isEditing) {
        const formHTML = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h5 class="fw-bold text-success mb-0"><i class="bi bi-plus-circle me-2"></i>${isEditing ? 'Редагувати завдання' : 'Нове завдання'}</h5>
                <button type="button" class="btn-close" onclick="toggleInlineTaskForm('${sectionId}')"></button>
            </div>
            <form id="inlineTaskForm-${sectionId}" onsubmit="submitInlineTaskForm(event, '${sectionId}', '${taskId || ''}')">
                <div class="row g-4 mb-4">
                    <div class="col-md-5">
                        <label class="form-label fw-bold text-success fs-6">Тип завдання</label>
                        <select id="taskTypeSelect-${sectionId}" class="form-select border-0 bg-white py-3 px-4 fs-6 shadow-sm" onchange="buildInlineDynamicTaskFields('${sectionId}', this.value)" required style="border-radius: 12px; font-family: inherit;">
                            <option value="multiple">Multiple Choice (Тест)</option>
                            <option value="gap">Gap (Пропуск)</option>
                            <option value="matching">Matching (Пари)</option>
                            <option value="essay">Essay (Есе)</option>
                        </select>
                    </div>
                    <div class="col-md-7">
                        <label class="form-label fw-bold text-success fs-6">Заголовок</label>
                        <input type="text" class="form-control border-0 bg-white py-3 px-4 fs-5 shadow-sm" id="taskTitle-${sectionId}" required style="border-radius: 12px; font-family: inherit;">
                    </div>
                </div>

                <div class="mb-4">
                    <label class="form-label fw-bold text-success fs-6">Умова (опис)</label>
                    <textarea class="form-control border-0 bg-white py-3 px-4 fs-6 shadow-sm" id="taskDesc-${sectionId}" rows="3" style="border-radius: 12px; font-family: inherit;"></textarea>
                </div>

                <div id="dynamicTaskFields-${sectionId}" class="p-4 bg-white rounded-4 border border-success-subtle shadow-sm mb-4">
                </div>

                <div class="d-flex justify-content-end gap-3 pt-3 border-top">
                    <button type="button" class="btn btn-light fw-bold px-4 py-3 rounded-pill fs-6" onclick="toggleInlineTaskForm('${sectionId}')">Скасувати</button>
                    <button type="submit" class="btn btn-success fw-bold px-5 py-3 rounded-pill shadow-sm fs-6" id="taskSubmitBtn-${sectionId}">
                        <i class="me-2"></i> Зберегти завдання
                    </button>
                </div>
            </form>
        `;
        
        formContainer.innerHTML = formHTML;
        formContainer.style.display = 'block';
        addBtn.style.display = 'none';

        if (!isEditing) {
            buildInlineDynamicTaskFields(sectionId, "multiple");
        }

        formContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
        formContainer.style.display = 'none';
        addBtn.style.display = 'block';
        formContainer.innerHTML = ""; 
    }
};

window.buildInlineDynamicTaskFields = function(sectionId, type) {
    const container = document.getElementById(`dynamicTaskFields-${sectionId}`);
    if (!container) return;
    container.innerHTML = "";

    const imageBlockHTML = `
        <div class="p-4 border border-success-subtle rounded-4 bg-white mb-4 shadow-sm">
            <div class="d-flex align-items-center mb-3">
                <div class="bg-success text-white rounded-3 p-2 me-3" style="width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">
                    <i class="bi bi-image fs-5"></i>
                </div>
                <h6 class="fw-bold mb-0 text-success fs-6">Зображення завдання</h6>
            </div>
            <input type="hidden" id="inlineTaskImage-${sectionId}" value="">
            <div class="row align-items-center">
                <div class="col-lg-7">
                    <div class="d-flex flex-wrap gap-2">
                        <input type="file" id="taskImageFile-${sectionId}" class="form-control bg-light border-0" accept="image/*" style="max-width: 350px; border-radius: 10px; font-family: inherit;">
                        <button type="button" class="btn btn-secondary fw-bold px-4 rounded-3" onclick="uploadTaskImageInline('${sectionId}', event)">Завантажити</button>
                        <button type="button" id="deleteTaskImageBtn-${sectionId}" class="btn btn-outline-danger fw-bold px-3 rounded-3" style="display: none;" onclick="removeTaskImageInline('${sectionId}')">
                            <i class="bi bi-trash3"></i>
                        </button>
                    </div>
                </div>
                <div class="col-lg-5 text-center mt-3 mt-lg-0">
                    <img id="inlineTaskImagePreview-${sectionId}" src="" class="shadow-sm border" style="max-height: 150px; display: none; border-radius: 15px; object-fit: cover;">
                </div>
            </div>
        </div>
    `;

    if (type === "multiple") {
        container.innerHTML = imageBlockHTML + `
            <div class="mb-4 p-4 bg-white border border-success-subtle rounded-4 shadow-sm">
                <h6 class="fw-bold text-success mb-3 fs-6">Варіанти відповіді</h6>
                <div id="multipleOptions-${sectionId}">
                    <div class="d-flex gap-3 mb-2 align-items-center option-row p-2 border rounded-3 bg-light transition-all" onclick="selectRadio(this, '${sectionId}')">
                        <div class="form-check m-0 ms-2">
                            <input class="form-check-input border-success" type="radio" name="isCorrect-${sectionId}" checked style="transform: scale(1.3);" onclick="event.stopPropagation(); highlightSelected(this, '${sectionId}')">
                        </div>
                        <input type="text" class="form-control border-0 bg-white px-3 py-2 opt-text fw-medium" placeholder="Варіант 1" style="border-radius: 10px; font-family: inherit;" onclick="event.stopPropagation();">
                        <button type="button" class="btn btn-link text-danger p-1" onclick="event.stopPropagation(); this.parentElement.remove()"><i class="bi bi-trash3 fs-5"></i></button>
                    </div>
                </div>
                <button type="button" class="btn btn-outline-success rounded-pill mt-3 px-4 py-2 fw-bold w-100 shadow-sm" onclick="addMultipleOption('${sectionId}')">
                    <i class="bi bi-plus-lg me-1"></i> Додати варіант
                </button>
            </div>
            <div class="p-4 bg-white border border-success-subtle rounded-4 shadow-sm">
                <label class="form-label fw-bold text-success mb-2 small ms-1">Пояснення для студента</label>
                <textarea id="taskExplanation-${sectionId}" class="form-control bg-light border-0 py-3 px-4" rows="2" placeholder="Чому ця відповідь правильна?" style="border-radius: 12px; font-family: inherit;"></textarea>
            </div>`;
    } else if (type === "gap") {
        container.innerHTML = imageBlockHTML + `
            <div class="mb-4 p-4 bg-white border border-success-subtle rounded-4 shadow-sm">
                <label class="form-label fw-bold text-success small ms-1">Текст завдання (використовуйте ___ для пропуску)</label>
                <textarea id="gapText-${sectionId}" class="form-control bg-light border-0 py-3 px-4 mb-3" placeholder="She ___ a doctor." rows="2" style="border-radius: 15px; font-size: 1.1rem; font-family: inherit;"></textarea>
                <label class="form-label fw-bold text-success small ms-1">Правильна відповідь</label>
                <input type="text" id="gapAnswer-${sectionId}" class="form-control bg-light border-0 py-3 px-4 fs-5" placeholder="is" style="border-radius: 12px; font-family: inherit;">
            </div>
            <div class="p-4 bg-white border border-success-subtle rounded-4 shadow-sm">
                <label class="form-label fw-bold text-success mb-2 small ms-1">Пояснення</label>
                <textarea id="taskExplanation-${sectionId}" class="form-control bg-light border-0 py-3 px-4" rows="2" style="border-radius: 12px; font-family: inherit;"></textarea>
            </div>`;
    } else if (type === "matching") {
        container.innerHTML = imageBlockHTML + `
            <div class="mb-4 p-4 bg-white border border-success-subtle rounded-4 shadow-sm">
                <h6 class="fw-bold text-success mb-3 fs-6">Логічні пари</h6>
                <div id="matchingPairs-${sectionId}">
                    <div class="d-flex gap-2 mb-2 pair-row align-items-center p-2 border rounded-3 bg-light shadow-sm">
                        <input type="text" class="form-control border-0 bg-white pair-left" placeholder="Слово" style="border-radius: 8px; font-family: inherit;">
                        <i class="bi bi-arrow-left-right text-muted px-2"></i>
                        <input type="text" class="form-control border-0 bg-white pair-right" placeholder="Переклад" style="border-radius: 8px; font-family: inherit;">
                        <button type="button" class="btn btn-link text-danger p-1" onclick="this.closest('.pair-row').remove()"><i class="bi bi-trash3 fs-5"></i></button>
                    </div>
                </div>
                <button type="button" class="btn btn-outline-success rounded-pill mt-3 px-4 py-2 fw-bold w-100 shadow-sm" onclick="addMatchingPair('${sectionId}')">
                    <i class="bi bi-plus-lg me-1"></i> Додати пару
                </button>
            </div>
            <div class="p-4 bg-white border border-success-subtle rounded-4 shadow-sm">
                <label class="form-label fw-bold text-success mb-2 small ms-1">Пояснення</label>
                <textarea id="taskExplanation-${sectionId}" class="form-control bg-light border-0 py-3 px-4" rows="2" style="border-radius: 12px; font-family: inherit;"></textarea>
            </div>`;
    } else if (type === "essay") {
        container.innerHTML = imageBlockHTML + `
            <div class="mb-4 p-5 bg-white border border-success-subtle rounded-4 shadow-sm text-center">
                 <i class="bi bi-pencil-square fs-1 text-success opacity-50"></i>
                 <h5 class="fw-bold text-success mt-2">Есе / Відкрита відповідь</h5>
                <p class="text-muted mb-0">Студент отримає текстове поле для розгорнутої відповіді.</p>
            </div>
            <div class="p-4 bg-white border border-success-subtle rounded-4 shadow-sm">
                <label class="form-label fw-bold text-success mb-2 small ms-1">Тези або підказки для студента</label>
                <textarea id="taskExplanation-${sectionId}" class="form-control bg-light border-0 py-3 px-4" rows="4" placeholder="Напишіть підказки або структуру відповіді..." style="border-radius: 15px; font-family: inherit;"></textarea>
            </div>`;
    }
};

// Клік по всій картці варіанту
window.selectRadio = function(rowElement, sectionId) {
    const radio = rowElement.querySelector('input[type="radio"]');
    if(radio) {
        radio.checked = true;
        highlightSelected(radio, sectionId);
    }
};

// Візуальна підсвітка обраного варіанту
window.highlightSelected = function(radioElement, sectionId) {
    // Скидаємо стилі для всіх рядків у цій секції
    document.querySelectorAll(`#multipleOptions-${sectionId} .option-row`).forEach(row => {
        row.classList.remove('bg-light', 'border-success-subtle', 'border-2');
        row.classList.add('bg-white');
        const input = row.querySelector('.opt-text');
        input.classList.remove('bg-white');
        input.classList.add('bg-light');
        const r = row.querySelector('input[type="radio"]');
        if(r) r.classList.remove('border-success');
    });

    // Додаємо стилі обраному
    const selectedRow = radioElement.closest('.option-row');
    if (selectedRow) {
        selectedRow.classList.remove('bg-white');
        selectedRow.classList.add('bg-light', 'border-success-subtle', 'border-2');
        const input = selectedRow.querySelector('.opt-text');
        input.classList.remove('bg-light');
        input.classList.add('bg-white');
        radioElement.classList.add('border-success');
    }
};

window.addMultipleOption = function(sectionId) {
    const container = document.getElementById(`multipleOptions-${sectionId}`);
    
    // Рахуємо, скільки варіантів зараз є в контейнері, щоб визначити наступний номер
    const optionCount = container.querySelectorAll('.option-row').length + 1;

    container.insertAdjacentHTML('beforeend', `
        <div class="d-flex gap-3 mb-2 align-items-center option-row p-2 border rounded-3 bg-white shadow-sm transition-all" onclick="selectRadio(this, '${sectionId}')">
            <div class="form-check m-0 ms-2">
                <input class="form-check-input border-secondary" type="radio" name="isCorrect-${sectionId}" style="transform: scale(1.3); cursor: pointer;" title="Позначити як правильну" onclick="event.stopPropagation(); highlightSelected(this, '${sectionId}')">
            </div>
            <input type="text" class="form-control border-0 bg-light px-3 py-2 opt-text fw-medium" placeholder="Варіант ${optionCount}" onclick="event.stopPropagation();">
            <button type="button" class="btn btn-light text-danger border-0 rounded-circle me-1" onclick="event.stopPropagation(); this.parentElement.remove();" title="Видалити">
                <i class="bi bi-trash3"></i>
            </button>
        </div>
    `);
};

window.addMatchingPair = function(sectionId) {
    const container = document.getElementById(`matchingPairs-${sectionId}`);
    container.insertAdjacentHTML('beforeend', `
        <div class="d-flex gap-2 mb-2 pair-row align-items-center p-2 border rounded-3 bg-light shadow-sm">
            <input type="text" class="form-control border-0 bg-white pair-left" placeholder="Слово">
            <i class="bi bi-arrow-left-right text-muted"></i>
            <input type="text" class="form-control border-0 bg-white pair-right" placeholder="Переклад">
            <button type="button" class="btn btn-sm btn-outline-danger border-0 rounded-circle" onclick="this.closest('.pair-row').remove()"><i class="bi bi-x-lg"></i></button>
        </div>
    `);
};

window.submitInlineTaskForm = async function(e, sectionId, taskId) {
    e.preventDefault();
    
    const submitBtn = document.getElementById(`taskSubmitBtn-${sectionId}`);
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Зберігаємо...';

    const type = document.getElementById(`taskTypeSelect-${sectionId}`).value;
    const isEditing = !!taskId;

    const payload = {
        title: document.getElementById(`taskTitle-${sectionId}`).value.trim(),
        description: document.getElementById(`taskDesc-${sectionId}`).value.trim(),
        taskType: type,
        image: document.getElementById(`inlineTaskImage-${sectionId}`) ? document.getElementById(`inlineTaskImage-${sectionId}`).value : ""
    };

    if (type === "multiple") {
        const opts = [];
        document.querySelectorAll(`#multipleOptions-${sectionId} .d-flex`).forEach((row) => {
            const text = row.querySelector('.opt-text').value.trim();
            const isCorrect = row.querySelector('input[type="radio"]').checked;
            if (text) opts.push({ text, isCorrect });
        });
        payload.options = opts;
        payload.explanation = document.getElementById(`taskExplanation-${sectionId}`).value;
    } else if (type === "gap") {
        payload.gapText = document.getElementById(`gapText-${sectionId}`).value;
        payload.gapAnswer = document.getElementById(`gapAnswer-${sectionId}`).value;
        payload.explanation = document.getElementById(`taskExplanation-${sectionId}`).value;
    } else if (type === "matching") {
        const pairs = [];
        document.querySelectorAll(`#matchingPairs-${sectionId} .pair-row`).forEach((row) => {
            const left = row.querySelector('.pair-left').value.trim();
            const right = row.querySelector('.pair-right').value.trim();
            if (left && right) pairs.push({ left, right });
        });
        payload.pairs = pairs;
        payload.explanation = document.getElementById(`taskExplanation-${sectionId}`).value;
    } else if (type === "essay") {
        payload.explanation = document.getElementById(`taskExplanation-${sectionId}`).value;
    }

    const url = isEditing 
        ? `${API_BASE_URL}/${courseId}/section/${sectionId}/task/${taskId}`
        : `${API_BASE_URL}/${courseId}/section/${sectionId}/task`;
    
    try {
        const res = await fetch(url, {
            method: isEditing ? 'PUT' : 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            await loadCourseData(); 
        } else {
            alert("Помилка при збереженні завдання");
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Зберегти завдання';
        }
    } catch (err) { 
        alert("Помилка сервера"); 
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Зберегти завдання';
    }
};

// ==========================================
// 6. ВИДАЛЕННЯ СЕКЦІЙ ТА ЗАВДАНЬ
// ==========================================
window.deleteSection = async function(sectionId) {
    if (!confirm('Ви впевнені, що хочете видалити цю секцію з усіма завданнями?')) return;
    try {
        const res = await fetch(`${API_BASE_URL}/${courseId}/section/${sectionId}`, { 
            method: 'DELETE', headers: getAuthHeaders() 
        });
        if (res.ok) loadCourseData();
        else alert("Помилка видалення");
    } catch (err) { alert("Помилка сервера"); }
};

window.deleteTask = async function(sectionId, taskId) {
    if (!confirm('Видалити це завдання?')) return;
    try {
        const res = await fetch(`${API_BASE_URL}/${courseId}/section/${sectionId}/task/${taskId}`, { 
            method: 'DELETE', headers: getAuthHeaders()
        });
        if (res.ok) loadCourseData();
        else alert("Помилка видалення");
    } catch (err) { alert("Помилка сервера"); }
};

// ==========================================
// ФУНКЦІЯ ДЛЯ ПЕРЕВІРКИ ДОВЖИНИ ТЕКСТУ ТА ПОКАЗУ КНОПОК "ЧИТАТИ ДАЛІ"
// ==========================================
window.checkTextOverflows = function() {
    // 1. Перевірка головного опису курсу
    const descContainer = document.getElementById('courseDescContainer');
    const toggleBtn = document.getElementById('toggleDescBtn');
    const gradient = document.getElementById('descGradient');

    if (descContainer && toggleBtn && gradient) {
        // Перевіряємо тільки якщо опис зараз згорнутий
        if (descContainer.style.maxHeight === '12em' || descContainer.style.maxHeight === '') {
            if (descContainer.scrollHeight > descContainer.offsetHeight + 5) {
                toggleBtn.style.display = 'inline-block';
                gradient.style.display = 'block';
                toggleBtn.className = "btn btn-link text-success p-0 mt-3 text-decoration-none fw-bold fs-5";
                toggleBtn.innerHTML = 'Читати далі <i class="bi bi-chevron-down"></i>';
            } else {
                toggleBtn.style.display = 'none';
                gradient.style.display = 'none';
            }
        }
    }

    // 2. Перевірка описів кожної секції
    if (currentCourse && currentCourse.sections) {
        currentCourse.sections.forEach((section) => {
            const sectionId = section._id?.$oid || section._id;
            const secContainer = document.getElementById(`secDescContainer-${sectionId}`);
            const secBtn = document.getElementById(`toggleSecDescBtn-${sectionId}`);
            const secGradient = document.getElementById(`secDescGradient-${sectionId}`);

            if (secContainer && secBtn && secGradient) {
                if (secContainer.style.maxHeight === '6em' || secContainer.style.maxHeight === '') {
                    if (secContainer.scrollHeight > secContainer.offsetHeight + 5) {
                        secBtn.style.display = 'inline-block';
                        secGradient.style.display = 'block';
                    } else {
                        secBtn.style.display = 'none';
                        secGradient.style.display = 'none';
                    }
                }
            }
        });
    }
};

// ==========================================
// 🛠️ СИСТЕМА ГАРНИХ ПОВІДОМЛЕНЬ (LEXORA ALERT)
// ==========================================

function showAlert(title, text, type = 'success') {
    const titleEl = document.getElementById('alertModalTitle');
    const textEl = document.getElementById('alertModalText');
    const iconEl = document.getElementById('alertModalIcon');
    const iconBox = document.getElementById('alertModalIconBox');
    const btnEl = document.getElementById('alertModalBtn');

    titleEl.textContent = title;
    textEl.textContent = text;

    // Налаштовуємо візуал залежно від типу
    if (type === 'error') {
        iconBox.className = 'bg-danger bg-opacity-10 text-danger rounded-circle d-inline-flex align-items-center justify-content-center mb-3';
        iconEl.className = 'bi bi-x-circle-fill fs-2';
        btnEl.className = 'btn btn-danger rounded-pill w-100 fw-bold py-2 shadow-sm';
    } else if (type === 'warning') {
        iconBox.className = 'bg-warning bg-opacity-10 text-warning rounded-circle d-inline-flex align-items-center justify-content-center mb-3';
        iconEl.className = 'bi bi-exclamation-triangle-fill fs-2';
        btnEl.className = 'btn btn-warning text-dark rounded-pill w-100 fw-bold py-2 shadow-sm';
    } else {
        iconBox.className = 'bg-success bg-opacity-10 text-success rounded-circle d-inline-flex align-items-center justify-content-center mb-3';
        iconEl.className = 'bi bi-check-circle-fill fs-2';
        btnEl.className = 'btn btn-success rounded-pill w-100 fw-bold py-2 shadow-sm';
    }

    const modal = new bootstrap.Modal(document.getElementById('lexoraAlertModal'));
    modal.show();
}

// ==========================================
// 📩 ОНОВЛЕНЕ ЗАПРОШЕННЯ (БЕЗ ЖОДНИХ ALERT)
// ==========================================

window.sendInvitation = function() {
    const studentEmail = document.getElementById('inviteEmail').value.trim();
    
    // Валідація через модалку
    if (!studentEmail) {
        showAlert("Помилка", "Будь ласка, введіть email студента.", "error");
        return;
    }

    // Підставляємо email у модалку підтвердження (яку ми робили раніше)
    document.getElementById('displayInviteEmail').textContent = studentEmail;
    new bootstrap.Modal(document.getElementById('inviteConfirmModal')).show();
};

window.executeSendInvitation = async function() {
    const emailInput = document.getElementById('inviteEmail');
    const studentEmail = emailInput.value.trim();
    const courseId = new URLSearchParams(window.location.search).get('id'); 
    const messageInput = document.getElementById('inviteMessage');
    const message = messageInput ? messageInput.value.trim() : ''; 
    const token = localStorage.getItem('token'); 
    
    const btn = document.getElementById('btnExecuteInvite');
    const originalText = btn.innerHTML;

    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>...`;

    try {
        const res = await fetch('http://localhost:5002/api/invitations/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ courseId, studentEmail, message })
        });

        const data = await res.json();

        // Закриваємо модалку підтвердження перед показом результату
        bootstrap.Modal.getInstance(document.getElementById('inviteConfirmModal')).hide();

        if (res.ok) {
            // УСПІХ
            emailInput.value = ''; 
            if (messageInput) {
                 messageInput.value = 'Привіт! 👋 Запрошую тебе на свій курс...';
            }
            showAlert("Надіслано!", data.message);
            loadCourseInvitations();
        } else {
            // ПЕРЕВІРКА НА "ВЖЕ НАДІСЛАНО" ТА ІНШІ ПОМИЛКИ
            if (data.message.includes("вже надіслано")) {
                showAlert("Попередження", data.message, "warning");
            } else {
                showAlert("Помилка", data.message, "error");
            }
        }
    } catch (err) {
        showAlert("Помилка", "Сервер не відповідає. Спробуйте пізніше.", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
};

// 1. Функція завантаження всіх інвайтів курсу
async function loadCourseInvitations() {
    const courseId = new URLSearchParams(window.location.search).get('id');
    const token = localStorage.getItem('token');
    
    try {
        // ПЕРЕВІР ЦЕЙ РЯДОК! ТУТ МАЄ БУТИ ПОВНИЙ URL АБО ПРАВИЛЬНИЙ ВІДНОСНИЙ ШЛЯХ
        const res = await fetch(`http://localhost:5002/api/invitations/course/${courseId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        // Додаємо перевірку, чи відповідь успішна, ПЕРЕД парсингом JSON
        if (!res.ok) {
            throw new Error(`Помилка сервера: ${res.status} ${res.statusText}`);
        }

        const invites = await res.json();
        renderInvitations(invites);
        
    } catch (err) {
        console.error("Помилка завантаження інвайтів:", err);
    }
}

// 2. Функція малювання карток у списках
function renderInvitations(invites) {
    lastInvitesList = invites; 
    const pendingList = document.getElementById('pendingInvitesList');
    const activeList = document.getElementById('activeStudentsList');
    const rejectedList = document.getElementById('rejectedInvitesList'); // Новий список
    
    const rejectedBlock = document.getElementById('rejectedBlock'); // ДОДАЙ ЦЕЙ РЯДОК

    const pendingCount = document.getElementById('pendingCount');
    const studentsCount = document.getElementById('studentsCount');
    const rejectedCount = document.getElementById('rejectedCount'); // Новий лічильник

    // Очищаємо списки перед рендером
    if (pendingList) pendingList.innerHTML = '';
    if (activeList) activeList.innerHTML = '';
    if (rejectedList) rejectedList.innerHTML = '';

    // Сортуємо інвайти по статусах
    const pendingArr = invites.filter(i => i.status === 'pending');
    const acceptedArr = invites.filter(i => i.status === 'accepted');
    const rejectedArr = invites.filter(i => i.status === 'rejected'); // Знаходимо відхилені

    // Оновлюємо лічильники
    if (pendingCount) pendingCount.textContent = pendingArr.length;
    if (studentsCount) studentsCount.textContent = acceptedArr.length;
    if (rejectedCount) rejectedCount.textContent = rejectedArr.length;

    // 1. Рендеримо тих, хто очікує
    if (pendingList) {
        if (pendingArr.length === 0) {
            pendingList.innerHTML = `<div class="p-4 text-center text-muted bg-light">Немає активних запитів</div>`;
        } else {
            pendingArr.forEach(invite => {
                const dateObj = new Date(invite.createdAt);
                const formattedDate = dateObj.toLocaleDateString('uk-UA');
                const formattedTime = dateObj.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });

                const messageHtml = invite.message 
                    ? `<div class="mt-2 p-2 bg-white rounded border shadow-sm small fst-italic text-secondary">"${invite.message}"</div>` 
                    : '';

                pendingList.innerHTML += `
                    <div class="list-group-item d-flex justify-content-between align-items-start p-3 border-0 border-bottom">
                        <div class="flex-grow-1 me-3">
                            <div class="fw-bold text-dark">${invite.studentEmail}</div>
                            <div class="text-muted small mb-1">
                                <i class="bi bi-clock me-1"></i> Надіслано: ${formattedDate} о ${formattedTime}
                            </div>
                            ${messageHtml}
                        </div>
                        <div class="d-flex align-items-center gap-2 mt-1">
                            <span class="badge bg-warning text-dark rounded-pill">Очікуємо відповіді</span>
                            <button onclick="confirmInvitationDeletion('${invite._id}')" 
                                    class="btn btn-link text-muted p-0 hover-danger" 
                                    title="Видалити запис">
                                <i class="bi bi-trash3" style="font-size: 1.3rem;"></i>
                            </button>
                        </div>
                    </div>
                `;
            });
        }
    }

    // 2. Рендеримо ВІДХИЛЕНІ
    if (rejectedBlock && rejectedList) {
        if (rejectedArr.length === 0) {
            // Якщо відхилених немає — повністю ховаємо блок
            rejectedBlock.style.display = 'none'; 
        } else {
            // Якщо є — показуємо блок
            rejectedBlock.style.display = 'block'; 
            
            rejectedArr.forEach(invite => {
                rejectedList.innerHTML += `
                    <div class="list-group-item d-flex justify-content-between align-items-center p-3 border-0 border-bottom bg-white shadow-sm mb-2 rounded-3">
                        
                        <div class="d-flex align-items-center">
                            <div class="bg-light text-secondary rounded-circle d-flex align-items-center justify-content-center me-3" 
                                style="width: 50px; height: 50px; border: 1px solid #dee2e6;">
                                <i class="bi bi-person-x" style="font-size: 1.5rem;"></i>
                            </div>
                            <div>
                                <div class="fw-bold text-dark fs-5" style="letter-spacing: -0.01em;">
                                    ${invite.studentEmail}
                                </div>
                                <small class="text-danger fw-medium" style="font-size: 0.95rem;">
                                    Запит відхилено студентом
                                </small>
                            </div>
                        </div>

                        <div class="d-flex align-items-center gap-3">
                            <span class="badge bg-danger bg-opacity-10 text-danger rounded-pill px-3 py-2 border border-danger border-opacity-25" 
                                style="font-size: 0.9rem; font-weight: 600;">
                                Відхилено
                            </span>
                            <button onclick="revokeInvitation('${invite._id}')" 
                                    class="btn btn-link text-muted p-0 hover-danger" 
                                    title="Видалити запис">
                                <i class="bi bi-trash3" style="font-size: 1.3rem;"></i>
                            </button>
                        </div>
                        
                    </div>
                `;
            });
        }
    }

    // 3. Рендеримо вже прийнятих студентів
    // 3. Рендеримо вже прийнятих студентів
    if (activeList) {
        if (acceptedArr.length === 0) {
            activeList.innerHTML = `<div class="p-4 text-center text-muted bg-light border-0 rounded-3">Студентів поки немає</div>`;
        } else {
            // Усередині renderInvitations, для acceptedArr.forEach:
            acceptedArr.forEach(invite => {
                const avatarHtml = invite.studentAvatar 
                    ? `<img src="${invite.studentAvatar}" class="rounded-circle me-3 shadow-sm" style="width: 45px; height: 45px; object-fit: cover; border: 2px solid #fff;">`
                    : `<div class="bg-success text-white rounded-circle d-flex align-items-center justify-content-center me-3 fw-bold" style="width: 45px; height: 45px; font-size: 1.2rem;">
                        ${(invite.studentName || invite.studentEmail).charAt(0).toUpperCase()}
                    </div>`;

                activeList.innerHTML += `
                    <div class="list-group-item d-flex justify-content-between align-items-center p-3 mb-2 border-0 shadow-sm rounded-4 bg-white student-row" 
                        onclick="showStudentDetails('${invite.studentId}')" 
                        style="cursor: pointer; transition: transform 0.2s;">
                        <div class="d-flex align-items-center">
                            ${avatarHtml}
                            <div>
                                <div class="fw-bold text-dark fs-5">${invite.studentName || "Учень"}</div>
                                <small class="text-muted">${invite.studentEmail}</small>
                            </div>
                        </div>
                        <i class="bi bi-arrow-right-short fs-3 text-muted"></i>
                    </div>
                `;
            });
        }
    }
}

// Функція відкликання інвайту


// ==========================================
// ====== ВІДРАХУВАННЯ СТУДЕНТА ======
// ==========================================
window.removeStudent = async function(studentId, studentName) {
    if (!studentId) {
        alert("Помилка: Неможливо знайти ID студента.");
        return;
    }

    if (!confirm(`Ви дійсно хочете відрахувати студента ${studentName || ''} з цього курсу?\n\nВін втратить доступ до матеріалів, але ви зможете запросити його знову.`)) {
        return;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/${courseId}/remove-student`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ studentId })
        });

        const data = await res.json();

        if (res.ok) {
            // Перезавантажуємо список інвайтів після успішного видалення
            const invitesRes = await fetch(`http://localhost:5002/api/invitations/course/${courseId}`, {
                headers: getAuthHeaders()
            });
            const invitesList = await invitesRes.json();
            renderInvitations(invitesList);
            
            // Якщо є функція показника успіху, можеш використати її, або просто alert
            alert("✅ " + data.message);
        } else {
            alert("❌ Помилка: " + data.message);
        }
    } catch (err) {
        console.error("Помилка відрахування:", err);
        alert("Помилка з'єднання з сервером при відрахуванні студента.");
    }
};

// ==========================================
// ====== ДЕТАЛІ СТУДЕНТА (МОНІТОРИНГ) ======
// ==========================================
// ==========================================
// ====== ДЕТАЛІ СТУДЕНТА (МОНІТОРИНГ) ======
// ==========================================
window.showStudentDetails = async function(studentId) {
    window.currentStudentId = studentId; 
    const detailsArea = document.getElementById('studentDetailsArea');
    const content = document.getElementById('studentDetailsContent');
    
    if (detailsArea.style.display === 'block' && detailsArea.dataset.currentStudent === studentId) {
        detailsArea.style.display = 'none';
        detailsArea.dataset.currentStudent = '';
        return; 
    }

    // Універсальний пошук даних студента (щоб не було "Невідомо")
    let sName = "Студент";
    let sEmail = "Електронна пошта невідома";
    let sAvatar = null;

    const toString = (id) => (id?.$oid || id || "").toString();
    
    // Шукаємо або в інвайтах, або в загальному списку
    const invite = lastInvitesList.find(i => toString(i.studentId) === toString(studentId));
    const enrolled = allCourseStudents.find(s => toString(s._id) === toString(studentId));

    if (invite) {
        sName = invite.studentName || invite.studentEmail;
        sEmail = invite.studentEmail;
        sAvatar = invite.studentAvatar;
    } else if (enrolled) {
        sName = enrolled.name;
        sEmail = enrolled.email;
        sAvatar = enrolled.avatar;
    }

    detailsArea.style.display = 'block';
    detailsArea.dataset.currentStudent = studentId;
    content.innerHTML = `<div class="card border-0 shadow-lg rounded-4 p-5 text-center"><div class="spinner-border text-success" role="status"></div><div class="mt-3 text-muted fw-bold">Збираємо аналітику для ${sName}...</div></div>`;
    detailsArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // Далі твій блок try { ... } без змін
    try {
        const token = localStorage.getItem('token');
        const statsRes = await fetch(`http://localhost:5002/api/results/user-stats/${studentId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const allResults = await statsRes.json();

        const courseResults = allResults.filter(r => 
            (r.course?._id?.$oid || r.course?._id || r.course)?.toString() === courseId
        );

        let totalAttempts = courseResults.length;
        let avgScore = 0;
        let completedSectionsCount = 0;
        let quality = { exc: 0, good: 0, bad: 0 };
        let lastActivityText = '<span class="text-muted">Ще не починав навчання</span>';
        let recentHistoryHtml = '';

        const totalSectionsCourse = (typeof currentCourse !== 'undefined' && currentCourse.sections) ? currentCourse.sections.length : 1;

        if (totalAttempts > 0) {
            const sum = courseResults.reduce((acc, r) => acc + (r.score / r.total) * 100, 0);
            avgScore = Math.round(sum / totalAttempts);

            const uniqueSections = new Set(courseResults.map(r => r.sectionIdx));
            completedSectionsCount = uniqueSections.size;

            courseResults.forEach(r => {
                const p = r.score / r.total;
                if (p >= 0.9) quality.exc++;          
                else if (p >= 0.7) quality.good++;    
                else quality.bad++;                   
            });

            const sortedResults = [...courseResults].sort((a,b) => new Date(b.completedAt) - new Date(a.completedAt));
            const lastDate = new Date(sortedResults[0].completedAt);
            lastActivityText = `<span class="fw-bold text-dark">${lastDate.toLocaleDateString('uk-UA')}</span> о ${lastDate.toLocaleTimeString('uk-UA', {hour: '2-digit', minute:'2-digit'})}`;

            // 🔥 ПАГІНАЦІЯ
            const ITEMS_PER_PAGE = 5;
            window.currentHistoryPage = 1;
            window.currentStudentResults = sortedResults;
            
            recentHistoryHtml = `
                <div class="list-group list-group-flush" id="studentHistoryList">
                    ${generateHistoryHtml(sortedResults.slice(0, ITEMS_PER_PAGE))}
                </div>
            `;

            if (sortedResults.length > ITEMS_PER_PAGE) {
                recentHistoryHtml += `
                    <div class="text-center mt-3 mb-2" id="loadMoreHistoryContainer">
                        <button class="btn btn-outline-success btn-sm rounded-pill px-4 fw-bold shadow-sm" 
                                onclick="loadMoreHistory()">
                            <i class="bi bi-arrow-clockwise me-1"></i> Показати ще
                        </button>
                    </div>
                `;
            }
        }

        const progressPercent = Math.min(100, Math.round((completedSectionsCount / totalSectionsCourse) * 100));

        // 🔥 ПОВЕРТАЄМО ВАШ ОРИГІНАЛЬНИЙ HTML ТЕМПЛЕЙТ
        content.innerHTML = `
            <div class="card border-0 shadow-sm rounded-4 overflow-hidden animate__animated animate__fadeIn position-relative" style="background: #fff;">
                <button type="button" class="btn-close position-absolute top-0 end-0 m-3" aria-label="Close" onclick="document.getElementById('studentDetailsArea').style.display='none'; document.getElementById('studentDetailsArea').dataset.currentStudent='';"></button>

                <div class="card-body p-4 pt-5">
                    <div class="row align-items-center mb-4">
                        <div class="col-auto">
                            ${sAvatar 
                                ? `<img src="${sAvatar}" class="rounded-circle shadow-sm" style="width: 70px; height: 70px; object-fit: cover; border: 3px solid #f1f8e9;">`
                                : `<div class="bg-success text-white rounded-circle d-flex align-items-center justify-content-center shadow-sm fw-bold" style="width: 70px; height: 70px; font-size: 2rem;">${sName.charAt(0).toUpperCase()}</div>`
                            }
                        </div>
                        <div class="col">
                            <h4 class="fw-bold text-dark mb-0">${sName}</h4>
                            <p class="text-muted mb-0 small"><i class="bi bi-envelope me-1"></i>${sEmail}</p>
                        </div>
                    </div>

                    <div class="row g-3 mb-4">
                        <div class="col-md-4">
                            <div class="p-3 rounded-4 border bg-light h-100 d-flex flex-column justify-content-center">
                                <h6 class="fw-bold text-success text-uppercase mb-2" style="font-size: 0.75rem; letter-spacing: 0.5px;">Прогрес курсу</h6>
                                <div class="d-flex justify-content-between align-items-end mb-1">
                                    <span class="fs-3 fw-bold text-dark lh-1">${progressPercent}%</span>
                                    <span class="small text-muted mb-1">${completedSectionsCount} з ${totalSectionsCourse} тем</span>
                                </div>
                                <div class="progress" style="height: 8px; border-radius: 10px;">
                                    <div class="progress-bar bg-success" style="width: ${progressPercent}%;"></div>
                                </div>
                            </div>
                        </div>

                        <div class="col-md-4">
                            <div class="p-3 rounded-4 border bg-light h-100 d-flex flex-column justify-content-between">
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <h6 class="fw-bold text-success text-uppercase mb-0" style="font-size: 0.7rem; letter-spacing: 0.5px;">Середній бал</h6>
                                    <div class="fs-4 fw-bolder lh-1 ${avgScore >= 70 ? 'text-success' : (avgScore >= 40 ? 'text-warning' : 'text-danger')}">${avgScore}%</div>
                                </div>
                                <div class="d-flex flex-column gap-1">
                                    <div class="d-flex align-items-center justify-content-between small px-2 py-1 rounded-2" style="background-color: rgba(25, 135, 84, 0.05);">
                                        <span class="text-success" style="font-size: 0.75rem;"><i class="bi bi-circle-fill me-2" style="font-size: 0.4rem;"></i>Відмінно</span>
                                        <span class="fw-bold text-success">${quality.exc}</span>
                                    </div>
                                    <div class="d-flex align-items-center justify-content-between small px-2 py-1 rounded-2" style="background-color: rgba(255, 193, 7, 0.05);">
                                        <span class="text-warning" style="color: #856404 !important; font-size: 0.75rem;"><i class="bi bi-circle-fill me-2" style="font-size: 0.4rem;"></i>Добре</span>
                                        <span class="fw-bold" style="color: #856404 !important;">${quality.good}</span>
                                    </div>
                                    <div class="d-flex align-items-center justify-content-between small px-2 py-1 rounded-2" style="background-color: rgba(220, 53, 69, 0.05);">
                                        <span class="text-danger" style="font-size: 0.75rem;"><i class="bi bi-circle-fill me-2" style="font-size: 0.4rem;"></i>Погано</span>
                                        <span class="fw-bold text-danger">${quality.bad}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="col-md-4">
                            <div class="p-3 rounded-4 border bg-light h-100 d-flex flex-column justify-content-center">
                                <h6 class="fw-bold text-success text-uppercase mb-3" style="font-size: 0.75rem; letter-spacing: 0.5px;">Активність</h6>
                                <p class="small mb-2 text-secondary"><i class="bi bi-clock-history me-2"></i>Остання дія:</p>
                                <div class="mb-2">${lastActivityText}</div>
                                <p class="small mb-0 text-secondary"><i class="bi bi-journal-check me-2"></i>Всього спроб: <strong class="text-dark">${totalAttempts}</strong></p>
                            </div>
                        </div>
                    </div>

                    ${totalAttempts > 0 ? `
                    <div class="mt-4 border-top pt-3">
                        <h6 class="fw-bold text-dark mb-3 fs-6">Останні пройдені завдання:</h6>
                        ${recentHistoryHtml}
                    </div>
                    ` : ''}

                    <div class="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
                        <button class="btn btn-success rounded-pill px-4 fw-bold shadow-sm" 
                                onclick="window.location.href='teacher-messages.html?chatWith=${studentId}'">
                            <i class="bi bi-chat-dots me-2"></i>Написати
                        </button>
                    </div>
                </div>
            </div>
        `;
    } catch (err) {
        console.error("Помилка завантаження статистики:", err);
        content.innerHTML = `<div class="alert alert-danger rounded-4 m-3">Помилка завантаження даних моніторингу.</div>`;
    }
};
// ==========================================
// ДОПОМІЖНІ ФУНКЦІЇ ДЛЯ ІСТОРІЇ (ПАГІНАЦІЯ ТА РЕНДЕР)
// ==========================================

function generateHistoryHtml(resultsArray) {
    return resultsArray.map(r => {
        const p = Math.round((r.score / r.total) * 100);
        const badgeColor = p >= 70 ? 'bg-success' : (p >= 40 ? 'bg-warning text-dark' : 'bg-danger');

        let sectionTitle = `Секція ${r.sectionIdx + 1}`;
        let currentSection = null;
        
        if (typeof currentCourse !== 'undefined' && currentCourse.sections && currentCourse.sections[r.sectionIdx]) {
            currentSection = currentCourse.sections[r.sectionIdx];
            sectionTitle = `${sectionTitle}: ${currentSection.title}`;
        }

        let answersHtml = '';
        if (r.answers && r.answers.length > 0) {
            const taskAccordionId = `tasks-accordion-${r._id}`;
            answersHtml = `<div class="accordion custom-accordion-sm mt-3" id="${taskAccordionId}">`;
            
            r.answers.forEach((ans, idx) => {
                const isOk = ans.isCorrect;
                const typeMap = { 'multiple': 'Тест', 'gap': 'Впишіть слово', 'matching': 'З\'єднання', 'essay': 'Есе' };
                const taskTypeName = typeMap[ans.taskType] || 'Завдання';

                const qText = ans.questionText || `Завдання №${ans.taskId + 1}`;
                const uAnswer = ans.userAnswerText || (typeof ans.userAnswer === 'number' ? `Варіант №${ans.userAnswer + 1}` : ans.userAnswer) || "Немає відповіді";
                const cAnswer = ans.correctAnswerText || "";

                const statusColor = isOk ? 'success' : 'danger';
                const statusIcon = isOk ? 'bi-check-circle-fill' : 'bi-x-circle-fill';

                // Деталі завдання
                let taskDescription = '';
                let taskImageHtml = '';
                let taskOptionsHtml = '';

                if (currentSection && currentSection.tasks && currentSection.tasks[ans.taskId]) {
                    const originalTask = currentSection.tasks[ans.taskId];
                    
                    if (originalTask.description && originalTask.description !== originalTask.title) {
                        taskDescription = `<p class="text-muted small mb-2 fst-italic">${originalTask.description}</p>`;
                    }

                    if (originalTask.image) {
                        taskImageHtml = `
                            <div class="mb-3 mt-2 text-center">
                                <img src="${originalTask.image}" class="img-fluid rounded-3 shadow-sm border" style="max-height: 200px; cursor: pointer; transition: transform 0.2s;" onclick="this.classList.toggle('fullscreen-img')" title="Натисніть, щоб збільшити">
                            </div>
                        `;
                    }

                    if (ans.taskType === 'multiple' && originalTask.options) {
                        taskOptionsHtml = `<div class="bg-light p-2 rounded-3 mb-3 border border-secondary-subtle">
                            <span class="d-block small text-muted mb-1 fw-bold">Варіанти відповідей:</span>
                            <ul class="list-unstyled mb-0 small ps-2" style="column-count: 2;">`;
                        
                        originalTask.options.forEach((opt, optIdx) => {
                            let liStyle = "";
                            let icon = "bi-circle";
                            // Перевіряємо, чи опція є об'єктом {text, isCorrect} чи просто рядком
                            let optText = typeof opt === 'object' ? opt.text : opt;
                            let isOptCorrect = typeof opt === 'object' ? opt.isCorrect : (optIdx === originalTask.correctOption);
                            
                            if (isOptCorrect) {
                                liStyle = "color: var(--primary-color); font-weight: bold;";
                                icon = "bi-check-circle-fill text-success";
                            } else if (ans.userAnswer === optIdx || ans.userAnswerText === optText) {
                                liStyle = "color: #dc3545; text-decoration: line-through;";
                                icon = "bi-x-circle-fill text-danger";
                            }

                            taskOptionsHtml += `<li style="${liStyle}"><i class="bi ${icon} me-1"></i> ${optText}</li>`;
                        });
                        taskOptionsHtml += `</ul></div>`;
                    }
                }

                // Статус відповіді
                // ==========================================
                // СТАТУС ВІДПОВІДІ СТУДЕНТА (detailsHtml)
                // ==========================================
                let detailsHtml = '';
                
                // 🔥 СПЕЦІАЛЬНИЙ БЛОК ТІЛЬКИ ДЛЯ ЛОГІЧНИХ ПАР 🔥
                if (ans.taskType === 'matching') {
                    let studentPairsHtml = '';
                    let studentAnswerObj = ans.userAnswer;
                    
                    // Пробуємо розпарсити, якщо це прийшло як рядок
                    if (typeof studentAnswerObj === 'string') {
                        try { studentAnswerObj = JSON.parse(studentAnswerObj); } catch(e) {}
                    }
                    
                    if (Array.isArray(studentAnswerObj) && studentAnswerObj.length > 0) {
                        studentAnswerObj.forEach(pair => {
                            let isThisPairCorrect = false;
                            let correctRightSide = "Невідомо";

                            // Шукаємо, як мало бути правильно
                            if (currentSection && currentSection.tasks && currentSection.tasks[ans.taskId] && currentSection.tasks[ans.taskId].pairs) {
                                const origPair = currentSection.tasks[ans.taskId].pairs.find(p => p.left === pair.left);
                                if (origPair) {
                                    correctRightSide = origPair.right;
                                    if (origPair.right === pair.right) {
                                        isThisPairCorrect = true;
                                    }
                                }
                            }

                            if (isThisPairCorrect) {
                                // Якщо з'єднав правильно - зелена рамка
                                studentPairsHtml += `
                                    <div class="d-flex align-items-center bg-white border border-success rounded shadow-sm overflow-hidden mb-1" style="font-size: 0.85rem;">
                                        <div class="p-2 fw-bold text-dark border-end border-success" style="width: 40%;">${pair.left}</div>
                                        <div class="p-2 text-center text-success" style="width: 10%;"><i class="bi bi-check-lg fs-5"></i></div>
                                        <div class="p-2 text-success fw-medium" style="width: 50%;">${pair.right}</div>
                                    </div>
                                `;
                            } else {
                                // Якщо помилився - червона рамка і показуємо, що він вибрав, а що треба було
                                studentPairsHtml += `
                                    <div class="d-flex align-items-stretch bg-white border border-danger rounded shadow-sm overflow-hidden mb-2" style="font-size: 0.85rem;">
                                        <div class="p-2 fw-bold text-dark border-end border-danger d-flex align-items-center" style="width: 35%;">${pair.left}</div>
                                        <div class="p-2 text-center text-danger d-flex align-items-center justify-content-center border-end border-danger bg-danger bg-opacity-10" style="width: 10%;"><i class="bi bi-x-lg fs-5"></i></div>
                                        <div class="d-flex flex-column" style="width: 55%;">
                                            <div class="p-1 px-2 border-bottom border-danger text-danger bg-danger bg-opacity-10">
                                                <small class="opacity-75 d-block" style="font-size: 0.65rem;">Студент обрав:</small>
                                                <strike>${pair.right}</strike>
                                            </div>
                                            <div class="p-1 px-2 text-success bg-success bg-opacity-10">
                                                <small class="opacity-75 d-block" style="font-size: 0.65rem;">Правильно:</small>
                                                <span class="fw-bold">${correctRightSide}</span>
                                            </div>
                                        </div>
                                    </div>
                                `;
                            }
                        });
                    } else {
                        studentPairsHtml = `<div class="text-muted small p-2 bg-white rounded border">Студент не дав відповіді або дані пошкоджені.</div>`;
                    }

                    if (isOk) {
                        detailsHtml = `
                            <div class="p-3 bg-success bg-opacity-10 rounded-3 mb-3 border border-success border-opacity-25">
                                <span class="text-success d-block mb-2 fw-bold"><i class="bi bi-check-circle-fill me-1"></i> Відповідь студента (Все правильно):</span> 
                                ${studentPairsHtml}
                            </div>`;
                    } else {
                        detailsHtml = `
                            <div class="p-3 bg-danger bg-opacity-10 rounded-3 mb-3 border border-danger border-opacity-25">
                                <span class="text-danger d-block mb-2 fw-bold"><i class="bi bi-x-circle-fill me-1"></i> Відповідь студента (Є помилки):</span> 
                                ${studentPairsHtml}
                            </div>`;
                    }
                } 
                // 🔥 ДЛЯ ВСІХ ІНШИХ ТИПІВ ЗАВДАНЬ (Тести, Gap Fill, Essay) 🔥
                else {
                    if (isOk) {
                        detailsHtml = `<div class="p-3 bg-light rounded-3 text-dark small mb-3 border"><span class="text-muted d-block mb-1">Відповідь студента:</span> <span class="fw-bold fs-6">${uAnswer}</span></div>`;
                    } else {
                        detailsHtml = `
                            <div class="row g-2 mb-3">
                                <div class="col-md-6">
                                    <div class="p-3 bg-danger bg-opacity-10 rounded-3 text-danger small h-100 border border-danger border-opacity-25">
                                        <span class="d-block mb-1 opacity-75">Студент відповів:</span> 
                                        <span class="fw-bold fs-6"><strike>${uAnswer}</strike></span>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="p-3 bg-success bg-opacity-10 rounded-3 text-success small h-100 border border-success border-opacity-25">
                                        <span class="d-block mb-1 opacity-75">Правильна відповідь:</span> 
                                        <span class="fw-bold fs-6">${cAnswer !== "Інформація недоступна" ? cAnswer : "Перевіряється..."}</span>
                                    </div>
                                </div>
                            </div>
                        `;
                    }
                }

                const taskCollapseId = `collapse-task-${r._id}-${idx}`;

                // Логіка для коментарів та обговорень
                const existingComment = ans.teacherComment || null; 
                const safeTaskTitle = String(qText || '').replace(/"/g, '&quot;');
                const safeUserAnswer = String(uAnswer || '').replace(/"/g, '&quot;');
                
                const commentIndicator = existingComment 
                    ? `<span class="badge bg-warning text-dark ms-2 py-1 px-2 rounded-pill shadow-sm" title="Є обговорення"><i class="bi bi-chat-text-fill"></i></span>` 
                    : '';

                let feedbackSectionHtml = '';
                if (existingComment) {
                    feedbackSectionHtml = `
                        <div class="mt-3 pt-3 border-top border-opacity-10">
                            <button class="btn btn-sm w-100 text-start d-flex justify-content-between align-items-center" 
                                    style="background-color: #fff3cd; color: #664d03; border: 1px solid #ffecb5; border-radius: 8px; transition: all 0.2s;" 
                                    type="button" data-bs-toggle="collapse" data-bs-target="#chat-${taskCollapseId}"
                                    onclick="loadTaskChat('${window.currentStudentId}', '${r._id}', '${ans.taskId}', 'chat-container-${taskCollapseId}')">
                                <span class="fw-bold"><i class="bi bi-chat-text-fill me-2"></i>Переглянути обговорення</span>
                                <i class="bi bi-chevron-expand"></i>
                            </button>
                            <div class="collapse mt-2" id="chat-${taskCollapseId}">
                                <div class="p-3 rounded-3" style="background-color: #fafafa; border: 1px solid #eee;">
                                    <div id="chat-container-${taskCollapseId}" style="max-height: 200px; overflow-y: auto; margin-bottom: 10px; padding-right: 5px;">
                                        <div class="text-center text-muted small"><span class="spinner-border spinner-border-sm me-1" role="status"></span> Завантаження...</div>
                                    </div>
                                    <div class="text-end mt-2 pt-2 border-top">
                                         <button class="btn btn-sm btn-outline-success rounded-pill px-3 shadow-sm" 
                                            data-student="${window.currentStudentId}" data-result="${r._id}" data-task="${ans.taskId}" 
                                            data-title="${safeTaskTitle}" data-answer="${safeUserAnswer}" data-section="${r.sectionIdx}"
                                            onclick="triggerFeedback(this)">
                                            <i class="bi bi-reply-fill me-1"></i>Відповісти
                                         </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                } else {
                    feedbackSectionHtml = `
                        <div class="d-flex justify-content-end mt-3 pt-3 border-top border-opacity-10">
                            <button class="btn btn-sm btn-outline-success rounded-pill px-4 fw-bold shadow-sm" 
                                data-student="${window.currentStudentId}" data-result="${r._id}" data-task="${ans.taskId}" 
                                data-title="${safeTaskTitle}" data-answer="${safeUserAnswer}" data-section="${r.sectionIdx}"
                                onclick="triggerFeedback(this)">
                                <i class="bi bi-chat-dots me-2"></i>Написати студенту
                            </button>
                        </div>
                    `;
                }

                answersHtml += `
                    <div class="accordion-item border-0 mb-2 bg-transparent shadow-none">
                        <h2 class="accordion-header">
                            <button class="accordion-button collapsed p-3 rounded-3 bg-white border shadow-sm d-flex align-items-center" type="button" data-bs-toggle="collapse" data-bs-target="#${taskCollapseId}" style="font-size: 0.95rem;">
                                <div class="d-flex align-items-center w-100 me-3">
                                    <i class="bi ${statusIcon} text-${statusColor} fs-5 me-3"></i>
                                    <div class="flex-grow-1 text-truncate pe-2 d-flex align-items-center">
                                        <span class="fw-bold text-dark me-2">Завдання ${idx + 1}</span>
                                        ${commentIndicator} 
                                        <span class="text-muted small text-truncate d-none d-sm-inline-block ms-2" style="max-width: 180px;">${qText}</span>
                                    </div>
                                    <span class="badge bg-${statusColor} bg-opacity-10 text-${statusColor} border border-${statusColor} border-opacity-25 ms-auto">${taskTypeName}</span>
                                </div>
                            </button>
                        </h2>
                        
                        <div id="${taskCollapseId}" class="accordion-collapse collapse" data-bs-parent="#${taskAccordionId}">
                            <div class="accordion-body bg-white border border-top-0 rounded-bottom-3 p-4 pt-3 mt-n1 shadow-sm">
                                <div class="mb-4 pb-3 border-bottom">
                                    <h6 class="text-muted mb-2 text-uppercase" style="font-size: 0.7rem; letter-spacing: 0.5px;">Умова завдання</h6>
                                    <p class="text-dark fw-bold mb-1">${qText}</p>
                                    ${taskDescription}
                                    ${taskImageHtml}
                                    ${taskOptionsHtml}
                                </div>
                                ${detailsHtml}
                                ${feedbackSectionHtml}
                            </div>
                        </div>
                    </div>
                `;
            });
            answersHtml += '</div>';
        } else {
             answersHtml = '<div class="text-center text-muted small py-3"><i class="bi bi-inbox fs-4 d-block mb-1"></i>Деталі недоступні для цієї спроби.</div>';
        }

        const collapseId = `collapse-attempt-${r._id}`;

        return `
            <div class="list-group-item p-0 border-0 mb-2 bg-transparent animate__animated animate__fadeIn">
                <div class="d-flex justify-content-between align-items-center p-3 bg-light border rounded-3 transition-all"
                     data-bs-toggle="collapse" data-bs-target="#${collapseId}" style="cursor: pointer;">
                    
                    <div class="ms-1 d-flex flex-column flex-sm-row align-items-sm-baseline gap-1 gap-sm-3">
                        <span class="fw-bold text-dark fs-6">${sectionTitle}</span>
                        <span class="text-muted" style="font-size: 0.8rem;">
                            <i class="bi bi-calendar-event me-1"></i>
                            ${new Date(r.completedAt).toLocaleDateString('uk-UA')} 
                            <span class="mx-1">•</span> 
                            ${new Date(r.completedAt).toLocaleTimeString('uk-UA', {hour:'2-digit', minute:'2-digit'})}
                        </span>
                    </div>
                    
                    <div class="d-flex align-items-center gap-3 me-1">
                        <span class="badge ${badgeColor} rounded-pill px-3 py-2" style="font-size: 0.85rem;">
                            ${p}% <span class="fw-normal opacity-75 ms-1">(${r.score}/${r.total})</span>
                        </span>
                        <i class="bi bi-chevron-down text-secondary fs-5"></i>
                    </div>
                </div>

                <div id="${collapseId}" class="collapse">
                    <div class="p-4 bg-white border border-top-0 rounded-bottom-3 shadow-sm mx-1 mb-2">
                        ${answersHtml}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

window.loadMoreHistory = function() {
    const ITEMS_PER_PAGE = 5;
    
    if (!window.currentHistoryPage) window.currentHistoryPage = 1;
    if (!window.currentStudentResults) return;

    const startIndex = window.currentHistoryPage * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    
    const nextResults = window.currentStudentResults.slice(startIndex, endIndex);
    
    if (nextResults.length > 0) {
        const list = document.getElementById('studentHistoryList');
        list.insertAdjacentHTML('beforeend', generateHistoryHtml(nextResults));
        window.currentHistoryPage++;
    }
    
    if (endIndex >= window.currentStudentResults.length) {
        document.getElementById('loadMoreHistoryContainer').style.display = 'none';
    }
};

// 1. Відкриваємо модалку
window.triggerFeedback = function(buttonElement) {
    const studentId = buttonElement.getAttribute('data-student');
    const resultId = buttonElement.getAttribute('data-result');
    const taskId = buttonElement.getAttribute('data-task');
    const taskTitle = buttonElement.getAttribute('data-title');
    const studentAnswer = buttonElement.getAttribute('data-answer');
    const sectionIdx = parseInt(buttonElement.getAttribute('data-section'), 10);

    // Заповнюємо текст у модалці
    document.getElementById('feedbackTaskTitle').textContent = taskTitle;
    document.getElementById('feedbackStudentAnswer').textContent = studentAnswer;
    document.getElementById('feedbackCommentInput').value = ''; 

    const fModal = new bootstrap.Modal(document.getElementById('feedbackModal'));
    fModal.show();

    // 🔥 ФІКС: Отримуємо кнопку і скидаємо її стан
    const sendBtn = document.getElementById('btnExecuteFeedback');
    sendBtn.disabled = false;
    sendBtn.innerHTML = 'Надіслати';

    // ПРИВ'ЯЗУЄМО ВІДПРАВКУ
    sendBtn.onclick = async () => {
        const comment = document.getElementById('feedbackCommentInput').value.trim();
        
        if (!comment) {
            showAlert("Помилка", "Напишіть хоча б щось студенту!", "error");
            return;
        }

        // 🚀 МИТТЄВО блокуємо і крутимо спінер
        sendBtn.disabled = true;
        sendBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Надсилаємо...`;
        
        // Викликаємо функцію відправки
        await sendTaskFeedback(studentId, resultId, taskId, taskTitle, studentAnswer, sectionIdx, comment);
        
        // Закриваємо модалку ТІЛЬКИ ПІСЛЯ успішної відправки
        bootstrap.Modal.getInstance(document.getElementById('feedbackModal')).hide();
    };
};

// 2. Реальна відправка (Тут я прибрав зайві alert, щоб не бісили)
window.sendTaskFeedback = async function(studentId, resultId, taskId, taskTitle, studentAnswer, sectionIdx, comment) {
    const token = localStorage.getItem('token');
    const courseId = new URLSearchParams(window.location.search).get('id');

    try {
        const res = await fetch(`http://localhost:5002/api/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                receiverId: studentId,
                courseId: courseId,
                text: comment,
                resultId: resultId,
                context: {
                    sectionIdx: sectionIdx,
                    taskTitle: taskTitle,
                    taskId: taskId,
                    studentError: studentAnswer 
                }
            })
        });

        if (res.ok) {
            // Оновлюємо аналітику (перевідкриваємо, щоб з'явився значок чату)
            const currentId = document.getElementById('studentDetailsArea').dataset.currentStudent;
            if (currentId) {
                document.getElementById('studentDetailsArea').style.display = 'none';
                document.getElementById('studentDetailsArea').dataset.currentStudent = '';
                showStudentDetails(currentId);
            }
            showAlert("Успішно", "Фідбек доставлено!", "success");
        } else {
            const data = await res.json();
            showAlert("Помилка", data.message || "Не вдалося відправити", "error");
            // Якщо помилка — повертаємо кнопку в робочий стан
            const btn = document.getElementById('btnExecuteFeedback');
            btn.disabled = false;
            btn.innerHTML = 'Надіслати';
        }
    } catch (err) {
        console.error(err);
        showAlert("Помилка", "Сервер ліг, спробуй пізніше", "error");
        const btn = document.getElementById('btnExecuteFeedback');
        btn.disabled = false;
        btn.innerHTML = 'Надіслати';
    }
};

window.loadTaskChat = async function(studentId, resultId, taskId, containerId) {
    const container = document.getElementById(containerId);
    if (container.dataset.loaded === 'true') return; 

    const token = localStorage.getItem('token');
    const myId = localStorage.getItem('userId'); 

    try {
        const res = await fetch(`http://localhost:5002/api/messages/context/${studentId}/${resultId}/${taskId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error("Помилка");

        const messages = await res.json();
        
        if (messages.length === 0) {
            container.innerHTML = `<div class="text-center text-muted small py-2">Повідомлень не знайдено.</div>`;
            return;
        }

        container.innerHTML = ''; 

        messages.forEach(msg => {
            const time = new Date(msg.createdAt).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
            const isMine = msg.sender.toString() === myId || (msg.sender._id && msg.sender._id.toString() === myId);

            if (isMine) {
                container.innerHTML += `
                    <div class="mb-2 text-end">
                        <div class="d-flex align-items-center justify-content-end mb-1">
                            <small class="text-muted me-2" style="font-size: 0.65rem;">${time}</small>
                            <span class="badge bg-success" style="font-size: 0.7rem;">Ви</span>
                        </div>
                        <div class="d-inline-block p-2 rounded-3 bg-success bg-opacity-10 text-dark small text-start border border-success border-opacity-25" style="max-width: 85%;">
                            ${msg.text}
                        </div>
                    </div>
                `;
            } else {
                container.innerHTML += `
                    <div class="mb-2 text-start">
                        <div class="d-flex align-items-center mb-1">
                            <span class="badge bg-secondary me-2" style="font-size: 0.7rem;">Студент</span>
                            <small class="text-muted" style="font-size: 0.65rem;">${time}</small>
                        </div>
                        <div class="d-inline-block p-2 rounded-3 bg-white text-dark small border shadow-sm" style="max-width: 85%;">
                            ${msg.text}
                        </div>
                    </div>
                `;
            }
        });

        container.dataset.loaded = 'true'; 
        container.scrollTop = container.scrollHeight; 

    } catch (err) {
        console.error(err);
        container.innerHTML = `<div class="text-center text-danger small py-2">Помилка завантаження чату.</div>`;
    }
};

// js/teacher-course-edit.js

// ==========================================
// 📢 СПОВІЩЕННЯ СТУДЕНТІВ (Твоя робоча логіка + Модалка)
// ==========================================

// 1. Відкриваємо модалку замість confirm()
window.notifyStudentsAboutUpdate = function() {
    const notifyModal = new bootstrap.Modal(document.getElementById('notifyStudentsModal'));
    notifyModal.show();
};

// 2. Виконуємо твій старий запит (з правильним роутом /notify-students)
window.executeNotifyStudents = async function() {
    const btn = document.getElementById('btnConfirmNotify');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Надсилаємо...`;

    try {
        const token = localStorage.getItem('token');
        // ОСЬ ТВІЙ РОБОЧИЙ РОУТ
        const res = await fetch(`http://localhost:5002/api/courses/${courseId}/notify-students`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await res.json();
        
        if (res.ok) {
            // Закриваємо модалку
            const modalEl = document.getElementById('notifyStudentsModal');
            bootstrap.Modal.getInstance(modalEl).hide();
            
            // Якщо є тоасти — показуємо красиво, якщо ні — alert (як ти і писав)
            if (typeof showToast === 'function') {
                showToast('Успішно', data.message || "Сповіщення надіслано.");
            } else {
                alert("✅ " + data.message);
            }
        } else {
            throw new Error(data.message || 'Помилка надсилання');
        }
    } catch (err) {
        console.error(err);
        if (typeof showToast === 'function') {
            showToast('Помилка', err.message || "Сервер не відповідає");
        } else {
            alert("❌ " + (err.message || "Сервер не відповідає"));
        }
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
};

function calculateEditEarnings() {
    const priceInput = document.getElementById('editCoursePrice');
    const displayFee = document.getElementById('displayFee');
    const displayNet = document.getElementById('displayNet');
    const errorMsg = document.getElementById('priceError');
    const submitBtn = document.querySelector('#courseSettingsForm button[type="submit"]');

    const price = parseInt(priceInput.value) || 0;
    
    if (price === 0) {
        displayFee.innerText = "0 ₴";
        displayNet.innerText = "0 ₴ (Безкоштовно)";
        errorMsg.classList.add('d-none');
        submitBtn.disabled = false;
        return;
    }

    if (price < 70) {
        errorMsg.classList.remove('d-none');
        displayFee.innerText = "—";
        displayNet.innerText = "—";
        submitBtn.disabled = true;
        return;
    }

    errorMsg.classList.add('d-none');
    submitBtn.disabled = false;

    let fee = Math.round(price * 0.25);
    if (fee < 50) fee = 50;
    const net = price - fee;

    displayFee.innerText = `${fee} ₴`;
    displayNet.innerText = `${net} ₴`;
}

// Додаємо слухач на зміну ціни
document.getElementById('editCoursePrice').addEventListener('input', calculateEditEarnings);

// ==========================================
// 🎓 СПИСОК ВСІХ СТУДЕНТІВ КУРСУ ТА ПОШУК
// ==========================================

 // Тут зберігаємо повний список для фільтрації

// ==========================================
// 🎓 ЛОГІКА ДЛЯ УСІХ СТУДЕНТІВ (ЗАГАЛЬНИЙ СПИСОК)
// ==========================================
 // Глобальний масив для всіх підписаних

// 1. Завантаження всіх студентів з бази
async function loadAllEnrolledStudents() {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`http://localhost:5002/api/courses/${courseId}/students`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            allCourseStudents = await res.json();
            renderEnrolledList(allCourseStudents);
        }
    } catch (err) {
        console.error("Помилка завантаження загального списку:", err);
    }
}

// 2. Рендер нижнього списку з кнопкою Моніторинг
function renderEnrolledList(students) {
    const container = document.getElementById('enrolledStudentsList');
    const countBadge = document.getElementById('totalEnrolledCount');
    if (countBadge) countBadge.textContent = students.length;

    if (students.length === 0) {
        container.innerHTML = `<div class="p-4 text-center text-muted bg-light fw-medium">На курсі поки немає студентів</div>`;
        return;
    }

    container.innerHTML = students.map(s => {
        const avatarHtml = s.avatar 
            ? `<img src="${s.avatar}" class="rounded-circle object-fit-cover me-3 border" style="width: 45px; height: 45px;">`
            : `<div class="bg-success bg-opacity-10 text-success border border-success border-opacity-25 rounded-circle d-flex align-items-center justify-content-center me-3 fw-bold" style="width: 45px; height: 45px;">${s.name.charAt(0).toUpperCase()}</div>`;
        
        return `
            <div class="list-group-item d-flex justify-content-between align-items-center p-3 border-0 border-bottom">
                <div class="d-flex align-items-center">
                    ${avatarHtml}
                    <div>
                        <h6 class="mb-0 fw-bold text-dark">${s.name}</h6>
                        <small class="text-muted">${s.email}</small>
                    </div>
                </div>
                <div class="d-flex align-items-center gap-3">
                    <span class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 rounded-pill px-3 py-2 small">Активний</span>
                    <button class="btn btn-sm btn-success rounded-pill fw-bold px-3 shadow-sm" onclick="showStudentDetails('${s._id}')">
                        Моніторинг <i class="bi bi-chevron-right ms-1"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Пошук по списку
document.getElementById('searchEnrolledInput')?.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase().trim();
    const filtered = allCourseStudents.filter(s => 
        s.name.toLowerCase().includes(term) || s.email.toLowerCase().includes(term)
    );
    renderEnrolledList(filtered);
});

// 3. 🔥 ФІКС МОНІТОРИНГУ (ПОВНІСТЮ ОРИГІНАЛЬНИЙ ВИГЛЯД)

// ==========================================
// ⚠️ ФАТАЛЬНЕ ВИДАЛЕННЯ КУРСУ
// ==========================================
// ==========================================
// ⚠️ ФАТАЛЬНЕ ВИДАЛЕННЯ КУРСУ (ЧЕРЕЗ МОДАЛКУ)
// ==========================================

// 1. Відкриття модалки
window.deleteFullCourse = function() {
    // Очищаємо інпут перед показом
    const input = document.getElementById('deleteConfirmInput');
    if (input) input.value = '';
    
    const deleteModal = new bootstrap.Modal(document.getElementById('deleteCourseModal'));
    deleteModal.show();
};

// 2. Реальне видалення після перевірки тексту
window.executePermanentDelete = async function() {
    const input = document.getElementById('deleteConfirmInput').value.trim();
    const btn = document.getElementById('btnFinalDelete');
    const modalEl = document.getElementById('deleteCourseModal');

    // Перевірка (або слово ВИДАЛИТИ, або точна назва курсу)
    if (input !== "ВИДАЛИТИ" && input !== currentCourse.title) {
        alert("Введений текст не співпадає. Видалення відхилено.");
        return;
    }

    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Знищення...`;

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`http://localhost:5002/api/courses/${courseId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            // 1. Закриваємо модалку підтвердження (якщо вона ще відкрита)
            const deleteModalEl = document.getElementById('deleteCourseModal');
            const deleteModal = bootstrap.Modal.getInstance(deleteModalEl);
            if (deleteModal) deleteModal.hide();

            // 2. Показуємо красиву модалку успіху
            const successModal = new bootstrap.Modal(document.getElementById('deleteSuccessModal'));
            successModal.show();
            
            // Студент не зможе закрити це вікно просто так (тільки натиснувши кнопку)
        } else {
            const data = await res.json();
            alert("❌ Помилка: " + (data.error || "Не вдалося видалити"));
            btn.disabled = false;
            btn.innerHTML = originalText;
        }

    } catch (err) {
        console.error(err);
        alert("Сервер не відповідає");
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
};
// 1. Функція, яка тільки показує модалку підтвердження
window.confirmInvitationDeletion = function(inviteId) {
    const modalEl = document.getElementById('deleteRejectedInviteModal');
    if (!modalEl) return; // Перевір, чи ти додав HTML модалки в файл .html

    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    // Прив'язуємо реальне видалення до кнопки "Так, видалити" в модалці
    const confirmBtn = document.getElementById('confirmDeleteInviteBtn');
    confirmBtn.onclick = async () => {
        await revokeInvitation(inviteId, true); // Передаємо true, щоб знати, що це з модалки
        bootstrap.Modal.getInstance(modalEl).hide();
    };
};

// 2. Оновлена функція видалення (твоя стара логіка, але з гарним алерт-модалкою)
// Функція видалення (тепер без confirm всередині)
async function revokeInvitation(inviteId) {
    const token = localStorage.getItem('token');
    
    try {
        const res = await fetch(`http://localhost:5002/api/invitations/${inviteId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await res.json();

        if (res.ok) {
            // Оновлюємо список
            loadCourseInvitations();
            // Показуємо КРАСИВУ модалку успіху
            showAlert("Видалено", "Запис про відхилене запрошення успішно очищено.", "success");
        } else {
            showAlert("Помилка", data.message || "Не вдалося видалити запис", "error");
        }
    } catch (err) {
        console.error("Помилка відкликання:", err);
        showAlert("Помилка", "Сервер не відповідає.", "error");
    }
}