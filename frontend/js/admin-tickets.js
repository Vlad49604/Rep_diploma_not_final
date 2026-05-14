const API_BASE_URL = 'http://localhost:5002/api';
let allTickets = [];
let currentTicketId = null;
const socket = io('http://localhost:5002');

// 🔥 ДОДАНО: глобальні змінні для зберігання інформації про цитату
let replyData = null;
let currentChatHistory = [];

document.addEventListener('DOMContentLoaded', () => {
    if (!localStorage.getItem('token')) window.location.href = '../index.html';
    loadAdminTickets();

    // Фільтри
    document.getElementById('roleFilter').addEventListener('change', renderTicketsList);
    document.getElementById('statusFilter').addEventListener('change', renderTicketsList);
    document.getElementById('searchTicket').addEventListener('input', renderTicketsList);
    document.getElementById('categoryFilter').addEventListener('change', renderTicketsList);
    
    // Відправка
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault(); 
                sendAdminReply();   
            }
        });
    }

    document.getElementById('sendBtn').addEventListener('click', sendAdminReply);
    const myId = localStorage.getItem('userId');
    if (myId) socket.emit('join', myId);

    // 🔥 СЛУХАЄМО НОВІ ПОВІДОМЛЕННЯ
    socket.on('newMessage', (msg) => {
        loadAdminTickets(true); 
        if (currentTicketId && currentTicketId === msg.ticketId) {
            refreshCurrentTicketSilent();
        }
    });

    const refreshBtn = document.getElementById('refreshTickets');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            const icon = refreshBtn.querySelector('i');
            if (icon) {
                icon.classList.add('spin-anim');
                try {
                    await loadAdminTickets(true);
                } catch (err) {
                    console.error("Помилка при оновленні:", err);
                } finally {
                    setTimeout(() => icon.classList.remove('spin-anim'), 800);
                }
            }
        });
    }
});

async function refreshCurrentTicketSilent() {
    if (!currentTicketId) return;
    try {
        const res = await fetch(`${API_BASE_URL}/tickets`, { headers: getAuthHeaders() });
        const all = await res.json();
        const ticket = all.find(t => t._id === currentTicketId);
        if (ticket) {
            const actualSender = ticket.sender || ticket.user || ticket.student || {};
            renderHistory(ticket, actualSender.name || "Користувач");
        }
    } catch (e) { console.error("Socket refresh error:", e); }
}

