const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const User = require('../models/User'); 
const auth = require('../middleware/auth'); // Твій middleware для JWT
const Ticket = require('../models/Ticket');
const bcrypt = require('bcryptjs');
const roleAuth = require('../middleware/roleAuth');
const Course = require('../models/CourseModel');
const Result = require('../models/Result');
const Transaction = require('../models/Transaction');
const Payout = require('../models/Payout');
const AuditLog = require('../models/AuditLog');
const mongoose = require('mongoose');

// Хелпер для запису логів
async function logAudit(adminId, action, targetId, description) {
    try {
        await AuditLog.create({ admin: adminId, action, targetId, description });
    } catch (err) {
        console.error("Помилка запису Audit Log:", err);
    }
}
// Налаштування транспортера (аналогічно до auth.js)
const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});
/**
 * CRM ПАНЕЛЬ: РОУТИ ДЛЯ РОЗСИЛОК
 */

// 1. Отримання списку імейлів за роллю (Сегментація)
// 1. Отримання списку імейлів за РОЗШИРЕНИМ фільтром (CRM Сегментація)
router.get('/users', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Доступ заборонено' });

        const { role, condition, days } = req.query;
        let filter = {};

        // --- БАЗОВИЙ ФІЛЬТР (РОЛЬ) ---
        if (role && role !== 'all') {
            filter.role = role;
        }

        // --- ДОДАТКОВА УМОВА (CONDITION) ---
        const now = new Date();

        switch (condition) {
            case 'inactive':
                const daysAgo = new Date();
                daysAgo.setDate(now.getDate() - parseInt(days || 7));
                filter.lastLogin = { $lte: daysAgo };
                break;

            case 'dead_souls':
                filter.lastLogin = { $exists: false };
                break;

            case 'new_leads':
                const twoDaysAgo = new Date();
                twoDaysAgo.setHours(now.getHours() - 48);
                filter.createdAt = { $gte: twoDaysAgo };
                break;

            case 'active_tickets':
                // Шукаємо ID всіх користувачів, у яких є відкриті тікети
                const userWithTickets = await Ticket.find({ 
                    status: { $nin: ['resolved', 'closed'] } 
                }).distinct('user');
                filter._id = { $in: userWithTickets };
                break;

            case 'no_avatar':
                filter.$or = [
                    { avatar: { $exists: false } },
                    { avatar: '' },
                    { avatar: 'default.png' }
                ];
                break;
        }

        const users = await User.find(filter).select('email name');
        res.json({ users });

    } catch (err) {
        console.error("CRM Segment Error:", err);
        res.status(500).json({ error: 'Помилка фільтрації сегментів' });
    }
});
// 2. Масова розсилка (Bulk Email)
router.post('/bulk-mail', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Доступ заборонено' });

        const { emails, subject, body, imageUrl } = req.body;

        if (!emails || emails.length === 0) {
            return res.status(400).json({ error: 'Список отримувачів порожній' });
        }

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        // Люксовий шаблон Lexora
        const htmlTemplate = `
            <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #eef2f3; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.05);">
                <div style="background-color: #198754; padding: 40px 20px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px; letter-spacing: 1px;">Lexora Education</h1>
                </div>
                
                ${imageUrl ? `<img src="${imageUrl}" style="width: 100%; max-height: 300px; object-fit: cover;" alt="Banner">` : ''}
                
                <div style="padding: 40px; color: #2d3436; line-height: 1.8; font-size: 16px;">
                    <div style="background: #f8f9fa; border-left: 4px solid #198754; padding: 20px; border-radius: 12px; margin-bottom: 30px;">
                        ${body.replace(/\n/g, '<br>')}
                    </div>
                    
                    <p style="text-align: center; margin-top: 40px;">
                        <a href="http://127.0.0.1:5501/frontend/index.html" style="background-color: #198754; color: #ffffff; padding: 15px 35px; text-decoration: none; border-radius: 50px; font-weight: bold; display: inline-block;">Перейти на платформу</a>
                    </p>
                </div>
                
                <div style="background-color: #f1f3f5; padding: 30px; text-align: center; color: #636e72; font-size: 12px;">
                    <p>© 2026 Lexora CRM. Це повідомлення надіслано адміністрацією платформи.</p>
                </div>
            </div>
        `;

        await transporter.sendMail({
            from: `"Lexora Admin" <${process.env.EMAIL_USER}>`,
            bcc: emails, // Використовуємо BCC (сховану копію), щоб користувачі не бачили імейлів один одного
            subject: subject,
            html: htmlTemplate
        });

        res.json({ success: true, message: `Надіслано ${emails.length} листів` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Помилка розсилки: ' + err.message });
    }
});

