// backend/utils/cronJobs.js
const cron = require('node-cron');
const User = require('../models/User');
const sendNotification = require('./notifier'); 
const Result = require('../models/Result');
const Ticket = require('../models/Ticket');
const Course = require('../models/CourseModel');

// Допоміжна функція для точного розрахунку днів тому
const getDaysAgo = (days) => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date;
};

// Запуск ЩОДНЯ о 10:00 ранку ('0 10 * * *')
cron.schedule('0 10 * * *', async () => {
    console.log('[CRON] Запуск щоденної перевірки неактивності...');

    try {
        // ==========================================
        // БЛОК 1: СТУДЕНТИ (3, 7 та 14 днів)
        // ==========================================
        
        // 3 дні
        const students3Days = await User.find({ 
            role: 'student', 
            lastLogin: { $lte: getDaysAgo(3), $gt: getDaysAgo(4) } 
        });
        for (const student of students3Days) {
            await sendNotification({
                userId: student._id,
                title: 'Час повернутися до навчання!',
                message: 'Ви не заходили на Lexora вже 3 дні. Ваші курси чекають на вас! Продовжіть навчання сьогодні, щоб тримати мозок у тонусі.',
                type: 'info',
                link: '/frontend/student/student.html',
                sendEmail: true,
                saveToDb: false
            });
        }

        // 7 днів
        const students7Days = await User.find({ 
            role: 'student', 
            lastLogin: { $lte: getDaysAgo(7), $gt: getDaysAgo(8) } 
        });
        for (const student of students7Days) {
            await sendNotification({
                userId: student._id,
                title: 'Ми сумуємо за вами!',
                message: 'Минув цілий тиждень від вашого останнього візиту. Не втрачайте свій прогрес в англійській! Зробіть хоча б одне маленьке завдання сьогодні.',
                type: 'warning',
                link: '/frontend/student/student.html',
                sendEmail: true,
                saveToDb: false
            });
        }

        // 14 днів
        const students14Days = await User.find({ 
            role: 'student', 
            lastLogin: { $lte: getDaysAgo(14), $gt: getDaysAgo(15) } 
        });
        for (const student of students14Days) {
            await sendNotification({
                userId: student._id,
                title: 'Ваш прогрес може згоріти!',
                message: 'Вас не було вже 2 тижні. Вивчення мови потребує регулярності. Повертайтеся на Lexora, щоб не забути те, що ви вже вивчили!',
                type: 'error',
                link: '/frontend/student/student.html',
                sendEmail: true,
                saveToDb: false
            });
        }

        // ==========================================
        // БЛОК 2: ВИКЛАДАЧІ (5 та 10 днів)
        // ==========================================
        
        // 5 днів
        const teachers5Days = await User.find({ 
            role: 'teacher', 
            lastLogin: { $lte: getDaysAgo(5), $gt: getDaysAgo(6) } 
        });
        for (const teacher of teachers5Days) {
            await sendNotification({
                userId: teacher._id,
                title: 'Студенти чекають на вас!',
                message: 'Ви не заходили в кабінет викладача вже 5 днів. Перевірте, можливо, у ваших студентів з\'явилися нові питання чи завдання для перевірки.',
                type: 'info',
                link: '/frontend/teacher/teacher.html',
                sendEmail: true,
                saveToDb: false
            });
        }

        // 10 днів
        const teachers10Days = await User.find({ 
            role: 'teacher', 
            lastLogin: { $lte: getDaysAgo(10), $gt: getDaysAgo(11) } 
        });
        for (const teacher of teachers10Days) {
            await sendNotification({
                userId: teacher._id,
                title: 'Активність викладача',
                message: 'Минув деякий час від вашого останнього візиту на Lexora. Не забувайте оновлювати матеріали курсів та підтримувати зв\'язок зі студентами для найкращих результатів!',
                type: 'warning',
                link: '/frontend/teacher/teacher.html',
                sendEmail: true,
                saveToDb: false
            });
        }

        console.log(`[CRON] Розсилка завершена.`);
        console.log(`Студенти: 3д (${students3Days.length}), 7д (${students7Days.length}), 14д (${students14Days.length})`);
        console.log(`Вчителі: 5д (${teachers5Days.length}), 10д (${teachers10Days.length})`);

    } catch (err) {
        console.error('[CRON] Помилка під час виконання cron job:', err);
    }
});

