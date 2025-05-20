const mongoose = require('mongoose');

const videoCallSchema = new mongoose.Schema({
  callerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['video', 'audio'],
    default: 'video'
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'ended', 'missed', 'rejected'],
    default: 'pending'
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: {
    type: Date
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes
videoCallSchema.index({ callerId: 1, startTime: -1 });
videoCallSchema.index({ receiverId: 1, startTime: -1 });
videoCallSchema.index({ participants: 1, status: 1 });

const Call = mongoose.model('VideoCall', videoCallSchema);

module.exports = Call; 