function getAuthHeaders() {
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` };
}

// 1. ЗАВАНТАЖЕННЯ ВСІХ ТІКЕТІВ
// 1. ЗАВАНТАЖЕННЯ ВСІХ ТІКЕТІВ
async function loadAdminTickets(isSilent = false) {
    const container = document.getElementById('ticketsContainer');
    if (!isSilent) container.innerHTML = '<div class="text-center p-5"><div class="spinner-border text-success"></div></div>';
    
    try {
        const res = await fetch(`${API_BASE_URL}/tickets/admin/all`, { headers: getAuthHeaders() });
        allTickets = await res.json();
        renderTicketsList(); // <--- ТУТ СПИСОК МАЛЮЄТЬСЯ НА ЕКРАНІ

        // ==========================================================
        // 🔥 ДОДАНО: АВТОМАТИЧНЕ ВІДКРИТТЯ ТІКЕТА З URL-ПОСИЛАННЯ
        // ==========================================================
        setTimeout(() => {
            const urlParams = new URLSearchParams(window.location.search);
            const targetTicketId = urlParams.get('ticketId');

            if (targetTicketId) {
                // Шукаємо елемент тікета по його data-ticket-id (у тебе в рендері він є!)
                const targetElement = document.querySelector(`[data-ticket-id="${targetTicketId}"]`);
                
                if (targetElement) {
                    // Скролимо до нього
                    targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    
                    // Клікаємо по ньому (це викличе функцію openTicket)
                    targetElement.click(); 
                    
                    // Підсвічуємо жовтим для візуального акценту
                    targetElement.style.transition = "background-color 1s";
                    targetElement.style.backgroundColor = "#fff3cd";
                    setTimeout(() => targetElement.style.backgroundColor = "", 2000);

                    // СУПЕР ФІЧА: Очищаємо URL (забираємо ?ticketId=...), 
                    // щоб при фільтрації чи оновленні сторінки він не клікав його знову
                    window.history.replaceState({}, document.title, window.location.pathname);
                }
            }
        }, 300); // Затримка 300мс, щоб DOM 100% встиг оновитися
        // ==========================================================

    } catch (e) {
        document.getElementById('ticketsContainer').innerHTML = '<div class="text-danger text-center p-3">Помилка завантаження черги.</div>';
    }
}

// 2. РЕНДЕР ЧЕРГИ ТІКЕТІВ
function renderTicketsList() {
    const container = document.getElementById('ticketsContainer');
    const roleFilter = document.getElementById('roleFilter').value;
    const catFilter = document.getElementById('categoryFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;
    const searchTerm = document.getElementById('searchTicket').value.toLowerCase();

    let filtered = allTickets.filter(t => {
        const actualSender = t.sender || t.user || t.student || {};
        const senderName = (actualSender.name || "").toLowerCase();
        const senderRole = actualSender.role || 'unknown';
        
        const roleMatch = roleFilter === 'all' || senderRole === roleFilter;
        const catMatch = catFilter === 'all' || t.category === catFilter;
        const statusMatch = statusFilter === 'all' || t.status === statusFilter;
        const searchMatch = 
            (t.subject && t.subject.toLowerCase().includes(searchTerm)) || 
            t._id.includes(searchTerm) ||
            senderName.includes(searchTerm);
        
        return roleMatch && catMatch && statusMatch && searchMatch;
    });

    if (filtered.length === 0) {
        container.innerHTML = '<div class="text-muted text-center p-4">Нічого не знайдено</div>';
        return;
    }

    container.innerHTML = filtered.map(t => {
        const isActive = currentTicketId === t._id ? 'active' : '';
        const actualSender = t.sender || t.user || t.student || {};
        const senderName = actualSender.name || "Користувач";
        
        const statusColors = { 
            new: 'text-primary', 
            open: 'text-success', 
            pending: 'text-warning', 
            closed: 'text-secondary' 
        };
        const statusIcon = `<i class="bi bi-circle-fill ${statusColors[t.status] || 'text-muted'}" style="font-size: 0.5rem;"></i>`;

        return `
            <div class="p-3 ticket-item ${isActive}" data-ticket-id="${t._id}" onclick="openTicket('${t._id}')">
                <div class="d-flex justify-content-between align-items-start mb-1">
                    <span class="fw-bold text-dark text-truncate" style="max-width: 75%;">${t.subject}</span>
                    ${statusIcon}
                </div>
                <div class="small text-muted m-3" style="font-size: 0.75rem;"></div>
                <div class="d-flex justify-content-between align-items-center mt-2">
                    <div class="small text-muted"><i class="bi bi-person"></i> ${senderName}</div>
                    <span class="badge bg-light text-dark border" style="font-size: 0.65rem;">${actualSender.role}</span>
                </div>
            </div>`;
    }).join('');
}

// 3. ВІДКРИТТЯ ТІКЕТА
function openTicket(ticketId) {
    currentTicketId = ticketId;
    renderTicketsList(); 
    
    const ticket = allTickets.find(t => t._id === ticketId);
    if (!ticket) return;

    document.getElementById('messagesArea').classList.remove('d-none');
    document.getElementById('chatInputContainer').classList.remove('d-none');

    const actualSender = ticket.sender || ticket.user || ticket.student || {};
    const senderName = actualSender.name || "Користувач";

    const statusOptions = [
        { val: 'new', label: '🔵 Новий' },
        { val: 'open', label: '🟢 В роботі' },
        { val: 'pending', label: '🟡 Очікує відповіді' },
        { val: 'closed', label: '🔴 Вирішено' }
    ];

    // 🔥 ДОДАНО: Кнопка видалення всього тікета
    document.getElementById('chatHeader').innerHTML = `
        <div class="d-flex justify-content-between w-100 align-items-center">
            <div>
                <h5 class="fw-bold mb-0 text-dark">${ticket.subject}</h5>
                <small class="text-muted">Від: ${senderName}</small>
            </div>
            <div class="d-flex align-items-center gap-2 bg-white p-2 rounded-pill shadow-sm border">
                <span class="small text-muted fw-bold ms-2">Статус:</span>
                <select id="statusSelect-${ticket._id}" class="form-select form-select-sm fw-bold border-0 shadow-none" style="width: auto; cursor: pointer;">
                    ${statusOptions.map(opt => `<option value="${opt.val}" ${ticket.status === opt.val ? 'selected' : ''}>${opt.label}</option>`).join('')}
                </select>
                <button class="btn btn-sm btn-success rounded-pill px-3 fw-bold" onclick="confirmStatusChange('${ticket._id}')">
                    Підтвердити
                </button>
                
                <button class="btn btn-sm btn-outline-danger rounded-circle border-0 ms-1" onclick="deleteTicketEntirely('${ticket._id}')" title="Видалити запит назавжди">
                    <i class="bi bi-trash fs-5"></i>
                </button>
            </div>
        </div>
    `;

    renderHistory(ticket, senderName);
}

async function confirmStatusChange(ticketId) {
    const select = document.getElementById(`statusSelect-${ticketId}`);
    const newStatus = select.value;

    try {
        const res = await fetch(`${API_BASE_URL}/tickets/${ticketId}/status`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ status: newStatus })
        });

        if (res.ok) {
            alert("Статус успішно змінено!");
            await loadAdminTickets();
        } else {
            const errData = await res.json();
            alert("Помилка: " + errData.error);
        }
    } catch (e) {
        console.error("Помилка запиту:", e);
        alert("Сервер недоступний");
    }
}

// 🔥 ДОПОМІЖНІ ФУНКЦІЇ ДЛЯ ВІДПОВІДІ (REPLY)
function setReply(msgId, text) {
    replyData = { id: msgId, text: text };
    
    // Якщо у тебе ще немає цих елементів у admin-tickets.html - тобі треба їх додати!
    const replyBar = document.getElementById('replyPreviewBar');
    const replyText = document.getElementById('replyPreviewText');
    
    if (replyBar && replyText) {
        replyText.textContent = text;
        replyBar.classList.remove('d-none');
        replyBar.classList.add('d-flex');
        document.getElementById('chatInput').focus();
    } else {
        // Фоллбек, якщо HTML ще не оновлено
        console.log("Відповідаємо на: " + text);
    }
}

function cancelReply() {
    replyData = null;
    const replyBar = document.getElementById('replyPreviewBar');
    if (replyBar) {
        replyBar.classList.add('d-none');
        replyBar.classList.remove('d-flex');
    }
}

// Допоміжна функція для рендеру історії 
// Допоміжна функція для рендеру історії 
function renderHistory(ticket, senderName) {
    const area = document.getElementById('messagesArea');
    area.innerHTML = '';
    const myId = localStorage.getItem('userId');

    // Зберігаємо історію
    currentChatHistory = ticket.messages;

    // ==========================================
    // 🔥 БЛОК МОДЕРАЦІЇ КУРСУ ДЛЯ АДМІНА (Стилізовано під Lexora)
    // ==========================================
    let moderationPanelHtml = '';
    if (ticket.category === 'publish_request' && ticket.courseId) {
        const cId = ticket.courseId.$oid || ticket.courseId._id || ticket.courseId;
        
        moderationPanelHtml = `
            <div class="border border-warning border-opacity-50 rounded-4 p-4 mb-4 shadow-sm" style="background-color: #fffdf5;">
                <div class="d-flex justify-content-between align-items-center flex-wrap gap-3">
                    <div>
                        <strong class="text-dark fs-5"><i class="bi bi-shield-check text-warning me-2"></i>Модерація курсу</strong>
                        <div class="small text-muted mt-1 fw-medium">Викладач просить опублікувати цей курс у загальний каталог.</div>
                    </div>
                    <div class="d-flex gap-2">
                        <button onclick="window.open('admin-course-view.html?id=${cId}', '_blank')" class="btn btn-outline-success rounded-pill fw-bold shadow-sm px-4">
                            <i class="bi bi-search me-1"></i> Переглянути
                        </button>
                        <button onclick="approveCoursePublish('${cId}', '${ticket._id}')" class="btn btn-success rounded-pill fw-bold shadow-sm px-4">
                            <i class="bi bi-check-lg me-1"></i> Одобрити
                        </button>
                        <button onclick="rejectCoursePublish('${ticket._id}')" class="btn btn-danger rounded-pill fw-bold shadow-sm px-4">
                            <i class="bi bi-x-lg me-1"></i> Відхилити
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    area.innerHTML += moderationPanelHtml;
    // ==========================================

    let initialText = ticket.message || (ticket.messages[0]?.text) || 'Опис відсутній';
    let startIndex = ticket.message ? 0 : 1;

    const initialImgHtml = (ticket.messages && ticket.messages[0]?.fileUrl)
        ? `<div class="mt-3 text-start">
             <a href="${ticket.messages[0].fileUrl}" target="_blank">
               <img src="${ticket.messages[0].fileUrl}" class="img-fluid rounded-4 border shadow-sm" style="max-height: 200px;">
             </a>
           </div>`
        : '';

    const safeInitialText = initialText.replace(/'/g, "\\'").replace(/"/g, "&quot;");
    
    // ПЕРШЕ ПОВІДОМЛЕННЯ (ВІД КОРИСТУВАЧА)
    area.innerHTML += `
        <div class="message-bubble mb-4 shadow-sm" style="background-color: #ffffff; color: #333; border-radius: 18px 18px 18px 4px; border: 1px solid #edf2f0; align-self: flex-start;" id="msg-${ticket._id}">
            <div class="d-flex justify-content-between align-items-start mb-2">
                <div class="small fw-bold text-success text-uppercase" style="letter-spacing: 0.5px;">${senderName} (Запит)</div>
                <i class="bi bi-reply-fill cursor-pointer text-muted opacity-50 hover-opacity-100 fs-5" 
                   onclick="setReply('${ticket._id}', '${safeInitialText}')" title="Відповісти"></i>
            </div>
            <div style="line-height: 1.5;">${initialText}</div>
            ${initialImgHtml}
        </div>
    `;

    // ІСТОРІЯ ПЕРЕПИСКИ
    if (ticket.messages && ticket.messages.length > startIndex) {
        for (let i = startIndex; i < ticket.messages.length; i++) {
            const msg = ticket.messages[i];
            const msgSenderId = msg.sender?._id || msg.sender;
            const isAdmin = msgSenderId === myId;
            
            // Налаштування кольорів залежно від того, чиє повідомлення
            const bubbleBg = isAdmin ? 'var(--primary-color)' : '#ffffff';
            const bubbleColor = isAdmin ? '#ffffff' : '#333333';
            const bubbleBorder = isAdmin ? 'none' : '1px solid #edf2f0';
            const bubbleRadius = isAdmin ? '18px 18px 4px 18px' : '18px 18px 18px 4px';
            const alignSelf = isAdmin ? 'flex-end' : 'flex-start';
            
            const textMutedClass = isAdmin ? 'text-white opacity-75' : 'text-muted';
            const iconClass = isAdmin ? 'text-white opacity-75' : 'text-muted opacity-50';

            const deleteBtn = isAdmin 
                ? `<i class="bi bi-trash ms-2 cursor-pointer ${iconClass} hover-opacity-100" 
                      onclick="deleteAdminMessage('${ticket._id}', '${msg._id}')" title="Видалити"></i>` 
                : '';

            // Блок цитати (Reply)
            let replyHtml = '';
            if (msg.replyTo && msg.replyTo.text) {
                const quoteBg = isAdmin ? 'rgba(255, 255, 255, 0.2)' : 'rgba(68, 191, 105, 0.05)';
                const quoteBorderColor = isAdmin ? 'rgba(255, 255, 255, 0.5)' : 'var(--primary-color)';
                const quoteTextColor = isAdmin ? '#ffffff' : '#333333';

                replyHtml = `
                    <div class="reply-quote p-2 mb-3 rounded-3 border-start border-3" 
                        style="background: ${quoteBg}; border-color: ${quoteBorderColor} !important; font-size: 0.85rem; color: ${quoteTextColor};">
                        <div class="small fw-bold mb-1 opacity-75" style="font-size: 0.65rem;">ВІДПОВІДЬ НА:</div>
                        <div class="text-truncate" style="max-width: 100%;">${msg.replyTo.text}</div>
                    </div>
                `;
            }

            const escapedText = (msg.text || "").replace(/'/g, "\\'").replace(/"/g, "&quot;");
            const replyBtn = `<i class="bi bi-reply-fill cursor-pointer ms-2 ${iconClass} hover-opacity-100" 
                                onclick="setReply('${msg._id}', '${escapedText}')" title="Відповісти"></i>`;

            const imgHtml = msg.fileUrl 
                ? `<div class="mt-3 ${isAdmin ? 'text-end' : 'text-start'}">
                     <a href="${msg.fileUrl}" target="_blank">
                       <img src="${msg.fileUrl}" class="img-fluid rounded-4 border shadow-sm" style="max-height: 200px; cursor: pointer;">
                     </a>
                   </div>` 
                : '';

            area.innerHTML += `
                <div class="message-bubble shadow-sm" id="msg-block-${msg._id}" 
                     style="background-color: ${bubbleBg}; color: ${bubbleColor}; border: ${bubbleBorder}; border-radius: ${bubbleRadius}; align-self: ${alignSelf};">
                    ${replyHtml}
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <div class="small fw-bold" style="letter-spacing: 0.5px; opacity: 0.85;">
                            ${isAdmin ? 'Ви' : senderName}
                        </div>
                        <div class="fs-6">
                            ${replyBtn}
                            ${deleteBtn}
                        </div>
                    </div>
                    <div style="line-height: 1.5;">${msg.text || ""}</div>
                    ${imgHtml}
                </div>
            `;
        }
    }
    // Автоскрол вниз
    area.scrollTop = area.scrollHeight;
}