// ==========================================
// БЛОК 3: ТИЖНЕВИЙ ЗВІТ (Щонеділі о 18:00)
// ==========================================
cron.schedule('0 18 * * 0', async () => {
    console.log('[CRON] Запуск генерації тижневих звітів...');
    try {
        const students = await User.find({ role: 'student' });
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        for (const student of students) {
            // Шукаємо тести, пройдені цим студентом за останні 7 днів
            const weeklyResults = await Result.find({
                user: student._id,
                completedAt: { $gte: oneWeekAgo }
            });

            // Якщо студент щось робив цього тижня — генеруємо звіт
            if (weeklyResults.length > 0) {
                const passedTasks = weeklyResults.length;
                const totalScore = weeklyResults.reduce((acc, r) => acc + (r.score / r.total), 0);
                const avgPercent = Math.round((totalScore / passedTasks) * 100);

                // ВИКОРИСТОВУЄМО Твій існуючий notifier!
                await sendNotification({
                    userId: student._id,
                    title: 'Ваш тижневий звіт успішності',
                    message: `Ваш прогрес за минулий тиждень: пройдено завдань — ${passedTasks}, середня оцінка — ${avgPercent}%. Продовжуйте регулярне навчання для досягнення найкращих результатів!`,
                    type: 'info',
                    link: '/frontend/student/monitoring.html',
                    sendEmail: true,  // Відправить на пошту студента через твій існуючий шаблон
                    saveToDb: true    // Збереже в "дзвоник" (можеш змінити на false, якщо хочеш ТІЛЬКИ на пошту)
                });
            }
        }
        console.log('[CRON] Тижневі звіти успішно розіслано!');
    } catch (error) {
        console.error('[CRON] Помилка під час розсилки тижневих звітів:', error);
    }
});
 // Перевір правильний шлях до моделі тікетів

// ==========================================
// БЛОК 4: CRM SLA КОНТРОЛЬ (Щогодини)
// Перевіряє тікети, на які ніхто не відповів більше 24 годин
// ==========================================
cron.schedule('0 * * * *', async () => {
    console.log('[CRON SLA] Перевірка тікетів без відповіді...');
    try {
        // Відраховуємо 24 години назад
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        // Шукаємо відкриті тікети, створені більше 24 годин тому, 
        // про які ми ще НЕ сповіщали адміна
        const overdueTickets = await Ticket.find({
            status: { $in: ['new', 'open'] },
            updatedAt: { $lt: twentyFourHoursAgo }, 
            slaNotified: false 
        });

        if (overdueTickets.length > 0) {
            const admins = await User.find({ role: 'admin' });

            for (const ticket of overdueTickets) {
                for (const admin of admins) {
                    await sendNotification({
                        userId: admin._id,
                        title: 'SLA Порушено (24 год)!',
                        message: `Увага: тікет "${ticket.subject}" не отримав відповіді понад добу! Негайно перевірте Helpdesk.`,
                        type: 'error',
                        link: `/frontend/admin/admin-tickets.html?ticketId=${ticket._id}`,
                        sendEmail: true, // Це критично, тому дублюємо на пошту
                        saveToDb: true
                    });
                }
                
                // Ставимо галочку, щоб не спамити про цей самий тікет через годину
                ticket.slaNotified = true;
                await ticket.save();
            }
            console.log(`[CRON SLA] Сповіщено про ${overdueTickets.length} протермінованих тікетів!`);
        } else {
            console.log('[CRON SLA] Всі тікети обробляються вчасно.');
        }

    } catch (error) {
        console.error('[CRON SLA] Помилка:', error);
    }
});

