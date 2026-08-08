import mongoose from 'mongoose';

const automationLogSchema = new mongoose.Schema({
  disputeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Dispute',
    required: true,
  },
  action: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['SUCCESS', 'FAILED', 'INFO'],
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  }
});

export const AutomationLog = mongoose.model('AutomationLog', automationLogSchema);
