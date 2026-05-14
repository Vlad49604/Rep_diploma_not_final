// js/student-messages.js
const API_BASE_URL = 'http://localhost:5002/api';

let currentReceiverId = null; 
let currentCourseFilter = 'all';
let currentSectionFilter = 'all';
let currentTaskFilter = 'all';
let loadedCourseData = null; 
let currentChatHistory = []; 
let lastMessageCount = 0;
let replyData = null;
let isContextHidden = false; // Пам'ятає стан: сховано чи ні

// Фільтри всередині чату
let pFilterCourse = 'all';
let pFilterSection = 'all';
let pFilterTask = 'all';
let pSearchMessage = ''; 

document.addEventListener('DOMContentLoaded', () => {
    checkAuthAndInit();
    
    const myId = localStorage.getItem('userId');
    if (myId) socket.emit('join', myId);

    loadCoursesForFilter();
    loadDialogs(); 
    initSupportChat();

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('ticketId')) {
        console.log("🚀 Знайдено ticketId в URL, відкриваємо підтримку...");
        
        // Викликаємо функцію списку тікетів примусово
        showTicketList(); 
        
        // Візуально виділяємо кнопку підтримки зліва
        const supportBtn = document.getElementById('supportChatBtn');
        if (supportBtn) {
            document.querySelectorAll('.dialog-item').forEach(el => el.classList.remove('active'));
            supportBtn.classList.add('active-support');
        }
    }

    setupEventListeners();
    setupSocketHandlers();
});