// 3. Пошук користувачів (Autocomplete для розсилки)
// 3. Пошук користувачів (Autocomplete для розсилки)
router.get('/search-users', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Доступ заборонено' });

        const { q } = req.query;
        // Якщо запит занадто короткий, нічого не шукаємо
        if (!q || q.length < 2) return res.json({ users: [] }); 

        // Шукаємо юзерів за email АБО за ім'ям (name)
        const users = await User.find({ 
            $or: [
                { email: { $regex: q, $options: 'i' } },
                { name: { $regex: q, $options: 'i' } } // Переконайся, що поле в моделі User називається 'name'
            ]
        })
        .select('email name') // Отримуємо і email, і ім'я
        .limit(10);

        res.json({ users });
    } catch (err) {
        console.error("Помилка автозаповнення:", err);
        res.status(500).json({ error: 'Помилка пошуку' });
    }
});

// Отримати всіх користувачів для таблиці адміна
router.get('/manage-users', auth, roleAuth(['admin']), async (req, res) => {
  try {
    const users = await User.find().select('-password'); 
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Помилка сервера' });
  }
});

// Перемикання бану (Ban/Unban)
router.patch('/manage-users/:id/toggle-ban', auth, roleAuth(['admin']), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Користувача не знайдено' });
    
    user.isBanned = !user.isBanned; 
    await user.save();
    res.json({ message: `Статус змінено на ${user.isBanned ? 'Заблоковано' : 'Активний'}`, isBanned: user.isBanned });
  } catch (err) {
    res.status(500).json({ message: 'Помилка при зміні статусу' });
  }
});

