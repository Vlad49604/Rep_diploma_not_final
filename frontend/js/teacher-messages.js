// js/teacher-messages.js
const API_BASE_URL = 'http://localhost:5002/api';
let currentReceiverId = null; 
let currentCourseFilter = 'all';
let currentSectionFilter = 'all';
let currentTicketId = null;
let currentTaskFilter = 'all';
let loadedCourseData = null; 
let currentChatHistory = []; 
let pFilterCourse = 'all';
let pFilterSection = 'all';
let pFilterTask = 'all';
let pSearchMessage = ''; // Зберігає текст пошуку
let replyData = null; // Зберігає ID та текст повідомлення, на яке відповідаємо
let isContextHidden = false;

// ==========================================
// 🚀 ІНІЦІАЛІЗАЦІЯ SOCKET.IO
// ==========================================
const socket = io('http://localhost:5002'); 


document.addEventListener('DOMContentLoaded', () => {
    checkAuthAndInit();
    
    const myId = localStorage.getItem('userId');
    if (myId) {
        socket.emit('join', myId);
    }

    loadCoursesForFilter();
    loadDialogs(); 
    initSupportChat();

    document.getElementById('sendBtn').addEventListener('click', sendMessage);
    
    document.getElementById('chatInput')?.addEventListener('keydown', (e) => {
        // Якщо натиснуто Enter І при цьому НЕ затиснуто Shift
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); // 🔥 Блокуємо перехід на новий рядок
            sendMessage();      // Відправляємо повідомлення
        }
    });

    // ==========================================
    // СЛУХАЧІ ЛІВОГО ФІЛЬТРА (ГЛОБАЛЬНІ)
    // ==========================================
    const courseSelect = document.getElementById('courseFilter');
    const sectionSelect = document.getElementById('sectionFilter');
    const taskSelect = document.getElementById('taskFilter');

    courseSelect.addEventListener('change', async (e) => {
        currentCourseFilter = e.target.value;
        currentSectionFilter = 'all';
        currentTaskFilter = 'all';
        
        sectionSelect.classList.add('d-none');
        taskSelect.classList.add('d-none');
        
        sectionSelect.innerHTML = `
            <option value="all">Всі секції</option>
            <option value="-1">Тільки загальні питання курсу</option>
        `;
        taskSelect.innerHTML = '<option value="all">Всі завдання</option>';

        if (currentCourseFilter !== 'all' && currentCourseFilter !== 'general') {
            try {
                const res = await fetch(`${API_BASE_URL}/courses/${currentCourseFilter}`, { headers: getAuthHeaders() });
                loadedCourseData = await res.json();
                
                loadedCourseData.sections.forEach((sec, idx) => {
                    sectionSelect.innerHTML += `<option value="${idx}">Секція ${idx + 1}: ${sec.title}</option>`;
                });
                sectionSelect.classList.remove('d-none'); 
            } catch (err) { console.error("Помилка завантаження структури курсу"); }
        }

        // 🔥 ВИПРАВЛЕННЯ 1: Видалено дублюючий loadDialogs(), щоб уникнути гонки потоків
        resetChatIfNeeded();
    });

    // ==========================================
    // ПОШУК ПО СТУДЕНТАХ (ЛІВА КОЛОНКА)
    // ==========================================
    // ПОШУК ПО СТУДЕНТАХ (ЛІВА КОЛОНКА)
    const searchUserInput = document.getElementById('searchUser');
    if (searchUserInput) {
        searchUserInput.addEventListener('input', applyLeftSearch);
    }

    sectionSelect.addEventListener('change', (e) => {
        currentSectionFilter = e.target.value;
        currentTaskFilter = 'all';
        
        taskSelect.classList.add('d-none');
        
        taskSelect.innerHTML = `
            <option value="all">Всі завдання</option>
            <option value="-1">Тільки питання по теорії секції</option>
        `;

        if (currentSectionFilter !== 'all' && currentSectionFilter !== '-1' && loadedCourseData) {
            const section = loadedCourseData.sections[parseInt(currentSectionFilter)];
            if (section && section.tasks && section.tasks.length > 0) {
                section.tasks.forEach((task, idx) => {
                    taskSelect.innerHTML += `<option value="${idx}">Завдання: ${task.title}</option>`;
                });
                taskSelect.classList.remove('d-none');
            }
        }

        if (currentSectionFilter === '-1') {
            taskSelect.classList.add('d-none');
        } else if (currentSectionFilter !== 'all') {
            taskSelect.classList.remove('d-none');
        }

        // 🔥 ВИПРАВЛЕННЯ 1
        resetChatIfNeeded();
    });

    taskSelect.addEventListener('change', (e) => {
        currentTaskFilter = e.target.value;
        // 🔥 ВИПРАВЛЕННЯ 1
        resetChatIfNeeded();
    });

    async function resetChatIfNeeded() {
        await loadDialogs(true);

        applyLeftSearch();
        
        // 🔥 ВИПРАВЛЕННЯ 2: Захист від пустого стейту
        if (!currentReceiverId) {
            const personalBar = document.getElementById('personalChatFilters');
            if (personalBar) personalBar.classList.add('d-none');
            return;
        }

        const isStudentStillVisible = document.querySelector(`.dialog-item[data-id="${currentReceiverId}"]`);
        
        if (!isStudentStillVisible) {
            // Якщо студент зник зі списку зліва - повністю ховаємо і очищаємо чат
            document.querySelector('.chat-area .p-3.border-bottom').innerHTML = `
              <div class="d-flex align-items-center gap-3 text-muted">
                <i class="bi bi-chat-square-dots fs-4"></i>
                <h5 class="mb-0">Виберіть діалог для початку спілкування</h5>
              </div>
            `;
            document.getElementById('messagesArea').innerHTML = '<div class="text-center text-muted mt-5">Виберіть діалог з меню зліва</div>';
            document.getElementById('chatInput').disabled = true;
            document.getElementById('sendBtn').disabled = true;
            
            // 🔥 ЖОРСТКО ховаємо праві фільтри!
            const personalBar = document.getElementById('personalChatFilters');
            if (personalBar) personalBar.classList.add('d-none');
            
            currentReceiverId = null;
        } else {
            const currentUserName = document.querySelector('.chat-area h5')?.textContent || "Студент";
            openChat(currentReceiverId, currentUserName);
        }
    }

    // ==========================================
    // СЛУХАЧІ ПЕРСОНАЛЬНИХ ФІЛЬТРІВ (ПРАВА ЧАСТИНА)
    // ==========================================
    document.getElementById('pcourseFilter').addEventListener('change', (e) => {
        pFilterCourse = e.target.value;
        pFilterSection = 'all';
        pFilterTask = 'all';
        updatePersonalSectionAndTaskFilters();
        applyPersonalFilters();
    });

    // ==========================================
    // ПОШУК ПО ПОВІДОМЛЕННЯХ (ПРАВА КОЛОНКА)
    // ==========================================
    const searchMessageInput = document.getElementById('searchMessage');
    if (searchMessageInput) {
        searchMessageInput.addEventListener('input', (e) => {
            pSearchMessage = e.target.value;
            applyPersonalFilters(); // Перемальовуємо чат з урахуванням тексту
        });
    }

    document.getElementById('psectionFilter').addEventListener('change', (e) => {
        pFilterSection = e.target.value;
        pFilterTask = 'all';
        updatePersonalSectionAndTaskFilters();
        applyPersonalFilters();
    });

    document.getElementById('ptaskFilter').addEventListener('change', (e) => {
        pFilterTask = e.target.value;
        applyPersonalFilters();
    });

    // ==========================================
    // 🔥 РЕАЛ-ТАЙМ ОБРОБНИК ПОВІДОМЛЕНЬ
    // ==========================================
    socket.on('newMessage', (msg) => {
        loadDialogs(true); 
        const senderId = typeof msg.sender === 'object' ? msg.sender._id : msg.sender;
        if (currentReceiverId === senderId) {
            refreshCurrentChatSilent(); 
        }
        if (typeof updateTeacherUnreadBadge === 'function') updateTeacherUnreadBadge();
    });

    // ==========================================
    // 🔥 РОЗУМНИЙ РЕАЛ-ТАЙМ ОБРОБНИК (УНІВЕРСАЛЬНИЙ)
    // ==========================================
    socket.on('newMessage', (msg) => {
        console.log("Отримано нове повідомлення через сокет:", msg);

        // 🚩 ПЕРЕВІРКА: Це тікет (CRM) чи звичайний чат?
        if (msg.ticketId) {
            // --- ЛОГІКА ТІКЕТІВ ---
            
            // 1. Оновлюємо список тікетів "тихо", якщо вчитель зараз у розділі підтримки
            if (typeof showTicketList === 'function') {
                showTicketList(true); 
            }

            // 2. Якщо саме цей тікет зараз відкритий — додаємо бабл
            if (currentTicketId === msg.ticketId) {
                // Створюємо структуру повідомлення, яку очікує рендер
                const formattedMsg = {
                    sender: msg.sender,
                    text: msg.text,
                    replyTo: msg.replyTo,
                    createdAt: new Date()
                };
                appendSingleTicketMessage(formattedMsg);
            }
        } else {
            // --- ЛОГІКА ЗВИЧАЙНОГО ЧАТУ (твоя стара версія) ---
            loadDialogs(true); 
            const senderId = typeof msg.sender === 'object' ? msg.sender._id : msg.sender;
            if (currentReceiverId === senderId) {
                refreshCurrentChatSilent(); 
            }
        }
        
        if (typeof updateTeacherUnreadBadge === 'function') updateTeacherUnreadBadge();
    });


    socket.on('messageDeleted', (msgId) => {
        const msgElement = document.getElementById(`msg-${msgId}`);
        if (msgElement) msgElement.remove();
        currentChatHistory = currentChatHistory.filter(m => m._id !== msgId);
        lastMessageCount--;
        loadDialogs(true); 
    });

    document.getElementById('attachBtn').onclick = () => {
        // Дозволяємо вибір файлу ТІЛЬКИ якщо ми в тікеті
        if (currentTicketId) {
            document.getElementById('ticketFile').click();
        } else {
            alert("Прикріплення фото доступне тільки для звернень до Адміна");
        }
    };

    // Відображення файлу при виборі
    document.getElementById('ticketFile').onchange = function() {
        const preview = document.getElementById('filePreview');
        const nameSpan = document.getElementById('fileNameDisplay');
        if (this.files[0]) {
            nameSpan.textContent = "📎 " + this.files[0].name;
            preview.classList.remove('d-none', 'd-flex');
            preview.classList.add('d-flex'); // Щоб хрестик був праворуч
        }
    };

    // 🔥 ЛОГІКА ХРЕСТИКА (Видалення вибраного файлу)
    document.getElementById('removeFileBtn').onclick = function() {
        const fileInput = document.getElementById('ticketFile');
        fileInput.value = ''; // Очищуємо сам інпут
        document.getElementById('filePreview').classList.add('d-none');
        document.getElementById('filePreview').classList.remove('d-flex');
    };

    // 🔥 МАГІЯ АВТО-ВІДКРИТТЯ ТІКЕТА
    // 🔥 МАГІЯ АВТО-ВІДКРИТТЯ ТІКЕТА
    const urlParams = new URLSearchParams(window.location.search);
    const ticketIdToOpen = urlParams.get('ticketId');

    if (ticketIdToOpen) {
        console.log("📂 Отримано запит на відкриття тікета:", ticketIdToOpen);

        // 1. Примусово клікаємо на кнопку "Зв'язок з Адміном"
        const supportTabBtn = document.getElementById('supportChatBtn'); 
        if (supportTabBtn) {
            supportTabBtn.click(); 
        }

        // 2. Чекаємо завантаження
        let attempts = 0;
        const maxAttempts = 15; // Даємо 7.5 секунд на завантаження

        const scrollInterval = setInterval(() => {
            attempts++;
            const ticketItem = document.querySelector(`[data-ticket-id="${ticketIdToOpen}"]`);

            if (ticketItem) {
                console.log("✅ Тікет знайдено! Відкриваємо...");
                ticketItem.click(); 
                ticketItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                ticketItem.classList.add('shadow-lg', 'border-success');
                setTimeout(() => ticketItem.classList.remove('shadow-lg', 'border-success'), 3000);

                clearInterval(scrollInterval);
            } else if (attempts >= maxAttempts) {
                console.warn("❌ Тікет так і не з'явився у списку.");
                clearInterval(scrollInterval);
            }
        }, 500); 
    }
});