function getAuthHeaders() {
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` };
}

function checkAuthAndInit() {
    if (!localStorage.getItem('token')) window.location.href = '../index.html'; 
}

// ==========================================
// 🛠 НАЛАШТУВАННЯ СЛУХАЧІВ
// ==========================================
function setupEventListeners() {
    document.getElementById('sendBtn').addEventListener('click', sendMessage);
    document.getElementById('chatInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    // --- ЛІВІ ФІЛЬТРИ (ГЛОБАЛЬНІ) ---
    document.getElementById('courseFilter').addEventListener('change', async (e) => {
        currentCourseFilter = e.target.value;
        currentSectionFilter = 'all';
        currentTaskFilter = 'all';
        
        const sectionSelect = document.getElementById('sectionFilter');
        const taskSelect = document.getElementById('taskFilter');
        
        sectionSelect.classList.add('d-none');
        taskSelect.classList.add('d-none');
        
        // 🔥 ЗМІНА 1: Чіткий текст для загальних питань курсу
        sectionSelect.innerHTML = `
            <option value="all">Всі секції</option>
            <option value="-1">Тільки загальні питання курсу</option>
        `;
        taskSelect.innerHTML = '<option value="all">Всі завдання</option>';

        if (currentCourseFilter !== 'all' && currentCourseFilter !== 'general') {
            try {
                const res = await fetch(`${API_BASE_URL}/courses/${currentCourseFilter}`, { headers: getAuthHeaders() });
                loadedCourseData = await res.json();
                
                if (loadedCourseData && loadedCourseData.sections) {
                    loadedCourseData.sections.forEach((sec, idx) => {
                        sectionSelect.innerHTML += `<option value="${idx}">Секція ${idx + 1}: ${sec.title}</option>`;
                    });
                    sectionSelect.classList.remove('d-none'); 
                }
            } catch (err) { console.error("Помилка завантаження структури курсу:", err); }
        }
        resetChatIfNeeded();
    });

    document.getElementById('sectionFilter').addEventListener('change', (e) => {
        currentSectionFilter = e.target.value;
        currentTaskFilter = 'all';
        const taskSelect = document.getElementById('taskFilter');
        
        taskSelect.classList.add('d-none');
        
        // 🔥 ЗМІНА 2: Додаємо опцію "-1" для теорії секції, як у вчителя
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

        // 🔥 ЗМІНА 3: Правильне відображення списку завдань
        if (currentSectionFilter === '-1') {
            taskSelect.classList.add('d-none'); // Ховаємо завдання, якщо це загальне питання до курсу
        } else if (currentSectionFilter !== 'all') {
            taskSelect.classList.remove('d-none'); // Показуємо (навіть якщо є тільки теорія)
        }
        
        resetChatIfNeeded();
    });

    document.getElementById('taskFilter').addEventListener('change', (e) => {
        currentTaskFilter = e.target.value;
        resetChatIfNeeded();
    });

    document.getElementById('searchUser')?.addEventListener('input', applyLeftSearch);

    // --- ПРАВІ ФІЛЬТРИ (ПЕРСОНАЛЬНІ В ЧАТІ) ---
    document.getElementById('pcourseFilter').addEventListener('change', (e) => {
        pFilterCourse = e.target.value;
        pFilterSection = 'all'; pFilterTask = 'all';
        updatePersonalSectionAndTaskFilters();
        applyPersonalFilters();
    });

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

    document.getElementById('searchMessage')?.addEventListener('input', (e) => {
        pSearchMessage = e.target.value;
        applyPersonalFilters(); 
    });

    // --- ЛОГІКА СКРІПКИ ТА ФАЙЛІВ ---
    const attachBtn = document.getElementById('attachBtn');
    const ticketFileInput = document.getElementById('ticketFile');
    const filePreviewBar = document.getElementById('filePreview');
    const fileNameSpan = document.getElementById('fileNameDisplay');
    const removeFileBtn = document.getElementById('removeFileBtn');

    if (attachBtn && ticketFileInput) {
        attachBtn.addEventListener('click', () => {
            // Дозволяємо прикріплювати фото тільки в тікетах
            if (currentTicketId) ticketFileInput.click();
            else alert("Прикріплення фото доступне тільки для звернень до підтримки");
        });

        ticketFileInput.addEventListener('change', function() {
            if (this.files[0] && filePreviewBar && fileNameSpan) {
                fileNameSpan.textContent = "📎 " + this.files[0].name;
                filePreviewBar.classList.remove('d-none');
                filePreviewBar.classList.add('d-flex');
            }
        });
    }

    if (removeFileBtn) {
        removeFileBtn.addEventListener('click', () => {
            if (ticketFileInput) ticketFileInput.value = ''; 
            if (filePreviewBar) {
                filePreviewBar.classList.add('d-none');
                filePreviewBar.classList.remove('d-flex');
            }
        });
    }
}

function setupSocketHandlers() {
    socket.on('newMessage', (msg) => {
        // 🔥 ПЕРЕВІРКА: Це повідомлення для тікета чи для звичайного чату?
        if (msg.ticketId) {
            // ЛОГІКА ДЛЯ ТІКЕТІВ
            if (typeof showTicketList === 'function') {
                showTicketList(true); // Оновлюємо список тікетів без лоадера
            }

            // Якщо ми зараз знаходимося саме в цьому тікеті — малюємо повідомлення
            if (currentTicketId === msg.ticketId) {
                const formattedMsg = {
                    _id: msg._id,
                    sender: msg.sender,
                    text: msg.text,
                    replyTo: msg.replyTo, // 🔥 ВАЖЛИВО! Передаємо цитату
                    fileUrl: msg.fileUrl,
                    createdAt: msg.createdAt || new Date()
                };
                appendSingleTicketMessage(formattedMsg);
            }
        } else {
            // ЛОГІКА ДЛЯ ЗВИЧАЙНИХ ЧАТІВ (як було раніше)
            loadDialogs(true); 
            const senderId = typeof msg.sender === 'object' ? msg.sender._id : msg.sender;
            if (currentReceiverId === senderId) refreshCurrentChatSilent(); 
        }
    });

    socket.on('messageDeleted', (msgId) => {
        document.getElementById(`msg-${msgId}`)?.remove();
        currentChatHistory = currentChatHistory.filter(m => m._id !== msgId);
        lastMessageCount--;
        loadDialogs(true); 
    });
}

// ==========================================
// 📂 ЗАВАНТАЖЕННЯ ДАНИХ (ТУТ ВИПРАВЛЕНО БАГ З КУРСАМИ!)
// ==========================================
async function loadCoursesForFilter() {
    try {
        const res = await fetch(`${API_BASE_URL}/courses/enrolled`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error("Не вдалося завантажити курси");
        const data = await res.json();
        
        const filterSelect = document.getElementById('courseFilter');
        let optionsHtml = `<option value="all">Всі курси</option>`;
        
        // 🔥 Універсальна обробка: працює і якщо бекенд віддає масив об'єктів курсів, 
        // і якщо він віддає масив зарахувань { course: {...} }
        data.forEach(item => {
            const courseObj = item.course || item; // Беремо курс або з вкладення, або сам об'єкт
            if (courseObj && courseObj._id) {
                const courseIdStr = typeof courseObj._id === 'object' && courseObj._id.$oid ? courseObj._id.$oid : courseObj._id;
                optionsHtml += `<option value="${courseIdStr}">Курс: ${courseObj.title}</option>`;
            }
        });
        
        filterSelect.innerHTML = optionsHtml;
    } catch (err) { console.error("Помилка завантаження фільтра:", err); }
}

async function loadDialogs(isSilent = false) {
    const container = document.getElementById('dialogsContainer');
    if (!isSilent) container.innerHTML = '<div class="text-center text-muted p-4"><div class="spinner-border text-success spinner-border-sm"></div></div>';

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
        const dialogs = await res.json();

        if (dialogs.length === 0) {
            container.innerHTML = '<div class="p-4 text-center text-muted">Немає повідомлень</div>';
            return;
        }

        let newHtml = '';
        dialogs.forEach(dialog => {
            const time = formatMessageDate(dialog.lastMessageTime);
            const unreadBadge = '';
            const isActive = currentReceiverId === dialog._id ? 'active' : '';
            const avatarChar = dialog.name ? dialog.name.charAt(0).toUpperCase() : 'В';

            newHtml += `
                <div class="p-3 border-bottom dialog-item ${isActive} d-flex align-items-center gap-3" data-id="${dialog._id}" onclick="openChat('${dialog._id}', '${dialog.name.replace(/'/g, "\\'")}')">
                    <div class="bg-success text-white rounded-circle d-flex align-items-center justify-content-center fw-bold flex-shrink-0" style="width: 45px; height: 45px;">${avatarChar}</div>
                    <div class="flex-grow-1 overflow-hidden">
                        <div class="d-flex justify-content-between align-items-center mb-1">
                            <span class="fw-bold text-dark text-truncate user-name-text">${dialog.name}</span>
                            <span class="small text-muted" style="font-size: 0.70rem;">${time}</span>
                        </div>
                        <div class="small ${dialog.unreadCount > 0 ? 'fw-bold text-dark' : 'text-muted'} text-truncate d-flex justify-content-between align-items-center">
                            <span class="text-truncate">${dialog.lastMessageText}</span>
                            ${unreadBadge}
                        </div>
                    </div>
                </div>
            `;
        });
        container.innerHTML = newHtml;
        applyLeftSearch();
   
        // Авто-відкриття чату з URL
        const urlParams = new URLSearchParams(window.location.search);
        const chatWithId = urlParams.get('chatWith');
        if (chatWithId && !currentReceiverId) {
            const targetDialog = dialogs.find(d => d._id === chatWithId);
            if (targetDialog) openChat(targetDialog._id, targetDialog.name);
            else openChat(chatWithId, "Викладач");
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    } catch (err) {
        if (!isSilent) container.innerHTML = '<div class="p-4 text-center text-danger">Помилка завантаження діалогів</div>';
    }
}

async function resetChatIfNeeded() {
    await loadDialogs(true);
    applyLeftSearch();
    
    if (!currentReceiverId) {
        document.getElementById('personalChatFilters')?.classList.add('d-none');
        return;
    }

    if (!document.querySelector(`.dialog-item[data-id="${currentReceiverId}"]`)) {
        document.getElementById('chatHeader').innerHTML = `
          <div class="d-flex align-items-center gap-3 text-muted">
            <i class="bi bi-chat-left-text fs-4"></i><h5 class="mb-0">Оберіть діалог для спілкування</h5>
          </div>`;
        document.getElementById('messagesArea').innerHTML = '<div class="text-center text-muted mt-5">Виберіть діалог з меню зліва</div>';
        document.getElementById('chatInput').disabled = true;
        document.getElementById('sendBtn').disabled = true;
        document.getElementById('personalChatFilters')?.classList.add('d-none');
        currentReceiverId = null;
    } else {
        const currentUserName = document.querySelector('#chatHeader h5')?.textContent.replace(' (Викладач)', '') || "Викладач";
        openChat(currentReceiverId, currentUserName);
    }
}

function applyLeftSearch() {
    const term = document.getElementById('searchUser')?.value.toLowerCase().trim() || "";
    document.querySelectorAll('.dialog-item').forEach(item => {
        const name = item.querySelector('.user-name-text')?.textContent.toLowerCase() || "";
        item.style.setProperty('display', (term === '' || name.includes(term)) ? 'flex' : 'none', 'important');
    });
}

// ==========================================
// 💬 РОБОТА З ЧАТОМ ТА ПЕРСОНАЛЬНІ ФІЛЬТРИ
// ==========================================
// ==========================================
// ВІДКРИТТЯ ЧАТУ ТА ФІЛЬТРИ ПРАВОЇ ЧАСТИНИ
// ==========================================
async function openChat(userId, userName, isSupport = false) {
    currentReceiverId = userId;
    currentTicketId = null; // Скидаємо тікет, якщо він був відкритий


    document.getElementById('attachBtn')?.classList.add('d-none');
    document.getElementById('filePreview')?.classList.add('d-none');

    // 1. ПЕРЕМИКАННЯ ВІЗУАЛЬНИХ БЛОКІВ
    // Ховаємо дашборд тікетів ПОВНІСТЮ
    const ticketDashboard = document.getElementById('ticketDashboardArea');
    if (ticketDashboard) {
        ticketDashboard.classList.add('d-none');
        ticketDashboard.classList.remove('d-flex');
    }

    // Показуємо всі зони звичайного чату
    document.getElementById('chatHeader')?.classList.remove('d-none');
    document.getElementById('messagesArea')?.classList.remove('d-none');
    document.getElementById('chatInputContainer')?.classList.remove('d-none');
    document.getElementById('chatInputGroup')?.classList.remove('d-none'); // Для блоку з тікетами
    document.getElementById('ticketOptions')?.classList.add('d-none');    // Ховаємо кнопки категорій

    document.getElementById('chatInput').disabled = false;
    document.getElementById('sendBtn').disabled = false;

    // 2. ОНОВЛЕННЯ ХЕДЕРА
    let headerSubtitle = isSupport ? "Адміністратор" : "Викладач";
    let iconOrAvatar = isSupport ? `<i class="bi bi-headset fs-5"></i>` : userName.charAt(0).toUpperCase();

    document.getElementById('chatHeader').innerHTML = `
      <div class="d-flex align-items-center gap-3">
        <div class="bg-success text-white rounded-circle d-flex align-items-center justify-content-center fw-bold shadow-sm" style="width: 45px; height: 45px;">
            ${iconOrAvatar}
        </div>
        <div>
            <h5 class="fw-bold text-dark mb-0">${userName}</h5>
            <small class="text-muted fw-normal" style="font-size: 0.75rem;">${headerSubtitle}</small>
        </div>
      </div>
    `;

    // 3. ВИДІЛЕННЯ В МЕНЮ ЗЛІВА
    const supportBtn = document.getElementById('supportChatBtn');
    document.querySelectorAll('.dialog-item').forEach(el => el.classList.remove('active'));
    if (isSupport) {
        supportBtn?.classList.add('active-support');
    } else {
        const activeItem = document.querySelector(`.dialog-item[data-id="${userId}"]`);
        if (activeItem) activeItem.classList.add('active');
        supportBtn?.classList.remove('active-support');
    }

    // 4. ЗАВАНТАЖЕННЯ ПОВІДОМЛЕНЬ
    const messagesArea = document.getElementById('messagesArea');
    messagesArea.innerHTML = '<div class="text-center text-muted mt-5"><div class="spinner-border text-success"></div></div>';

    try {
        const res = await fetch(`${API_BASE_URL}/messages/history/${userId}`, { headers: getAuthHeaders() });
        const messages = await res.json();
        
        lastMessageCount = messages.length; 
        currentChatHistory = messages; 

        // Якщо це ПІДТРИМКА і повідомлень ще немає - показуємо вибір категорій
        if (isSupport && messages.length === 0) {
            document.getElementById('chatInputGroup').classList.add('d-none');
            document.getElementById('ticketOptions').classList.remove('d-none');
            document.getElementById('personalChatFilters').classList.add('d-none');
            messagesArea.innerHTML = `
                <div class="d-flex flex-column align-items-center justify-content-center h-100 text-muted opacity-75">
                    <i class="bi bi-ticket-detailed fs-1 mb-2"></i>
                    <h6>Створення нового запиту</h6>
                    <p class="small text-center">Оберіть тему звернення внизу.</p>
                </div>
            `;
            return;
        }

        // Відображення
        if (isSupport) {
            document.getElementById('personalChatFilters').classList.add('d-none');
            renderMessages(messages); // Малюємо все без фільтрів
        } else {
            // Для вчителя застосовуємо фільтри
            pFilterCourse = currentCourseFilter;
            pFilterSection = currentSectionFilter;
            pFilterTask = currentTaskFilter;
            
            buildPersonalFilters(messages); 
            applyPersonalFilters(); // Ця функція сама викличе renderMessages
        }
        
    } catch (err) {
        console.error(err);
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
    if (!currentReceiverId) { bar.classList.add('d-none'); return; }

    const cSelect = document.getElementById('pcourseFilter');
    const hasContext = messages.some(m => m.courseId || m.context);
    if (!hasContext) { bar.classList.add('d-none'); return; }
    bar.classList.remove('d-none');

    const uniqueCourses = new Map();
    let hasGeneral = false;
    
    messages.forEach(m => {
        if (!m.courseId) hasGeneral = true;
        else uniqueCourses.set(getSafeCourseId(m.courseId), m.courseId.title || "Курс");
    });

    cSelect.innerHTML = '<option value="all">Всі повідомлення</option>';
    if (hasGeneral) cSelect.innerHTML += '<option value="general">Загальна переписка</option>';
    uniqueCourses.forEach((title, id) => { cSelect.innerHTML += `<option value="${id}">${title}</option>`; });

    document.getElementById('psectionFilter')?.classList.add('d-none');
    document.getElementById('ptaskFilter')?.classList.add('d-none');
}

function updatePersonalSectionAndTaskFilters() {
    const sSelect = document.getElementById('psectionFilter');
    const tSelect = document.getElementById('ptaskFilter');
    sSelect.innerHTML = '<option value="all">Всі секції</option>';
    tSelect.innerHTML = '<option value="all">Всі завдання</option>';

    if (pFilterCourse === 'all' || pFilterCourse === 'general') {
        sSelect.classList.add('d-none'); tSelect.classList.add('d-none');
        pFilterSection = 'all'; pFilterTask = 'all';
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

    if (hasCourseGeneral) sSelect.innerHTML += '<option value="-1">Загальні питання</option>';
    Array.from(uniqueSections).sort((a,b)=>a-b).forEach(idx => {
        sSelect.innerHTML += `<option value="${idx}">Секція ${idx + 1}</option>`;
    });

    sSelect.classList.toggle('d-none', uniqueSections.size === 0 && !hasCourseGeneral);

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
        uniqueTasks.forEach((title, id) => { tSelect.innerHTML += `<option value="${id}">${title}</option>`; });
        tSelect.classList.toggle('d-none', uniqueTasks.size === 0 && !hasTheory);
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

    if (pSearchMessage.trim() !== '') {
        filtered = filtered.filter(m => m.text.toLowerCase().includes(pSearchMessage.toLowerCase()));
    }
    renderMessages(filtered); 
}

// ==========================================
// 🎨 РЕНДЕР ПОВІДОМЛЕНЬ
// ==========================================
// ==========================================
// 🎨 РЕНДЕР ПОВІДОМЛЕНЬ (ВІДРЕГУЛЬОВАНО ДЛЯ СТУДЕНТА)
// ==========================================
function renderMessages(messages) {
    const messagesArea = document.getElementById('messagesArea');
    if (!messagesArea) return;
    messagesArea.innerHTML = '';
    const myId = localStorage.getItem('userId');

    if (messages.length === 0) {
        messagesArea.innerHTML = '<div class="text-center text-muted mt-5">Немає повідомлень для цього розділу</div>';
        return;
    }

    // Отримуємо значення фільтрів
    const pCourseVal = document.getElementById('pcourseFilter')?.value || 'all';
    const pSecVal = document.getElementById('psectionFilter')?.value || 'all';
    const pTaskVal = document.getElementById('ptaskFilter')?.value || 'all';
    
    const isStickyMode = (pSecVal === '-1') || (pTaskVal !== 'all');
    
    // 🔥 ГОЛОВНА УМОВА: показувати назву курсу лише якщо фільтр "Всі повідомлення" (all)
    const shouldShowCourseName = (pCourseVal === 'all');

    const btnToggle = document.getElementById('btnToggleContext');
    if (btnToggle) {
        btnToggle.classList.toggle('d-none', !isStickyMode);
    }

    let lastBaseKey = null; 
    let lastErrorStr = null;

    messages.forEach(msg => {
        const time = formatMessageDate(msg.createdAt);
        const isMine = msg.sender.toString() === myId || msg.sender === myId || (msg.sender._id && msg.sender._id.toString() === myId);
        const bubbleClass = isMine ? 'msg-me' : 'msg-other shadow-sm';
        
        let contextHtml = '';
        let stickyHeaderHtml = '';

        if (msg.context && (msg.context.taskTitle || msg.context.taskId)) {
            const courseName = (msg.courseId && msg.courseId.title) ? msg.courseId.title : 'Курс';
            
            let headerText = 'Контекст';
            let badgeText = ''; 
            let bodyText = msg.context.taskTitle || '';

            if (msg.context.sectionIdx === -1 && msg.context.taskId === "-1") {
                headerText = 'Питання по курсу';
                badgeText = 'Загальне';
                bodyText = msg.context.taskTitle.replace('Загальне питання по курсу: ', '');
            } else if (msg.context.sectionIdx !== -1 && msg.context.taskId === "-1") {
                headerText = 'Питання по теорії';
                badgeText = `Секція ${msg.context.sectionIdx + 1}`;
            } else {
                headerText = 'Завдання';
                badgeText = `Секція ${msg.context.sectionIdx + 1}`;
            }

            if (isStickyMode && !isContextHidden) {
                const baseKey = `${msg.context.taskId}`;
                const currentError = msg.context.studentError ? msg.context.studentError.toString().trim() : null;
                
                if (baseKey !== lastBaseKey || (currentError && currentError !== lastErrorStr)) {
                    stickyHeaderHtml = `
                        <div class="w-100 d-flex justify-content-center my-3 position-sticky sticky-context-wrapper" style="top: 10px; z-index: 10;">
                            <div class="shadow-sm px-4 py-3 rounded-4 text-start" style="background: rgba(255, 255, 255, 0.98); backdrop-filter: blur(10px); border: 1px solid #dee2e6; border-left: 5px solid #198754; font-size: 0.85rem; max-width: 85%;">
                                <div class="d-flex align-items-center justify-content-between mb-1">
                                    <div class="d-flex align-items-center gap-2 text-muted" style="text-transform: uppercase; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.5px;">
                                        <i class="bi bi-pin-angle-fill text-success"></i> ${headerText}
                                    </div>
                                    <span class="badge bg-success bg-opacity-10 text-success border border-success-subtle rounded-pill" style="font-size: 0.65rem;">${badgeText}</span>
                                </div>
                                
                                ${shouldShowCourseName ? `
                                    <div class="mb-1 text-muted small" style="font-size: 0.75rem;">
                                        <i class="bi bi-folder2-open me-1"></i> <b>Курс:</b> ${courseName}
                                    </div>
                                ` : ''}

                                <div class="text-dark fw-800 mb-1" style="font-size: 0.95rem; overflow-wrap: anywhere;">${bodyText}</div>
                                ${currentError ? `
                                    <div class="mt-2 pt-2 border-top" style="border-color: rgba(0,0,0,0.05) !important;">
                                        <div class="small text-muted mb-1" style="font-size: 0.75rem;">Ваша відповідь:</div>
                                        <div class="p-2 rounded-3 border" style="background: #f1f8e9; color: #198754; font-weight: 600; border-color: #c8e6c9 !important;">
                                            ${currentError}
                                        </div>
                                    </div>` : ''}
                            </div>
                        </div>`;
                    lastBaseKey = baseKey;
                    if (currentError) lastErrorStr = currentError;
                }
            } else if (!isStickyMode) {
                const contextBg = isMine ? 'rgba(0, 0, 0, 0.12)' : '#ffffff'; 
                const contextBorder = isMine ? '#ffffff' : '#198754';
                const contextTextColor = isMine ? '#ffffff' : '#495057';
                const errorTextColor = isMine ? '#f1fdec' : '#198754';
                const dividerColor = isMine ? 'rgba(255,255,255,0.3)' : 'rgba(25, 135, 84, 0.2)';

                contextHtml = `
                    <div class="context-card mb-2 shadow-sm" style="background: ${contextBg}; border-left: 4px solid ${contextBorder}; padding: 12px; border-radius: 10px; font-size: 0.8rem; color: ${contextTextColor}; overflow-wrap: anywhere;">
                      
                      ${shouldShowCourseName ? `
                          <div class="mb-1 pb-1 border-bottom" style="border-color: ${dividerColor} !important; opacity: 0.8; font-size: 0.7rem;">
                            <i class="bi bi-folder2-open"></i> <b>Курс:</b> ${courseName}
                          </div>
                      ` : ''}

                      <div class="d-flex justify-content-between align-items-center mb-1">
                        <strong style="color: ${isMine ? '#ffffff' : '#212529'}; text-transform: uppercase; font-size: 0.7rem;">${headerText}</strong>
                        <span class="badge ${isMine ? 'bg-white text-success' : 'bg-success'} rounded-pill" style="font-size: 0.65rem;">${badgeText}</span>
                      </div>
                      <div class="fw-bold">${bodyText}</div>
                      ${msg.context.studentError ? `
                          <div class="mt-2 pt-1 border-top" style="border-color: ${dividerColor} !important; color: ${errorTextColor}; font-weight: 700;">
                              Ваша відповідь: ${msg.context.studentError}
                          </div>` : ''}
                    </div>`;
            }
        }

        const deleteBtn = isMine ? `<i class="bi bi-trash cursor-pointer ms-2 opacity-50" onclick="deleteMessage('${msg._id}')"></i>` : '';
        const safeText = encodeURIComponent(msg.text); 
        const replyBtn = `<i class="bi bi-reply-fill cursor-pointer ms-2 opacity-75" onclick="setReply('${msg._id}', decodeURIComponent('${safeText}'))"></i>`;

        let replyHtml = '';
        if (msg.replyTo) {
            replyHtml = `
                <div class="reply-quote p-2 mb-2 rounded border-start border-3" 
                    style="background: rgba(255,255,255,0.1); border-color: ${isMine ? '#fff' : '#198754'}; font-size: 0.8rem; opacity: 0.8;">
                    <div class="text-truncate">${msg.replyTo.text}</div>
                </div>`;
        }

        messagesArea.innerHTML += `
            ${stickyHeaderHtml}
            <div class="message-bubble ${bubbleClass}" id="msg-${msg._id}" style="overflow-wrap: anywhere;">
                ${contextHtml}
                ${replyHtml} 
                <div style="white-space: pre-wrap;">${msg.text}</div>
                <div class="small mt-1 opacity-75 d-flex justify-content-end align-items-center" style="font-size: 0.7rem;">
                    ${time} ${replyBtn} ${deleteBtn}
                </div>
            </div>`;
    });
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

window.toggleContextVisibility = function() {
    isContextHidden = !isContextHidden; // Міняємо так/ні
    
    const btn = document.getElementById('btnToggleContext');
    if (btn) {
        btn.innerHTML = isContextHidden 
            ? '<i class="bi bi-eye-fill "></i>' 
            : '<i class="bi bi-eye-slash-fill "></i>';
    }

    // Перемальовуємо чат миттєво з новими налаштуваннями
    applyPersonalFilters(); 
};

// ==========================================
// 🚀 ВІДПРАВКА ТА ВИДАЛЕННЯ
// ==========================================
// ==========================================
// 🚀 ВІДПРАВКА ПОВІДОМЛЕНЬ (ЧАТ + ТІКЕТИ)
// ==========================================
// ==========================================
// 🚀 ВІДПРАВКА ПОВІДОМЛЕНЬ (ЧАТ + ТІКЕТИ)
async function sendMessage() {
    const input = document.getElementById('chatInput');
    const fileInput = document.getElementById('ticketFile');
    const text = input.value.trim();
    
    // Перевірка: чи є текст або файл
    const hasFile = fileInput && fileInput.files && fileInput.files.length > 0;
    if (!text && !hasFile) return;

    // Підготовка даних цитати (спільна для обох режимів)
    const replyPayload = replyData ? {
        messageId: replyData.id,
        text: replyData.text
    } : null;

    // ==========================================
    // 🚩 БЛОК 1: ПЕРЕПИСКА З ПІДТРИМКОЮ (ТІКЕТИ)
    // ==========================================
    if (currentTicketId) {
        try {
            let response;
            // Якщо є файл - FormData
            if (hasFile) {
                const formData = new FormData();
                formData.append('text', text);
                formData.append('image', fileInput.files[0]);
                
                // Додаємо цитату, якщо є
                if (replyPayload) {
                    formData.append('replyTo', JSON.stringify(replyPayload));
                }

                response = await fetch(`${API_BASE_URL}/tickets/${currentTicketId}/reply`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                    body: formData
                });
            } else {
                // Тільки текст - JSON
                response = await fetch(`${API_BASE_URL}/tickets/${currentTicketId}/reply`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ 
                        text: text,
                        replyTo: replyPayload // 🔥 Додаємо цитату
                    })
                });
            }

            const data = await response.json();

            // Якщо ліміт вичерпано
            if (response.status === 429) {
                alert("Ліміт фото вичерпано (3/3). Фото видалено. Натисніть 'Надіслати' ще раз, щоб відправити тільки текст.");
                if (fileInput) fileInput.value = ''; 
                document.getElementById('filePreview')?.classList.add('d-none');
                return; 
            }

            if (response.ok) {
                input.value = '';
                if (fileInput) fileInput.value = '';
                document.getElementById('filePreview')?.classList.add('d-none');
                
                cancelReply();
                
                // 🔥 МИ ВИДАЛИЛИ ТУТ openTicketChat(...)
                // Тому що Socket.io сам отримає подію і намалює повідомлення без перезавантаження всього чату!
            } else {
                alert(data.error || "Помилка відправки в тікет");
            }
        } catch (err) {
            console.error("Помилка Тікета:", err);
        }
        return; // Виходимо, щоб не пішло в блок 2
    }

    // ==========================================
    // 💬 БЛОК 2: ЗВИЧАЙНИЙ ЧАТ З ВИКЛАДАЧЕМ
    // ==========================================
    if (!currentReceiverId) {
        alert("Виберіть викладача для переписки");
        return;
    }

    const payload = { receiverId: currentReceiverId, text: text };

    if (replyData) {
        payload.replyTo = replyPayload; // 🔥 Використовуємо спільну змінну
        
        const originalMsg = currentChatHistory.find(m => m._id === replyData.id);
        if (originalMsg) {
            if (originalMsg.courseId) payload.courseId = getSafeCourseId(originalMsg.courseId);
            if (originalMsg.context) payload.context = { ...originalMsg.context };
        }
    } else {
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

    try {
        const res = await fetch(`${API_BASE_URL}/messages`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            input.value = ''; 
            cancelReply();
            await refreshCurrentChatSilent(); 
            loadDialogs(true); 
        } else {
            alert("Помилка відправки");
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

let messageIdToDelete = null; // Змінна для тимчасового зберігання ID

// 1. Функція, яка викликається при кліку на іконку кошика
function deleteMessage(msgId) {
    messageIdToDelete = msgId;
    const deleteModal = new bootstrap.Modal(document.getElementById('deleteMessageModal'));
    deleteModal.show();
}

// 2. Функція, яка виконує реальне видалення (викликається з модалки)
async function executeMessageDelete() {
    if (!messageIdToDelete) return;

    const btn = document.getElementById('confirmDeleteMsgBtn');
    const originalText = btn.innerHTML;
    
    // Показуємо завантаження на кнопці
    btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`;
    btn.disabled = true;

    try {
        const res = await fetch(`${API_BASE_URL}/messages/${messageIdToDelete}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        if (res.ok) {
            // Анімація зникнення (твоя стара логіка)
            const msgElement = document.getElementById(`msg-${messageIdToDelete}`);
            if (msgElement) {
                msgElement.style.transition = "0.3s";
                msgElement.style.opacity = "0";
                setTimeout(() => msgElement.remove(), 300);
            }
            
            // Оновлення списків та історії
            currentChatHistory = currentChatHistory.filter(m => m._id !== messageIdToDelete);
            lastMessageCount--;
            if (typeof loadDialogs === 'function') loadDialogs(true);
            
            // Закриваємо модалку
            const modalEl = document.getElementById('deleteMessageModal');
            const modalInstance = bootstrap.Modal.getInstance(modalEl);
            modalInstance.hide();
        } else {
            const data = await res.json();
            alert(data.message || "Не вдалося видалити повідомлення");
        }
    } catch (err) { 
        console.error("Помилка видалення:", err); 
    } finally {
        // Повертаємо кнопку в норму
        btn.innerHTML = originalText;
        btn.disabled = false;
        messageIdToDelete = null;
    }
}

// ==========================================
// УТИЛІТИ (ЧАС, ВІДПОВІДІ)
// ==========================================
function formatMessageDate(dateInput) {
    if (!dateInput) return '';
    const msgDate = new Date(dateInput);
    const today = new Date();
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const timeStr = msgDate.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });

    if (msgDate.toDateString() === today.toDateString()) return timeStr;
    if (msgDate.toDateString() === yesterday.toDateString()) return `Вчора, ${timeStr}`;
    if (msgDate.getFullYear() === today.getFullYear()) return `${msgDate.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })}, ${timeStr}`;
    return `${msgDate.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' })}, ${timeStr}`;
}

