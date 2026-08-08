import { Dispute } from '../models/Dispute.js';
import { AutomationLog } from '../models/AutomationLog.js';
import { disputeResolver } from '../services/dispute/disputeResolver.js';
import { storageService } from '../services/storage/storageService.js';

export const createDispute = async (req, res, next) => {
  try {
    const { orderId, description, category, productId } = req.body;

    if (!description) {
      res.status(400);
      throw new Error('Dispute description is required');
    }

    // Prevent duplicate disputes on the same product inside an order
    const targetProductId = (productId && productId !== 'ALL' && productId !== '') ? productId : null;
    if (orderId) {
      const existingDispute = await Dispute.findOne({
        orderId,
        productId: targetProductId,
        userId: req.user._id,
        status: { $in: ['PENDING', 'RESOLVED', 'HUMAN_REVIEW_REQUIRED', 'MORE_INFO_REQUIRED'] }
      });

      if (existingDispute) {
        res.status(400);
        if (existingDispute.status === 'RESOLVED') {
          throw new Error('A refund has already been resolved and processed for this product claim.');
        }
        const statusMsg = existingDispute.status.toLowerCase().replace(/_/g, ' ');
        throw new Error(`A dispute claim for this product is already ${statusMsg}.`);
      }
    }

    let evidenceUrl = null;
    
    // Check if evidence image file is uploaded via multer
    if (req.file) {
      console.log(`[DISPUTE] Uploaded file received: ${req.file.originalname}`);
      evidenceUrl = await storageService.uploadFile(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );
    }

    // Default category to OTHER if not provided; AI classifier will verify
    const disputeCategory = category || 'OTHER';

    const dispute = await Dispute.create({
      orderId: orderId || null,
      productId: (productId && productId !== 'ALL' && productId !== '') ? productId : null,
      userId: req.user._id,
      category: disputeCategory,
      description,
      evidenceUrl,
      status: 'PENDING'
    });

    console.log(`[DISPUTE] Created Dispute ${dispute._id} for customer ${req.user.name}`);

    // Trigger autonomous resolution engine asynchronously to support real-time frontend timeline polling
    disputeResolver.resolve(dispute._id).catch(err => {
      console.error(`[RESOLVER ASYNC ERROR] Dispute ${dispute._id} failed: ${err.message}`);
    });

    res.status(201).json(dispute);
  } catch (error) {
    next(error);
  }
};

export const getDisputes = async (req, res, next) => {
  try {
    const disputes = await Dispute.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json(disputes);
  } catch (error) {
    next(error);
  }
};

export const getDisputeById = async (req, res, next) => {
  try {
    const dispute = await Dispute.findById(req.params.id)
      .populate('userId', 'name email')
      .populate('productId', 'name price image');
      
    if (!dispute) {
      res.status(404);
      throw new Error('Dispute not found');
    }

    // Verify ownership (checking both populated and raw mongoose ID cases)
    const disputeOwnerId = dispute.userId._id ? dispute.userId._id.toString() : dispute.userId.toString();
    if (disputeOwnerId !== req.user._id.toString() && req.user.role !== 'ADMIN') {
      res.status(403);
      throw new Error('Access denied. Dispute belongs to another user.');
    }

    // Fetch automation logs timeline
    const logs = await AutomationLog.find({ disputeId: dispute._id }).sort({ timestamp: 1 });

    res.status(200).json({
      dispute,
      logs
    });
  } catch (error) {
    next(error);
  }
};

export const resolveDispute = async (req, res, next) => {
  try {
    const resolved = await disputeResolver.resolve(req.params.id);
    res.status(200).json(resolved);
  } catch (error) {
    next(error);
  }
};
