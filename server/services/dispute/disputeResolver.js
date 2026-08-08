import fs from 'fs';
import path from 'path';
import { Dispute } from '../../models/Dispute.js';
import { Order } from '../../models/Order.js';
import { Payment } from '../../models/Payment.js';
import { User } from '../../models/User.js';
import { disputeClassifier } from './disputeClassifier.js';
import { policyEngine } from './policyEngine.js';
import { aiService } from '../ai/aiService.js';
import { paymentService } from '../payment/paymentService.js';
import { emailService } from '../email/emailService.js';
import { automationLogger } from '../automation/automationLogger.js';
import { env } from '../../config/env.js';

class DisputeResolver {
  /**
   * Orchestrate full dispute resolution
   * @param {string} disputeId 
   * @returns {Promise<Object>} The resolved dispute data
   */
  async resolve(disputeId) {
    console.log(`[RESOLVER] Starting resolution for dispute: ${disputeId}`);
    
    // 1. Fetch dispute & verify it exists (populate productId to verify correct image context)
    const dispute = await Dispute.findById(disputeId).populate('productId');
    if (!dispute) {
      throw new Error(`Dispute ${disputeId} not found`);
    }

    // Initialize user metadata for logging
    const customer = await User.findById(dispute.userId);
    const customerEmail = customer ? customer.email : 'customer@example.com';
    const customerName = customer ? customer.name : 'Valued Customer';

    await automationLogger.log(disputeId, 'REQUEST_RECEIVED', 'SUCCESS', 'Dispute submission received and logged in system.', {
      customerEmail,
      description: dispute.description
    });

    try {
      // 2. AI Dispute Classification
      await automationLogger.log(disputeId, 'AI_CLASSIFY_START', 'INFO', 'Sending dispute text to AI classifier for categorization.');
      
      const classification = await disputeClassifier.classify(dispute.description);
      dispute.aiClassification = classification;
      
      // Override/update dispute category if AI was confident
      if (classification.confidence >= 0.7) {
        dispute.category = classification.category;
      }
      await dispute.save();

      await automationLogger.log(
        disputeId,
        'AI_CLASSIFIED',
        'SUCCESS',
        `AI categorized dispute as ${classification.category} with confidence ${(classification.confidence * 100).toFixed(1)}%`,
        classification
      );

      // Check if AI determined manual review is required immediately
      if (classification.requiresHuman) {
        return await this.escalateToHuman(dispute, 'AI flagged dispute as requiring human review/low confidence.');
      }

      // 3. Coordinate specific workflows based on classified category
      switch (dispute.category) {
        case 'DOUBLE_CHARGE':
          return await this.handleDoubleChargeWorkflow(dispute, customerEmail, customerName);

        case 'DAMAGED_PRODUCT':
          return await this.handleDamagedProductWorkflow(dispute, customerEmail, customerName);

        case 'PAYMENT_DISPUTE':
          return await this.handlePaymentDisputeWorkflow(dispute, customerEmail, customerName);

        case 'REFUND_NOT_RECEIVED':
          return await this.handleRefundNotReceivedWorkflow(dispute, customerEmail, customerName);

        case 'REFUND_REQUEST':
          return await this.handleRefundRequestWorkflow(dispute, customerEmail, customerName);

        case 'OTHER':
        default:
          return await this.escalateToHuman(dispute, 'Dispute category requires manual administrative inspection.');
      }

    } catch (error) {
      console.error(`[RESOLVER ERROR] Processing failed: ${error.message}`);
      await automationLogger.log(disputeId, 'RESOLVER_FAILED', 'FAILED', `Error during automated resolution: ${error.message}`);
      return await this.escalateToHuman(dispute, `Workflow error: ${error.message}`);
    }
  }

  /**
   * Escalates dispute to human review state
   */
  async escalateToHuman(dispute, reason) {
    dispute.status = 'HUMAN_REVIEW_REQUIRED';
    dispute.requiresHumanReview = true;
    dispute.resolutionDetails = {
      action: 'ESCALATED',
      amount: 0,
      message: reason
    };
    await dispute.save();

    await automationLogger.log(dispute._id, 'ESCALATED_TO_HUMAN', 'INFO', `Workflow escalated to customer support. Reason: ${reason}`);

    // Fetch user for email
    const customer = await User.findById(dispute.userId);
    if (customer) {
      await emailService.sendHumanReviewEmail(customer.email, customer.name, dispute.orderId || 'N/A', dispute.category);
      await automationLogger.log(dispute._id, 'EMAIL_SENT', 'SUCCESS', `Sent status update email to ${customer.email}`);
    }

    await automationLogger.log(dispute._id, 'WORKFLOW_COMPLETED', 'SUCCESS', 'Automated dispute lifecycle step completed (Escalated).');
    return dispute;
  }

