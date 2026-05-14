// routes/messages.js
const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const User = require('../models/User');
const auth = require('../middleware/auth'); // Твій мідлвар для перевірки токена
const sendNotification = require('../utils/notifier');

// 1. НАДІСЛАТИ ПОВІДОМЛЕННЯ (Працює і для студента, і для вчителя)
// 1. НАДІСЛАТИ ПОВІДОМЛЕННЯ
// 1. НАДІСЛАТИ ПОВІДОМЛЕННЯ
router.post('/', auth, async (req, res) => {
    try {
        const { receiverId, text, courseId, context, resultId } = req.body;
        const senderId = req.user.id; 

        // Створюємо і зберігаємо повідомлення
        const newMessage = new Message({
            sender: senderId,
            receiver: receiverId,
            courseId: courseId || null,
            text: text,
            context: context || null
        });

        await newMessage.save();

        // 🔥 2. ОНОВЛЕННЯ RESULTS (Коментар викладача до завдання)
        let isFeedback = false;
        let taskTitleForNotif = 'завдання';

        if (resultId && context && context.taskId !== undefined) {
            const mongoose = require('mongoose');
            const Result = mongoose.model('Result'); 

            const resultDoc = await Result.findById(resultId);
            
            if (resultDoc && resultDoc.answers) {
                const answerIndex = resultDoc.answers.findIndex(
                    a => a.taskId.toString() === context.taskId.toString()
                );

                if (answerIndex !== -1) {
                    resultDoc.answers[answerIndex].teacherComment = text;
                    resultDoc.markModified('answers');
                    await resultDoc.save();
                    
                    isFeedback = true;
                    taskTitleForNotif = context.taskTitle || 'завдання';
                    console.log(`✅ Result ${resultId} успішно оновлено коментарем!`);
                }
            }
        }

        // ==========================================
        // 🔥 3. СИСТЕМА СПОВІЩЕНЬ (ДЗВІНОЧОК + EMAIL)
        // ==========================================
        try {
            // Дізнаємося роль відправника, щоб правильно сформувати заголовок
            const senderUser = await User.findById(senderId);
            const senderName = senderUser ? senderUser.name : 'Користувач';
            const isTeacherOrAdmin = senderUser && (senderUser.role === 'teacher' || senderUser.role === 'admin');

            // Надсилаємо сповіщення ТІЛЬКИ якщо пише вчитель/адмін
            if (isTeacherOrAdmin) {
                let notifTitle = isFeedback ? 'Новий коментар від викладача' : 'Нове повідомлення';
                let notifMessage = isFeedback 
                    ? `Викладач ${senderName} залишив коментар до вашого виконання: "${taskTitleForNotif}".` 
                    : `Ви отримали нове повідомлення від ${senderName}.`;
                let notifType = isFeedback ? 'success' : 'info';

                // СТВОРЮЄМО СПОВІЩЕННЯ В БАЗІ ДАНИХ
                await sendNotification({
                    userId: receiverId,
                    title: notifTitle,
                    message: notifMessage,
                    type: notifType,
                    link: `/frontend/student/student-messages.html?chatWith=${senderId}`,
                    sendEmail: isFeedback // Листи шлемо тільки для фідбеку
                });

                // 🔥 ВАЖЛИВО! Відправляємо подію Socket.io для ДЗВІНОЧКА
                const io = req.app.get('socketio');
                if (io) {
                    io.to(receiverId.toString()).emit('new_notification', {
                        title: notifTitle,
                        message: notifMessage,
                        type: notifType,
                        link: `/frontend/student/student-messages.html?chatWith=${senderId}`
                    });
                }
            }
        } catch (notifErr) {
            console.error("Помилка відправки CRM-сповіщення:", notifErr);
        }
        // ==========================================

        // 🔥 4. SOCKET.IO (Миттєва відправка на фронтенд для чату)
        const io = req.app.get('socketio');
        if (io && receiverId) {
            const receiverStr = receiverId.toString();
            // Відправляємо подію для самого чату (малює бульбашку)
            io.to(receiverStr).emit('newMessage', newMessage);
        }

        res.status(201).json({ message: "Повідомлення надіслано", data: newMessage });
    } catch (err) {
        console.error("Помилка відправки:", err);
        res.status(500).json({ message: "Помилка сервера при відправці повідомлення" });
    }
});

// 2. ОТРИМАТИ ІСТОРІЮ ЧАТУ З КОНКРЕТНИМ КОРИСТУВАЧЕМ (Права колонка)
// 2. ОТРИМАТИ ІСТОРІЮ ЧАТУ З КОНКРЕТНИМ КОРИСТУВАЧЕМ
router.get('/history/:otherUserId', auth, async (req, res) => {
    try {
        const myId = req.user.id;
        const otherId = req.params.otherUserId;

        const messages = await Message.find({
            $or: [
                { sender: myId, receiver: otherId },
                { sender: otherId, receiver: myId }
            ]
        })
        .populate('courseId', 'title') // 🔥 ОСЬ ЦЕЙ РЯДОК ДОДАСТЬ НАЗВУ КУРСУ
        .sort({ createdAt: 1 }); 

        await Message.updateMany(
            { sender: otherId, receiver: myId, isRead: false },
            { $set: { isRead: true } }
        );

        res.json(messages);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Помилка завантаження історії чату" });
    }
});

