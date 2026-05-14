const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Transaction = require('../models/Transaction'); 
const User = require('../models/User');
const Payout = require('../models/Payout');

// Отримати фінансову статистику (АДМІН)
router.get('/stats', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'No access' });

        const summaryStats = await Transaction.aggregate([
            {
                $group: {
                    _id: null,
                    totalTurnover: { $sum: "$amount" }, 
                    totalPlatformNet: { 
                        $sum: { $ifNull: ["$platformFee", { $multiply: ["$amount", 0.25] }] } 
                    }
                }
            }
        ]);

        // Рахуємо загальний борг (сума балансів всіх вчителів)
        const teacherDebtAgg = await User.aggregate([
            { $match: { role: 'teacher' } },
            { $group: { _id: null, totalBalance: { $sum: "$balance" } } }
        ]);
        const totalDebt = teacherDebtAgg[0] ? teacherDebtAgg[0].totalBalance : 0;

        // 1. Черга запитів (тільки ті, що pending)
        // 1. Черга запитів (тільки ті, що pending)
        const payoutQueue = await Payout.find({ status: 'pending' })
            .populate('teacher', 'name email cardNumber') // 🔥 ДОДАЛИ cardNumber
            .sort({ createdAt: 1 });

        // 2. Архів виплат (тільки completed)
        const payoutArchive = await Payout.find({ status: 'completed' })
            .populate('teacher', 'name')
            .sort({ createdAt: -1 });

        const transactions = await Transaction.find()
            .populate('user', 'name')
            .populate('course', 'title')
            .sort({ createdAt: -1 })
            .limit(15);

        res.json({
            summary: { 
                ...summaryStats[0] || { totalTurnover: 0, totalPlatformNet: 0 },
                totalTeacherDebt: totalDebt 
            },
            payoutQueue,
            payoutArchive,
            transactions
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Підтвердити виплату (АДМІН)
router.post('/payout/:requestId', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Немає доступу' });
        
        // 1. Знаходимо сам ЗАПИТ, а не вчителя
        const payoutRequest = await Payout.findById(req.params.requestId).populate('teacher');
        
        if (!payoutRequest || payoutRequest.status !== 'pending') {
            return res.status(404).json({ error: 'Запит не знайдено або вже оброблено' });
        }

        const teacher = payoutRequest.teacher;

        // 2. Перевіряємо, чи є у вчителя достатньо грошей на балансі для цієї виплати
        if (teacher.balance < payoutRequest.amount) {
            return res.status(400).json({ error: 'На балансі викладача недостатньо коштів' });
        }

        // 3. Віднімаємо суму з балансу
        teacher.balance -= payoutRequest.amount;
        await teacher.save();

        // 4. Закриваємо запит (переносимо в архів)
        payoutRequest.status = 'completed';
        await payoutRequest.save();
        
        res.json({ success: true, message: 'Виплату успішно підтверджено' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Відхилити виплату (АДМІН)
router.post('/payout/:requestId/reject', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Немає доступу' });
        
        const { reason } = req.body;
        const payoutRequest = await Payout.findById(req.params.requestId);
        
        if (!payoutRequest || payoutRequest.status !== 'pending') {
            return res.status(404).json({ error: 'Запит не знайдено або вже оброблено' });
        }

        // Міняємо статус на відхилений і записуємо причину
        payoutRequest.status = 'rejected';
        payoutRequest.rejectionReason = reason || 'Неправильні реквізити';
        await payoutRequest.save();
        
        res.json({ success: true, message: 'Виплату відхилено. Кошти повернуто на баланс викладача.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;