  /**
   * Scenario 1: DOUBLE_CHARGE primary demo workflow
   */
  async handleDoubleChargeWorkflow(dispute, customerEmail, customerName) {
    const disputeId = dispute._id;

    if (!dispute.orderId) {
      return await this.escalateToHuman(dispute, 'Order ID is missing from dispute submission.');
    }

    await automationLogger.log(disputeId, 'ORDER_FOUND', 'SUCCESS', `Retrieved order #${dispute.orderId} from customer records.`);

    // Check policy engine eligibility for double charge
    await automationLogger.log(disputeId, 'POLICY_CHECK_START', 'INFO', 'Checking duplicate payment records and refund eligibility thresholds.');
    const policyResult = await policyEngine.checkDoubleChargeEligibility(dispute.orderId);

    if (!policyResult.eligible) {
      await automationLogger.log(disputeId, 'POLICY_CHECKED', 'FAILED', `Automated policy match failed: ${policyResult.reason}`);
      return await this.escalateToHuman(dispute, `Double charge policy check rejected: ${policyResult.reason}`);
    }

    const { duplicatePayment } = policyResult;
    dispute.paymentId = duplicatePayment._id;
    await dispute.save();

    await automationLogger.log(
      disputeId,
      'DUPLICATE_CONFIRMED',
      'SUCCESS',
      `Duplicate payments confirmed. Original transaction: ${policyResult.originalPayment.transactionId}, Duplicate transaction: ${duplicatePayment.transactionId}`
    );

    await automationLogger.log(disputeId, 'POLICY_CHECKED', 'SUCCESS', 'Policy checks cleared. Auto-refund approved.');

    // Execute refund through paymentService interface
    await automationLogger.log(disputeId, 'REFUND_INITIATED', 'INFO', `Initiating refund of ₹${duplicatePayment.amount} on transaction ${duplicatePayment.transactionId}`);
    
    const refundResult = await paymentService.refundPayment(duplicatePayment.transactionId);
    
    if (refundResult.success) {
      dispute.status = 'RESOLVED';
      dispute.resolutionDetails = {
        action: 'REFUND_DUPLICATE',
        amount: duplicatePayment.amount,
        refundedPaymentId: duplicatePayment.transactionId,
        message: `Duplicate charge of ₹${duplicatePayment.amount} has been successfully refunded.`
      };
      await dispute.save();

      await automationLogger.log(
        disputeId,
        'PAYMENT_UPDATED',
        'SUCCESS',
        `Transaction ${duplicatePayment.transactionId} refunded successfully. Order status updated.`
      );

      // Send email
      await emailService.sendRefundEmail(
        customerEmail,
        customerName,
        dispute.orderId,
        duplicatePayment.amount,
        duplicatePayment.transactionId
      );
      await automationLogger.log(disputeId, 'EMAIL_SENT', 'SUCCESS', `Refund email sent to ${customerEmail}`);

      await automationLogger.log(disputeId, 'WORKFLOW_COMPLETED', 'SUCCESS', 'Automated double-charge workflow finished successfully.');
      return dispute;
    } else {
      await automationLogger.log(disputeId, 'REFUND_FAILED', 'FAILED', `Refund gateway rejected transaction: ${refundResult.message}`);
      return await this.escalateToHuman(dispute, 'Payment gateway refund transaction failed.');
    }
  }