// Це має бути у файлі teacher-messages.js або там, куди веде лінк
function checkAuthAndInit() {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;

    // 1. Перевірка наявності токена
    if (!token || token === "null") {
        localStorage.setItem('redirectAfterLogin', window.location.href);
        window.location.href = '../index.html'; 
        return false;
    }

    // 2. 🔥 КРИТИЧНА ПЕРЕВІРКА РОЛІ
    // Якщо роль не вчитель і не адмін — виганяємо на студентську сторінку
    if (user && user.role !== 'teacher' && user.role !== 'admin') {
        console.error("⛔ Спроба доступу студента до вчительської панелі!");
        alert("У вас немає прав доступу до цієї сторінки.");
        window.location.href = '../student/student.html'; 
        return false;
    }

    return true;
}

function getAuthHeaders() {
    const token = localStorage.getItem('token');
    // Додатковий захист: якщо токен битий, не шлемо його
    if (!token || token.length < 20) return { 'Content-Type': 'application/json' };
    
    return { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${token}` 
    };
}

function applyLeftSearch() {
    const searchInput = document.getElementById('searchUser');
    if (!searchInput) return;
    
    const term = searchInput.value.toLowerCase().trim();
    const dialogItems = document.querySelectorAll('.dialog-item');
    
    dialogItems.forEach(item => {
        // 🔥 ФІКС: Шукаємо ім'я тільки всередині блоку з контентом (.flex-grow-1), 
        // ігноруючи ліву частину з аватаркою
        const nameElement = item.querySelector('.flex-grow-1 span.fw-bold');
        const name = nameElement ? nameElement.textContent.toLowerCase() : "";
        
        if (term === '' || name.includes(term)) {
            item.style.setProperty('display', 'flex', 'important');
        } else {
            item.style.setProperty('display', 'none', 'important');
        }
    });
}

// ==========================================
// ЗАВАНТАЖЕННЯ ДІАЛОГІВ ТА КУРСІВ
// ==========================================
async function loadCoursesForFilter() {
    try {
        const res = await fetch(`${API_BASE_URL}/courses/my-courses`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error("Не вдалося завантажити курси");
        const courses = await res.json();
        const filterSelect = document.getElementById('courseFilter');
        
        let optionsHtml = `
            <option value="all">Всі повідомлення</option>
            <option value="general">Загальна переписка</option>
        `;
        
        courses.forEach(course => {
            const courseIdStr = typeof course._id === 'object' && course._id.$oid ? course._id.$oid : course._id;
            optionsHtml += `<option value="${courseIdStr}">Курс: ${course.title}</option>`;
        });
        filterSelect.innerHTML = optionsHtml;
    } catch (err) { console.error("Помилка завантаження фільтра:", err); }
}

async function loadDialogs(isSilent = false) {
    const container = document.getElementById('dialogsContainer');
    if (!isSilent) container.innerHTML = '<div class="text-center text-muted p-4"><div class="spinner-border text-success spinner-border-sm" role="status"></div> Завантаження...</div>';

    try {
        let url = `${API_BASE_URL}/messages/dialogs`;
        const params = new URLSearchParams();
        if (currentCourseFilter !== 'all') {
            params.append('courseId', currentCourseFilter);
            if (currentSectionFilter !== 'all') params.append('sectionIdx', currentSectionFilter);
            if (currentTaskFilter !== 'all') params.append('taskId', currentTaskFilter);
        }
        if (params.toString()) url += `?${params.toString()}`;

        const res = await fetch(url, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error("Помилка завантаження діалогів");
        
        let dialogs = await res.json();

        if (dialogs.length === 0) {
            container.innerHTML = '<div class="p-4 text-center text-muted">Немає повідомлень</div>';
            return;
        }

        let newHtml = '';
        dialogs.forEach(dialog => {
            const time = formatMessageDate(dialog.lastMessageTime);
            const unreadBadge = '';
            const isActive = currentReceiverId === dialog._id ? 'active' : '';
            const avatarHtml = dialog.avatar 
                ? `<img src="${dialog.avatar}" class="rounded-circle" style="width: 45px; height: 45px; object-fit: cover;">`
                : `<div class="bg-success text-white rounded-circle d-flex align-items-center justify-content-center fw-bold" style="width: 45px; height: 45px;">${dialog.name.charAt(0).toUpperCase()}</div>`;

            const avatarUrl = dialog.avatar ? `'${dialog.avatar}'` : 'null';

            newHtml += `
                <div class="p-3 border-bottom dialog-item ${isActive} d-flex align-items-center gap-3" data-id="${dialog._id}" onclick="openChat('${dialog._id}', '${dialog.name.replace(/'/g, "\\'")}', false, ${avatarUrl})">
                    <div class="position-relative">${avatarHtml}${unreadBadge}</div>
                    <div class="flex-grow-1 overflow-hidden">
                        <div class="d-flex justify-content-between align-items-center mb-1">
                            <span class="fw-bold text-dark text-truncate user-name-text">${dialog.name}</span>
                            <span class="small text-muted" style="font-size: 0.75rem;">${time}</span>
                        </div>
                        <div class="small ${dialog.unreadCount > 0 ? 'fw-bold text-dark' : 'text-muted'} text-truncate">${dialog.lastMessageText}</div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = newHtml;
        
        // 🔥 Одразу після вставки HTML викликаємо пошук
 
        setTimeout(applyLeftSearch, 10);
   

        const urlParams = new URLSearchParams(window.location.search);
        const chatWithId = urlParams.get('chatWith');
        if (chatWithId && !currentReceiverId) {
            const targetDialog = dialogs.find(d => d._id === chatWithId);
            if (targetDialog) openChat(targetDialog._id, targetDialog.name);
            else openChat(chatWithId, "Студент");
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    } catch (err) {
        if (!isSilent) container.innerHTML = '<div class="p-4 text-center text-danger">Не вдалося завантажити діалоги</div>';
    }
}