function setReply(msgId, text) {
    const originalMsg = currentChatHistory.find(m => m._id === msgId);
    replyData = { 
        id: msgId, text: text,
        courseId: originalMsg?.courseId, context: originalMsg?.context 
    };
    
    const replyBar = document.getElementById('replyPreviewBar');
    const replyText = document.getElementById('replyPreviewText');
    
    if (replyBar && replyText) {
        replyText.textContent = text;
        replyBar.classList.remove('d-none');
        replyBar.classList.add('d-flex'); // 🔥 Додав d-flex, щоб воно гарно виглядало
        document.getElementById('chatInput').focus();
    }
}

function cancelReply() {
    replyData = null; // Скидаємо дані в пам'яті
    const replyBar = document.getElementById('replyPreviewBar');
    if (replyBar) {
        replyBar.classList.add('d-none'); // Ховаємо плашку
        replyBar.classList.remove('d-flex'); // На всякий випадок прибираємо d-flex
    }
}

// ==========================================
// 🛠 ПІДТРИМКА (ЧАТ З АДМІНОМ)
// ==========================================
// ==========================================
// 🛠 СИСТЕМА ТІКЕТІВ (CRM SUPPORT)
// ==========================================



// ==========================================
// СТВОРЕННЯ ТІКЕТА З КНОПКИ
// ==========================================
async function sendTicket(category) {
    if (!currentReceiverId) return;

    // Відправляємо перше повідомлення, де текст - це назва категорії
    const payload = { 
        receiverId: currentReceiverId, 
        text: `[Новий запит: ${category}] Доброго дня! Мені потрібна допомога з цього питання.` 
    };

    try {
        const res = await fetch(`${API_BASE_URL}/messages`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            // Ховаємо кнопки, повертаємо нормальне поле вводу
            document.getElementById('ticketOptions').classList.add('d-none');
            document.getElementById('chatInputGroup').classList.remove('d-none');
            
            // Оновлюємо чат
            await refreshCurrentChatSilent(); 
            loadDialogs(true); 
        } else {
            alert("Помилка створення запиту");
        }
    } catch (err) {
        console.error(err);
    }
}

