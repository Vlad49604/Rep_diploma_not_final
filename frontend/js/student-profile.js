const API_BASE_URL = 'http://localhost:5002/api'; 

let lastTaskCount = null; // Тут ми будемо тримати кількість завдань

// 1. Отримання токена
function getAuthToken() {
    let token = localStorage.getItem('token');
    if (!token || token === "null") {
        const userData = localStorage.getItem('user');
        if (userData) {
            try { token = JSON.parse(userData).token; } catch (e) { console.error(e); }
        }
    }
    return token;
}

// 2. Ініціалізація
document.addEventListener('DOMContentLoaded', async () => {
    const token = getAuthToken();
    if (!token) {
        window.location.href = '../index.html';
        return;
    }

    // Завантажуємо кешовані дані для миттєвого відображення
    const cachedUser = JSON.parse(localStorage.getItem('user'));
    if (cachedUser) updateProfileUI(cachedUser);

    try {
        // Отримуємо свіжі дані про користувача
        const userRes = await fetch(`${API_BASE_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (userRes.ok) {
            const freshUser = await userRes.json();
            localStorage.setItem('user', JSON.stringify(freshUser));
            updateProfileUI(freshUser);
            
            // Завантажуємо глибоку аналітику та курси
            loadEnhancedProfileData(freshUser, token);
        } else {
            logout();
        }
    } catch (e) {
        console.error("Критична помилка ініціалізації:", e);
    }

// Додай це всередину document.addEventListener('DOMContentLoaded', async () => { ...

    const passForm = document.getElementById('passwordForm');
    const newPassInp = document.getElementById('newPassword');
    const rulesBox = document.getElementById('passwordRules');
    const confirmPassInp = document.getElementById('confirmPassword');

    if (newPassInp && rulesBox) {
        newPassInp.addEventListener('input', () => {
            const val = newPassInp.value;
            rulesBox.style.display = val ? 'block' : 'none';

            const checks = {
                'rule-length': val.length >= 8,
                'rule-letter': /[A-Za-z]/.test(val),
                'rule-digit': /\d/.test(val),
                'rule-upper': /[A-Z]/.test(val)
            };

            Object.keys(checks).forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    const text = el.innerText.replace(/[^а-яА-ЯіІїЇєЄґҐa-zA-Z0-9\s()]/g, '').trim();
                    if (checks[id]) {
                        el.className = 'text-success small fw-bold';
                        el.innerHTML = `<i class="bi bi-check-circle-fill me-1"></i> ${text}`;
                    } else {
                        el.className = 'text-danger small';
                        el.innerHTML = `<i class="bi bi-x-circle me-1"></i> ${text}`;
                    }
                }
            });
        });
    }

    if (passForm) {
    passForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = newPassInp.value;
        const confirmPassword = confirmPassInp.value;

        // Валідація
        const passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            if (typeof showToast === 'function') showToast('Увага', 'Пароль занадто слабкий! Перевірте вимоги.');
            return;
        }
        
        if (newPassword !== confirmPassword) {
            if (typeof showToast === 'function') showToast('Увага', 'Нові паролі не співпадають!');
            return;
        }

        const btn = passForm.querySelector('button');
        btn.disabled = true;
        const originalBtnText = btn.innerHTML;
        btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`;

        try {
            const res = await fetch(`${API_BASE_URL}/auth/change-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ currentPassword, newPassword })
            });

            const data = await res.json();
            
            if (res.ok) {
                // КРАСИВИЙ TOAST УСПІХУ
                if (typeof showToast === 'function') {
                    showToast('Успішно', 'Ваш пароль було успішно оновлено!');
                }
                
                passForm.reset();
                if (rulesBox) rulesBox.style.display = 'none'; 
            } else {
                // ТОАСТ ПОМИЛКИ (напр. неправильний поточний пароль)
                if (typeof showToast === 'function') {
                    showToast('Помилка', data.message || 'Не вдалося змінити пароль.');
                }
            }
        } catch (err) {
            if (typeof showToast === 'function') {
                showToast('Помилка сервера', 'Виникла проблема із зʼєднанням.');
            }
        } finally {
            btn.disabled = false; п
            btn.innerHTML = originalBtnText;
        }
    });
}
});
    
// 3. Оновлення базового інтерфейсу (Ім'я, Роль)
function updateProfileUI(user) {
    document.getElementById('studentNavName').textContent = user.name;
    document.getElementById('displayUserName').textContent = user.name;
    if (document.getElementById('userNameInput')) {
        document.getElementById('userNameInput').value = user.name;
    }

    const roleText = user.role === 'teacher' ? 'Викладач' : 'Студент';
    const emailArea = document.getElementById('displayUserEmail');
    
    // ПЕРЕВІРКА: Якщо ми вже знаємо кількість завдань, показуємо її, інакше "Аналіз..."
    const statsText = lastTaskCount !== null 
        ? `<i class="bi bi-check2-all me-1"></i> Виконано завдань: ${lastTaskCount}` 
        : `<i class="bi bi-lightning-charge me-1"></i> Аналіз активності...`;

    if (emailArea) {
        emailArea.innerHTML = `
            <div class="mb-2">${user.email}</div>
            <div class="d-flex justify-content-center gap-2 flex-wrap">
                <span class="badge rounded-pill bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-3 py-2">
                    <i class="bi bi-shield-check me-1"></i> ${roleText}
                </span>
                <span class="badge rounded-pill bg-success bg-opacity-10 text-success border border-primary border-opacity-25 px-3 py-2" id="taskStatsBadge">
                    ${statsText}
                </span>
            </div>
        `;
    }

    const photo = document.getElementById('userPhoto');
    const initials = document.getElementById('userInitials');

    if (user.avatar) {
        photo.src = user.avatar + '?t=' + new Date().getTime(); 
        photo.classList.remove('d-none');
        initials.classList.add('d-none');
    } else {
        photo.classList.add('d-none');
        initials.classList.remove('d-none');
        initials.textContent = user.name.charAt(0).toUpperCase();
    }
    if (user.savedCardMask) {
        showSavedCardUI(user.savedCardMask);
    } else {
        hideSavedCardUI();
    }
}


// 4. Глибоке завантаження даних (Курси + Прогрес + Статистика)
// 4. Глибоке завантаження даних (Курси + Прогрес + Статистика)
async function loadEnhancedProfileData(user, token) {
    const userId = user._id || user.id;
    const listContainer = document.getElementById('enrolledCoursesList');

    try {
        // Паралельні запити для швидкості
        const [coursesRes, resultsRes] = await Promise.all([
            fetch(`${API_BASE_URL}/courses/all`),
            fetch(`${API_BASE_URL}/results/user-stats/${userId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
        ]);

        if (!coursesRes.ok || !resultsRes.ok) throw new Error("Помилка завантаження даних з сервера");

        const allCourses = await coursesRes.json();
        const userResults = await resultsRes.json();

        // Зберігаємо кількість у глобальну змінну, щоб вона не пропадала
        lastTaskCount = userResults.length;

        // Оновлюємо бейдж активності реальними даними
        const statsBadge = document.getElementById('taskStatsBadge');
        if (statsBadge) {
            statsBadge.innerHTML = `<i class="bi bi-check2-all me-1"></i> Виконано завдань: ${lastTaskCount}`;
        }

        // Оновлюємо загальну статистику активності
        document.getElementById('taskStatsBadge').innerHTML = `
            <i class="bi bi-check2-all me-1"></i> Виконано завдань: ${userResults.length}
        `;

        // Визначаємо список курсів користувача
        const enrolledIds = (user.enrolledCourses || []).map(id => (typeof id === 'string' ? id : (id._id || id.$oid)));
        const myCourses = allCourses.filter(c => enrolledIds.includes(c._id.$oid || c._id.toString()));

        if (myCourses.length === 0) {
            listContainer.innerHTML = `
                <div class="text-center py-5 border rounded-4 bg-light" style="border-style: dashed !important;">
                    <i class="bi bi-emoji-expressionless fs-1 text-muted mb-3 d-block"></i>
                    <h5 class="text-muted fw-bold">Ви поки не обрали жодного курсу</h5>
                    <a href="courses.html" class="btn btn-lexora mt-3 px-4">Перейти до каталогу</a>
                </div>`;
            return;
        }

        // Рендер кожної картки курсу з підрахунком реального прогресу
        listContainer.innerHTML = myCourses.map(course => {
            const cId = course._id.$oid || course._id.toString();
            
            // ВАЖЛИВО: Оновлена логіка підрахунку пройдених секцій
            // Знаходимо всі результати, що належать до цього курсу
            const courseResults = userResults.filter(r => {
                const resCourseId = r.course?.$oid || r.course?._id || r.course || r.courseId;
                return resCourseId === cId;
            });

            // Зараховуємо секцію як пройдену, якщо відсоток правильних відповідей >= 70%
                        // Зараховуємо ТІЛЬКИ УНІКАЛЬНІ секції, де відсоток правильних відповідей >= 70%
            const successfulResults = courseResults.filter(r => {
                const percentage = (r.score / r.total) * 100;
                return percentage >= 70;
            });
            // Використовуємо Set, щоб відкинути дублікати (якщо студент проходив одну секцію кілька разів)
            const completedSectionsCount = new Set(successfulResults.map(r => r.sectionIdx)).size;

            // Отримуємо реальну кількість секцій курсу
            // Отримуємо реальну кількість секцій (як у сторінці моніторингу)
            let totalSections = course.totalSections || (course.sections ? course.sections.length : 0);

            // Якщо в об'єкті курсу немає прямої цифри, вираховуємо її з історії спроб:
            if (totalSections === 0) {
                totalSections = courseResults.length > 0 
                    ? Math.max(...courseResults.map(r => r.sectionIdx || 0)) + 1 
                    : 3; // <-- Твій дефолт (у тебе всюди по 3 секції)
            } // 12 як дефолт, якщо немає поля sections
                        
            // Рахуємо фінальний прогрес курсу
            const progressPercent = Math.min(Math.round((completedSectionsCount / totalSections) * 100), 100);

            return `
            <div class="course-list-item p-4 mb-4 bg-white rounded-4 border-0 shadow-sm position-relative">
                <div class="d-flex flex-column flex-xl-row justify-content-between align-items-xl-center gap-4">
                    
                    <div class="d-flex align-items-center">
                        <div class="bg-success bg-opacity-10 rounded-3 p-3 me-3 text-success d-flex align-items-center justify-content-center" style="width: 60px; height: 60px;">
                            <i class="bi bi-journal-check fs-2"></i>
                        </div>
                        <div>
                            <h5 class="fw-bold mb-1" style="color: #1b5e20;">${course.title}</h5>
                            <div class="d-flex gap-3 text-muted small mt-1">
                                <span><i class="bi bi-layers text-success opacity-75 me-1"></i> ${totalSections} секцій</span>
                            </div>
                        </div>
                    </div>

                    <div class="d-flex flex-wrap gap-2 mt-2 mt-xl-0">
                        <a href="course-view.html?id=${cId}" class="btn btn-lexora px-4 py-2 rounded-pill fw-bold d-flex align-items-center justify-content-center shadow-sm">
                            <i class="bi me-2 fs-5"></i> Продовжити
                        </a>
                        <button class="btn btn-outline-danger px-4 py-2 rounded-pill fw-bold d-flex align-items-center justify-content-center transition-all" onclick="unsubscribe('${cId}')">
                            <i class="bi me-2 fs-5"></i> Відписатися
                        </button>
                    </div>

                </div>

                <div class="mt-4 pt-3 border-top">
                    <div class="d-flex justify-content-between align-items-end mb-2">
                        <div>
                            <span class="text-muted small fw-bold text-uppercase tracking-wider">Твій прогрес</span>
                            <div class="small fw-bold" style="color: #1b5e20; margin-top: 2px;">
                                ${completedSectionsCount} з ${totalSections} секцій завершено
                            </div>
                        </div>
                        <div class="h3 fw-bold text-success mb-0">${progressPercent}%</div>
                    </div>
                    <div class="progress shadow-sm" style="height: 12px; border-radius: 20px; background-color: #e9ecef;">
                        <div class="progress-bar bg-success progress-bar-striped progress-bar-animated" role="progressbar" 
                             style="width: ${progressPercent}%; border-radius: 20px; transition: width 1.5s cubic-bezier(0.4, 0, 0.2, 1);" 
                             aria-valuenow="${progressPercent}" aria-valuemin="0" aria-valuemax="100"></div>
                    </div>
                </div>
            </div>
            `;
        }).join('');

    } catch (err) {
        console.error("Помилка завантаження профілю:", err);
        listContainer.innerHTML = '<div class="alert alert-danger">Не вдалося завантажити розширені дані.</div>';
    }
}

// 5. Оновлення імені (Форма)
document.getElementById('profileForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = getAuthToken();
    const newName = document.getElementById('userNameInput').value.trim();
    let user = JSON.parse(localStorage.getItem('user'));
    const btn = e.target.querySelector('button[type="submit"]');
    
    if (!newName) return;

    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`;

    try {
        const res = await fetch(`${API_BASE_URL}/auth/${user._id || user.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ name: newName })
        });
        
        if (res.ok) {
            const updatedData = await res.json();
            // Оновлюємо об'єкт юзера, зберігаючи старий аватар та інші дані
            user = { ...user, name: updatedData.name }; 
            localStorage.setItem('user', JSON.stringify(user));
            
            // Оновлюємо UI (тепер статистика не зникне)
            updateProfileUI(user);
            
            btn.innerHTML = `✔ Збережено!`;
            btn.classList.replace('btn-lexora', 'btn-success');
            setTimeout(() => { 
                btn.disabled = false; 
                btn.innerHTML = `Зберегти зміну логіну`; 
                btn.classList.replace('btn-success', 'btn-lexora');
            }, 2000);
        }
    } catch (err) { 
        console.error(err);
        btn.disabled = false; 
        btn.innerHTML = `Зберегти зміну логіну`;
    }
});