// ==========================================
// ВІДКРИТТЯ ЧАТУ ТА ФІЛЬТРИ ПРАВОЇ ЧАСТИНИ
// ==========================================
// ==========================================
// ВІДКРИТТЯ ЧАТУ ТА ФІЛЬТРИ ПРАВОЇ ЧАСТИНИ
// ==========================================
async function openChat(userId, userName, isSupport = false, avatar = null) {
    currentReceiverId = userId;
    currentTicketId = null; // 🔥 Обов'язково скидаємо ID тікета, щоб повідомлення йшли студенту!

    document.getElementById('attachBtn')?.classList.add('d-none');
    // Очищуємо прев'ю файлу, якщо воно було відкрите
    document.getElementById('filePreview')?.classList.add('d-none');

    // 1. ХОВАЄМО ТІКЕТИ ТА ПОКАЗУЄМО ЧАТ
    const ticketDashboard = document.getElementById('ticketDashboardArea');
    if (ticketDashboard) {
        ticketDashboard.classList.add('d-none');
        ticketDashboard.classList.remove('d-flex');
    }

    document.getElementById('chatHeader')?.classList.remove('d-none');
    document.getElementById('chatHeader')?.classList.add('d-flex');
    document.getElementById('messagesArea')?.classList.remove('d-none');
    document.getElementById('chatInputContainer')?.classList.remove('d-none');

    // 2. ЗНІМАЄМО ВИДІЛЕННЯ З КНОПКИ АДМІНА
    const supportBtn = document.getElementById('supportChatBtn');
    if (supportBtn) supportBtn.classList.remove('active-support');

    // 3. АКТИВУЄМО ІНПУТ
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.disabled = false;
        chatInput.placeholder = "Напишіть повідомлення...";
    }
    document.getElementById('sendBtn').disabled = false;
    
    const avatarHtml = avatar 
        ? `<img src="${avatar}" class="rounded-circle shadow-sm" style="width: 40px; height: 40px; object-fit: cover;">`
        : `<div class="bg-success text-white rounded-circle d-flex align-items-center justify-content-center fw-bold shadow-sm" style="width: 40px; height: 40px;">
              ${userName.charAt(0).toUpperCase()}
           </div>`;

    // 4. ОНОВЛЮЄМО ХЕДЕР ЧАТУ
    document.getElementById('chatHeader').innerHTML = `
      <div class="d-flex align-items-center gap-3">
        ${avatarHtml}
        <div>
            <h5 class="fw-bold text-dark mb-0">${userName}</h5>
            <small class="text-muted fw-normal" style="font-size: 0.75rem;">${isSupport ? "Адміністратор" : "Студент"}</small>
        </div>
      </div>
    `;

    // Виділяємо студента у списку зліва
    document.querySelectorAll('.dialog-item').forEach(el => el.classList.remove('active'));
    const activeItem = document.querySelector(`.dialog-item[data-id="${userId}"]`);
    if (activeItem) activeItem.classList.add('active');

    // 5. ЗАВАНТАЖУЄМО ІСТОРІЮ ПОВІДОМЛЕНЬ
    const messagesArea = document.getElementById('messagesArea');
    messagesArea.innerHTML = '<div class="text-center text-muted mt-5"><div class="spinner-border text-success" role="status"></div></div>';

    try {
        const res = await fetch(`${API_BASE_URL}/messages/history/${userId}`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error("Помилка завантаження історії");
        const messages = await res.json();
        
        lastMessageCount = messages.length; 
        currentChatHistory = messages; 
        
        pFilterCourse = currentCourseFilter;
        pFilterSection = currentSectionFilter;
        pFilterTask = currentTaskFilter;
        
        buildPersonalFilters(messages); 
        
        const cSelect = document.getElementById('pcourseFilter');
        if (cSelect && cSelect.querySelector(`option[value="${pFilterCourse}"]`)) {
            cSelect.value = pFilterCourse;
        } else {
            pFilterCourse = 'all'; 
            if(cSelect) cSelect.value = 'all';
        }
        
        updatePersonalSectionAndTaskFilters(); 
        
        const sSelect = document.getElementById('psectionFilter');
        if (sSelect && sSelect.querySelector(`option[value="${pFilterSection}"]`)) {
            sSelect.value = pFilterSection;
        } else {
            pFilterSection = 'all';
            if(sSelect) sSelect.value = 'all';
        }
        
        updatePersonalSectionAndTaskFilters(); 
        
        const tSelect = document.getElementById('ptaskFilter');
        if (tSelect && tSelect.querySelector(`option[value="${pFilterTask}"]`)) {
            tSelect.value = pFilterTask;
        } else {
            pFilterTask = 'all';
            if(tSelect) tSelect.value = 'all';
        }
        
        applyPersonalFilters();
        
    } catch (err) {
        messagesArea.innerHTML = '<div class="p-4 text-center text-danger">Не вдалося завантажити повідомлення</div>';
    }
}

function getSafeCourseId(courseField) {
    if (!courseField) return null;
    const cId = courseField._id || courseField;
    return (typeof cId === 'object' && cId.$oid) ? cId.$oid.toString() : cId.toString();
}

function buildPersonalFilters(messages) {
    const bar = document.getElementById('personalChatFilters');
    
    // 🔥 Якщо чат пустий (ніхто не вибраний), взагалі не показуємо фільтри
    if (!currentReceiverId) {
        bar.classList.add('d-none');
        return;
    }

    const cSelect = document.getElementById('pcourseFilter');
    const hasContext = messages.some(m => m.courseId || m.context);
    if (!hasContext) { bar.classList.add('d-none'); return; }
    bar.classList.remove('d-none');

    const uniqueCourses = new Map();
    let hasGeneral = false;
    
    messages.forEach(m => {
        if (!m.courseId) hasGeneral = true;
        else {
            const idStr = getSafeCourseId(m.courseId);
            uniqueCourses.set(idStr, m.courseId.title || "Курс");
        }
    });

    cSelect.innerHTML = '<option value="all">Всі повідомлення</option>';
    if (hasGeneral) cSelect.innerHTML += '<option value="general">Загальна переписка</option>';
    
    uniqueCourses.forEach((title, id) => {
        cSelect.innerHTML += `<option value="${id}">${title}</option>`;
    });

    const sSelect = document.getElementById('psectionFilter');
    const tSelect = document.getElementById('ptaskFilter');
    if (sSelect) sSelect.classList.add('d-none');
    if (tSelect) tSelect.classList.add('d-none');
}

