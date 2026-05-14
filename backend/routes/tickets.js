const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');
const auth = require('../middleware/auth');
const User = require('../models/User');
const parser = require('./cloudinary_upload'); 
const sendNotification = require('../utils/notifier');

// 1. Створення нового тікета
router.post('/', auth, async (req, res) => {
  try {
    console.log("----------------------------------------");
    console.log("📥 [ТІКЕТ] Отримано запит на створення тікета. Тіло запиту:", req.body);
    
    const { subject, category, message, priority, courseId } = req.body;
    const ticketData = {
      user: req.user.id, 
      subject,
      category,
      priority: priority || 'low',
      status: 'new',
      messages: [{ sender: req.user.id, text: message }]
    };

    if (courseId && courseId.trim() !== "" && courseId !== "null") {
      ticketData.courseId = courseId;
    }

    const newTicket = new Ticket(ticketData);
    await newTicket.save();
    console.log("💾 [ТІКЕТ] Тікет успішно збережено в БД з ID:", newTicket._id);

    // ========================================================
    // 🔥 БЛОК СПОВІЩЕНЬ: ТІЛЬКИ ДЛЯ ПУБЛІКАЦІЇ КУРСІВ (БЕЗ EMAIL)
    // ========================================================
    const creator = await User.findById(req.user.id).select('name role');
    console.log(`👤 [ТІКЕТ] Створювач: ${creator ? creator.name : 'Невідомо'}, Роль: ${creator ? creator.role : 'Немає'}`);
    console.log(`🏷️ [ТІКЕТ] Категорія запиту: "${category}"`);
    
    // ПЕРЕВІРКА: чи це вчитель І чи категорія відповідає публікації
    if (creator && creator.role === 'teacher' && (category === 'Запит на публікацію курсу' || category === 'publish_request')) {
        console.log("✅ [ТІКЕТ] Умова виконана! Це вчитель і категорія підходить. Шукаємо адмінів...");
        
        const admins = await User.find({ role: 'admin' });
        console.log(`👥 [ТІКЕТ] Знайдено адмінів у базі: ${admins.length}`);
        
        const io = req.app.get('socketio') || req.app.get('io');
        if (!io) console.log("⚠️ [ТІКЕТ] УВАГА: Об'єкт Socket.IO (io) не знайдено на бекенді!");
        
        // Спробуємо дістати назву курсу для гарного повідомлення
        let courseTitle = "Новий курс";
        if (courseId && courseId !== "null") {
            try {
                // Перевір чи файл CourseModel.js дійсно так називається у тебе в папці models!
                const Course = require('../models/CourseModel'); 
                const courseInfo = await Course.findById(courseId).select('title');
                if (courseInfo) courseTitle = courseInfo.title;
                console.log(`📚 [ТІКЕТ] Знайдено курс: "${courseTitle}"`);
            } catch (courseErr) {
                console.log("❌ [ТІКЕТ] Помилка пошуку курсу (можливо неправильний шлях до моделі):", courseErr.message);
            }
        }

        for (const admin of admins) {
            console.log(`🔔 [ТІКЕТ] Відправляємо сповіщення адміну: ${admin.name} (ID: ${admin._id})`);
            await sendNotification({
                userId: admin._id,
                title: '📝 Запит на модерацію',
                message: `Вчитель <b>${creator.name}</b> подав курс "<b>${courseTitle}</b>" на модерацію.`,
                type: 'info',
                link: `/frontend/admin/admin-tickets.html?ticketId=${newTicket._id}`,
                saveToDb: true,
                sendEmail: false 
            });

            if (io) {
                console.log(`📡 [ТІКЕТ] Еміт socket.io 'new_notification' для кімнати адміна: ${admin._id}`);
                io.to(admin._id.toString()).emit('new_notification', {
                    title: '📝 Запит на модерацію',
                    message: `Вчитель ${creator.name} подав курс "${courseTitle}" на модерацію.`,
                    link: `/frontend/admin/admin-tickets.html?ticketId=${newTicket._id}`
                });
            }
        }
    } else {
        console.log("⏭️ [ТІКЕТ] Умова для модерації НЕ виконана. Сповіщення адмінам не відправляємо.");
    }
    // ========================================================

    const ioMain = req.app.get('socketio') || req.app.get('io');
    if (ioMain) {
        console.log("📡 [ТІКЕТ] Еміт загального socket.io 'newMessage'");
        ioMain.emit('newMessage', { 
            ticketId: newTicket._id, 
            isNewTicket: true 
        });
    }
    
    console.log("✅ [ТІКЕТ] Запит успішно завершено (201)");
    console.log("----------------------------------------");
    res.status(201).json(newTicket);
  } catch (err) {
    console.log("🚨 [ТІКЕТ] КРИТИЧНА ПОМИЛКА:", err.message);
    res.status(500).json({ error: err.message });
  }
});
// 2. Отримати список тікетів
router.get('/', auth, async (req, res) => {
  try {
    let query = {};
    if (req.user.role !== 'admin') {
        query.user = req.user.id;
    }
    const tickets = await Ticket.find(query)
      .populate('user', 'name email role') 
      .populate('courseId', 'title')
      .sort({ updatedAt: -1 });
    res.json(tickets);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 3. Відповідь у тікет
router.post('/:id/reply', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const today = new Date().toDateString();

        if (user.lastUploadDate !== today) {
            user.dailyUploadCount = 0;
            user.lastUploadDate = today;
            await user.save();
        }

        const isMultipart = req.headers['content-type']?.includes('multipart/form-data');

        if (isMultipart) {
            if (user.dailyUploadCount >= 3 && user.role !== 'admin') {
                return res.status(429).json({ error: "LIMIT_EXCEEDED" });
            }
            parser.single('image')(req, res, async (err) => {
                if (err) return res.status(400).json({ error: "Помилка Cloudinary" });
                await saveMessage(req, res, req.file ? req.file.path : null);
            });
        } else {
            await saveMessage(req, res, null);
        }

        async function saveMessage(req, res, fileUrl) {
          // 🔥 ТУТ ВАЖЛИВО: завантажуємо юзера, щоб знати його роль
          const ticket = await Ticket.findById(req.params.id).populate('user');
          if (!ticket) return res.status(404).json({ error: "Тікет не знайдено" });

          let replyTo = req.body.replyTo;
          if (replyTo && typeof replyTo === 'string') {
              try { replyTo = JSON.parse(replyTo); } catch (e) { replyTo = undefined; }
          }

          const newMessage = {
              sender: req.user.id,
              text: req.body.text || "",
              fileUrl: fileUrl,
              replyTo: replyTo,
              createdAt: new Date()
          };

          ticket.messages.push(newMessage);
          ticket.status = 'open';

         if (req.user.role === 'admin') {
              // Якщо відповів адмін -> SLA виконано, "зупиняємо" таймер
              ticket.slaNotified = true; 
          } else {
              // Якщо відповів студент/вчитель -> скидаємо SLA, "запускаємо" таймер на 24 години
              ticket.slaNotified = false; 
          }

          await ticket.save();

          // 🔥 СПОВІЩЕННЯ ДЛЯ КОРИСТУВАЧА (Автовизначення Студент чи Вчитель)
          if (req.user.role === 'admin') {
                const owner = ticket.user; // Тепер це об'єкт завдяки populate
                const folder = owner.role === 'teacher' ? 'teacher' : 'student';
                const notifLink = `/frontend/${folder}/${folder}-messages.html?ticketId=${ticket._id}`;

                await sendNotification({
                    userId: owner._id,
                    title: 'Відповідь від підтримки',
                    message: `Адміністратор надіслав відповідь у ваш запит: "<b>${ticket.subject}</b>"`,
                    type: 'info',
                    link: notifLink
                });

                const io = req.app.get('socketio') || req.app.get('io');
                if (io) {
                    io.to(owner._id.toString()).emit('new_notification', {
                        title: 'Відповідь від підтримки',
                        message: `Адмін відповів на ваш запит`,
                        link: notifLink
                    });
                }
          }

          if (fileUrl) {
              user.dailyUploadCount += 1;
              await user.save();
          }

          const savedMessage = ticket.messages[ticket.messages.length - 1];
          const io = req.app.get('socketio') || req.app.get('io');
          if (io) {
              io.emit('newMessage', { 
                  ticketId: ticket._id, 
                  _id: savedMessage._id,
                  sender: savedMessage.sender,
                  text: savedMessage.text,
                  fileUrl: fileUrl,
                  replyTo: savedMessage.replyTo,
                  createdAt: savedMessage.createdAt
              });
          }
          res.json(ticket);
      }
    } catch (err) { res.status(500).json({ error: "Помилка сервера" }); }
});

// 4. Зміна статусу
router.put('/:id/status', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Немає доступу' });
    
    try {
        const { status } = req.body;
        const ticket = await Ticket.findByIdAndUpdate(req.params.id, { status }, { new: true }).populate('user');
        if (!ticket) return res.status(404).json({ error: 'Тікет не знайдено' });

        const owner = ticket.user;
        const folder = owner.role === 'teacher' ? 'teacher' : 'student';
        const notifLink = `/frontend/${folder}/${folder}-messages.html?ticketId=${ticket._id}`;
        
        const statusMap = { 'open': 'В роботі', 'pending': 'Очікує відповіді', 'closed': 'Вирішено' };
        const statusLabel = statusMap[status] || status;

        await sendNotification({
            userId: owner._id,
            title: 'Статус запиту змінено 📋',
            message: `Ваш запит "<b>${ticket.subject}</b>" тепер має статус: <b>${statusLabel}</b>`,
            type: status === 'closed' ? 'success' : 'info',
            link: notifLink,
            sendEmail: (status === 'pending' || status === 'closed')
        });

        const io = req.app.get('socketio') || req.app.get('io');
        if (io) {
            io.to(owner._id.toString()).emit('new_notification', {
                title: 'Оновлення статусу тікета 📋',
                message: `Новий статус: ${statusLabel}`,
                link: notifLink
            });
        }
        res.json(ticket);
    } catch (err) { res.status(500).json({ error: 'Помилка сервера' }); }
});