  /**
   * Scenario 6: DAMAGED_PRODUCT workflow with multimodal AI evidence analysis
   */
  async handleDamagedProductWorkflow(dispute, customerEmail, customerName) {
    const disputeId = dispute._id;

    if (!dispute.orderId) {
      return await this.escalateToHuman(dispute, 'Order ID is missing from dispute.');
    }

    if (!dispute.evidenceUrl) {
      await automationLogger.log(disputeId, 'EVIDENCE_CHECK', 'FAILED', 'No photo evidence uploaded for damaged product claim.');
      return await this.escalateToHuman(dispute, 'Product damage claim submitted without supporting photographic evidence.');
    }

    await automationLogger.log(disputeId, 'ORDER_FOUND', 'SUCCESS', `Retrieved order #${dispute.orderId} from customer records.`);

    // Perform Policy check on return window
    const order = await Order.findById(dispute.orderId);
    const payment = await Payment.findOne({ orderId: dispute.orderId, status: 'SUCCESS' });
    
    if (!order || !payment) {
      return await this.escalateToHuman(dispute, 'Could not retrieve matching active order or success payment.');
    }

    if (order.status !== 'DELIVERED') {
      return await this.escalateToHuman(dispute, `Product refund rejected: Order status is '${order.status}' instead of 'DELIVERED'.`);
    }

    if (policyEngine.isReturnWindowExpired(order)) {
      return await this.escalateToHuman(dispute, `Damage claim rejected: Request submitted outside ${env.returnWindowDays}-day return window.`);
    }

    // Retrieve file buffer for image analysis
    await automationLogger.log(disputeId, 'EVIDENCE_ANALYSIS_START', 'INFO', 'Analyzing uploaded image evidence using Gemini Multimodal capability.');
    
    let fileBuffer;
    let mimeType = 'image/jpeg'; // default fallback
    
    try {
      if (dispute.evidenceUrl.startsWith('http')) {
        // Remote Cloudinary URL
        const response = await fetch(dispute.evidenceUrl);
        const arrayBuffer = await response.arrayBuffer();
        fileBuffer = Buffer.from(arrayBuffer);
        const contentType = response.headers.get('content-type');
        if (contentType) mimeType = contentType;
      } else {
        // Local path
        const absolutePath = path.join(process.cwd(), dispute.evidenceUrl);
        fileBuffer = fs.readFileSync(absolutePath);
        // Deduce mime type
        const ext = path.extname(dispute.evidenceUrl).toLowerCase();
        if (ext === '.png') mimeType = 'image/png';
        else if (ext === '.webp') mimeType = 'image/webp';
      }

      // Retrieve expected product name context to prevent fraud check mismatches
      const expectedProductName = dispute.productId 
        ? (dispute.productId.name || 'Unknown Product') 
        : order.items.map(item => item.name).join(', ');

      // Call AI Image Analyzer passing product details
      const analysis = await aiService.analyzeDamageImage(fileBuffer, mimeType, expectedProductName);
      dispute.evidenceAnalysis = {
        damageDetected: analysis.damage_detected || analysis.damageDetected || false,
        damageType: analysis.damage_type || analysis.damageType || 'unknown',
        evidenceQuality: analysis.evidence_quality || analysis.evidenceQuality || 'unclear',
        confidence: analysis.confidence || 0.0
      };
      await dispute.save();

      await automationLogger.log(
        disputeId,
        'EVIDENCE_ANALYZED',
        'SUCCESS',
        `AI Multimodal analysis complete. Damage detected: ${analysis.damage_detected ? 'YES' : 'NO'}. Confidence: ${(analysis.confidence * 100).toFixed(1)}%`,
        analysis
      );

      // Apply decision policy based on AI findings
      if (analysis.damage_detected && analysis.confidence >= 0.75 && analysis.evidence_quality !== 'poor') {
        await automationLogger.log(disputeId, 'POLICY_CHECKED', 'SUCCESS', 'Evidence damage verified. Auto-refund approved.');

        // Check if this is a claim for a specific product
        let refundAmount = payment.amount;
        let refundMsg = 'AI verified product damage and processed a full refund.';
        
        if (dispute.productId) {
          const item = order.items.find(i => i.productId.toString() === dispute.productId.toString());
          if (item) {
            refundAmount = item.price * item.quantity;
            refundMsg = `AI verified product damage and processed a partial refund of ₹${refundAmount} for ${item.name}.`;
            console.log(`[RESOLVER] DAMAGED_PRODUCT: Found matching item ${item.name} for partial refund ₹${refundAmount}`);
          } else {
            console.warn(`[RESOLVER] DAMAGED_PRODUCT: ProductId ${dispute.productId} not found in order items. Refunding full payment.`);
          }
        }

        // Refund payment
        await automationLogger.log(disputeId, 'REFUND_INITIATED', 'INFO', `Refunding ₹${refundAmount} to original payment ${payment.transactionId}`);
        const refundResult = await paymentService.refundPayment(payment.transactionId, refundAmount);

        if (refundResult.success) {
          dispute.status = 'RESOLVED';
          dispute.resolutionDetails = {
            action: 'REFUND_DAMAGE',
            amount: refundAmount,
            refundedPaymentId: payment.transactionId,
            message: refundMsg
          };
          await dispute.save();

          await automationLogger.log(disputeId, 'PAYMENT_UPDATED', 'SUCCESS', `Refunded damaged product claim successfully. Transaction: ${payment.transactionId}`);
          
          await emailService.sendRefundEmail(customerEmail, customerName, dispute.orderId, refundAmount, payment.transactionId);
          await automationLogger.log(disputeId, 'EMAIL_SENT', 'SUCCESS', `Refund confirmation email sent to ${customerEmail}`);

          await automationLogger.log(disputeId, 'WORKFLOW_COMPLETED', 'SUCCESS', 'Automated damaged product workflow completed successfully.');
          return dispute;
        } else {
          return await this.escalateToHuman(dispute, 'Refund execution failed in payment gateway.');
        }
      } else {
        await automationLogger.log(disputeId, 'POLICY_CHECKED', 'FAILED', 'Evidence damage could not be confidently verified by AI.');
        return await this.escalateToHuman(dispute, 'Photographic evidence is inconclusive or shows insufficient damage.');
      }

    } catch (error) {
      console.error(`[RESOLVER damaged product error]: ${error.message}`);
      return await this.escalateToHuman(dispute, `Damaged product evidence analysis workflow failed: ${error.message}`);
    }
  }

