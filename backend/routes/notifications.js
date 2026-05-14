// backend/routes/notifications.js
const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const auth = require('../middleware/auth'); // Твій щит
const mongoose = require('mongoose');

// 1. Отримати кількість непрочитаних (СТАВИМО ВИЩЕ ЗА ВСЕ!)
router.get('/unread-count', auth, async (req, res) => {
    try {
        const count = await Notification.countDocuments({ userId: req.user.id, isRead: false });
        res.json({ count });
    } catch (err) {
        res.status(500).json({ error: 'Помилка лічильника' });
    }
});

// 2. Позначити ВСІ як прочитані (ОРИГІНАЛЬНИЙ МЕТОД PUT ДЛЯ СТУДЕНТА/ВЧИТЕЛЯ)
router.put('/read-all', auth, async (req, res) => {
    try {
        await Notification.updateMany({ userId: req.user.id, isRead: false }, { isRead: true });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Помилка' });
    }
});

// 2.1. Позначити ВСІ як прочитані (НОВИЙ МЕТОД POST ДЛЯ АДМІНА - щоб не ламати фронтенд адміна)
router.post('/read-all', auth, async (req, res) => {
    try {
        await Notification.updateMany({ userId: req.user.id, isRead: false }, { isRead: true });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Помилка' });
    }
});

// 3. Позначити ОДНЕ як прочитане (підтримує старий і новий код)
router.put('/read/:id', async (req, res) => {
    try {
        await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: 'Помилка оновлення статусу' });
    }
});

// 4. Отримати сповіщення ПОТОЧНОГО юзера (Оригінальний метод)
router.get('/', auth, async (req, res) => {
    try {
        const notifications = await Notification.find({ userId: req.user.id })
            .sort({ createdAt: -1 })
            .limit(20);
        res.json(notifications);
    } catch (err) {
        res.status(500).json({ message: 'Помилка отримання сповіщень' });
    }
});

// 5. Отримати сповіщення ЗА УНІВЕРСАЛЬНИМ ID (ПОВЕРНУТО! Без цього ламався старий код)
router.get('/:userId', auth, async (req, res) => {
    try {
        const { userId } = req.params;

        const query = {
            $or: [
                { userId: userId }, // Шукаємо як рядок
                { userId: mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : null } // Як об'єкт
            ]
        };

        const notifications = await Notification.find(query)
            .sort({ createdAt: -1 })
            .limit(20);

        res.json(notifications);
    } catch (err) {
        console.error("❌ Помилка БД:", err);
        res.status(500).json({ error: 'Помилка' });
    }
});

// 6. Видалення сповіщення (залишаємо, якщо було)
router.delete('/:id', async (req, res) => {
    try {
        await Notification.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: 'Помилка видалення' });
    }
});

module.exports = router;