function updatePersonalSectionAndTaskFilters() {
    const sSelect = document.getElementById('psectionFilter');
    const tSelect = document.getElementById('ptaskFilter');
    
    sSelect.innerHTML = '<option value="all">Всі секції</option>';
    tSelect.innerHTML = '<option value="all">Всі завдання</option>';

    if (pFilterCourse === 'all' || pFilterCourse === 'general') {
        sSelect.classList.add('d-none');
        tSelect.classList.add('d-none');
        pFilterSection = 'all';
        pFilterTask = 'all';
        return;
    }

    const courseMsgs = currentChatHistory.filter(m => getSafeCourseId(m.courseId) === pFilterCourse);
    const uniqueSections = new Set();
    let hasCourseGeneral = false;

    courseMsgs.forEach(m => {
        if (m.context && m.context.sectionIdx !== undefined && m.context.sectionIdx !== null) {
            const sIdx = parseInt(m.context.sectionIdx);
            if (sIdx === -1) hasCourseGeneral = true;
            else uniqueSections.add(sIdx);
        }
    });

    if (hasCourseGeneral) sSelect.innerHTML += '<option value="-1">Загальні питання курсу</option>';
    Array.from(uniqueSections).sort((a,b)=>a-b).forEach(idx => {
        sSelect.innerHTML += `<option value="${idx}">Секція ${idx + 1}</option>`;
    });

    if (uniqueSections.size > 0 || hasCourseGeneral) sSelect.classList.remove('d-none');
    else sSelect.classList.add('d-none');

    if (sSelect.querySelector(`option[value="${pFilterSection}"]`)) sSelect.value = pFilterSection;
    else { pFilterSection = 'all'; sSelect.value = 'all'; }

    if (pFilterSection !== 'all' && pFilterSection !== '-1') {
        const sectionMsgs = courseMsgs.filter(m => m.context && parseInt(m.context.sectionIdx) === parseInt(pFilterSection));
        const uniqueTasks = new Map();
        let hasTheory = false;

        sectionMsgs.forEach(m => {
            if (m.context && m.context.taskId !== undefined) {
                const tId = m.context.taskId.toString();
                if (tId === "-1") hasTheory = true;
                else uniqueTasks.set(tId, m.context.taskTitle || "Завдання");
            }
        });

        if (hasTheory) tSelect.innerHTML += '<option value="-1">Питання по теорії</option>';
        uniqueTasks.forEach((title, id) => {
            tSelect.innerHTML += `<option value="${id}">${title}</option>`;
        });

        if (uniqueTasks.size > 0 || hasTheory) tSelect.classList.remove('d-none');
        else tSelect.classList.add('d-none');
    } else {
        tSelect.classList.add('d-none');
    }

    if (tSelect.querySelector(`option[value="${pFilterTask}"]`)) tSelect.value = pFilterTask;
    else { pFilterTask = 'all'; tSelect.value = 'all'; }
}

function applyPersonalFilters() {
    let filtered = currentChatHistory;


    if (pFilterCourse === 'general') {
        filtered = filtered.filter(m => !m.courseId);
    } else if (pFilterCourse !== 'all') {
        filtered = filtered.filter(m => getSafeCourseId(m.courseId) === pFilterCourse);
        if (pFilterSection !== 'all') {
            filtered = filtered.filter(m => m.context && parseInt(m.context.sectionIdx) === parseInt(pFilterSection));
            if (pFilterTask !== 'all') {
                filtered = filtered.filter(m => m.context && m.context.taskId && m.context.taskId.toString() === pFilterTask.toString());
            }
        }
    }

    // 🔥 ДОДАЄМО ПОШУК ПО ТЕКСТУ
    if (pSearchMessage.trim() !== '') {
        filtered = filtered.filter(m => m.text.toLowerCase().includes(pSearchMessage.toLowerCase()));
    }

    renderMessages(filtered); 
}