// Роут для примусового скидання пароля
router.post('/manage-users/:id/reset-password', auth, roleAuth(['admin']), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Користувача не знайдено' });

    const newPassword = 'Lexora2026';
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    
    // Скидаємо лічильник невдалих спроб, щоб користувач міг зайти
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    
    await user.save();

    // Налаштування листа
    const mailOptions = {
      from: '"Lexora Admin" <lexoraengcourses@gmail.com>',
      to: user.email,
      subject: 'Ваш пароль у Lexora було скинуто 🔑',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e8f5e9; border-radius: 15px; overflow: hidden;">
          <div style="background-color: #198754; padding: 20px; text-align: center; color: white;">
            <h2>Адміністрація Lexora</h2>
          </div>
          <div style="padding: 30px; line-height: 1.6; color: #333;">
            <p>Вітаємо, <b>${user.name}</b>!</p>
            <p>Ваш пароль для входу в систему був скинутий адміністратором.</p>
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0; border: 1px dashed #198754;">
              <p style="margin: 0; font-size: 14px; color: #666;">Ваш новий тимчасовий пароль:</p>
              <h3 style="margin: 5px 0; color: #198754; font-size: 24px;">${newPassword}</h3>
            </div>
            <p style="color: #d32f2f; font-weight: bold;">⚠️ Важливо:</p>
            <p>Будь ласка, змініть цей пароль у налаштуваннях вашого профілю одразу після першого входу для безпеки вашого акаунту.</p>
            <p style="text-align: center; margin-top: 30px;">
              <a href="http://127.0.0.1:5501/frontend/index.html" style="background-color: #198754; color: white; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-weight: bold;">Перейти до входу</a>
            </p>
          </div>
          <div style="background-color: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #aaa;">
            &copy; 2026 Lexora. Якщо ви не просили про скидання пароля, зверніться в підтримку.
          </div>
        </div>
      `
    };

    // Відправка листа
    await transporter.sendMail(mailOptions);

    res.json({ message: `Пароль успішно скинуто. Лист надіслано на ${user.email}` });
  } catch (err) {
    console.error("Помилка скидання пароля:", err);
    res.status(500).json({ message: 'Помилка на сервері' });
  }
});

// routes/admin.js

// 1. РОУТ ДЛЯ БАНУ КОРИСТУВАЧА
router.post('/manage-users/:id/ban', auth, roleAuth(['admin']), async (req, res) => {
    try {
        const { durationDays, reason } = req.body;
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'Користувача не знайдено' });

        user.isBanned = true;
        user.banReason = reason || 'Порушення правил платформи';
        
        // Визначаємо термін
        if (durationDays === 'permanent') {
            user.bannedUntil = null;
        } else {
            const endDate = new Date();
            endDate.setDate(endDate.getDate() + parseInt(durationDays));
            user.bannedUntil = endDate;
        }

        await user.save();

        await logAudit(req.user.id, 'BAN_USER', user._id, `Заблоковано користувача ${user.email}. Причина: ${reason}`);

        // Формуємо текст для листа
        const timeText = durationDays === 'permanent' ? 'НАЗАВЖДИ' : `на ${durationDays} днів (до ${user.bannedUntil.toLocaleDateString()})`;

        // Відправляємо Email
        const mailOptions = {
            from: '"Lexora Security" <lexoraengcourses@gmail.com>',
            to: user.email,
            subject: '🚨 Ваш акаунт заблоковано',
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ffcdd2; border-radius: 15px; overflow: hidden;">
                    <div style="background-color: #d32f2f; padding: 20px; text-align: center; color: white;">
                        <h2>Обмеження доступу</h2>
                    </div>
                    <div style="padding: 30px; color: #333;">
                        <p>Вітаємо, <b>${user.name}</b>.</p>
                        <p>На жаль, ваш акаунт на платформі Lexora було заблоковано.</p>
                        <ul style="background: #fff0f0; padding: 15px 30px; border-radius: 8px;">
                            <li><b>Термін блокування:</b> ${timeText}</li>
                            <li><b>Причина:</b> ${user.banReason}</li>
                        </ul>
                        <p>Якщо ви вважаєте, що це сталося помилково, будь ласка, дайте відповідь на цей лист.</p>
                    </div>
                </div>`
        };
        await transporter.sendMail(mailOptions);

        // Миттєвий "кік" користувача через Socket.io
        const io = req.app.get('socketio') || req.app.get('io');
        if (io) {
            io.to(user._id.toString()).emit('forced_logout', { 
                reason: `Ваш акаунт заблоковано. Причина: ${user.banReason}` 
            });
        }

        res.json({ message: `Користувача заблоковано ${timeText}` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Помилка при блокуванні' });
    }
});

// 2. РОУТ ДЛЯ РОЗБАНУ
router.post('/manage-users/:id/unban', auth, roleAuth(['admin']), async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'Користувача не знайдено' });

        user.isBanned = false;
        user.banReason = '';
        user.bannedUntil = null;
        await user.save();

        // Лист про розблокування
        await transporter.sendMail({
            from: '"Lexora Security" <lexoraengcourses@gmail.com>',
            to: user.email,
            subject: '✅ Ваш акаунт розблоковано',
            html: `<p>Вітаємо, ${user.name}! Обмеження з вашого акаунту знято. Ви знову можете увійти на платформу.</p>`
        });

        res.json({ message: 'Користувача успішно розблоковано' });
    } catch (err) {
        res.status(500).json({ message: 'Помилка розблокування' });
    }
});