// ==========================================
// ОТРИМАТИ ОБГОВОРЕННЯ ДЛЯ КОНКРЕТНОГО ЗАВДАННЯ (В межах спроби)
// ==========================================
router.get('/context/:studentId/:resultId/:taskId', auth, async (req, res) => {
    try {
        const { studentId, resultId, taskId } = req.params;
        const myId = req.user.id;

        // Шукаємо повідомлення, де співрозмовники — ми і студент, і є прив'язка до цього завдання
        const messages = await Message.find({
            $or: [
                { sender: myId, receiver: studentId },
                { sender: studentId, receiver: myId }
            ],
            "context.taskId": taskId
            // Якщо хочеш ще точніше, можна додати: "context.resultId": resultId
            // Але для цього треба буде додати resultId всередину об'єкта context у моделі Message
        }).sort({ createdAt: 1 }); // Від старих до нових

        res.json(messages);
    } catch (err) {
        console.error("Помилка завантаження контекстного чату:", err);
        res.status(500).json({ message: "Помилка сервера" });
    }
});

// 3. ОТРИМАТИ СПИСОК ДІАЛОГІВ (Ліва колонка: список студентів, з ким є переписка)
// 3. ОТРИМАТИ СПИСОК ДІАЛОГІВ (Ліва колонка)
router.get('/dialogs', auth, async (req, res) => {
    try {
        const myId = req.user.id; 
        const mongoose = require('mongoose');
        const userObjectId = new mongoose.Types.ObjectId(myId);
        
        // 🔥 1. Отримуємо фільтр, який передасть фронтенд
        // 🔥 1. Витягуємо всі параметри з URL
        const filterCourseId = req.query.courseId; 
        const filterSectionIdx = req.query.sectionIdx;
        const filterTaskId = req.query.taskId;

        // 🔥 2. Будуємо базовий фільтр
        let matchStage = {
            $or: [{ sender: userObjectId }, { receiver: userObjectId }]
        };

        // 🔥 3. Додаємо фільтр по курсу, секції та завданню
        if (filterCourseId) {
            if (filterCourseId === 'general') {
                matchStage.courseId = null; 
            } else if (filterCourseId !== 'all') {
                matchStage.courseId = new mongoose.Types.ObjectId(filterCourseId); 
                
                // Додаємо секцію тільки якщо вибрано конкретний курс
                if (filterSectionIdx && filterSectionIdx !== 'all') {
                    // Перетворюємо в число, бо в базі sectionIdx це Number
                    matchStage['context.sectionIdx'] = parseInt(filterSectionIdx);
                }
                
                // Додаємо завдання тільки якщо воно вибране
                if (filterTaskId && filterTaskId !== 'all') {
                    matchStage['context.taskId'] = filterTaskId;
                }
            }
        }

        const dialogs = await Message.aggregate([
            { $match: matchStage }, // Спочатку відсікаємо зайві повідомлення!
            { $sort: { createdAt: -1 } },
            {
                $group: {
                    _id: {
                        $cond: { if: { $eq: ["$sender", userObjectId] }, then: "$receiver", else: "$sender" }
                    },
                    lastMessage: { $first: "$$ROOT" }, // Тепер це буде останнє повідомлення САМЕ З ЦЬОГО КУРСУ
                    unreadCount: { 
                        $sum: {
                            $cond: [{ $and: [{ $eq: ["$receiver", userObjectId] }, { $eq: ["$isRead", false] }] }, 1, 0]
                        }
                    }
                }
            },
            {
                $lookup: {
                    from: 'users', 
                    localField: '_id',
                    foreignField: '_id',
                    as: 'userInfo'
                }
            },
            { $unwind: { path: "$userInfo", preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    _id: 1, 
                    name: { $ifNull: ["$userInfo.name", "Невідомий користувач"] },
                    email: { $ifNull: ["$userInfo.email", ""] },
                    avatar: { $ifNull: ["$userInfo.avatar", ""] },
                    lastMessageText: "$lastMessage.text",
                    lastMessageTime: "$lastMessage.createdAt",
                    lastMessageCourseId: "$lastMessage.courseId",
                    unreadCount: 1
                }
            },
            { $sort: { lastMessageTime: -1 } }
        ]);

        res.json(dialogs);
    } catch (err) {
        console.error("Помилка агрегації діалогів:", err);
        res.status(500).json({ message: "Помилка завантаження діалогів" });
    }
});