// ==========================================
// 🛠 СИСТЕМА ТІКЕТІВ (CRM SUPPORT)
// ==========================================
// ==========================================
// 🛠 СИСТЕМА ТІКЕТІВ (CRM SUPPORT - Справжня БД)
// ==========================================
// ==========================================
// 🛠 СИСТЕМА ТІКЕТІВ (CRM SUPPORT)
// ==========================================
let currentTicketId = null; // Зберігає ID відкритого тікета

// 1. Клік на "Службу підтримки" (Зліва)
// 1. Клік на "Службу підтримки" (Зліва)
async function initSupportChat() {
    const supportBtn = document.getElementById('supportChatBtn');
    if (!supportBtn) return;

    supportBtn.onclick = () => {
        currentTicketId = null;
        currentReceiverId = null; // Тимчасово, поки не відкриємо чат тікета

        // Виділяємо кнопку
        document.querySelectorAll('.dialog-item').forEach(el => el.classList.remove('active'));
        supportBtn.classList.add('active-support');

        // Показуємо дашборд
        document.getElementById('ticketDashboardArea').classList.remove('d-none');
        document.getElementById('ticketDashboardArea').classList.add('d-flex');
        
        // Ховаємо фільтри та інпут (поки не відкриємо конкретний тікет)
        document.getElementById('personalChatFilters').classList.add('d-none');
        document.getElementById('chatInputContainer').classList.add('d-none');

        document.getElementById('chatHeader').innerHTML = `
          <div class="d-flex align-items-center gap-3">
            <div class="bg-success text-white rounded-circle d-flex align-items-center justify-content-center fw-bold shadow-sm" style="width: 45px; height: 45px;"><i class="bi bi-headset fs-5"></i></div>
            <div><h5 class="fw-bold text-dark mb-0">Служба підтримки</h5><small class="text-muted">Керування запитами</small></div>
          </div>
        `;
        showTicketList();
    };
}