// Роут для User 360° View
// Роут для User 360° View
router.get('/manage-users/:id/details', auth, roleAuth(['admin']), async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) return res.status(404).json({ message: 'Користувача не знайдено' });

        let data = { profile: user };

        if (user.role === 'student') {
            // Збираємо ВСЮ аналітику студента паралельно
            const [transactions, results, tickets, enrolledCourses, pendingInvites, lastMessage] = await Promise.all([
                require('../models/Transaction').find({ user: user._id }).populate('course', 'title price'),
                require('../models/Result').find({ user: user._id }).populate('course', 'title sections').sort({ completedAt: -1 }),
                require('../models/Ticket').find({ user: user._id }).sort({ createdAt: -1 }),
                require('../models/CourseModel').find({ _id: { $in: user.enrolledCourses } }).select('title sections author').populate('author', 'name'),
                require('../models/Invitation').find({ studentEmail: user.email, status: 'pending' }),
                require('../models/Message').findOne({ $or: [{ sender: user._id }, { receiver: user._id }] }).sort({ createdAt: -1 })
            ]);
            
            data.studentData = { 
                transactions, 
                results, 
                tickets, 
                enrolledCourses, 
                pendingInvites, 
                lastMessage 
            };
        } 
        else if (user.role === 'teacher') {
            const [courses, payouts] = await Promise.all([
                require('../models/CourseModel').find({ author: user._id }).select('title isPublic price'),
                require('../models/Payout').find({ teacher: user._id }).sort({ createdAt: -1 })
            ]);
            data.teacherData = { courses, payouts };
        }

        res.json(data);
    } catch (err) {
        console.error("Помилка 360 View:", err);
        res.status(500).json({ message: 'Помилка завантаження досьє' });
    }
});

// Отримати список усіх курсів платформи для адміна
// Отримати список усіх курсів платформи для адміна
router.get('/manage-courses', auth, roleAuth(['admin']), async (req, res) => {
    try {
        const Course = require('../models/CourseModel');
        const User = require('../models/User'); // Обов'язково підключаємо модель користувача

        // Використовуємо .lean(), щоб можна було додати нове поле до об'єктів
        const courses = await Course.find()
            .populate('author', 'name email')
            .sort({ createdAt: -1 })
            .lean(); 

        // Перебираємо всі курси і шукаємо реальну кількість студентів
        for (let course of courses) {
            // Рахуємо, скільки юзерів мають ID цього курсу у своєму масиві enrolledCourses
            const enrolledCount = await User.countDocuments({ enrolledCourses: course._id });
            
            // Залишаємо fallback для викладацьких курсів, які використовують allowedStudents
            const allowedCount = course.allowedStudents ? course.allowedStudents.length : 0;
            
            // Беремо найбільше число, щоб точно не загубити жодного студента
            course.realStudentCount = Math.max(enrolledCount, allowedCount);
        }

        res.json(courses);
    } catch (err) {
        console.error("Помилка завантаження курсів:", err);
        res.status(500).json({ message: 'Помилка сервера при отриманні курсів' });
    }
});

// Отримати список студентів для конкретного курсу
router.get('/manage-courses/:id/students', auth, roleAuth(['admin']), async (req, res) => {
    try {
        const Course = require('../models/CourseModel');
        const User = require('../models/User');

        const courseId = req.params.id;
        const course = await Course.findById(courseId);
        
        if (!course) return res.status(404).json({ message: 'Курс не знайдено' });

        // Шукаємо юзерів: або вони самі записались (enrolledCourses), 
        // або викладач дав їм доступ вручну (allowedStudents)
        const students = await User.find({
            $or: [
                { enrolledCourses: courseId },
                { _id: { $in: course.allowedStudents || [] } }
            ],
            role: 'student' // Беремо тільки студентів
        }).select('name email _id'); // Беремо тільки необхідні поля для списку

        res.json(students);
    } catch (err) {
        console.error("Помилка завантаження списку студентів:", err);
        res.status(500).json({ message: 'Помилка сервера' });
    }
});

