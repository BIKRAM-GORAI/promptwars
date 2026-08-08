import mongoose from 'mongoose';

const disputeSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null,
  },
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    default: null,
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    default: null,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  category: {
    type: String,
    enum: ['DAMAGED_PRODUCT', 'PAYMENT_DISPUTE', 'DOUBLE_CHARGE', 'REFUND_NOT_RECEIVED', 'REFUND_REQUEST', 'OTHER'],
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  evidenceUrl: {
    type: String,
    default: null,
  },
  status: {
    type: String,
    enum: ['PENDING', 'RESOLVED', 'HUMAN_REVIEW_REQUIRED', 'MORE_INFO_REQUIRED', 'REJECTED'],
    default: 'PENDING',
  },
  aiClassification: {
    category: { type: String, default: null },
    confidence: { type: Number, default: 0 },
    reasoningSummary: { type: String, default: '' },
    requestedAction: { type: String, default: '' },
    requiresHuman: { type: Boolean, default: false }
  },
  evidenceAnalysis: {
    damageDetected: { type: Boolean, default: false },
    damageType: { type: String, default: '' },
    evidenceQuality: { type: String, default: '' },
    confidence: { type: Number, default: 0 }
  },
  resolutionDetails: {
    action: { type: String, default: '' },
    amount: { type: Number, default: 0 },
    refundedPaymentId: { type: String, default: '' },
    message: { type: String, default: '' }
  },
  requiresHumanReview: {
    type: Boolean,
    default: false,
  }
}, {
  timestamps: true
});

export const Dispute = mongoose.model('Dispute', disputeSchema);
