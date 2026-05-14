const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    course: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Course', 
        required: true 
    },
    sectionIdx: { type: Number, required: true },
    score: { type: Number, required: true },
    total: { type: Number, required: true },
    
    // Зберігаємо деталі по кожному завданню
    answers: [{
        taskId: Number,
        isCorrect: Boolean,
        userAnswer: mongoose.Schema.Types.Mixed, // Для різних типів відповідей
        
        // --- ДОДАНІ НОВІ ПОЛЯ ДЛЯ ІСТОРІЇ (РОБОТИ НАД ПОМИЛКАМИ) ---
        taskType: String,
        questionText: String,
        userAnswerText: String,
        correctAnswerText: String,
        teacherComment: { type: String, default: null }
    }],
    
    completedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Result', resultSchema);