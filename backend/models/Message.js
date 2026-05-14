// models/Message.js
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    sender: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    receiver: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    courseId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Course' 
    }, // Прив'язка до курсу для фільтрації
    
    text: { 
        type: String, 
        required: true 
    },
    
    // 🔥 НАША КІЛЕР-ФІЧА: Збереження контексту завдання
    context: {
        sectionIdx: { type: Number },
        taskTitle: { type: String },
        taskId: { type: String },
        studentError: { type: String } // Щоб вчитель бачив, де саме студент помилився
    },
    
    isRead: { 
        type: Boolean, 
        default: false 
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

module.exports = mongoose.model('Message', messageSchema);