// 4. ОТРИМАТИ ЗАГАЛЬНУ КІЛЬКІСТЬ НЕПРОЧИТАНИХ (Для дзвіночка в хедері)
router.get('/unread-count', auth, async (req, res) => {
    try {
        const count = await Message.countDocuments({ receiver: req.user.id, isRead: false });
        res.json({ count });
    } catch (err) {
        res.status(500).json({ message: "Помилка сервера" });
    }
});

// ==========================================
// 5. ВИДАЛЕННЯ ПОВІДОМЛЕННЯ
// ==========================================
router.delete('/:id', auth, async (req, res) => {
    try {
        const messageId = req.params.id;
        const userId = req.user.id; // Той, хто натиснув "видалити"

        const message = await Message.findById(messageId);
        
        if (!message) {
            return res.status(404).json({ message: "Повідомлення не знайдено" });
        }

        // Перевіряємо, чи юзер є відправником цього повідомлення
        if (message.sender.toString() !== userId) {
            return res.status(403).json({ message: "Ви можете видаляти лише свої повідомлення" });
        }

        await Message.findByIdAndDelete(messageId);

        // 🔥 Якщо підключений Socket.io, кажемо співрозмовнику теж видалити це повідомлення
        const io = req.app.get('socketio');
        if (io) {
            io.to(message.receiver.toString()).emit('messageDeleted', messageId);
        }

        res.json({ message: "Повідомлення видалено", id: messageId });
    } catch (err) {
        console.error("Помилка видалення повідомлення:", err);
        res.status(500).json({ message: "Помилка сервера" });
    }
});

// ==========================================
// ЗНАЙТИ АДМІНІСТРАТОРА ДЛЯ ПІДТРИМКИ
// ==========================================
router.get('/support-admin', auth, async (req, res) => {
    try {
        const User = require('../models/User'); // Підключаємо модель юзера
        
        // Шукаємо першого-ліпшого користувача з роллю admin
        const admin = await User.findOne({ role: 'admin' });
        
        if (!admin) {
            return res.status(404).json({ message: "Адміністратора не знайдено" });
        }
        
        // Відправляємо його ID на фронтенд
        res.json({ _id: admin._id, name: "Служба підтримки" });
    } catch (err) {
        console.error("Помилка пошуку адміна:", err);
        res.status(500).json({ message: "Помилка сервера" });
    }
});

// ==========================================
// 🚀 ТІКЕТИ (ПІДТРИМКА) - CRM БЛОК
// ==========================================

// 1. Отримати всі тікети студента
router.get('/tickets/my-tickets', auth, async (req, res) => {
    try {
        const myId = req.user.id;
        const User = require('../models/User');
        const admin = await User.findOne({ role: 'admin' });
        
        if (!admin) return res.status(404).json({ message: "Адміна не знайдено" });

        // Шукаємо всі перші повідомлення тікетів
        const tickets = await Message.find({
            $or: [{ sender: myId, receiver: admin._id }, { sender: admin._id, receiver: myId }],
            "context.isTicket": true, 
            "context.isFirstMessage": true // Шукаємо тільки "заголовки" тікетів
        })
        .populate('courseId', 'title')
        .sort({ createdAt: -1 });

        // Для кожного тікета рахуємо непрочитані (опціонально, для краси)
        const ticketsWithDetails = await Promise.all(tickets.map(async (t) => {
            const unreadCount = await Message.countDocuments({
                receiver: myId,
                isRead: false,
                "context.ticketId": t._id.toString()
            });
            return {
                _id: t._id,
                subject: t.context.taskTitle || "Без теми", // Використовуємо taskTitle як Тему запиту
                courseId: t.courseId,
                status: t.context.status || 'open',
                createdAt: t.createdAt,
                unreadCount
            };
        }));

        res.json(ticketsWithDetails);
    } catch (err) {
        console.error("Помилка завантаження тікетів:", err);
        res.status(500).json({ message: "Помилка сервера" });
    }
});

// 2. Отримати історію конкретного тікета
router.get('/tickets/history/:ticketId', auth, async (req, res) => {
    try {
        const ticketId = req.params.ticketId;
        const messages = await Message.find({
            "context.ticketId": ticketId
        }).populate('courseId', 'title').sort({ createdAt: 1 });

        // Відмічаємо як прочитані
        await Message.updateMany(
            { receiver: req.user.id, "context.ticketId": ticketId, isRead: false },
            { $set: { isRead: true } }
        );

        res.json(messages);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Помилка завантаження історії тікета" });
    }
});

// 3. Закрити тікет
router.put('/tickets/:ticketId/close', auth, async (req, res) => {
    try {
        const ticketId = req.params.ticketId;
        // Знаходимо перше повідомлення тікета і міняємо статус
        await Message.findByIdAndUpdate(ticketId, { "context.status": "closed" });
        res.json({ message: "Тікет закрито" });
    } catch (err) {
        res.status(500).json({ message: "Помилка сервера" });
    }
});

module.exports = router;
