const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 5000
  },
  type: {
    type: String,
    enum: ['text', 'image', 'file', 'system'],
    default: 'text'
  },
  attachments: [{
    name: String,
    url: String,
    size: Number,
    mimeType: String
  }],
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: Date,
  contentStatus: {
    type: String,
    enum: ['safe', 'unsafe', 'pending'],
    default: 'pending'
  },
  contentScore: {
    type: Number,
    min: 0,
    max: 1,
    default: null
  },
  flaggedAt: Date
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

MessageSchema.index({ conversation: 1, createdAt: -1 });
MessageSchema.index({ sender: 1, createdAt: -1 });
module.exports = mongoose.model('Message', MessageSchema);