// 6. Відписка від курсу (з миттєвим UI-оновленням)
let courseIdToDelete = null; // Тимчасово зберігаємо ID для видалення

window.unsubscribe = function(courseId) {
    courseIdToDelete = courseId;
    // Відкриваємо красиву модалку замість confirm
    const unsubModal = new bootstrap.Modal(document.getElementById('unsubscribeModal'));
    unsubModal.show();
};

// Обробник натискання "Так, відписатися" всередині модалки
document.getElementById('confirmUnsubscribeBtn').addEventListener('click', async function() {
    if (!courseIdToDelete) return;

    const btn = this;
    const token = getAuthToken();
    const user = JSON.parse(localStorage.getItem('user'));
    const userId = user._id || user.id;

    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> Видалення...`;

    try {
        const res = await fetch(`${API_BASE_URL}/courses/unsubscribe`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ userId, courseId: courseIdToDelete })
        });

        if (res.ok) {
            // Оновлюємо локальний стан
            user.enrolledCourses = user.enrolledCourses.filter(id => {
                const currentId = typeof id === 'object' ? (id._id || id.$oid || id.id) : id;
                return currentId !== courseIdToDelete;
            });
            localStorage.setItem('user', JSON.stringify(user));

            // Закриваємо модалку
            const modalEl = document.getElementById('unsubscribeModal');
            bootstrap.Modal.getInstance(modalEl).hide();

            // Показуємо Toast про успіх (як ми робили раніше)
            if (typeof showToast === 'function') {
                showToast('Успішно', 'Ви успішно відписалися від курсу.');
            }

            // Перемальовуємо дані профілю
            loadEnhancedProfileData(user, token);
        } else {
            if (typeof showToast === 'function') {
                showToast('Помилка', 'Не вдалося відписатися. Спробуйте пізніше.');
            }
        }
    } catch (error) {
        console.error("Помилка:", error);
    } finally {
        btn.disabled = false;
        btn.textContent = "Так, відписатися";
        courseIdToDelete = null;
    }
});

// 7. Вихід
window.logout = function() {
    localStorage.clear();
    window.location.href = '../index.html';
};

// --- ЗМІНА АВАТАРА (Кольору фону) ---
// Найпростіша кастомізація - зміна градієнту аватара
const avatarColors = [
    'linear-gradient(135deg, #4caf50, #1b5e20)', // Зелений (дефолт)
    'linear-gradient(135deg, #2196f3, #0d47a1)', // Синій
    'linear-gradient(135deg, #ff9800, #e65100)', // Оранжевий
    'linear-gradient(135deg, #9c27b0, #4a148c)', // Фіолетовий
    'linear-gradient(135deg, #e91e63, #880e4f)'  // Рожевий
];

window.changeAvatar = function() {
    const avatar = document.getElementById('userInitials');
    // Беремо поточний колір з localStorage або ставимо 0
    let colorIndex = parseInt(localStorage.getItem('avatarColorIndex') || '0');
    
    // Перемикаємо на наступний колір
    colorIndex = (colorIndex + 1) % avatarColors.length;
    
    // Застосовуємо та зберігаємо
    avatar.style.background = avatarColors[colorIndex];
    localStorage.setItem('avatarColorIndex', colorIndex);
};

document.getElementById('avatarInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Знайди цей рядок у js/profile.js
    const formData = new FormData();
    formData.append('image', file); // <--- ПЕРЕВІР, ЩОБ ТУТ БУЛО САМЕ 'image'

    const token = getAuthToken();
    try {
        const res = await fetch(`${API_BASE_URL}/auth/upload-avatar`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData // Для файлів НЕ ставимо Content-Type: application/json
        });

        const data = await res.json();
        if (res.ok) {
            // Оновлюємо картинку в localStorage та на екрані
            const user = JSON.parse(localStorage.getItem('user'));
            user.avatar = data.avatarUrl;
            localStorage.setItem('user', JSON.stringify(user));
            updateProfileUI(user);
            alert("Аватар успішно змінено!");
        }
    } catch (err) {
        alert("Помилка завантаження фото");
    }
});

// При завантаженні сторінки (додай виклик цієї функції в DOMContentLoaded)
function loadAvatarColor() {
    const colorIndex = localStorage.getItem('avatarColorIndex') || '0';
    document.getElementById('userInitials').style.background = avatarColors[colorIndex];
}


// --- ВИДАЛЕННЯ АКАУНТУ ---
// 1. Просто відкриваємо модалку
window.deleteAccount = function() {
    // Очищуємо поле вводу перед показом
    document.getElementById('deleteConfirmInput').value = '';
    const delModal = new bootstrap.Modal(document.getElementById('deleteAccountModal'));
    delModal.show();
};

// 2. Реальна логіка видалення
window.confirmDeleteAccount = async function() {
    const input = document.getElementById('deleteConfirmInput').value.trim();
    const btn = document.getElementById('btnFinalDelete');

    // Перевірка секретного слова
    if (input !== 'ВИДАЛИТИ') {
        if (typeof showToast === 'function') {
            showToast('Увага', 'Будь ласка, введіть слово "ВИДАЛИТИ" правильно.');
        } else {
            alert("Неправильне слово підтвердження.");
        }
        return;
    }

    const token = getAuthToken();
    const user = JSON.parse(localStorage.getItem('user'));
    const userId = user._id || user.id;

    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> Видалення...`;

    try {
        const res = await fetch(`${API_BASE_URL}/auth/${userId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            // Закриваємо модалку
            const modalEl = document.getElementById('deleteAccountModal');
            bootstrap.Modal.getInstance(modalEl).hide();

            if (typeof showToast === 'function') {
                showToast('Прощавайте', 'Ваш акаунт видалено. Перенаправлення...');
            }
            
            // Даємо час тосту показатися і виходимо
            setTimeout(() => {
                logout(); // Твоя функція очищення стореджу та редіректу
            }, 2000);
            
        } else {
            const data = await res.json();
            if (typeof showToast === 'function') {
                showToast('Помилка', data.message || 'Не вдалося видалити акаунт.');
            }
        }
    } catch (err) {
        if (typeof showToast === 'function') {
            showToast('Помилка сервера', '🚨 Не вдалося зв’язатися з сервером.');
        }
    } finally {
        btn.disabled = false;
        btn.textContent = "Видалити назавжди";
    }
};

// 1. Ініціалізуємо маски (Cleave.js)
// 1. Ініціалізуємо маски (Cleave.js)
if (document.getElementById('studentCardNumber')) {
    const studentCardCleave = new Cleave('#studentCardNumber', { creditCard: true });
    const studentExpiryCleave = new Cleave('#studentCardExpiry', { date: true, datePattern: ['m', 'y'] });

    // 2. Обробка форми збереження картки
    document.getElementById('studentPaymentForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Отримуємо "чистий" номер картки (без пробілів)
        const rawCardNumber = studentCardCleave.getRawValue();
        
        if (rawCardNumber.length !== 16) {
            alert("Помилка: Номер картки має містити рівно 16 цифр!");
            return;
        }

        // 🌟 ІМІТАЦІЯ РОБОТИ ПЛАТІЖНОГО ШЛЮЗУ 🌟
        const last4 = rawCardNumber.slice(-4);
        const maskedCard = `**** **** **** ${last4}`;
        const fakeToken = 'tok_' + Math.random().toString(36).substring(2, 15);

        try {
            const token = getAuthToken(); // використовуємо твою функцію getAuthToken()
            const res = await fetch(`${API_BASE_URL}/auth/update-student-card`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ 
                    savedCardMask: maskedCard,
                    paymentToken: fakeToken 
                }) 
            });

            if (res.ok) {
                // Оновлюємо локальний кеш
                let user = JSON.parse(localStorage.getItem('user'));
                user.savedCardMask = maskedCard;
                user.paymentToken = fakeToken;
                localStorage.setItem('user', JSON.stringify(user));

                // КРАСИВЕ ПОВІДОМЛЕННЯ
                if (typeof showToast === 'function') {
                    showToast('Успішно', 'Картку перевірено та надійно збережено!');
                }

                document.getElementById('studentPaymentForm').reset();
                showSavedCardUI(maskedCard);
            } else {
                if (typeof showToast === 'function') {
                    showToast('Помилка', 'Не вдалося зберегти дані картки.');
                }
            }
        } catch (err) {
            console.error(err);
            if (typeof showToast === 'function') {
                showToast('🚨 Помилка', 'Проблема зі з’єднанням із сервером.');
            }
        }
    });
}

// 3. Функції для перемикання інтерфейсу
function showSavedCardUI(mask) {
    document.getElementById('addCardFormContainer').classList.add('d-none');
    document.getElementById('savedCardContainer').classList.remove('d-none');
    // Не забуваємо `!important` для Bootstrap d-flex, якщо треба
    document.getElementById('savedCardContainer').classList.add('d-flex'); 
    document.getElementById('displaySavedCard').innerText = mask;
}

function hideSavedCardUI() {
    document.getElementById('addCardFormContainer').classList.remove('d-none');
    document.getElementById('savedCardContainer').classList.add('d-none');
    document.getElementById('savedCardContainer').classList.remove('d-flex');
}

// 4. Функція видалення картки
// 1. Просто відкриваємо модалку замість confirm()
window.removeSavedCard = function() {
    const removeModal = new bootstrap.Modal(document.getElementById('removeCardModal'));
    removeModal.show();
};

// 2. Реальна логіка видалення після підтвердження в модалці
window.confirmRemoveSavedCard = async function() {
    const btn = document.getElementById('btnConfirmRemoveCard');
    const originalText = btn.textContent;

    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> Видалення...`;

    try {
        const token = getAuthToken();
        const res = await fetch(`${API_BASE_URL}/auth/update-student-card`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ action: 'remove' }) 
        });
        
        if (res.ok) {
            // Оновлюємо localStorage
            const user = JSON.parse(localStorage.getItem('user'));
            user.savedCardMask = '';
            localStorage.setItem('user', JSON.stringify(user));
            
            // Ховаємо інтерфейс картки
            if (typeof hideSavedCardUI === 'function') hideSavedCardUI();

            // Закриваємо модалку
            const modalEl = document.getElementById('removeCardModal');
            bootstrap.Modal.getInstance(modalEl).hide();

            // Показуємо красиве сповіщення збоку
            if (typeof showToast === 'function') {
                showToast('Успішно', 'Картку видалено зі списку збережених.');
            }
        } else {
            if (typeof showToast === 'function') showToast('Помилка', 'Не вдалося видалити картку.');
        }
    } catch (err) {
        console.error('Помилка:', err);
        if (typeof showToast === 'function') showToast('Помилка', 'Проблема зі з’єднанням.');
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
};