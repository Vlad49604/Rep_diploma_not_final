const Notification = require('../models/Notification');
const User = require('../models/User'); 
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// backend/utils/notifier.js

async function sendNotification({ userId, title, message, type = 'info', link = null, sendEmail = false, saveToDb = true }) {
    try {
        let savedNotif = null;

        // 1. Зберігаємо в базу ТІЛЬКИ якщо saveToDb === true
        if (saveToDb) {
            const notif = new Notification({
                userId: userId.toString(),
                title,
                message,
                type,
                link
            });
            savedNotif = await notif.save();
            console.log(`Сповіщення відобразиться на платформі (ID: ${savedNotif._id})`);
        } else {
            console.log(`Сповіщення пропущено для платформи (тільки імейл)`);
        }

        // 2. Відправляємо на пошту
        if (sendEmail) {
            const User = require('../models/User');
            const user = await User.findById(userId);
            
            if (user && user.email) {
                const nodemailer = require('nodemailer');
                const transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
                });

                const mailOptions = {
                    from: `"Lexora Team" <${process.env.EMAIL_USER}>`,
                    to: user.email,
                    subject: title,
                    html: `
                        <div style="font-family: sans-serif; padding: 20px; text-align: center;">
                            <h2 style="color: #198754;">${title}</h2>
                            <p style="font-size: 16px;">${message.replace(/<br>/g, '\n')}</p>
                            ${link ? `<a href="https://lexora-platform.ngrok.io${link}" style="background:#198754; color:white; padding:12px 25px; text-decoration:none; border-radius:8px; font-weight:bold; display:inline-block; margin-top:20px;">Повернутися до уроків</a>` : ''}
                        </div>`
                };
                await transporter.sendMail(mailOptions);
                console.log(`📧 Лист-нагадування відправлено на: ${user.email}`);
            }
        }

        return savedNotif;
    } catch (err) {
        console.error('Помилка системи сповіщень:', err);
    }
}

module.exports = sendNotification;