// 5. Закрити тікет
router.put('/:id/close', auth, async (req, res) => {
    try {
        const ticket = await Ticket.findById(req.params.id).populate('user');
        if (!ticket) return res.status(404).json({ error: 'Тікет не знайдено' });

        ticket.status = 'closed';
        await ticket.save();

        const owner = ticket.user;
        const folder = owner.role === 'teacher' ? 'teacher' : 'student';
        const notifLink = `/frontend/${folder}/${folder}-messages.html?ticketId=${ticket._id}`;

        await sendNotification({
            userId: owner._id,
            title: 'Запит вирішено ✅',
            message: `Ваше звернення "<b>${ticket.subject}</b>" позначено як вирішене.`,
            type: 'success',
            link: notifLink,
            sendEmail: true
        });

        res.json({ message: 'Тікет закрито', ticket });
    } catch (err) { res.status(500).json({ error: 'Помилка сервера' }); }
});

// --- ІНШІ АДМІНСЬКІ РОУТИ ---
router.get('/admin/all', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Доступ заборонено' });
        const tickets = await Ticket.find()
            .populate({ path: 'user', select: 'name role email avatar' })
            .populate('courseId', 'title') 
            .sort({ updatedAt: -1 });

        const formattedTickets = tickets.map(t => {
            const obj = t.toObject();
            obj.sender = obj.user; 
            return obj;
        });
        res.json(formattedTickets);
    } catch (err) { res.status(500).json({ error: 'Помилка CRM' }); }
});

module.exports = router;