// ==========================================
// ІДЕАЛЬНИЙ РЕНДЕР ПОВІДОМЛЕНЬ
// ==========================================
// ==========================================
// 🎨 РЕНДЕР ПОВІДОМЛЕНЬ (ВЧИТЕЛЬ)
// ==========================================
function renderMessages(messages) {
    const messagesArea = document.getElementById('messagesArea');
    messagesArea.innerHTML = '';
    const myId = localStorage.getItem('userId');

    if (messages.length === 0) {
        messagesArea.innerHTML = '<div class="text-center text-muted mt-5">Немає повідомлень для цього розділу</div>';
        return;
    }

    const pSecVal = document.getElementById('psectionFilter')?.value || 'all';
    const pTaskVal = document.getElementById('ptaskFilter')?.value || 'all';
    const isStickyMode = (pSecVal === '-1') || (pTaskVal !== 'all');

    const btnToggle = document.getElementById('btnToggleContext');
    if (btnToggle) {
        if (isStickyMode) {
            btnToggle.classList.remove('d-none'); // Показуємо кнопку
            btnToggle.innerHTML = isContextHidden 
                ? '<i class="bi bi-eye-fill"></i>' 
                : '<i class="bi bi-eye-slash-fill"></i>';
        } else {
            btnToggle.classList.add('d-none'); // Ховаємо кнопку в режимі "Всі завдання"
        }
    }
    
    let lastBaseKey = null; 
    let lastErrorStr = null;

    messages.forEach(msg => {
        const time = formatMessageDate(msg.createdAt);
        const isMine = msg.sender.toString() === myId || msg.sender === myId || (msg.sender._id && msg.sender._id.toString() === myId);
        
        // 🔥 Використовуємо класи стилів вчителя
        const bubbleClass = isMine ? 'msg-teacher' : 'msg-student shadow-sm';
        
        let contextHtml = '';
        let stickyHeaderHtml = '';

        // Малюємо блок тільки якщо у повідомлення РЕАЛЬНО є контекст в БД
        if (msg.context && (msg.context.taskTitle || msg.context.taskId)) {
            let headerText = '<i class="bi bi-pin-angle-fill me-1"></i> Контекст';
            let badgeText = ''; 
            let bodyText = '';

            const courseName = (msg.courseId && msg.courseId.title) ? msg.courseId.title : 'Курс';
            const dividerColor = isMine ? 'rgba(255,255,255,0.3)' : 'rgba(25, 135, 84, 0.2)';
            const courseBadgeHtml = `<div class="mb-1 pb-1 border-bottom" style="border-color: ${dividerColor} !important; opacity: 0.8; font-size: 0.7rem;"><i class="bi bi-folder2-open"></i> <b>Курс:</b> ${courseName}</div>`;

            if (msg.context.sectionIdx === -1 && msg.context.taskId === "-1") {
                headerText = '<i class="bi bi-journal-bookmark-fill me-1"></i> Питання по курсу';
                badgeText = 'Загальне';
                bodyText = `<b>Курс:</b> ${msg.context.taskTitle.replace('Загальне питання по курсу: ', '')}`;
            } else if (msg.context.sectionIdx !== -1 && msg.context.taskId === "-1") {
                headerText = '<i class="bi bi-book-half me-1"></i> Питання по теорії';
                badgeText = `Секція ${msg.context.sectionIdx + 1}`;
                bodyText = `<b>Тема:</b> ${msg.context.taskTitle}`;
            } else if (msg.context.taskId && msg.context.taskId !== "-1") {
                headerText = '<i class="bi bi-pencil-square me-1"></i> Завдання';
                badgeText = `Секція ${msg.context.sectionIdx !== undefined ? msg.context.sectionIdx + 1 : '?'}`;
                bodyText = `<b>${msg.context.taskTitle}</b>`;
            }

            if (isStickyMode) {
                const baseKey = `${msg.context.taskId}`;
                const currentError = msg.context.studentError ? msg.context.studentError.toString().trim() : null;
                let isNewGroup = false;

                if (baseKey !== lastBaseKey) isNewGroup = true; 
                else if (currentError && currentError !== lastErrorStr) isNewGroup = true; 

                if (isNewGroup) {
                    if(!isContextHidden){
                    stickyHeaderHtml = `
                        <div class="w-100 d-flex justify-content-center my-3 position-sticky sticky-context-wrapper" style="top: 10px; z-index: 10;">
                            <div class="shadow-sm px-4 py-3 rounded-4 text-start" style="background: rgba(255, 255, 255, 0.98); backdrop-filter: blur(10px); border: 1px solid #dee2e6; border-left: 5px solid #198754; font-size: 0.85rem; max-width: 85%;">
                              <div class="d-flex align-items-center justify-content-between mb-1">
                                <div class="d-flex align-items-center gap-2 text-muted" style="text-transform: uppercase; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.5px;">
                                  <span class="text-success">${headerText}</span>
                                </div>
                                <span class="badge bg-success bg-opacity-10 text-success border border-success-subtle rounded-pill" style="font-size: 0.65rem;">${badgeText}</span>
                              </div>
                              <div class="text-dark fw-800 mb-1" style="font-size: 0.95rem; overflow-wrap: anywhere;">${bodyText}</div>
                              ${currentError ? `
                                  <div class="mt-2 pt-2 border-top" style="border-color: rgba(0,0,0,0.05) !important;">
                                      <div class="small text-muted mb-1" style="font-size: 0.75rem;">Відповідь студента:</div>
                                      <div class="p-2 rounded-3 border" style="background: #f1f8e9; color: #198754; font-weight: 600; border-color: #c8e6c9 !important;">
                                          ${currentError}
                                      </div>
                                  </div>` : ''}
                            </div>
                        </div>
                    `;
                    }
                    lastBaseKey = baseKey;
                    if (currentError) lastErrorStr = currentError;
                }
            } else {
                const shouldShowCourse = (typeof pFilterCourse !== 'undefined' ? pFilterCourse === 'all' : true);
                const isGeneralCourseQuestion = (msg.context.sectionIdx === -1 && msg.context.taskId === "-1");
                const finalCourseBadge = (shouldShowCourse && !isGeneralCourseQuestion) ? courseBadgeHtml : '';

                const contextBg = isMine ? 'rgba(0, 0, 0, 0.12)' : '#ffffff'; 
                const contextBorder = isMine ? '#ffffff' : '#198754';
                const contextTextColor = isMine ? '#ffffff' : '#495057';
                const errorTextColor = isMine ? '#f1fdec' : '#198754';

                // Контекстний блок (зелений/білий стиль)
                contextHtml = `
                    <div class="context-card mb-2 shadow-sm" style="background: ${contextBg}; border-left: 4px solid ${contextBorder}; padding: 12px; border-radius: 10px; font-size: 0.8rem; color: ${contextTextColor}; overflow-wrap: anywhere;">
                      ${finalCourseBadge}
                      <div class="d-flex justify-content-between align-items-center mb-1">
                        <strong style="color: ${isMine ? '#ffffff' : '#212529'}; text-transform: uppercase; font-size: 0.7rem;">${headerText}</strong>
                        <span class="badge ${isMine ? 'bg-white text-success' : 'bg-success'} rounded-pill" style="font-size: 0.65rem;">${badgeText}</span>
                      </div>
                      <div class="fw-bold">${bodyText}</div>
                      ${msg.context.studentError ? `
                          <div class="mt-2 pt-1 border-top" style="border-color: ${dividerColor} !important; color: ${errorTextColor}; font-weight: 700;">
                              <b>Відповідь студента:</b> ${msg.context.studentError}
                          </div>` : ''}
                    </div>
                `;
            }
        }

        const deleteBtn = isMine 
            ? `<i class="bi bi-trash cursor-pointer ms-2 hover-text-danger" onclick="deleteMessage('${msg._id}')" title="Видалити" style="transition: 0.2s; opacity: 0.7;"></i>` 
            : '';

        let replyHtml = '';
        if (msg.replyTo) {
            replyHtml = `
                <div class="reply-quote p-2 mb-2 rounded border-start border-3" 
                    style="background: rgba(255,255,255,0.1); border-color: ${isMine ? '#fff' : '#198754'}; font-size: 0.8rem; opacity: 0.8;">
                    <div class="text-truncate">${msg.replyTo.text}</div>
                </div>
            `;
        }

        // Безпечне екранування для HTML-атрибутів
        const escapedText = (msg.text || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;"); // Головне - апострофи!

        const replyBtn = `<i class="bi bi-reply-fill cursor-pointer ms-2 opacity-75 hover-text-primary" onclick="setReply('${msg._id}', '${escapedText}')" title="Відповісти"></i>`;

        messagesArea.innerHTML += `
            ${stickyHeaderHtml}
            <div class="message-bubble ${bubbleClass}" id="msg-${msg._id}" style="overflow-wrap: anywhere;">
                ${contextHtml}
                ${replyHtml} 
                <div style="white-space: pre-wrap;">${msg.text}</div>
                <div class="small mt-1 opacity-75 d-flex justify-content-end align-items-center" style="font-size: 0.7rem;">
                    ${time} ${replyBtn} ${deleteBtn}
                </div>
            </div>
        `;
    });
    
    messagesArea.scrollTop = messagesArea.scrollHeight;
}
// ==========================================
// ВІДПРАВКА ТА ВИДАЛЕННЯ
// ==========================================
async function sendMessage() {
    const input = document.getElementById('chatInput');
    const fileInput = document.getElementById('ticketFile');
    const text = input.value.trim();
    
    // Перевіряємо, чи є хоча б текст або файл (щоб не слати пустоту)
    const hasFile = fileInput && fileInput.files && fileInput.files.length > 0;
    if (!text && !hasFile) return;

    // ==========================================
    // 🚩 РЕЖИМ 1: ПЕРЕПИСКА З АДМІНОМ (ТІКЕТИ)
    // ==========================================
    // ==========================================
    // 🚩 РЕЖИМ 1: ПЕРЕПИСКА З АДМІНОМ (ТІКЕТИ)
    // ==========================================
    if (currentTicketId) {
        try {
            let res;
            
            // Підготовка даних для відповіді (цитати)
            const replyPayload = replyData ? {
                messageId: replyData.id,
                text: replyData.text
            } : null;

            // --- ВАРІАНТ 1: ЯКЩО Є ФОТО ---
            if (hasFile) {
                const formData = new FormData();
                formData.append('text', text);
                formData.append('image', fileInput.files[0]);
                
                // 🔥 ДОДАЄМО ЦИТАТУ В FORMDATA
                if (replyPayload) {
                    formData.append('replyTo', JSON.stringify(replyPayload));
                }

                res = await fetch(`${API_BASE_URL}/tickets/${currentTicketId}/reply`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                    body: formData 
                });
            } 
            // --- ВАРІАНТ 2: ЯКЩО ТІЛЬКИ ТЕКСТ ---
            else {
                res = await fetch(`${API_BASE_URL}/tickets/${currentTicketId}/reply`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ 
                        text: text,
                        replyTo: replyPayload // 🔥 ДОДАЄМО ЦИТАТУ В JSON
                    })
                });
            }

            const data = await res.json();

            // Обробка ліміту
            if (res.status === 429 && data.error === "LIMIT_EXCEEDED") {
                alert("У вас закінчився ліміт фото на сьогодні (3/3). Спробуйте відправити тільки текст.");
                fileInput.value = ''; 
                document.getElementById('filePreview').classList.add('d-none');
                return; 
            }

            if (res.ok) {
                input.value = '';
                if (fileInput) fileInput.value = '';
                document.getElementById('filePreview').classList.add('d-none');
                
                // 🔥 ОЧИЩАЄМО ПЛАШКУ ЦИТАТИ ПІСЛЯ УСПІШНОЇ ВІДПРАВКИ
                cancelReply(); 
                
                // Якщо хочеш миттєво оновити інтерфейс (для вчителя/студента)
                if (typeof showTicketList === 'function') {
                    // Якщо ми на сторінці списку - оновимо список
                }
            } else {
                alert(data.error || "Помилка відправки в тікет");
            }
        } catch (err) {
            console.error("Помилка відправки:", err);
        }
        
        return; // Виходимо, щоб не спрацювала логіка звичайного чату
    }

// ... далі логіка чату студентів ...

    // ==========================================
    // 💬 РЕЖИМ 2: ЗВИЧАЙНИЙ ЧАТ ЗІ СТУДЕНТОМ
    // ==========================================
    if (!currentReceiverId) {
        alert("Виберіть студента для переписки");
        return;
    }

    // 1. Базовий пейлоад
    const payload = { receiverId: currentReceiverId, text: text };

    // 2. Якщо це ВІДПОВІДЬ — копіюємо контекст оригіналу
    if (replyData) {
        payload.replyTo = {
            messageId: replyData.id,
            text: replyData.text
        };

        // Беремо оригінальне повідомлення, щоб витягнути його "координати"
        const originalMsg = currentChatHistory.find(m => m._id === replyData.id);
        
        if (originalMsg) {
            if (originalMsg.courseId) {
                payload.courseId = getSafeCourseId(originalMsg.courseId);
            }
            if (originalMsg.context) {
                payload.context = { ...originalMsg.context };
            }
        }
    } 
    // 3. Якщо це НЕ відповідь — працює твоя логіка лівих/правих фільтрів
    else {
        const targetCourse = pFilterCourse !== 'all' ? pFilterCourse : currentCourseFilter;

        if (targetCourse !== 'all' && targetCourse !== 'general') {
            payload.courseId = targetCourse;

            const targetSec = pFilterSection !== 'all' ? pFilterSection : currentSectionFilter;
            const targetTask = pFilterTask !== 'all' ? pFilterTask : currentTaskFilter;

            if (targetSec !== 'all') {
                payload.context = {
                    sectionIdx: parseInt(targetSec),
                    taskId: targetTask !== 'all' ? targetTask : "-1",
                    taskTitle: "Контекст" 
                };

                if (targetSec === '-1') {
                    payload.context.taskTitle = "Загальні питання курсу";
                } else if (payload.context.taskId === "-1") {
                    const opt = document.querySelector(`#psectionFilter option[value="${targetSec}"]`) || document.querySelector(`#sectionFilter option[value="${targetSec}"]`);
                    payload.context.taskTitle = opt ? opt.textContent : `Секція ${parseInt(targetSec) + 1}`;
                } else {
                    const opt = document.querySelector(`#ptaskFilter option[value="${targetTask}"]`) || document.querySelector(`#taskFilter option[value="${targetTask}"]`);
                    payload.context.taskTitle = opt ? opt.textContent.replace('Завдання: ', '') : "Завдання";
                }
            }
        }
    }

    // 4. Відправка студенту
    try {
        const res = await fetch(`${API_BASE_URL}/messages`, {
            method: 'POST',
            headers: getAuthHeaders(), // Тут JSON, бо студенту ми шлемо тільки текст
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            input.value = ''; 
            cancelReply(); // Очищаємо плашку відповіді
            await refreshCurrentChatSilent(); 
            loadDialogs(true); 
        } else {
            alert("Помилка відправки повідомлення студенту");
        }
    } catch (err) {
        console.error("Помилка відправки студенту:", err);
    }
}