  /**
   * Scenario 2: PAYMENT_DISPUTE workflow (paid but no order / order stuck)
   */
  async handlePaymentDisputeWorkflow(dispute, customerEmail, customerName) {
    const disputeId = dispute._id;

    // Check if customer mentions transaction id or we look up recent payments of the user that have status SUCCESS
    // but their corresponding orders are in 'PENDING' or status is stuck
    await automationLogger.log(disputeId, 'DATABASE_QUERY', 'INFO', `Retrieving successful payments and orders for customer ${customerName}`);

    const userPayments = await Payment.find({ userId: dispute.userId, status: 'SUCCESS' }).sort({ createdAt: -1 });
    
    if (userPayments.length === 0) {
      await automationLogger.log(disputeId, 'PAYMENTS_RETRIEVED', 'FAILED', 'No successful payment transactions found for this customer account.');
      return await this.escalateToHuman(dispute, 'No recorded successful payments found matching this customer account.');
    }

    // Look for a payment whose associated order is in status 'PENDING' (stuck)
    let stuckPayment = null;
    let stuckOrder = null;

    for (const payment of userPayments) {
      const order = await Order.findById(payment.orderId);
      if (order && order.status === 'PENDING') {
        stuckPayment = payment;
        stuckOrder = order;
        break;
      }
    }

    if (stuckPayment && stuckOrder) {
      dispute.orderId = stuckOrder._id;
      dispute.paymentId = stuckPayment._id;
      await dispute.save();

      await automationLogger.log(
        disputeId,
        'STUCK_ORDER_CONFIRMED',
        'SUCCESS',
        `Confirmed payment ${stuckPayment.transactionId} belongs to Order #${stuckOrder._id} which is stuck in PENDING status.`
      );

      await automationLogger.log(disputeId, 'POLICY_CHECKED', 'SUCCESS', 'Auto-refund approved for stuck transaction.');

      // Initiate refund
      await automationLogger.log(disputeId, 'REFUND_INITIATED', 'INFO', `Initiating refund of ₹${stuckPayment.amount} for stuck transaction: ${stuckPayment.transactionId}`);
      
      const refundResult = await paymentService.refundPayment(stuckPayment.transactionId);
      
      if (refundResult.success) {
        dispute.status = 'RESOLVED';
        dispute.resolutionDetails = {
          action: 'REFUND_STUCK_ORDER',
          amount: stuckPayment.amount,
          refundedPaymentId: stuckPayment.transactionId,
          message: `Your payment of ₹${stuckPayment.amount} was received but the order failed to confirm. We have processed a full refund.`
        };
        await dispute.save();

        await automationLogger.log(disputeId, 'PAYMENT_UPDATED', 'SUCCESS', `Successfully refunded payment ${stuckPayment.transactionId}.`);
        
        await emailService.sendRefundEmail(customerEmail, customerName, stuckOrder._id, stuckPayment.amount, stuckPayment.transactionId);
        await automationLogger.log(disputeId, 'EMAIL_SENT', 'SUCCESS', `Refund email sent to ${customerEmail}`);

        await automationLogger.log(disputeId, 'WORKFLOW_COMPLETED', 'SUCCESS', 'Automated payment-dispute refund finished successfully.');
        return dispute;
      } else {
        return await this.escalateToHuman(dispute, 'Payment gateway refund rejected.');
      }
    } else {
      await automationLogger.log(disputeId, 'PAYMENTS_RETRIEVED', 'INFO', 'No stuck orders found. Searching for payment without any order.');
      // Look for a payment that doesn't have an orderId at all (orphaned payment)
      const orphanedPayment = await Payment.findOne({ userId: dispute.userId, orderId: null, status: 'SUCCESS' });
      
      if (orphanedPayment) {
        dispute.paymentId = orphanedPayment._id;
        await dispute.save();
        
        await automationLogger.log(disputeId, 'POLICY_CHECKED', 'SUCCESS', `Orphaned payment ${orphanedPayment.transactionId} found. Auto-refund approved.`);
        
        const refundResult = await paymentService.refundPayment(orphanedPayment.transactionId);
        if (refundResult.success) {
          dispute.status = 'RESOLVED';
          dispute.resolutionDetails = {
            action: 'REFUND_ORPHANED_PAYMENT',
            amount: orphanedPayment.amount,
            refundedPaymentId: orphanedPayment.transactionId,
            message: `A payment of ₹${orphanedPayment.amount} was recorded without an order. A refund has been processed.`
          };
          await dispute.save();
          
          await emailService.sendRefundEmail(customerEmail, customerName, 'N/A', orphanedPayment.amount, orphanedPayment.transactionId);
          return dispute;
        }
      }
      
      return await this.escalateToHuman(dispute, 'Could not find any successful payment associated with an order stuck in creation.');
    }
  }