// 4. ВІДПРАВКА ВІДПОВІДІ
// 🔥 Оновлена функція відправки з підтримкою replyTo
async function sendAdminReply() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text || !currentTicketId) return;

    // Формуємо об'єкт цитати, якщо він є
    const replyPayload = replyData ? {
        messageId: replyData.id,
        text: replyData.text
    } : null;

    try {
        const res = await fetch(`${API_BASE_URL}/tickets/${currentTicketId}/reply`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ 
                text: text,
                replyTo: replyPayload // Передаємо на бекенд
            })
        });
        if (res.ok) {
            input.value = '';
            cancelReply(); // Очищаємо плашку цитати
            // refreshCurrentTicketSilent(); // Socket.io все зробить
        }
    } catch (e) { console.error(e); }
}

// 5. АДМІН ЗАКРИВАЄ ТІКЕТ
async function closeTicketByAdmin(ticketId) {
    if (!confirm('Закрити цей тікет?')) return;
    try {
        const res = await fetch(`${API_BASE_URL}/tickets/${ticketId}/close`, { method: 'PUT', headers: getAuthHeaders() });
        if (res.ok) {
            await loadAdminTickets();
            openTicket(ticketId);
        }
    } catch (e) { console.error(e); }
}


async function deleteAdminMessage(ticketId, messageId) {
    if (!confirm("Видалити це повідомлення?")) return;

    try {
        const res = await fetch(`${API_BASE_URL}/tickets/${ticketId}/messages/${messageId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        if (res.ok) {
            const element = document.getElementById(`msg-block-${messageId}`);
            if (element) {
                element.style.transition = "0.3s";
                element.style.opacity = "0";
                element.style.transform = "scale(0.9)";
                setTimeout(() => {
                    const ticket = allTickets.find(t => t._id === ticketId);
                    if (ticket) {
                        ticket.messages = ticket.messages.filter(m => m._id !== messageId);
                    }
                    renderHistory(ticket, ticket.sender?.name || "Користувач");
                }, 300);
            }
        } else {
            alert("Не вдалося видалити повідомлення");
        }
    } catch (e) {
        console.error(e);
    }
}

// 🔥 ФУНКЦІЯ ПОВНОГО ВИДАЛЕННЯ ТІКЕТА АДМІНОМ
async function deleteTicketEntirely(ticketId) {
    if (!confirm('Увага! Ви назавжди видалите цей запит та всю історію переписки. Продовжити?')) return;

    try {
        const res = await fetch(`${API_BASE_URL}/tickets/${ticketId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        if (res.ok) {
            currentTicketId = null; // Скидаємо відкритий тікет
            
            // Ховаємо зону чату і показуємо заглушку
            document.getElementById('messagesArea').classList.add('d-none');
            document.getElementById('chatInputContainer').classList.add('d-none');
            document.getElementById('chatHeader').innerHTML = `
              <div class="d-flex flex-column justify-content-center h-100 text-muted opacity-50 w-100 align-items-center mt-4">
                <i class="bi bi-inbox fs-1 mb-2"></i>
                <p>Виберіть запит з черги зліва для обробки</p>
              </div>
            `;
            
            // Оновлюємо список
            await loadAdminTickets(); 
            alert('Тікет успішно видалено.');
        } else {
            alert('Не вдалося видалити тікет.');
        }
    } catch (e) {
        console.error(e);
        alert('Помилка сервера при видаленні.');
    }
}

// 🔥 ВІДХИЛИТИ КУРС
window.rejectCoursePublish = async function(ticketId) {
    const reason = prompt("Вкажіть причину відхилення (наприклад: 'Виправте граматику', 'Додайте обкладинку'):\nЦе повідомлення буде відправлено викладачу.");
    
    if (!reason || reason.trim() === "") return;

    try {
        // 1. Відправляємо причину відмови в тікет
        await fetch(`${API_BASE_URL}/tickets/${ticketId}/reply`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ text: `На жаль, ваш курс не пройшов перевірку і не може бути опублікований. Причина: ${reason}. Будь ласка, внесіть зміни та подайте запит повторно.` })
        });

        // 2. Закриваємо тікет (він більше не актуальний)
        await fetch(`${API_BASE_URL}/tickets/${ticketId}/close`, { 
            method: 'PUT', 
            headers: getAuthHeaders() 
        });

        alert("Запит відхилено. Викладача повідомлено.");
        await loadAdminTickets();
        openTicket(ticketId); // Оновлюємо вигляд поточного тікета
    } catch (e) {
        console.error("Помилка відхилення", e);
        alert("Сталася помилка при відхиленні.");
    }
};