async function refreshCurrentChatSilent() {
    if (!currentReceiverId) return; 

    try {
        const res = await fetch(`${API_BASE_URL}/messages/history/${currentReceiverId}`, { headers: getAuthHeaders() });
        if (!res.ok) return;
        
        const messages = await res.json();
        if (messages.length !== lastMessageCount) {
            lastMessageCount = messages.length;
            currentChatHistory = messages; 
            applyPersonalFilters(); 
        }
    } catch (err) { console.error("Помилка тихого оновлення чату:", err); }
}

let messageIdToDelete = null; // Змінна для збереження ID повідомлення

// 1. Функція, яка лише відкриває модалку (викликається при кліку на іконку кошика)
function deleteMessage(msgId) {
    messageIdToDelete = msgId;
    const deleteModal = new bootstrap.Modal(document.getElementById('deleteMessageModal'));
    deleteModal.show();
}

// 2. Функція, яка виконує реальне видалення (викликається кнопкою "Видалити" в модалці)
async function executeMessageDelete() {
    if (!messageIdToDelete) return;

    const btn = document.getElementById('confirmDeleteMsgBtn');
    const originalText = btn.innerHTML;
    
    // Візуальний відгук: лоадер на кнопці
    btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`;
    btn.disabled = true;

    try {
        const res = await fetch(`${API_BASE_URL}/messages/${messageIdToDelete}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        if (res.ok) {
            // Анімація зникнення як у твоєму старому коді
            const msgElement = document.getElementById(`msg-${messageIdToDelete}`);
            if (msgElement) {
                msgElement.style.transition = "0.3s";
                msgElement.style.opacity = "0";
                setTimeout(() => msgElement.remove(), 300);
            }
            
            currentChatHistory = currentChatHistory.filter(m => m._id !== messageIdToDelete);
            lastMessageCount--;
            if (typeof loadDialogs === 'function') loadDialogs(true);
            
            // Закриваємо модалку
            const modalEl = document.getElementById('deleteMessageModal');
            bootstrap.Modal.getInstance(modalEl).hide();
        } else {
            const data = await res.json();
            alert(data.message || "Не вдалося видалити повідомлення");
        }
    } catch (err) { 
        console.error("Помилка видалення:", err); 
    } finally {
        // Повертаємо кнопку до ладу
        btn.innerHTML = originalText;
        btn.disabled = false;
        messageIdToDelete = null;
    }
}

// ==========================================
// РОЗУМНЕ ФОРМАТУВАННЯ ДАТИ ТА ЧАСУ
// ==========================================
function formatMessageDate(dateInput) {
    if (!dateInput) return '';
    
    const msgDate = new Date(dateInput);
    const today = new Date();
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const timeStr = msgDate.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });

    // Якщо сьогодні
    if (msgDate.toDateString() === today.toDateString()) {
        return timeStr;
    }
    // Якщо вчора
    if (msgDate.toDateString() === yesterday.toDateString()) {
        return `Вчора, ${timeStr}`;
    }
    // Якщо цього року
    if (msgDate.getFullYear() === today.getFullYear()) {
        const dayMonth = msgDate.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
        return `${dayMonth}, ${timeStr}`;
    }
    // Якщо старіше (інший рік)
    const fullDate = msgDate.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `${fullDate}, ${timeStr}`;
}

function setReply(msgId, text) {
    // Шукаємо оригінальне повідомлення в історії
    const originalMsg = currentChatHistory.find(m => m._id === msgId);
    
    replyData = { 
        id: msgId, 
        text: text,
        // 🔥 Зберігаємо контекст оригіналу
        courseId: originalMsg?.courseId,
        context: originalMsg?.context 
    };
    

    const replyText = document.getElementById('replyPreviewText');
    
    const replyBar = document.getElementById('replyPreviewBar');
    if (replyBar) {
        document.getElementById('replyPreviewText').textContent = text;
        replyBar.classList.remove('d-none');
        replyBar.classList.add('d-flex'); // Важливо для вирівнювання хрестика
        document.getElementById('chatInput').focus();
    }
}

function cancelReply() {
    replyData = null;
    const replyBar = document.getElementById('replyPreviewBar');
    if (replyBar) {
        replyBar.classList.add('d-none');
    }
}

// ==========================================
// 🛠 СИСТЕМА ТІКЕТІВ (CRM SUPPORT ДЛЯ ВИКЛАДАЧА)
// ==========================================

// 1. Ініціалізація кліку на кнопку "Зв'язок з Адміном"
function initSupportChat() {
    const supportBtn = document.getElementById('supportChatBtn');
    if (!supportBtn) return;

    supportBtn.onclick = () => {
        currentTicketId = null;
        currentReceiverId = null; 

        // Виділяємо кнопку
        document.querySelectorAll('.dialog-item').forEach(el => el.classList.remove('active'));
        supportBtn.classList.add('active-support');

        // Показуємо дашборд
        document.getElementById('ticketDashboardArea').classList.remove('d-none');
        document.getElementById('ticketDashboardArea').classList.add('d-flex');
        
        // Ховаємо фільтри та інпут
        document.getElementById('personalChatFilters').classList.add('d-none');
        document.getElementById('chatInputContainer').classList.add('d-none');

        document.getElementById('chatHeader').innerHTML = `
          <div class="d-flex align-items-center gap-3">
            <div class="bg-success text-white rounded-circle d-flex align-items-center justify-content-center fw-bold shadow-sm" style="width: 45px; height: 45px;"><i class="bi bi-shield-lock fs-5"></i></div>
            <div><h5 class="fw-bold text-dark mb-0">Зв'язок з Адміном</h5><small class="text-muted">Модерація та техпідтримка</small></div>
          </div>
        `;
        showTicketList();
    };
}

// 2. Список тікетів викладача
// Оновлена функція з підтримкою silent-режиму
async function showTicketList(isSilent = false) {
    // Показуємо спіннер тільки якщо це не фонове оновлення
    const container = document.getElementById('ticketsContainer');
    if (!isSilent) {
        document.getElementById('chatHeader')?.classList.add('d-none');
        document.getElementById('messagesArea')?.classList.add('d-none');
        document.getElementById('chatInputContainer')?.classList.add('d-none');
        
        const dashboard = document.getElementById('ticketDashboardArea');
        if (dashboard) { dashboard.classList.remove('d-none'); dashboard.classList.add('d-flex'); }
        
        document.getElementById('ticketCreateView')?.classList.add('d-none');
        document.getElementById('ticketListView')?.classList.remove('d-none');
        
        if (container) container.innerHTML = '<div class="text-center mt-4"><div class="spinner-border text-success"></div></div>';
    }

    try {
        const res = await fetch(`${API_BASE_URL}/tickets`, { headers: getAuthHeaders() });
        const tickets = await res.json();
        
        if (container) {
            if (tickets.length === 0) {
                container.innerHTML = `<div class="text-center text-muted p-5 bg-light rounded-4 border">Запитів немає.</div>`;
                return;
            }

            container.innerHTML = tickets.map(t => {
                // 🔥 НОВА ЛОГІКА СТАТУСІВ
                const statusConfig = {
                    new: { color: 'text-primary', label: 'Новий', bg: 'bg-primary-subtle', icon: '🔵' },
                    open: { color: 'text-success', label: 'В роботі', bg: 'bg-success-subtle', icon: '🟢' },
                    pending: { color: 'text-warning', label: 'Очікує вашої відповіді', bg: 'bg-warning-subtle', icon: '🟡' },
                    closed: { color: 'text-secondary', label: 'Запит вирішено', bg: 'bg-secondary-subtle', icon: '🔴' }
                };
                const config = statusConfig[t.status] || statusConfig.new;
                
                const firstMsgText = t.message || (t.messages && t.messages.length > 0 ? t.messages[0].text : 'Опис відсутній');
                
                return `
                <div class="card border border-success-subtle shadow-sm rounded-4 mb-3 ticket-card-item" 
                     data-ticket-id="${t._id}" 
                     onclick="openTicketChat('${t._id}', '${t.subject.replace(/'/g, "\\'")}', '${t.status}', '${t.category}')" 
                     style="cursor: pointer; transition: 0.2s;">
                    <div class="card-body p-3">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <span class="badge ${config.bg} ${config.color} rounded-pill px-3" style="font-size: 0.75rem; font-weight: 700;">
                                ${config.icon} ${config.label}
                            </span>
                            <small class="text-muted">${new Date(t.createdAt).toLocaleDateString()}</small>
                        </div>
                        <h6 class="fw-bold mb-1 text-dark">${t.subject}</h6>
                        <div class="small text-muted mb-1"><b>Категорія:</b> ${t.category}</div>
                        <div class="small text-truncate text-secondary" style="max-width: 90%;">${firstMsgText}</div>
                    </div>
                </div>`;
            }).join('');
        }
    } catch (err) { if (!isSilent) container.innerHTML = 'Помилка завантаження.'; }
}

