const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();


// 1. Підключаємо http та socket.io
const http = require('http');
const { Server } = require('socket.io');

const app = express();
process.noDeprecation = true;

// 2. Створюємо HTTP сервер на базі Express
const server = http.createServer(app);

// 3. Налаштовуємо Socket.io
const io = new Server(server, {
    cors: {
        origin: "*", // Дозволяємо підключення з фронтенду
        methods: ["GET", "POST"]
    }
});

const ticketsRouter = require('./routes/tickets'); // Переконайся, що шлях правильний


// Робимо 'io' доступним у всіх роутах (через req.app.get('socketio'))
app.set('socketio', io);
app.set('io', io);

// Логіка підключень Socket.io
io.on('connection', (socket) => {
    
    // Користувач входить у свою "кімнату" (його ID)
    socket.on('join', (userId) => {
        socket.join(userId);
    });

    socket.on('disconnect', () => {
    });
});

// === Middleware ===
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// === Підключення роутів ===
const authRoutes = require('./routes/auth');
const coursesRouter = require('./routes/courses');
const imageRoutes = require('./routes/cloudinary');
const resultRoutes = require('./routes/results');
const messageRoutes = require('./routes/messages');
const invitationRoutes = require('./routes/invitations');
const adminRouter = require('./routes/admin');
const teacherRouter = require('./routes/teacher'); // або той файл, куди ти вставиш код нижче
const paymentsRouter = require('./routes/payments'); // Підключаємо файл
const financeRouter = require('./routes/finance');
const aiRoutes = require('./routes/ai');

app.use('/api/auth', authRoutes);
app.use('/api/courses', coursesRouter);
app.use('/api/image', imageRoutes);
app.use('/api/results', resultRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/tickets', ticketsRouter);
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/admin', adminRouter);
app.use('/api/teacher', teacherRouter);
app.use('/api/payments', paymentsRouter);            // Задаємо для нього базовий шлях
app.use('/api/admin/finance', financeRouter);
app.use('/api/payouts', require('./routes/payouts'));
app.use('/api/ai', aiRoutes);

// === Підключення до MongoDB ===
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB підключено!'))
  .catch(err => console.error('Помилка підключення до MongoDB:', err));

// === Статичні файли фронтенду ===
app.use(express.static(path.join(__dirname, '../frontend')));



// === ЗАПУСК СЕРВЕРА (ВАЖЛИВО: тепер server.listen, а не app.listen) ===
const PORT = process.env.PORT || 5002;
server.listen(PORT, () => {
  console.log(`Сервер та WebSocket запущені на порту ${PORT}`);
});

require('./utils/cronJobs');

// === Graceful Shutdown ===
const gracefulShutdown = () => {
  console.log('\nЗавершення сервера...');
  server.close(() => {
    console.log('Сервер закрито. Порт звільнено.');
    process.exit(0);
  });
};

process.on('SIGINT', gracefulShutdown);   // Ctrl+C
process.on('SIGTERM', gracefulShutdown);  // Сигнал завершення процесу