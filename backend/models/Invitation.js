const mongoose = require('mongoose');

const InvitationSchema = new mongoose.Schema({
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    studentEmail: { type: String, required: true, lowercase: true, trim: true },
    // --- НОВЕ ПОЛЕ ДЛЯ ПОВІДОМЛЕННЯ ---
    message: { type: String, trim: true, maxlength: 500 }, 
    // ----------------------------------
    status: { 
        type: String, 
        enum: ['pending', 'accepted', 'rejected'], 
        default: 'pending' 
    },
    createdAt: { type: Date, default: Date.now, expires: '7d' }
});

module.exports = mongoose.model('Invitation', InvitationSchema);