window.approveCoursePublish = async function(courseId, ticketId) {
    if (!confirm("Ви впевнені, що хочете опублікувати цей курс у загальний каталог?")) return;

    try {
        const token = localStorage.getItem('token');
        const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

        // 1. Оновлюємо статус курсу на isPublic: true
        const courseRes = await fetch(`http://localhost:5002/api/courses/${courseId}`, {
            method: 'PUT',
            headers: headers,
            body: JSON.stringify({ isPublic: true })
        });

        if (!courseRes.ok) throw new Error("Не вдалося оновити статус курсу");

        // 2. Відправляємо системне повідомлення в тікет
        await fetch(`http://localhost:5002/api/tickets/${ticketId}/reply`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ text: "Вітаємо! Ваш курс успішно пройшов перевірку та опублікований у загальному каталозі." })
        });

        // 3. Закриваємо тікет (змінюємо статус на resolved або closed)
        await fetch(`http://localhost:5002/api/tickets/${ticketId}/close`, {
            method: 'PUT',
            headers: headers
        });

        alert("Курс опубліковано! Тікет закрито.");
        // Оновлюємо UI (перезавантажуємо список тікетів)
        // loadTickets(); або closeTicketView();

    } catch (err) {
        console.error(err);
        alert("Виникла помилка: " + err.message);
    }
};