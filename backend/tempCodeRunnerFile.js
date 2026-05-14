const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Підключення до MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB підключено!'))
    .catch(err => console.error('Помилка підключення до MongoDB:', err));

// Маршрути
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Сервер
const PORT = process.env.PORT || 5002;
const server = app.listen(PORT, () => {
    console.log(`Сервер запущено на порті ${PORT}`);
});

// Функція для коректного завершення сервера та звільнення порту
const gracefulShutdown = () => {
    console.log('\nЗавершення сервера...');
    server.close(() => {
        console.log('Сервер закрито. Порт звільнено.');
        process.exit(0);
    });
};

// Обробка сигналів завершення процесу
process.on('SIGINT', gracefulShutdown);  // Ctrl+C
process.on('SIGTERM', gracefulShutdown); // Системний сигнал завершення
