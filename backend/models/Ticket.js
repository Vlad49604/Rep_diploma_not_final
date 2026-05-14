const mongoose = require('mongoose');

const TicketSchema = new mongoose.Schema({
  // 🔥 ЗАМІНИЛИ student на user
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, 
  subject: { type: String, required: true },
  category: { type: String, default: 'Інше' },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', default: null },
  status: { 
    type: String, 
    enum: ['new', 'open', 'pending', 'closed'], 
    default: 'new' 
  },
  slaNotified: {
      type: Boolean,
      default: false
  },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
  messages: [{
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    text: String,
    fileUrl: { type: String, default: null },
    replyTo: { // 🔥 Додаємо цей блок
        messageId: String,
        text: String
    },
    createdAt: { type: Date, default: Date.now }
  }] 
}, { timestamps: true });

module.exports = mongoose.model('Ticket', TicketSchema);