// backend/utils/cronJobs.js
// backend/utils/cronJobs.js

cron.schedule('55 23 * * *', async () => {
    console.log('[CRON] Генерація розширеного денного звіту...');
    try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        // 1. Загальні метрики (як раніше)
        const newStudents = await User.countDocuments({ 
            role: 'student', 
            createdAt: { $gte: startOfDay } 
        });

        const testsPassed = await Result.countDocuments({ 
            completedAt: { $gte: startOfDay } 
        });

        // 2. 🔥 АГРЕГАЦІЯ: Пошук найпопулярнішого курсу за сьогодні
        const popularCourseData = await Result.aggregate([
            { $match: { completedAt: { $gte: startOfDay } } }, // Тільки за сьогодні
            { $group: { 
                _id: "$course",             // Гпупуємо за ID курсу
                count: { $sum: 1 }          // Рахуємо кількість проходжень
            } },
            { $sort: { count: -1 } },       // Сортуємо: від більшого до меншого
            { $limit: 1 }                   // Беремо тільки перший (топ)
        ]);

        let popularCourseInfo = "немає даних";
        if (popularCourseData.length > 0) {
            const course = await Course.findById(popularCourseData[0]._id).select('title');
            if (course) {
                popularCourseInfo = `"${course.title}" (${popularCourseData[0].count} проходжень)`;
            }
        }

        // 3. Відправка сповіщення адмінам
        const admins = await User.find({ role: 'admin' });
        for (const admin of admins) {
            await sendNotification({
                userId: admin._id,
                title: 'Денний аналітичний звіт',
                message: `
                    <b>Підсумки за сьогодні:</b><br>
                    Нових студентів: <b>+${newStudents}</b><br>
                    Пройдено тестів: <b>${testsPassed}</b><br>
                    Найпопулярніший курс: <b>${popularCourseInfo}</b>
                `,
                type: 'info',
                link: '/frontend/admin/admin-statistics.html',
                saveToDb: true,
                sendEmail: true
            });
        }
        
        console.log('[CRON] Денний звіт надіслано успішно.');
    } catch (error) {
        console.error('[CRON] Помилка денного звіту:', error);
    }
});

// backend/utils/cronJobs.js

cron.schedule('0 20 * * 0', async () => {
    console.log('📈 [CRON] Розрахунок тижневого росту активності...');
    try {
        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

        // Кількість активних за цей тиждень
        const activeThisWeek = await User.countDocuments({ 
            lastLogin: { $gte: oneWeekAgo } 
        });

        // Кількість активних за минулий тиждень
        const activeLastWeek = await User.countDocuments({ 
            lastLogin: { $gte: twoWeeksAgo, $lt: oneWeekAgo } 
        });

        let growthMessage = '';
        if (activeLastWeek > 0) {
            const growthPercent = Math.round(((activeThisWeek - activeLastWeek) / activeLastWeek) * 100);
            const trend = growthPercent >= 0 ? 'зросла на' : 'знизилася на';
            growthMessage = `Кількість активних користувачів ${trend} <b>${Math.abs(growthPercent)}%</b> за цей тиждень. Разом: ${activeThisWeek} чол.`;
        } else {
            growthMessage = `Поточна активність: <b>${activeThisWeek}</b> активних користувачів за тиждень.`;
        }

        const admins = await User.find({ role: 'admin' });
        for (const admin of admins) {
            await sendNotification({
                userId: admin._id,
                title: 'Аналітика активності',
                message: growthMessage,
                type: 'success',
                link: '/frontend/admin/admin-users.html',
                saveToDb: true,
                sendEmail: true
            });
        }
    } catch (error) {
        console.error('[CRON] Помилка звіту росту:', error);
    }
});