// 2. Коли клікаємо на викладача (Звичайна переписка)

// 2. Показати список тікетів
// 2. Показати список тікетів
async function showTicketList(isSilent = false) {
    
    // 🔥 ТІЛЬКИ ЯКЩО ЦЕ НЕ ФОНОВЕ ОНОВЛЕННЯ — перемикаємо екрани
    if (!isSilent) {
        // 1. ХОВАЄМО ЗОНУ ЧАТУ
        document.getElementById('chatHeader')?.classList.add('d-none');
        document.getElementById('chatHeader')?.classList.remove('d-flex');
        document.getElementById('messagesArea')?.classList.add('d-none');
        document.getElementById('chatInputContainer')?.classList.add('d-none');

        // 2. ОБОВ'ЯЗКОВО ПОКАЗУЄМО ГОЛОВНИЙ ДАШБОРД ТІКЕТІВ
        const dashboard = document.getElementById('ticketDashboardArea');
        if (dashboard) {
            dashboard.classList.remove('d-none');
            dashboard.classList.add('d-flex');
        }

        // 3. Перемикаємось на список (ховаємо форму створення)
        document.getElementById('ticketCreateView')?.classList.add('d-none');
        document.getElementById('ticketListView')?.classList.remove('d-none');
    }

    const container = document.getElementById('ticketsContainer');
    if (!container) return;
    
    // Показуємо спіннер теж тільки якщо це не тихе оновлення
    if (!isSilent) {
        container.innerHTML = '<div class="text-center mt-4"><div class="spinner-border text-success"></div></div>';
    }

    try {
        const res = await fetch(`${API_BASE_URL}/tickets`, { headers: getAuthHeaders() });
        const tickets = await res.json();

        if (tickets.length === 0) {
            if (!isSilent) container.innerHTML = `<div class="text-center text-muted p-5 bg-light rounded-4 border"><i class="bi bi-inbox fs-1"></i><p class="mt-2 mb-0">У вас немає активних запитів.</p></div>`;
            return;
        }

        container.innerHTML = tickets.map(t => {
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
                 style="transition: 0.2s; cursor: pointer;" 
                 onclick="openTicketChat('${t._id}', '${t.subject.replace(/'/g, "\\'")}', '${t.status}', '${t.category}')">
                <div class="card-body p-3">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <span class="badge ${config.bg} ${config.color} rounded-pill px-3" style="font-size: 0.75rem; font-weight: 700;">
                            ${config.icon} ${config.label}
                        </span>
                        <small class="text-muted">${new Date(t.createdAt).toLocaleDateString()}</small>
                    </div>
                    <h6 class="fw-bold mb-1 text-dark">${t.subject}</h6>
                    <div class="small text-muted mb-1"><b>Категорія:</b> ${t.category}</div>
                    <div class="small text-truncate text-secondary" style="max-width: 90%;">Ваш опис: ${firstMsgText}</div>
                </div>
            </div>`;
        }).join('');
    } catch (err) {
        if (!isSilent) container.innerHTML = '<div class="text-danger text-center mt-4">Помилка завантаження запитів.</div>';
    }
    setTimeout(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const targetTicketId = urlParams.get('ticketId');

        if (targetTicketId) {
            // Ми додали data-ticket-id у HTML вище, тепер можемо легко знайти картку
            const targetElement = document.querySelector(`[data-ticket-id="${targetTicketId}"]`);
            
            if (targetElement) {
                // Якщо ми ще не на екрані дашборду (наприклад, відкритий звичайний чат) - перемикаємось на підтримку
                const supportBtn = document.getElementById('supportChatBtn');
                // Заміни цей шмат у setTimeout:
                if (supportBtn && !supportBtn.classList.contains('active-support')) {
                    supportBtn.classList.add('active-support'); // Просто підсвічуємо кнопку зліва
                    document.querySelectorAll('.dialog-item').forEach(el => el.classList.remove('active')); // Знімаємо виділення з чатів
                }

                // Скролимо і клікаємо
                targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                targetElement.click(); 
                
                // Підсвічуємо картку зеленим
                targetElement.style.transition = "background-color 1s";
                targetElement.style.backgroundColor = "#e8f5e9"; 
                setTimeout(() => targetElement.style.backgroundColor = "", 2000);

                // Очищаємо URL
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        }
    }, 500);
}

// 3. Форма створення тікета
async function showNewTicketForm() {
    document.getElementById('ticketListView').classList.add('d-none');
    document.getElementById('ticketCreateView').classList.remove('d-none');

    const select = document.getElementById('newTicketCourse');
    if (!select) return;
    
    select.innerHTML = '<option value="">Завантаження курсів...</option>';

    try {
        const res = await fetch(`${API_BASE_URL}/courses/enrolled`, { headers: getAuthHeaders() });
        const data = await res.json();
        
        select.innerHTML = '<option value="">-- Оберіть системний курс --</option>';
        
        let foundSystemCourses = 0;
        data.forEach(item => {
            const courseObj = item.course || item; 
            
            // 🔥 ТЕПЕР ПЕРЕВІРЯЄМО: має бути назва, системний (isSystem) і бажано публічний (isPublic)
            if (courseObj && courseObj.title && courseObj.isSystem && courseObj.isPublic !== false) {
                const cId = (courseObj._id && courseObj._id.$oid) ? courseObj._id.$oid : courseObj._id;
                select.innerHTML += `<option value="${cId}">${courseObj.title}</option>`;
                foundSystemCourses++;
            }
        });

        if (foundSystemCourses === 0) {
            select.innerHTML = '<option value="">У вас немає активних офіційних курсів</option>';
        }
    } catch (e) {
        console.error("Помилка завантаження курсів для тікета:", e);
        select.innerHTML = '<option value="">Помилка завантаження</option>';
    }
}

// 1. Показ/приховання вибору курсу
function toggleSystemCourseSelect() {
    const subject = document.getElementById('newTicketSubject').value;
    const wrapper = document.getElementById('systemCourseSelectWrapper');
    if (wrapper) {
        // Показуємо лише якщо обрано тему "Питання по системному курсу"
        wrapper.classList.toggle('d-none', subject !== 'Питання по системному курсу');
    }
}

// 4. ВІДПРАВИТИ НОВИЙ ТІКЕТ
async function submitNewTicket() {
    const subjectSelect = document.getElementById('newTicketSubject');
    const subject = subjectSelect.value;
    const categoryText = subjectSelect.options[subjectSelect.selectedIndex].text;
// Видаляємо всі емодзі та спецсимволи, залишаємо лише текст
    const category = categoryText.replace(/[^\w\sа-яА-ЯіїєґІЇЄҐ]/g, '').trim();
    const courseSelect = document.getElementById('newTicketCourse');
    const message = document.getElementById('newTicketMessage').value.trim();

    if (!message) return alert("Опишіть вашу проблему!");

    // Створюємо базовий об'єкт
    const payload = {
        subject: subject,
        category: category,
        message: message
    };

    // 🔥 ДОДАЄМО courseId ТІЛЬКИ ЯКЩО ЦЕ ПИТАННЯ ПО КУРСУ
    if (subject === 'Питання по системному курсу') {
        const courseId = courseSelect.value;
        if (!courseId) return alert("Будь ласка, оберіть курс!");
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
    } catch (e) {
        console.error(e);
    }
}

// 5. ВІДКРИТИ ЧАТ ТІКЕТА
// 5. ВІДКРИТИ ЧАТ ТІКЕТА (з кнопками управління)
async function openTicketChat(ticketId, subject, status, category) {
    currentTicketId = ticketId;
    currentReceiverId = null;
    
    document.getElementById('attachBtn')?.classList.remove('d-none');
    // Перемикання екранів
    const dashboard = document.getElementById('ticketDashboardArea');
    const header = document.getElementById('chatHeader');
    const msgArea = document.getElementById('messagesArea');
    const inputCont = document.getElementById('chatInputContainer');

    if (dashboard) dashboard.classList.add('d-none');
    if (header) header.classList.remove('d-none');
    if (msgArea) msgArea.classList.remove('d-none');
    if (inputCont) inputCont.classList.remove('d-none');

    // 🌟 Додаємо кнопки "Вирішено" та "Видалити"
    // 🌟 Додаємо кнопки "Вирішено" (БЕЗ ВИДАЛЕННЯ!)
    let actionButtons = '';
    if (status !== 'closed') {
        actionButtons = `
            <div class="d-flex gap-2 ms-3 border-start ps-3">
                <button class="btn btn-sm btn-outline-success rounded-circle shadow-xs" onclick="closeTicket('${ticketId}')" title="Позначити як вирішене">
                    <i class="bi bi-check-lg"></i>
                </button>
            </div>
        `;
    
    // Якщо статус 'closed', actionButtons залишається порожнім — ніяких кнопок взагалі
    } else {
        actionButtons = `
            <div class="d-flex gap-2 ms-3 border-start ps-3">
                <button class="btn btn-sm btn-outline-danger rounded-circle shadow-xs" onclick="deleteTicket('${ticketId}')" title="Видалити запит">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `;
    }

    // Оновлюємо заголовок
    const statusLabels = {
        new: '<span class="badge bg-primary-subtle text-primary rounded-pill px-3">🔵 Новий запит</span>',
        open: '<span class="badge bg-success-subtle text-success rounded-pill px-3">🟢 В роботі</span>',
        pending: '<span class="badge bg-warning-subtle text-warning rounded-pill px-3">🟡 Очікує вашої відповіді</span>',
        closed: '<span class="badge bg-secondary-subtle text-secondary rounded-pill px-3">🔴 Вирішено</span>'
    };

    if (header) {
        header.innerHTML = `
          <div class="d-flex justify-content-between w-100 align-items-center">
            <div class="d-flex align-items-center gap-3">
              <i class="bi bi-arrow-left-circle-fill fs-3 text-success cursor-pointer opacity-75 hover-opacity-100" 
                 onclick="showTicketList()" title="До списку запитів"></i>
              <div>
                <h5 class="fw-bold text-dark mb-0">${subject}</h5>
                <small class="text-muted">ID: ${ticketId.slice(-6).toUpperCase()} | ${category}</small>
              </div>
            </div>
            <div class="d-flex align-items-center">
                ${statusLabels[status] || statusLabels.new}
                <div class="d-flex gap-2 ms-3 border-start ps-3">
                    ${status !== 'closed' ? `
                        <button class="btn btn-sm btn-outline-success rounded-circle border-0 shadow-none" 
                                onclick="closeTicket('${ticketId}')" title="Питання вирішено">
                            <i class="bi bi-check-circle-fill fs-5"></i>
                        </button>` : ''}
                </div>
            </div>
          </div>
        `;
    }


    // Блокуємо інпут, якщо закритий
    // Завжди залишаємо інпут активним для можливості перевідкриття тікета
    const input = document.getElementById('chatInput');
    const btn = document.getElementById('sendBtn');
    if (input) {
        input.disabled = false;
        // Міняємо підказку, якщо тікет закритий
        input.placeholder = status === 'closed' ? "Напишіть сюди, щоб перевідкрити запит..." : "Напишіть повідомлення...";
    }
    if (btn) btn.disabled = false;
    
    const area = document.getElementById('messagesArea');
    area.innerHTML = '<div class="text-center mt-5"><div class="spinner-border text-success"></div></div>';
    
    // Завантажуємо поточний тікет повністю
    try {
        const res = await fetch(`${API_BASE_URL}/tickets`, { headers: getAuthHeaders() });
        const allTickets = await res.json();
        const currentTicket = allTickets.find(t => t._id === ticketId);
        
        if (currentTicket) {
            renderTicketMessages(currentTicket);
        } else {
            area.innerHTML = '<div class="text-center text-muted mt-5">Тікет не знайдено</div>';
        }
    } catch (e) { 
        area.innerHTML = '<div class="text-danger text-center mt-4">Помилка завантаження.</div>'; 
    }
}

// 🌟 6. Рендер повідомлень (Тепер показує опис проблеми як перше повідомлення)
// 🌟 6. Рендер повідомлень (Тепер показує опис проблеми як перше повідомлення)
function renderTicketMessages(ticket) {
    const area = document.getElementById('messagesArea');
    area.innerHTML = '';
    const myId = localStorage.getItem('userId');

    // 🔥 1. ОБОВ'ЯЗКОВО: Оновлюємо історію, щоб функція setReply могла знайти текст
    currentChatHistory = ticket.messages;

    // ШУКАЄМО ТЕКСТ ПЕРШОГО ПОВІДОМЛЕННЯ
    let initialMessageText = ticket.message; // Шукаємо окреме поле
    let startIndex = 0; // З якого індексу малювати решту повідомлень

    // Якщо окремого поля немає, беремо найперше повідомлення з масиву messages
    if (!initialMessageText && ticket.messages && ticket.messages.length > 0) {
        initialMessageText = ticket.messages[0].text;
        startIndex = 1; // Пропускаємо нульове повідомлення в циклі нижче, бо ми його зараз намалюємо
    } else if (!initialMessageText) {
        initialMessageText = 'Опис відсутній';
    }

    // МАЛЮЄМО СТАРТОВИЙ ЗАПИТ
    const createdTime = formatMessageDate(ticket.createdAt);
    
    // 🔥 2. ДОДАЄМО КНОПКУ ВІДПОВІДІ ДЛЯ СТАРТОВОГО ПОВІДОМЛЕННЯ
    area.innerHTML += `
        <div class="message-bubble msg-me mb-3 shadow-sm" id="msg-${ticket._id}">
            <div class="d-flex justify-content-between align-items-start">
                <div class="small fw-bold mb-1 text-white-50"><i class="bi bi-ticket-detailed me-1"></i> Ваш запит</div>
                <i class="bi bi-reply-fill cursor-pointer text-white-50 opacity-75 hover-opacity-100" 
                   onclick="setReply('${ticket._id}', '${initialMessageText.replace(/'/g, "\\'")}')" title="Відповісти"></i>
            </div>
            <div>${initialMessageText}</div>
            <div class="small mt-2 text-end text-white-50" style="font-size: 0.7rem;">${createdTime}</div>
        </div>
    `;

    // МАЛЮЄМО ІСТОРІЮ ПЕРЕПИСКИ (починаючи зі startIndex)
    if (ticket.messages && ticket.messages.length > startIndex) {
        for (let i = startIndex; i < ticket.messages.length; i++) {
            const msg = ticket.messages[i];
            const time = formatMessageDate(msg.createdAt);
            const senderId = (msg.sender && msg.sender._id) ? msg.sender._id.toString() : msg.sender.toString();
            const isMine = senderId === myId;
            const bubbleClass = isMine ? 'msg-me' : 'msg-other shadow-sm';
            const senderName = isMine ? "Ви" : "Служба підтримки";
            const textStyle = isMine ? 'text-white-50' : 'opacity-75';

            // 🔥 3. БЛОК ЦИТАТИ (ЯКЩО ЦЕ ВІДПОВІДЬ НА ІНШЕ ПОВІДОМЛЕННЯ)
            let replyHtml = '';
            if (msg.replyTo && msg.replyTo.text) {
                // Робимо фон цитати трохи темнішим для контрасту, а текст — завжди світлим для зеленого бабла і темним для білого
                const quoteBg = isMine ? 'rgba(0, 0, 0, 0.15)' : 'rgba(0, 0, 0, 0.05)';
                const titleColor = isMine ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.5)';
                const textColor = isMine ? '#ffffff' : '#212529';
                const borderColor = isMine ? 'rgba(255,255,255,0.5)' : '#198754';

                replyHtml = `
                    <div class="reply-quote p-2 mb-2 rounded border-start border-3" 
                        style="background: ${quoteBg}; border-color: ${borderColor} !important; font-size: 0.8rem;">
                        <div class="small fw-bold mb-1" style="font-size: 0.65rem; color: ${titleColor}; letter-spacing: 0.5px;">ВІДПОВІДЬ НА:</div>
                        <div class="text-truncate" style="color: ${textColor}; max-width: 100%;">${msg.replyTo.text}</div>
                    </div>
                `;
            }

            // 🔥 4. КНОПКА ВІДПОВІДІ НА КОЖНОМУ ПОВІДОМЛЕННІ
            const escapedText = (msg.text || "").replace(/'/g, "\\'").replace(/"/g, "&quot;");
            const replyBtn = `<i class="bi bi-reply-fill cursor-pointer ms-2 opacity-50 hover-opacity-100" 
                                onclick="setReply('${msg._id}', '${escapedText}')" title="Відповісти"></i>`;

            const imgHtml = msg.fileUrl 
                ? `<div class="mt-2 ${isMine ? 'text-end' : 'text-start'}">
                    <a href="${msg.fileUrl}" target="_blank">
                    <img src="${msg.fileUrl}" class="img-fluid rounded-3 border shadow-sm" style="max-height: 200px; cursor: pointer;">
                    </a>
                </div>` 
                : '';

            area.innerHTML += `
                <div class="message-bubble ${bubbleClass} mb-3" id="msg-${msg._id}">
                    ${replyHtml}
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="small fw-bold mb-1" style="opacity: 0.7;">${senderName}</div>
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

// ==========================================
// 🛠 КЕРУВАННЯ ТІКЕТАМИ (Закрити / Видалити)
// ==========================================

let ticketIdToClose = null; // Змінна для збереження ID активного тікета

// 1. Функція, яка лише відкриває модалку (замість системного confirm)
function closeTicket(ticketId) {
    ticketIdToClose = ticketId;
    const modalEl = document.getElementById('closeTicketModal');
    const closeTicketModal = new bootstrap.Modal(modalEl);
    closeTicketModal.show();
}

// 2. Функція, яка виконує реальне закриття після натискання кнопки у модалці
async function executeTicketClose() {
    if (!ticketIdToClose) return;

    const btn = document.getElementById('confirmCloseTicketBtn');
    const originalText = btn.innerHTML;
    
    // Показуємо лоадер на кнопці для солідності
    btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`;
    btn.disabled = true;

    try {
        const res = await fetch(`${API_BASE_URL}/tickets/${ticketIdToClose}/close`, {
            method: 'PUT',
            headers: getAuthHeaders()
        });

        if (res.ok) {
            // Закриваємо модалку через Bootstrap API
            const modalEl = document.getElementById('closeTicketModal');
            const modalInstance = bootstrap.Modal.getInstance(modalEl);
            if (modalInstance) modalInstance.hide();
            
            // Повертаємось до списку або оновлюємо чат
            if (typeof showTicketList === 'function') {
                showTicketList(); 
            }
        } else {
            alert('Не вдалося закрити тікет.');
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

// 🔥 ФУНКЦІЯ ДЛЯ МИТТЄВОГО ДОДАВАННЯ ПОВІДОМЛЕННЯ В ЧАТ ТІКЕТА (ДЛЯ СТУДЕНТА)
function appendSingleTicketMessage(msg) {
    const area = document.getElementById('messagesArea');
    if (!area) return;

    // 🛡️ БРОНЯ ВІД ДУБЛІКАТІВ
    if (msg._id && document.getElementById(`msg-${msg._id}`)) {
        return; 
    }

    const myId = localStorage.getItem('userId');
    const msgSenderId = msg.sender?._id || msg.sender;
    const isMine = msgSenderId.toString() === myId;
    
    // 🔥 Класи для студента: 'msg-me' (свої) та 'msg-other' (від адміна)
    const bubbleClass = isMine ? 'msg-me' : 'msg-other shadow-sm';
    const senderName = isMine ? "Ви" : "Служба підтримки";
    const textStyle = isMine ? 'text-white-50' : 'opacity-75';
    const time = typeof formatMessageDate === 'function' ? formatMessageDate(msg.createdAt) : "щойно";

    // 1. БЛОК ЦИТАТИ
    let replyHtml = '';
    if (msg.replyTo && msg.replyTo.text) {
        const quoteBg = isMine ? 'rgba(0, 0, 0, 0.15)' : 'rgba(0, 0, 0, 0.05)';
        const titleColor = isMine ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.5)';
        const textColor = isMine ? '#ffffff' : '#212529';
        const borderColor = isMine ? 'rgba(255,255,255,0.5)' : '#198754';

        replyHtml = `
            <div class="reply-quote p-2 mb-2 rounded border-start border-3" 
                 style="background: ${quoteBg}; border-color: ${borderColor} !important; font-size: 0.8rem;">
                <div class="small fw-bold mb-1" style="font-size: 0.65rem; color: ${titleColor}; letter-spacing: 0.5px;">ВІДПОВІДЬ НА:</div>
                <div class="text-truncate" style="color: ${textColor}; max-width: 100%;">${msg.replyTo.text}</div>
            </div>
        `;
    }

    // 2. КНОПКА ВІДПОВІДІ
    const escapedText = (msg.text || "").replace(/'/g, "\\'").replace(/"/g, "&quot;");
    const replyBtn = `<i class="bi bi-reply-fill cursor-pointer ms-2 opacity-50 hover-opacity-100" 
                        onclick="setReply('${msg._id}', '${escapedText}')" title="Відповісти"></i>`;

    // 3. КАРТИНКА (Якщо є)
    const imgHtml = msg.fileUrl 
        ? `<div class="mt-2 ${isMine ? 'text-end' : 'text-start'}">
            <a href="${msg.fileUrl}" target="_blank">
            <img src="${msg.fileUrl}" class="img-fluid rounded-3 border shadow-sm" style="max-height: 200px; cursor: pointer;">
            </a>
           </div>` 
        : '';

    // 4. ФОРМУВАННЯ HTML
    const html = `
        <div class="message-bubble ${bubbleClass} mb-3" id="msg-${msg._id}" style="animation: fadeIn 0.3s ease;">
            ${replyHtml}
            <div class="d-flex justify-content-between align-items-start">
                <div class="small fw-bold mb-1" style="opacity: 0.7;">${senderName}</div>
                ${replyBtn}
            </div>
            <div>${msg.text || ""}</div>
            ${imgHtml}
            <div class="small mt-1 text-end ${textStyle}" style="font-size: 0.7rem;">${time}</div>
        </div>`;

    area.insertAdjacentHTML('beforeend', html);
    area.scrollTop = area.scrollHeight;

    // 🔥 ДОДАЄМО В ІСТОРІЮ, ЩОБ ПРАЦЮВАВ КЛІК ПО "ВІДПОВІСТИ"
    if (typeof currentChatHistory !== 'undefined' && Array.isArray(currentChatHistory)) {
        currentChatHistory.push(msg);
    }
}