// Перемикання статусу публікації курсу (Глобально)
router.patch('/manage-courses/:id/toggle-publish', auth, roleAuth(['admin']), async (req, res) => {
    try {
        // Ми використовуємо модель Course, яка у тебе вже підключена зверху файлу
        const course = await Course.findById(req.params.id);
        
        if (!course) {
            return res.status(404).json({ message: 'Курс не знайдено' });
        }

        // Міняємо статус на протилежний
        course.isPublic = !course.isPublic;
        await course.save();

        res.json({ 
            message: `Курс тепер ${course.isPublic ? 'ПУБЛІЧНИЙ' : 'ПРИВАТНИЙ'}`, 
            isPublic: course.isPublic 
        });
    } catch (err) {
        console.error("Помилка зміни статусу курсу:", err);
        res.status(500).json({ message: 'Помилка сервера при зміні статусу' });
    }
});

// Головний дашборд: Глобальна аналітика
// Головний дашборд: Глобальна аналітика (РЕАЛЬНІ ДАНІ)
router.get('/dashboard-stats', auth, roleAuth(['admin']), async (req, res) => {
    try {
        const User = require('../models/User');
        const Transaction = require('../models/Transaction');
        const Result = require('../models/Result');

        // 1. Воронка конверсії (Реальні дані)
        const totalUsers = await User.countDocuments({ role: 'student' });
        const activeUsers = await User.countDocuments({ role: 'student', enrolledCourses: { $exists: true, $not: {$size: 0} } });
        // Рахуємо унікальних покупців
        const buyers = await Transaction.distinct('user');
        const totalBuyers = buyers.length;

        // 2. Глобальний GPA (Реальні дані)
        const allResults = await Result.find().select('score total');
        let globalGpa = 0;
        if (allResults.length > 0) {
            const totalPercent = allResults.reduce((acc, r) => acc + (r.score / r.total) * 100, 0);
            globalGpa = Math.round(totalPercent / allResults.length);
        }

        // 3. Динаміка реєстрацій (АБСОЛЮТНО РЕАЛЬНІ ДАНІ ЗА ОСТАННІ 6 МІСЯЦІВ)
        const monthNames = [];
        const studentsGrowth = [];
        const teachersGrowth = [];

        // Цикл: йдемо від 5 місяців тому до поточного (0)
        for (let i = 5; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            
            // Визначаємо перший і останній день конкретного місяця
            const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
            const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);

            // Отримуємо коротку назву місяця українською (напр., "Лис", "Гру")
            const monthStr = startOfMonth.toLocaleString('uk-UA', { month: 'short' });
            // Робимо першу букву великою
            monthNames.push(monthStr.charAt(0).toUpperCase() + monthStr.slice(1).replace('.', ''));

            // Рахуємо РЕАЛЬНІ реєстрації студентів за цей конкретний місяць
            const studentsCount = await User.countDocuments({
                role: 'student',
                createdAt: { $gte: startOfMonth, $lte: endOfMonth }
            });

            // Рахуємо РЕАЛЬНІ реєстрації викладачів за цей місяць
            const teachersCount = await User.countDocuments({
                role: 'teacher',
                createdAt: { $gte: startOfMonth, $lte: endOfMonth }
            });

            studentsGrowth.push(studentsCount);
            teachersGrowth.push(teachersCount);
        }

        res.json({
            funnel: { total: totalUsers, active: activeUsers, buyers: totalBuyers },
            gpa: globalGpa,
            growth: { labels: monthNames, students: studentsGrowth, teachers: teachersGrowth }
        });

    } catch (err) {
        console.error("Dashboard Error:", err);
        res.status(500).json({ error: 'Помилка завантаження аналітики' });
    }
});