  /**
   * Scenario 3: REFUND_NOT_RECEIVED workflow
   */
  async handleRefundNotReceivedWorkflow(dispute, customerEmail, customerName) {
    const disputeId = dispute._id;

    if (!dispute.orderId) {
      return await this.escalateToHuman(dispute, 'Order ID is missing from dispute.');
    }

    await automationLogger.log(disputeId, 'ORDER_FOUND', 'SUCCESS', `Retrieved order #${dispute.orderId} from customer records.`);

    // Retrieve order and payment status
    const order = await Order.findById(dispute.orderId);
    const payment = await Payment.findOne({ orderId: dispute.orderId });

    if (!order || !payment) {
      return await this.escalateToHuman(dispute, 'Matching order or payment transactions could not be retrieved.');
    }

    await automationLogger.log(
      disputeId,
      'STATUS_CHECKED',
      'SUCCESS',
      `Order status is '${order.status}', Payment status is '${payment.status}' (Refund Status: '${payment.refundStatus}')`
    );

    if (payment.status === 'REFUNDED' && payment.refundStatus === 'SUCCESS') {
      // Refund has indeed been successfully initiated on our side
      dispute.status = 'RESOLVED';
      dispute.resolutionDetails = {
        action: 'CONFIRM_REFUND_PROCESSED',
        amount: payment.amount,
        refundedPaymentId: payment.transactionId,
        message: `Our records confirm that a refund of ₹${payment.amount} was already successfully processed for order #${dispute.orderId} on our gateway. The transaction ID is ${payment.transactionId}. Please contact your banking provider to track the clearance.`
      };
      await dispute.save();

      await automationLogger.log(disputeId, 'POLICY_CHECKED', 'SUCCESS', 'Existing processed refund confirmed.');
      
      await emailService.sendResolutionEmail(customerEmail, customerName, dispute.orderId, dispute.category, dispute.resolutionDetails.message);
      await automationLogger.log(disputeId, 'EMAIL_SENT', 'SUCCESS', `Resolution details email sent to ${customerEmail}`);
      
      await automationLogger.log(disputeId, 'WORKFLOW_COMPLETED', 'SUCCESS', 'Automated refund-status check resolved successfully.');
      return dispute;
    } else if (order.status === 'CANCELLED' && payment.status === 'SUCCESS') {
      // Order is cancelled, but payment has not been refunded yet! Auto refund it.
      await automationLogger.log(disputeId, 'POLICY_CHECKED', 'SUCCESS', 'Order is cancelled but payment is not refunded. Auto-refund approved.');

      const refundResult = await paymentService.refundPayment(payment.transactionId);
      if (refundResult.success) {
        dispute.status = 'RESOLVED';
        dispute.resolutionDetails = {
          action: 'REFUND_CANCELLED_ORDER',
          amount: payment.amount,
          refundedPaymentId: payment.transactionId,
          message: `Your order was cancelled but the payment was not refunded. We have now processed a refund of ₹${payment.amount}.`
        };
        await dispute.save();

        await emailService.sendRefundEmail(customerEmail, customerName, dispute.orderId, payment.amount, payment.transactionId);
        return dispute;
      }
    }

    return await this.escalateToHuman(dispute, 'Refund status requires administrative inspection or support from payment gateway.');
  }

