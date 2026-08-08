import { Dispute } from '../models/Dispute.js';
import { Payment } from '../models/Payment.js';
import { AutomationLog } from '../models/AutomationLog.js';
import { Product } from '../models/Product.js';
import { paymentService } from '../services/payment/paymentService.js';
import { emailService } from '../services/email/emailService.js';
import { storageService } from '../services/storage/storageService.js';
import { env } from '../config/env.js';

export const adminLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      res.status(400);
      throw new Error('Email and password are required');
    }

    if (email === env.admin.email && password === env.admin.password) {
      console.log(`[ADMIN] Successful login for admin account: ${email}`);
      res.status(200).json({
        token: 'resolveai-admin-session-token',
        name: 'System Admin',
        email: env.admin.email
      });
    } else {
      res.status(401);
      throw new Error('Invalid email or password');
    }
  } catch (error) {
    next(error);
  }
};

export const getStats = async (req, res, next) => {
  try {
    const totalDisputes = await Dispute.countDocuments({});
    
    // Status counts
    const resolvedDisputes = await Dispute.countDocuments({ status: 'RESOLVED' });
    const humanReviews = await Dispute.countDocuments({ status: 'HUMAN_REVIEW_REQUIRED' });
    const rejectedDisputes = await Dispute.countDocuments({ status: 'REJECTED' });

    // Calculate automation rate (disputes resolved without requiring human intervention)
    const automatedResolved = await Dispute.countDocuments({ 
      status: 'RESOLVED', 
      requiresHumanReview: false 
    });
    
    const automationRate = totalDisputes > 0 
      ? Math.round((automatedResolved / totalDisputes) * 100) 
      : 0;

    // Total refunds processed (sum of refundedAmount from Payment schema)
    const refundStats = await Payment.aggregate([
      { $match: { refundedAmount: { $gt: 0 } } },
      { $group: { _id: null, totalRefunds: { $sum: '$refundedAmount' } } }
    ]);
    
    const totalRefundedAmount = refundStats.length > 0 ? refundStats[0].totalRefunds : 0;

    res.status(200).json({
      totalDisputes,
      resolvedDisputes,
      humanReviews,
      rejectedDisputes,
      totalRefundedAmount,
      automationRate
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminDisputes = async (req, res, next) => {
  try {
    const disputes = await Dispute.find({})
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });
    res.status(200).json(disputes);
  } catch (error) {
    next(error);
  }
};

export const reviewDispute = async (req, res, next) => {
  try {
    const { action, feedback } = req.body;
    const disputeId = req.params.id;

    if (!action) {
      res.status(400);
      throw new Error('Review action is required');
    }

    const dispute = await Dispute.findById(disputeId).populate('userId', 'name email');
    if (!dispute) {
      res.status(404);
      throw new Error('Dispute not found');
    }

    const customerEmail = dispute.userId ? dispute.userId.email : 'customer@example.com';
    const customerName = dispute.userId ? dispute.userId.name : 'Valued Customer';

    // Log the review action
    const logEntry = await AutomationLog.create({
      disputeId,
      action: 'HUMAN_REVIEW_DECISION',
      status: 'SUCCESS',
      message: `Admin manually reviewed dispute. Action: ${action}. Admin notes: ${feedback || 'None'}`
    });

    if (action === 'APPROVE') {
      // Find associated payment
      const payment = await Payment.findOne({ orderId: dispute.orderId, status: { $ne: 'REFUNDED' } });
      
      if (!payment) {
        res.status(400);
        throw new Error('No active payment transaction found for this order, or it is already fully refunded');
      }

      // Execute refund
      const refundResult = await paymentService.refundPayment(payment.transactionId);
      
      if (refundResult.success) {
        dispute.status = 'RESOLVED';
        dispute.resolutionDetails = {
          action: 'MANUAL_REFUND_APPROVED',
          amount: payment.amount,
          refundedPaymentId: payment.transactionId,
          message: feedback || 'Your refund request has been manually approved and processed by our support team.'
        };
        dispute.requiresHumanReview = false;
        await dispute.save();

        await AutomationLog.create({
          disputeId,
          action: 'MANUAL_REFUND_COMPLETED',
          status: 'SUCCESS',
          message: `Manual refund processed for ₹${payment.amount}. Transaction: ${payment.transactionId}`
        });

        // Send email
        await emailService.sendRefundEmail(customerEmail, customerName, dispute.orderId, payment.amount, payment.transactionId);
      } else {
        res.status(500);
        throw new Error('Refund transaction failed at the payment gateway');
      }
    } else if (action === 'REJECT') {
      dispute.status = 'REJECTED';
      dispute.resolutionDetails = {
        action: 'MANUAL_REJECTED',
        amount: 0,
        message: feedback || 'Your dispute has been manually reviewed and declined by our support team.'
      };
      dispute.requiresHumanReview = false;
      await dispute.save();

      await emailService.sendResolutionEmail(customerEmail, customerName, dispute.orderId, dispute.category, dispute.resolutionDetails.message);
    } else if (action === 'REQUEST_INFO') {
      dispute.status = 'MORE_INFO_REQUIRED';
      dispute.resolutionDetails = {
        action: 'MANUAL_REQUEST_MORE_INFO',
        amount: 0,
        message: feedback || 'Our support team requires more information regarding this claim.'
      };
      await dispute.save();

      await emailService.sendAdditionalEvidenceEmail(customerEmail, customerName, dispute.orderId, feedback || 'Please provide additional photos or details.');
    } else {
      res.status(400);
      throw new Error(`Invalid manual action: ${action}`);
    }

    res.status(200).json(dispute);
  } catch (error) {
    next(error);
  }
};

export const createProduct = async (req, res, next) => {
  try {
    const { name, description, price, stock, category } = req.body;
    
    let imageUrl = '/images/products/placeholder.jpg';
    if (req.file) {
      imageUrl = await storageService.uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype);
    } else {
      // Default emoji placeholder base on category
      const lowerCat = (category || '').toLowerCase();
      if (lowerCat.includes('accessories')) {
        imageUrl = '💼'; // Emoji indicator
      } else {
        imageUrl = '📦';
      }
    }

    const product = await Product.create({
      name,
      description,
      price: parseFloat(price || '0'),
      stock: parseInt(stock || '0', 10),
      category: category || 'General',
      image: imageUrl
    });

    console.log(`[ADMIN INVENTORY] Created Product: ${product.name} (${product._id})`);
    res.status(201).json(product);
  } catch (error) {
    next(error);
  }
};

export const updateProduct = async (req, res, next) => {
  try {
    const { name, description, price, stock, category } = req.body;
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      res.status(404);
      throw new Error('Product not found');
    }

    if (name !== undefined) product.name = name;
    if (description !== undefined) product.description = description;
    if (price !== undefined) product.price = parseFloat(price || '0');
    if (stock !== undefined) product.stock = parseInt(stock || '0', 10);
    if (category !== undefined) product.category = category;

    if (req.file) {
      product.image = await storageService.uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype);
    }

    await product.save();
    console.log(`[ADMIN INVENTORY] Updated Product: ${product.name} (${product._id})`);
    res.status(200).json(product);
  } catch (error) {
    next(error);
  }
};

export const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      res.status(404);
      throw new Error('Product not found');
    }
    console.log(`[ADMIN INVENTORY] Deleted Product: ${product.name} (${product._id})`);
    res.status(200).json({ message: 'Product successfully deleted', id: req.params.id });
  } catch (error) {
    next(error);
  }
};
