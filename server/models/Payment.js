import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  currency: {
    type: String,
    default: 'INR',
  },
  status: {
    type: String,
    enum: ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'],
    default: 'PENDING',
  },
  transactionId: {
    type: String,
    required: true,
    unique: true,
  },
  paymentMethod: {
    type: String,
    default: 'MOCK_CARD',
  },
  refundedAmount: {
    type: Number,
    default: 0,
  },
  refundStatus: {
    type: String,
    enum: [null, 'PENDING', 'SUCCESS', 'FAILED'],
    default: null,
  }
}, {
  timestamps: true
});

export const Payment = mongoose.model('Payment', paymentSchema);