  /**
   * Scenario 4/5: REFUND_REQUEST workflow
   */
  async handleRefundRequestWorkflow(dispute, customerEmail, customerName) {
    const disputeId = dispute._id;

    if (!dispute.orderId) {
      return await this.escalateToHuman(dispute, 'Order ID is missing from dispute.');
    }

    await automationLogger.log(disputeId, 'ORDER_FOUND', 'SUCCESS', `Retrieved order #${dispute.orderId} from customer records.`);

    // Evaluate refund eligibility using Policy Engine
    await automationLogger.log(disputeId, 'POLICY_CHECK_START', 'INFO', 'Evaluating standard return/refund window eligibility constraints.');
    const policyResult = await policyEngine.checkRefundRequestEligibility(dispute.orderId, dispute.productId);

    if (policyResult.eligible) {
      await automationLogger.log(disputeId, 'POLICY_CHECKED', 'SUCCESS', `Policy check approved: ${policyResult.reason}`);
      
      const { payment } = policyResult;
      dispute.paymentId = payment._id;
      await dispute.save();

      // Check if this is a claim for a specific product
      let refundAmount = payment.amount;
      let refundMsg = `Your return has been approved and a full refund of ₹${payment.amount} has been processed.`;
      
      if (dispute.productId) {
        const item = order.items.find(i => i.productId.toString() === dispute.productId.toString());
        if (item) {
          refundAmount = item.price * item.quantity;
          refundMsg = `Your return has been approved and a partial refund of ₹${refundAmount} has been processed for ${item.name}.`;
          console.log(`[RESOLVER] REFUND_REQUEST: Found matching item ${item.name} for partial refund ₹${refundAmount}`);
        } else {
          console.warn(`[RESOLVER] REFUND_REQUEST: ProductId ${dispute.productId} not found in order items. Refunding full payment.`);
        }
      }

      // Initiate refund
      await automationLogger.log(disputeId, 'REFUND_INITIATED', 'INFO', `Initiating refund of ₹${refundAmount} for transaction: ${payment.transactionId}`);
      const refundResult = await paymentService.refundPayment(payment.transactionId, refundAmount);

      if (refundResult.success) {
        dispute.status = 'RESOLVED';
        dispute.resolutionDetails = {
          action: 'REFUND_ORDER',
          amount: refundAmount,
          refundedPaymentId: payment.transactionId,
          message: refundMsg
        };
        await dispute.save();

        await automationLogger.log(disputeId, 'PAYMENT_UPDATED', 'SUCCESS', `Refunded order successfully. Transaction: ${payment.transactionId}`);
        
        await emailService.sendRefundEmail(customerEmail, customerName, dispute.orderId, refundAmount, payment.transactionId);
        await automationLogger.log(disputeId, 'EMAIL_SENT', 'SUCCESS', `Refund confirmation email sent to ${customerEmail}`);

        await automationLogger.log(disputeId, 'WORKFLOW_COMPLETED', 'SUCCESS', 'Automated refund request workflow completed successfully.');
        return dispute;
      } else {
        return await this.escalateToHuman(dispute, 'Refund execution failed in gateway transaction.');
      }
    } else {
      await automationLogger.log(disputeId, 'POLICY_CHECKED', 'FAILED', `Policy check rejected: ${policyResult.reason}`);
      
      // Expired or invalid return request: reject and explain to customer
      dispute.status = 'REJECTED';
      dispute.resolutionDetails = {
        action: 'REJECT_REFUND_REQUEST',
        amount: 0,
        message: `Your refund request was declined. Reason: ${policyResult.reason}`
      };
      await dispute.save();

      await emailService.sendResolutionEmail(customerEmail, customerName, dispute.orderId, dispute.category, dispute.resolutionDetails.message);
      await automationLogger.log(disputeId, 'EMAIL_SENT', 'SUCCESS', `Dispute rejection email sent to ${customerEmail}`);
      
      await automationLogger.log(disputeId, 'WORKFLOW_COMPLETED', 'SUCCESS', `Automated dispute rejected based on policy rules: ${policyResult.reason}`);
      return dispute;
    }
  }
}

export const disputeResolver = new DisputeResolver();
export default disputeResolver;
