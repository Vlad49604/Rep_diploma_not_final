// frontend/js/teacher-mailing.js

const API_URL = 'http://localhost:5002/api';
let recipients = new Map();

// Перевірка авторизації при завантаженні
document.addEventListener('DOMContentLoaded', async () => {
    const token = getSafeToken();
    if (!token) {
        window.location.href = '../index.html';
        return;
    }
    await loadCoursesForFilter();
});

function getSafeToken() {
    let t = localStorage.getItem('token') || "";
    return t.replace(/['"\n\r\t]/g, '').trim();
}

// Завантаження списку курсів для фільтра
async function loadCoursesForFilter() {
    try {
        const res = await fetch(`${API_URL}/teacher/my-courses-list`, {
            headers: { 'Authorization': `Bearer ${getSafeToken()}` }
        });
        const courses = await res.json();
        const select = document.getElementById('courseFilter');
        if (!select) return;
        
        courses.forEach(c => {
            const option = document.createElement('option');
            option.value = c._id;
            option.textContent = c.title; // Без емодзі книжки
            select.appendChild(option);
        });
    } catch (err) {
        console.error("Помилка завантаження курсів:", err);
    }
}

// Логіка показу додаткових полів фільтра
document.getElementById('recipientCondition')?.addEventListener('change', (e) => {
    const wrapper = document.getElementById('daysInputWrapper');
    if (wrapper) wrapper.classList.toggle('d-none', e.target.value !== 'inactive');
});

// Функція завантаження студентів за фільтром
window.loadMyStudents = async function() {
    const courseId = document.getElementById('courseFilter').value;
    const condition = document.getElementById('recipientCondition').value;
    const days = document.getElementById('filterDays').value;
    const btn = document.getElementById('loadStudentsBtn');
    
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Завантажуємо...';

    try {
        const res = await fetch(`${API_URL}/teacher/my-students?courseId=${courseId}&condition=${condition}&days=${days}`, {
            headers: { 'Authorization': `Bearer ${getSafeToken()}` }
        });
        const data = await res.json();
        
        if (!data.users || data.users.length === 0) {
            // ВИКЛИКАЄМО МОДАЛКУ
            const noStudentsModal = new bootstrap.Modal(document.getElementById('noStudentsModal'));
            noStudentsModal.show();
            recipients.clear();
            renderRecipients();
        } else {
            recipients.clear();
            data.users.forEach(u => recipients.set(u.email, u.name || 'Студент'));
            renderRecipients();
        }
    } catch (err) { 
        console.error(err);
    } finally { 
        btn.disabled = false; 
        btn.innerText = 'Завантажити список отримувачів'; 
    }
};

// Оновлений рендер отримувачів
function renderRecipients() {
    const list = document.getElementById('recipientsList');
    const clearBtn = document.getElementById('clearAllBtn');
    list.innerHTML = '';
    document.getElementById('recipientsCount').innerText = recipients.size;
    
    if (recipients.size === 0) {
        list.innerHTML = '<div class="text-center text-muted small py-2">Список порожній</div>';
        clearBtn?.classList.add('d-none');
        return;
    }

    clearBtn?.classList.remove('d-none');
    recipients.forEach((name, email) => {
        const badge = document.createElement('span');
        badge.className = 'student-badge d-inline-flex align-items-center me-2 mb-2';
        badge.innerHTML = `
            ${name} <span class="ms-1 opacity-50 fw-normal">| ${email}</span> 
            <i class="bi bi-x ms-2 cursor-pointer" onclick="removeEmail('${email}')" style="font-size: 1rem;"></i>
        `;
        list.appendChild(badge);
    });
}

// Функція, яка викликається кнопкою "Так, очистити" в модалці
window.executeClearList = () => {
    recipients.clear();
    renderRecipients();
    const modalEl = document.getElementById('clearListModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    modal?.hide();
};

window.removeEmail = (email) => { 
    recipients.delete(email); 
    renderRecipients(); 
};

// Робота з картинкою
document.getElementById('mailImage')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("image", file);

    try {
        const res = await fetch(`${API_URL}/image`, { method: "POST", body: formData });
        const data = await res.json();
        
        document.getElementById('uploadedImageUrl').value = data.url;
        
        const preview = document.getElementById('imagePreview');
        preview.src = data.url;
        preview.classList.remove('d-none'); 
        preview.style.display = 'block'; 
        
        document.getElementById('uploadBox').classList.add('d-none');
        document.getElementById('removeImageBtn').classList.remove('d-none');
    } catch (err) {
        alert("Помилка завантаження зображення");
    }
});

window.removeImage = () => {
    document.getElementById('uploadedImageUrl').value = '';
    const preview = document.getElementById('imagePreview');
    preview.classList.add('d-none');
    preview.style.display = 'none';
    preview.src = '';
    document.getElementById('removeImageBtn').classList.add('d-none');
    document.getElementById('uploadBox').classList.remove('d-none');
    document.getElementById('mailImage').value = '';
};


// 🔥 ОЧИЩЕННЯ ФОРМИ ПІСЛЯ УСПІШНОЇ ВІДПРАВКИ
window.resetMailingForm = () => {
    document.getElementById('teacherMailingForm').reset();
    recipients.clear();
    renderRecipients();
    window.removeImage();
};


// Відправка розсилки
document.getElementById('teacherMailingForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (recipients.size === 0) return alert("Оберіть отримувачів!");
    
    const btn = document.getElementById('sendBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Надсилаємо...';

    const payload = {
        emails: Array.from(recipients.keys()),
        subject: document.getElementById('mailSubject').value,
        body: document.getElementById('mailBody').value,
        imageUrl: document.getElementById('uploadedImageUrl').value
    };

    try {
        const res = await fetch(`${API_URL}/teacher/bulk-mail`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${getSafeToken()}` 
            },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        if (res.ok) {
            // 1. Повертаємо кнопку в норму
            btn.disabled = false;
            btn.innerHTML = 'Надіслати повідомлення';
            
            // 2. Вписуємо кількість в модалку
            const countSpan = document.getElementById('successSentCount');
            if (countSpan) countSpan.innerText = data.sentCount;

            // 3. Відкриваємо модалку (вона не ховає сторінку, тому «пустоти» не буде)
            const successModal = new bootstrap.Modal(document.getElementById('successMailingModal'));
            successModal.show();
            
        } else { 
            throw new Error(data.error || "Помилка відправки"); 
        }
    } catch (err) { 
        alert(err.message); 
        btn.disabled = false; 
        btn.innerText = 'Надіслати повідомлення'; 
    }
});

window.resetMailingForm = () => {
    document.getElementById('teacherMailingForm').reset(); // очищає текст
    recipients.clear(); // видаляє список людей
    renderRecipients(); // оновлює візуал списку
    window.removeImage(); // видаляє прев'ю картинки
};

const manualInput = document.getElementById('manualEmail');
const suggestBox = document.getElementById('emailSuggestions');

// 1. Логіка випадаючого списку підказок
if (manualInput) {
    manualInput.addEventListener('input', async function() {
        const q = manualInput.value.trim();
        if (q.length < 2) { 
            suggestBox.style.display = 'none'; 
            return; 
        }
        try {
            // Використовуємо чисту конкатенацію без складних шаблонів
            const url = API_URL + '/teacher/search-students?q=' + encodeURIComponent(q);
            const res = await fetch(url, {
                headers: { 'Authorization': 'Bearer ' + getSafeToken() }
            });
            
            if (!res.ok) throw new Error("Server error: " + res.status);
            
            const data = await res.json();
            suggestBox.innerHTML = '';
            
            if (data.users && data.users.length > 0) {
                data.users.forEach(u => {
                    const li = document.createElement('li');
                    li.className = "dropdown-item py-2";
                    li.style.cursor = "pointer";
                    li.innerHTML = '<b>' + u.name + '</b><br><small class="text-muted">' + u.email + '</small>';
                    li.onclick = function() {
                        recipients.set(u.email, u.name); 
                        renderRecipients(); 
                        manualInput.value = ''; 
                        suggestBox.style.display = 'none';
                    };
                    suggestBox.appendChild(li);
                });
                suggestBox.style.display = 'block';
            } else {
                suggestBox.style.display = 'none';
            }
        } catch (e) { 
            console.error("Помилка пошуку:", e); 
        }
    });
}

// 2. Функція для кнопки "Додати студента" (Додано window. для глобального доступу)
window.addManualEmail = async function() {
    const email = manualInput.value.trim();
    if (!email || !email.includes('@')) {
        const emailErrorModal = new bootstrap.Modal(document.getElementById('emailErrorModal'));
        emailErrorModal.show();
        return;
    }
    try {
        const url = API_URL + '/teacher/search-students?q=' + encodeURIComponent(email);
        const res = await fetch(url, {
            headers: { 'Authorization': 'Bearer ' + getSafeToken() }
        });
        const data = await res.json();
        const exact = data.users ? data.users.find(u => u.email.toLowerCase() === email.toLowerCase()) : null;
        
        if (exact) { 
            recipients.set(exact.email, exact.name); 
            renderRecipients(); 
            manualInput.value = ''; 
            suggestBox.style.display = 'none';
        } else { 
            const noStudentsModal = new bootstrap.Modal(document.getElementById('noStudentsModal'));
            noStudentsModal.show(); 
        }
    } catch (e) { 
        console.error("Помилка додавання:", e); 
    }
};