// 3. Форма створення тікета (Підтягуємо ЧЕРНЕТКИ викладача)
async function showNewTicketForm() {
    document.getElementById('ticketListView').classList.add('d-none');
    document.getElementById('ticketCreateView').classList.remove('d-none');

    const select = document.getElementById('newTicketCourse');
    if (!select) return;
    
    select.innerHTML = '<option value="">Завантаження курсів...</option>';

    try {
        const res = await fetch(`${API_BASE_URL}/courses/my-courses`, { headers: getAuthHeaders() });
        const courses = await res.json();
        
        select.innerHTML = '<option value="">-- Оберіть курс для модерації --</option>';
        
        let foundDrafts = 0;
        courses.forEach(c => {
            // Показуємо тільки ті курси, які ще не публічні
            if (!c.isPublic) {
                const cId = (c._id && c._id.$oid) ? c._id.$oid : c._id;
                select.innerHTML += `<option value="${cId}">${c.title}</option>`;
                foundDrafts++;
            }
        });

        if (foundDrafts === 0) {
            select.innerHTML = '<option value="">У вас немає курсів-чернеток для публікації</option>';
        }
    } catch (e) {
        console.error("Помилка завантаження курсів для тікета:", e);
        select.innerHTML = '<option value="">Помилка завантаження</option>';
    }
}

function toggleTeacherTicketFields() {
    const subject = document.getElementById('newTicketSubject').value;
    const wrapper = document.getElementById('teacherCourseSelectWrapper');
    if (wrapper) {
        wrapper.classList.toggle('d-none', subject !== 'Запит на публікацію курсу');
    }
}

window.toggleContextVisibility = function() {
    isContextHidden = !isContextHidden; // Перемикаємо стан (сховано/показано)
    applyPersonalFilters(); // Миттєво перемальовуємо чат
};

// 4. Відправити новий тікет
async function submitNewTicket() {
    const subjectSelect = document.getElementById('newTicketSubject');
    const subject = subjectSelect.value;
    const categoryText = subjectSelect.options[subjectSelect.selectedIndex].text;
    const category = categoryText.replace(/[^\w\sа-яА-ЯіїєґІЇЄҐ]/g, '').trim(); // Видаляємо емодзі
    
    const courseSelect = document.getElementById('newTicketCourse');
    const message = document.getElementById('newTicketMessage').value.trim();

    if (!message) return alert("Опишіть ваше звернення!");

    const payload = {
        subject: subject,
        category: category,
        message: message
    };

    if (subject === 'Запит на публікацію курсу') {
        const courseId = courseSelect.value;
        if (!courseId) return alert("Будь ласка, оберіть курс для перевірки!");
        payload.courseId = courseId;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/tickets`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            document.getElementById('newTicketMessage').value = '';
            showTicketList();
        } else {
            const errData = await res.json();
            alert("Помилка: " + (errData.error || "Невідома помилка"));
        }
    } catch (e) { console.error(e); }
}

// 5. Відкрити чат тікета
async function openTicketChat(ticketId, subject, status, category) {
    const isAlreadyOpen = (currentTicketId === ticketId);
    currentTicketId = ticketId;

    document.getElementById('attachBtn')?.classList.remove('d-none');
    
    const dashboard = document.getElementById('ticketDashboardArea');
    const header = document.getElementById('chatHeader');
    const msgArea = document.getElementById('messagesArea');
    const inputCont = document.getElementById('chatInputContainer');

    if (dashboard) dashboard.classList.add('d-none');
    header.classList.remove('d-none');
    header.classList.add('d-flex');
    msgArea.classList.remove('d-none');
    inputCont.classList.remove('d-none');

    // Оновлюємо заголовок (статуси, кнопки)
    renderTicketHeader(ticketId, subject, status, category);

    // 🔥 Якщо чат вже відкритий, не показуємо спіннер, щоб не було мерехтіння
    if (!isAlreadyOpen) {
        msgArea.innerHTML = '<div class="text-center mt-5"><div class="spinner-border text-success"></div></div>';
    }
    
    try {
        const res = await fetch(`${API_BASE_URL}/tickets`, { headers: getAuthHeaders() });
        const allTickets = await res.json();
        const currentTicket = allTickets.find(t => t._id === ticketId);
        
        if (currentTicket) renderTicketMessages(currentTicket);
    } catch (e) { console.error("Помилка завантаження тікета"); }
}

// Виніс заголовок в окрему функцію для зручності
// Виніс заголовок в окрему функцію для зручності
function renderTicketHeader(ticketId, subject, status, category) {
    const header = document.getElementById('chatHeader');
    
    const statusLabels = {
        new: '<span class="badge bg-primary-subtle text-primary rounded-pill px-3">🔵 Новий запит</span>',
        open: '<span class="badge bg-success-subtle text-success rounded-pill px-3">🟢 В роботі</span>',
        pending: '<span class="badge bg-warning-subtle text-warning rounded-pill px-3">🟡 Очікує відповіді</span>',
        closed: '<span class="badge bg-secondary-subtle text-secondary rounded-pill px-3">🔴 Вирішено</span>'
    };

    // 🔥 ВИПРАВЛЕНО: Залишаємо тільки кнопку "Закрити" (без кошика)
    let actionButtons = '';
    if (status !== 'closed') {
        actionButtons = `<button class="btn btn-sm btn-outline-success rounded-circle ms-2 border-0 shadow-none" onclick="closeTicket('${ticketId}')" title="Позначити як вирішене"><i class="bi bi-check-circle-fill fs-5"></i></button>`;
    }

    header.innerHTML = `
      <div class="d-flex justify-content-between w-100 align-items-center">
        <div class="d-flex align-items-center gap-3">
          <i class="bi bi-arrow-left-circle-fill fs-3 text-success cursor-pointer opacity-75 hover-opacity-100" onclick="showTicketList()"></i>
          <div>
            <div class="d-flex align-items-center gap-2">
                <h5 class="fw-bold text-dark mb-0">Служба підтримки</h5>
                <span class="badge bg-success rounded-pill" style="font-size: 0.65rem;">Support</span>
            </div>
            <small class="text-muted">ID: ${ticketId.slice(-6).toUpperCase()} | Тема: <span class="fw-bold">${subject}</span></small>
          </div>
        </div>
        <div class="d-flex align-items-center">
            ${statusLabels[status] || statusLabels.new}
            ${actionButtons}
        </div>
      </div>`;
}

// js/teacher-messages.js
function renderTicketMessages(ticket) {
    const area = document.getElementById('messagesArea');
    area.innerHTML = '';
    const myId = localStorage.getItem('userId');
    
    // 1. 🔥 ОБОВ'ЯЗКОВО: Оновлюємо історію, щоб функція setReply могла знайти текст
    currentChatHistory = ticket.messages; 

    let initialMessageText = ticket.message || (ticket.messages && ticket.messages[0]?.text) || 'Опис відсутній';
    const createdTime = formatMessageDate(ticket.createdAt);
    
    const initialImg = (ticket.messages && ticket.messages[0]?.fileUrl) 
        ? `<div class="mt-2 text-center"><a href="${ticket.messages[0].fileUrl}" target="_blank"><img src="${ticket.messages[0].fileUrl}" class="img-fluid rounded-3 border" style="max-height: 200px;"></a></div>` 
        : '';

    // 2. 🔥 ДОДАЄМО КНОПКУ ВІДПОВІДІ ТА ID ДЛЯ ПЕРШОГО ПОВІДОМЛЕННЯ
    area.innerHTML += `
        <div class="message-bubble msg-teacher mb-3 shadow-sm" id="msg-${ticket._id}">
            <div class="d-flex justify-content-between align-items-start">
                <div class="small fw-bold mb-1 text-white-50"><i class="bi bi-ticket-detailed me-1"></i> Ваш запит</div>
                <i class="bi bi-reply-fill cursor-pointer text-white-50 opacity-75 hover-opacity-100" 
                   onclick="setReply('${ticket._id}', '${initialMessageText.replace(/'/g, "\\'")}')"></i>
            </div>
            <div>${initialMessageText}</div>
            ${initialImg}
            <div class="small mt-2 text-end text-white-50" style="font-size: 0.7rem;">${createdTime}</div>
        </div>
    `;

    const startIndex = (ticket.message) ? 0 : 1; 
    if (ticket.messages && ticket.messages.length > startIndex) {
        for (let i = startIndex; i < ticket.messages.length; i++) {
            const msg = ticket.messages[i];
            const time = formatMessageDate(msg.createdAt);
            const senderId = (msg.sender && msg.sender._id) ? msg.sender._id.toString() : msg.sender.toString();
            const isMine = senderId === myId;
            
            const bubbleClass = isMine ? 'msg-teacher' : 'msg-student shadow-sm';
            const senderName = isMine ? "Ви" : "Адміністратор (Підтримка)";
            const textStyle = isMine ? 'text-white-50' : 'opacity-75';

            // 3. 🔥 ВПЕВНИСЬ, ЩО ЦЕЙ БЛОК replyHtml ВІДОБРАЖАЄ ТЕКСТ (msg.replyTo.text)
            let replyHtml = '';
            if (msg.replyTo && msg.replyTo.text) {
                replyHtml = `
                    <div class="reply-quote mb-2">
                        <div class="text-truncate small fw-bold mb-1" style="opacity: 0.6;">ВІДПОВІДЬ НА:</div>
                        <div class="text-truncate">${msg.replyTo.text}</div>
                    </div>`;
            }

            const escapedText = (msg.text || "").replace(/'/g, "\\'").replace(/"/g, "&quot;");
            const replyBtn = `<i class="bi bi-reply-fill cursor-pointer ms-2 opacity-50 hover-opacity-100" 
                                onclick="setReply('${msg._id}', '${escapedText}')" title="Відповісти"></i>`;

            const imgHtml = msg.fileUrl 
                ? `<div class="mt-2 text-center">
                     <a href="${msg.fileUrl}" target="_blank">
                       <img src="${msg.fileUrl}" class="img-fluid rounded-3 border shadow-sm" style="max-height: 200px; cursor: pointer;">
                     </a>
                   </div>` 
                : '';

            area.innerHTML += `
                <div class="message-bubble ${bubbleClass} mb-3" id="msg-${msg._id}">
                    ${replyHtml}
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="small fw-bold mb-1" style="opacity: 0.8;">${senderName}</div>
                        ${replyBtn}
                    </div>
                    <div>${msg.text || ""}</div>
                    ${imgHtml} 
                    <div class="small mt-1 text-end ${textStyle}" style="font-size: 0.7rem;">${time}</div>
                </div>
            `;
        }
    }
    area.scrollTop = area.scrollHeight;
}

// 6. Управління тікетом
// Глобальна змінна для збереження ID тікета, який закриваємо
let ticketIdToClose = null;

/**
 * 1. Відкриває модальне вікно (замість стандартного confirm)
 */
function closeTicket(ticketId) {
    ticketIdToClose = ticketId;
    const modalEl = document.getElementById('closeTicketModal');
    const modalInstance = new bootstrap.Modal(modalEl);
    modalInstance.show();
}

/**
 * 2. Виконує реальний запит на закриття тікета
 */
async function executeTicketClose() {
    if (!ticketIdToClose) return;

    const btn = document.getElementById('confirmCloseTicketBtn');
    const originalText = btn.innerHTML;
    
    // Візуальна індикація завантаження
    btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`;
    btn.disabled = true;

    try {
        const res = await fetch(`${API_BASE_URL}/tickets/${ticketIdToClose}/close`, {
            method: 'PUT',
            headers: getAuthHeaders()
        });

        if (res.ok) {
            // Закриваємо модалку
            const modalEl = document.getElementById('closeTicketModal');
            const modalInstance = bootstrap.Modal.getInstance(modalEl);
            if (modalInstance) modalInstance.hide();
            
            // Оновлюємо інтерфейс викладача (список запитів)
            if (typeof showTicketList === 'function') {
                showTicketList(); 
            }
        } else {
            const data = await res.json();
            alert(data.error || 'Не вдалося закрити тікет.');
        }
    } catch (e) { 
        console.error("Помилка закриття тікета:", e); 
    } finally {
        // Повертаємо кнопку в початковий стан
        btn.innerHTML = originalText;
        btn.disabled = false;
        ticketIdToClose = null;
    }
}