// Отримання даних поточного авторизованого користувача
router.get('/me', auth, async (req, res) => {
    try {
        // Шукаємо юзера по ID з токена, пароль не передаємо в цілях безпеки
        const user = await User.findById(req.user.id).select('-password');
        if (!user) return res.status(404).json({ error: 'Користувача не знайдено' });
        res.json(user);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// Реальна зміна пароля
router.put('/update-password', auth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ error: 'Користувача не знайдено' });

        // Перевіряємо, чи правильний старий пароль
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) return res.status(400).json({ error: 'Поточний пароль введено неправильно' });

        // Хешуємо новий пароль
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        
        await user.save();
        res.json({ message: 'Пароль успішно оновлено!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Помилка при зміні пароля' });
    }
});

// 1. Зміна ролі користувача (RBAC)
router.patch('/manage-users/:id/change-role', auth, roleAuth(['admin']), async (req, res) => {
    try {
        const { newRole } = req.body;
        // Дозволяємо лише валідні ролі
        if (!['student', 'teacher', 'admin'].includes(newRole)) {
            return res.status(400).json({ message: 'Недійсна роль' });
        }

        const user = await User.findByIdAndUpdate(req.params.id, { role: newRole }, { new: true });
        if (!user) return res.status(404).json({ message: 'Користувача не знайдено' });

        await logAudit(req.user.id, 'CHANGE_ROLE', user._id, `Змінено роль користувача ${user.email} на ${newRole.toUpperCase()}`);

        res.json({ message: `Роль успішно змінено на ${newRole.toUpperCase()}`, role: user.role });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Помилка сервера при зміні ролі' });
    }
});

// 2. Ручна видача доступу до курсу (Бонус/Тест)
router.post('/manage-users/:id/grant-course', auth, roleAuth(['admin']), async (req, res) => {
    try {
        const { courseId } = req.body;
        const user = await User.findById(req.params.id);
        
        if (!user) return res.status(404).json({ message: 'Користувача не знайдено' });
        
        // Перевіряємо, чи курс вже є у студента
        if (user.enrolledCourses.includes(courseId)) {
            return res.status(400).json({ message: 'Користувач вже має доступ до цього курсу' });
        }

        // Додаємо курс користувачу
        user.enrolledCourses.push(courseId);
        await user.save();

        await logAudit(req.user.id, 'GRANT_COURSE', user._id, `Видано безкоштовний доступ до курсу для студента ${user.email}`);

        res.json({ message: 'Доступ до курсу успішно відкрито!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Помилка при видачі доступу' });
    }
});

// === СИСТЕМНИЙ МОНІТОРИНГ ТА ЛОГИ (Health Check & Audit) ===
router.get('/system-health', auth, roleAuth(['admin']), async (req, res) => {
    try {
        // 1. Перевірка БД (0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting)
        const dbStatus = mongoose.connection.readyState === 1 ? 'OK' : 'ERROR';
        
        // 2. Час роботи сервера (Uptime)
        const uptimeSeconds = process.uptime();
        const uptimeHours = Math.floor(uptimeSeconds / 3600);
        
        // 3. Використання пам'яті сервером Node.js (у Мегабайтах)
        const memoryUsage = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

        // 4. Останні 20 логів аудиту
        const logs = await AuditLog.find()
            .populate('admin', 'name email')
            .sort({ createdAt: -1 })
            .limit(20);

        // Перевіряємо, чи є або єдиний URL, або всі три окремі ключі
        const isCloudinaryOk = process.env.CLOUDINARY_URL || 
                              (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

        res.json({
            health: {
                database: dbStatus,
                uptimeHours: uptimeHours,
                memoryMB: memoryUsage,
                // Тепер перевірка знайде твої ключі
                cloudinary: isCloudinaryOk ? 'OK' : 'MISSING KEYS'
            },
            logs: logs
        });
    } catch (err) {
        res.status(500).json({ error: 'Помилка отримання системних даних' });
    }
});

module.exports = router;