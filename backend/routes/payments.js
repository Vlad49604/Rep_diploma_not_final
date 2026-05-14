const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Course = require('../models/CourseModel');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: 'lexoraengcourses@gmail.com',
    pass: process.env.EMAIL_PASS
  }
});

router.post('/buy/:courseId', auth, async (req, res) => {
    try {
        const { courseId } = req.params;
        // Дістаємо юзера з бази (ТУТ Є ЙОГО EMAIL І ІМ'Я)
        const user = await User.findById(req.user.id);
        const course = await Course.findById(courseId);

        if (!course) return res.status(404).json({ error: 'Курс не знайдено' });
        if (user.enrolledCourses.includes(courseId)) return res.status(400).json({ error: 'Курс вже придбано' });

        const price = course.price || 0;
        let platformFee = 0;
        let teacherEarnings = 0;

        // --- ЛОГІКА РОЗПОДІЛУ КОШТІВ ---
        if (course.isSystem) {
            platformFee = price;
            teacherEarnings = 0;
        } else {
            let calculatedFee = Math.round(price * 0.25);
            platformFee = Math.max(calculatedFee, 50); 
            if (platformFee > price) platformFee = price; 
            teacherEarnings = price - platformFee;
        }

        // 1. Створюємо запис про транзакцію
        const newTransaction = new Transaction({
            user: user._id,
            course: course._id,
            teacher: course.isSystem ? null : course.author,
            totalAmount: price,
            platformFee: platformFee,
            teacherEarnings: teacherEarnings,
            isSystemCourse: course.isSystem
        });
        await newTransaction.save();

        // 2. Надаємо доступ студенту
        user.enrolledCourses.push(course._id);
        await user.save();

        // 3. Зараховуємо кошти вчителю
        if (!course.isSystem && course.author) {
            await User.findByIdAndUpdate(course.author, {
                $inc: { balance: teacherEarnings }
            });
        }

        // 🔥 ГЕНЕРАЦІЯ ТА ВІДПРАВКА ЧЕКА НА ПОШТУ 🔥
        try {
            const transactionId = `LX-${Math.floor(Math.random() * 900000 + 100000)}`;
            const purchaseDate = new Date().toLocaleDateString('uk-UA', { 
                day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' 
            });

            const mailOptions = {
                from: '"Lexora Billing" <lexoraengcourses@gmail.com>',
                // 🔥 ВИПРАВЛЕНО: Беремо пошту з бази (user.email)
                to: user.email, 
                subject: `🧾 Квитанція про оплату курсу: ${course.title}`, 
                html: `
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7f6; padding: 40px 20px;">
                    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05);">
                        
                        <!-- Шапка чека -->
                        <div style="background-color: #1b5e20; padding: 30px; text-align: center; color: white;">
                            <h1 style="margin: 0; font-size: 28px; letter-spacing: 1px;">LEXORA PAY</h1>
                            <p style="margin: 5px 0 0; opacity: 0.8; font-size: 14px;">Електронний чек</p>
                        </div>

                        <!-- Тіло чека -->
                        <div style="padding: 40px;">
                            <!-- 🔥 ВИПРАВЛЕНО: Беремо ім'я з бази (user.name) -->
                            <h2 style="color: #2c3e50; margin-top: 0;">Привіт, ${user.name || 'Студенте'}!</h2>
                            <p style="color: #555; font-size: 16px; line-height: 1.6;">
                                Ваша оплата успішно оброблена. Курс вже додано до вашого кабінету, і ви можете розпочати навчання прямо зараз!
                            </p>

                            <!-- Деталі транзакції -->
                            <div style="background-color: #f9fcf9; border: 1px solid #e8f5e9; border-radius: 12px; padding: 25px; margin: 30px 0;">
                                <h3 style="margin-top: 0; color: #1b5e20; border-bottom: 2px dashed #c8e6c9; padding-bottom: 10px;">Деталі операції</h3>
                                
                                <table style="width: 100%; border-collapse: collapse;">
                                    <tr>
                                        <td style="padding: 10px 0; color: #777;">Товар/Курс:</td>
                                        <td style="padding: 10px 0; text-align: right; font-weight: bold; color: #333;">${course.title}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 10px 0; color: #777;">ID Транзакції:</td>
                                        <td style="padding: 10px 0; text-align: right; font-family: monospace; color: #333;">${transactionId}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 10px 0; color: #777;">Дата:</td>
                                        <td style="padding: 10px 0; text-align: right; color: #333;">${purchaseDate}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 15px 0 5px 0; color: #777; border-top: 2px dashed #c8e6c9;"><strong>СУМА ДО СПЛАТИ:</strong></td>
                                        <td style="padding: 15px 0 5px 0; text-align: right; font-size: 20px; font-weight: bold; color: #1b5e20; border-top: 2px dashed #c8e6c9;">${course.price} ₴</td>
                                    </tr>
                                </table>
                            </div>

                            <div style="text-align: center; margin-top: 40px;">
                                <a href="https://unschooled-isothermally-aleen.ngrok-free.dev/pages/student.html" style="background-color: #28a745; color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
                                    Перейти до навчання
                                </a>
                            </div>
                        </div>

                        <!-- Футер -->
                        <div style="background-color: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #aaa; border-top: 1px solid #eee;">
                            Це автоматичний лист, будь ласка, не відповідайте на нього.<br>
                            &copy; 2026 Lexora. м. Львів, вул. Наукова 30.
                        </div>
                    </div>
                </div>
                `
            };

            transporter.sendMail(mailOptions).catch(err => console.error("Помилка відправки чека:", err));
            
        } catch (mailError) {
            console.error("Щось пішло не так при формуванні листа:", mailError);
        }

        // 4. Віддаємо успішну відповідь
        res.json({ 
            success: true, 
            message: `Оплата успішна! Списано ${price} ₴.`,
            details: {
                fee: platformFee,
                earned: teacherEarnings
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Помилка при проведенні транзакції' });
    }
});

module.exports = router;