// 🔥 ФУНКЦІЯ ДЛЯ МИТТЄВОГО ДОДАВАННЯ ПОВІДОМЛЕННЯ В ЧАТ ТІКЕТА
function appendSingleTicketMessage(msg) {
    const area = document.getElementById('messagesArea');
    if (!area) return;

    // 🛡️ БРОНЯ ВІД ДУБЛІКАТІВ
    if (msg._id && document.getElementById(`msg-${msg._id}`)) {
        console.log("Блок дубліката:", msg._id);
        return; 
    }

    const myId = localStorage.getItem('userId');
    const msgSenderId = msg.sender?._id || msg.sender;
    const isMine = msgSenderId.toString() === myId;
    
    const bubbleClass = isMine ? 'msg-teacher' : 'msg-student shadow-sm';
    const senderName = isMine ? "Ви" : "Адміністратор (Підтримка)";
    const time = typeof formatMessageDate === 'function' ? formatMessageDate(msg.createdAt) : "щойно";

    // 🔥 1. ДОДАЄМО БЛОК ЦИТАТИ (якщо повідомлення є відповіддю)
    let replyHtml = '';
    if (msg.replyTo && msg.replyTo.text) {
        replyHtml = `
            <div class="reply-quote p-2 mb-2 rounded border-start border-3 border-success" 
                 style="background: rgba(0,0,0,0.05); font-size: 0.8rem; opacity: 0.8;">
                <div class="text-truncate text-muted" style="font-size: 0.7rem;">ВІДПОВІДЬ НА:</div>
                <div class="text-truncate text-dark">${msg.replyTo.text}</div>
            </div>`;
    }

    // 🔥 2. ДОДАЄМО КНОПКУ ВІДПОВІДІ (щоб можна було відповісти на щойно отримане повідомлення)
    const escapedText = (msg.text || "").replace(/'/g, "\\'").replace(/"/g, "&quot;");
    const replyBtn = `<i class="bi bi-reply-fill cursor-pointer ms-2 opacity-50 hover-opacity-100" 
                        onclick="setReply('${msg._id}', '${escapedText}')" title="Відповісти"></i>`;

    const imgHtml = msg.fileUrl 
        ? `<div class="mt-2 text-center"><a href="${msg.fileUrl}" target="_blank"><img src="${msg.fileUrl}" class="img-fluid rounded-3 border" style="max-height: 200px;"></a></div>` 
        : '';

    // 🔥 3. ОНОВЛЕНИЙ ШАБЛОН (з replyHtml та replyBtn)
    const html = `
        <div class="message-bubble ${bubbleClass} mb-3" id="msg-${msg._id}" style="animation: fadeIn 0.3s ease;">
            ${replyHtml}
            <div class="d-flex justify-content-between align-items-start">
                <div class="small fw-bold mb-1" style="opacity: 0.8;">${senderName}</div>
                ${replyBtn}
            </div>
            <div>${msg.text || ""}</div>
            ${imgHtml}
            <div class="small mt-1 text-end opacity-50" style="font-size: 0.7rem;">${time}</div>
        </div>`;

    area.insertAdjacentHTML('beforeend', html);
    area.scrollTop = area.scrollHeight;

    // 🔥 4. ВАЖЛИВО: додаємо повідомлення в локальну історію, 
    // щоб функція setReply могла знайти його текст пізніше
    if (typeof currentChatHistory !== 'undefined' && Array.isArray(currentChatHistory)) {
        currentChatHistory.push(msg);
    }
}