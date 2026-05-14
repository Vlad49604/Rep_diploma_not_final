const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    verified: { type: Boolean, default: false },
    emailToken: { type: String },
    role: { type: String, default: "student" },
    avatar: { type: String, default: "" },
    // Тільки список курсів, нічого зайвого
    enrolledCourses: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Course',
        default: [] 
    }],
    loginAttempts: { 
        type: Number, 
        default: 0 
    },
    cardNumber: { type: String, default: '' },
    lockUntil: { 
        type: Date 
    },
    balance: { type: Number, default: 0 },

    completedCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
    lastLogin: {
        type: Date,
        default: Date.now
    },
    savedCardMask: { type: String, default: '' },
    paymentToken: { type: String, default: '' }, // Токен для "списання" коштів
    dailyUploadCount: { type: Number, default: 0 },
    lastUploadDate: { type: String, default: "" }, // Додай цей рядок
    // models/User.js (додай до існуючих полів)
    isBanned: { type: Boolean, default: false },
    banReason: { type: String, default: '' },
    bannedUntil: { type: Date, default: null } // Якщо null, але isBanned = true -> це назавжди
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);