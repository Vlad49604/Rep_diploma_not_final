const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Payout = require('../models/Payout');
const User = require('../models/User');
const Transaction = require('../models/Transaction'); 

// 🔥 НОВИЙ РОУТ: Реальна фінансова статистика (з транзакціями)
router.get('/teacher-stats', auth, async (req, res) => {
    try {
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

        // Отримуємо всі транзакції цього викладача з іменами студентів та курсів
        const transactions = await Transaction.find({ teacher: req.user.id })
            .populate('course', 'title')
            .populate('user', 'name')
            .sort({ createdAt: -1 });

        let availableTxsSum = 0; 
        let pendingTxsSum = 0;   
        let totalEarnedAllTime = 0; // Скільки всього зароблено за весь час

        transactions.forEach(tr => {
            const earnings = tr.teacherEarnings || 0;
            totalEarnedAllTime += earnings;

            if (new Date(tr.createdAt) <= fourteenDaysAgo) {
                availableTxsSum += earnings;
            } else {
                pendingTxsSum += earnings;
            }
        });

        // Беремо тільки ті, що виплачені або в черзі. Відхилені ігноруємо (вони залишаться на балансі)
        const payouts = await Payout.find({ 
            teacher: req.user.id, 
            status: { $in: ['pending', 'completed'] } 
        });
        const totalPayouts = payouts.reduce((sum, p) => sum + p.amount, 0);

        let availableBalance = availableTxsSum - totalPayouts;
        if (availableBalance < 0) availableBalance = 0;

        res.json({ 
            availableBalance, 
            pendingBalance: pendingTxsSum,
            totalEarnedAllTime, // Для аналітики
            totalSalesCount: transactions.length, // Для аналітики
            transactions // Масив самих транзакцій для таблиці
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Отримати історію своїх запитів (для викладача)
router.get('/my', auth, async (req, res) => {
    try {
        const payouts = await Payout.find({ teacher: req.user.id }).sort({ createdAt: -1 });
        res.json(payouts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Створити новий запит на виплату
router.post('/request', auth, async (req, res) => {
    try {
        const { amount } = req.body;
        
        // Встановлюємо мінімальну суму 100 ₴
        if (amount < 100) return res.status(400).json({ error: 'Мінімальна сума виводу - 100 ₴' });

        const teacher = await User.findById(req.user.id);
        if (!teacher || teacher.role !== 'teacher') return res.status(403).json({ error: 'Доступ заборонено' });

        if (!teacher.cardNumber || teacher.cardNumber.length < 16) {
            return res.status(400).json({ error: 'Спочатку збережіть номер банківської картки в налаштуваннях профілю.' });
        }

        // Рахуємо реальний доступний баланс ще раз перед виплатою
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

        const txs = await Transaction.find({ teacher: req.user.id, createdAt: { $lte: fourteenDaysAgo } });
        const availableTxs = txs.reduce((sum, t) => sum + (t.teacherEarnings || 0), 0);

        // Беремо тільки ті, що виплачені або в черзі. Відхилені ігноруємо (вони залишаться на балансі)
        const payouts = await Payout.find({ 
            teacher: req.user.id, 
            status: { $in: ['pending', 'completed'] } 
        });
        const requestedPayouts = payouts.reduce((sum, p) => sum + p.amount, 0);

        const actualAvailable = availableTxs - requestedPayouts;

        // Перевіряємо, чи вистачає саме ДОСТУПНИХ коштів
        if (actualAvailable < amount) {
            return res.status(400).json({ error: 'Недостатньо доступних коштів (можливо, вони ще в холді)' });
        }

        const payoutRequest = new Payout({ teacher: teacher._id, amount, status: 'pending' });
        await payoutRequest.save();

        res.json({ success: true, message: 'Запит відправлено' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;