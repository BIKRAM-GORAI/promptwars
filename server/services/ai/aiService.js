import { geminiService } from './geminiService.js';
import { env } from '../../config/env.js';

class AIService {
  async classifyDispute(text) {
    if (env.geminiApiKey) {
      try {
        return await geminiService.classifyDispute(text);
      } catch (error) {
        console.error(`[AI SERVICE ERROR] Gemini classification failed: ${error.message}`);
        return this.getMockClassification(text);
      }
    } else {
      console.warn('[AI SERVICE INFO] Running mock dispute classification (Missing GEMINI_API_KEY)');
      return this.getMockClassification(text);
    }
  }

  async analyzeDamageImage(fileBuffer, mimeType, expectedProductName = null) {
    if (env.geminiApiKey) {
      try {
        return await geminiService.analyzeDamageImage(fileBuffer, mimeType, expectedProductName);
      } catch (error) {
        console.error(`[AI SERVICE ERROR] Gemini image analysis failed: ${error.message}`);
        return this.getMockImageAnalysis();
      }
    } else {
      console.warn('[AI SERVICE INFO] Running mock image analysis (Missing GEMINI_API_KEY)');
      return this.getMockImageAnalysis();
    }
  }

  getMockClassification(text) {
    const lowercase = text.toLowerCase();
    let category = 'OTHER';
    let requestedAction = 'HUMAN_REVIEW';
    let reasoning = 'AI classified query in offline/mock mode.';
    let requiresHuman = true;
    let confidence = 0.90;

    if (lowercase.includes('twice') || lowercase.includes('double charge') || lowercase.includes('charged twice') || lowercase.includes('duplicate payment')) {
      category = 'DOUBLE_CHARGE';
      requestedAction = 'REFUND_DUPLICATE';
      reasoning = 'Customer reports being charged twice for the same order.';
      requiresHuman = false;
    } else if (lowercase.includes('paid but my order wasn\'t created') || lowercase.includes('order wasn\'t created') || lowercase.includes('paid but no order') || lowercase.includes('payment dispute')) {
      category = 'PAYMENT_DISPUTE';
      requestedAction = 'INVESTIGATE_PAYMENT';
      reasoning = 'Customer paid for an order but the order creation was not verified.';
      requiresHuman = true;
    } else if (lowercase.includes('refund not received') || lowercase.includes('haven\'t received my refund') || lowercase.includes('returned my order but no refund')) {
      category = 'REFUND_NOT_RECEIVED';
      requestedAction = 'CHECK_REFUND_STATUS';
      reasoning = 'Customer claims they returned the item but haven\'t received their refund.';
      requiresHuman = false;
    } else if (lowercase.includes('want a refund') || lowercase.includes('request a refund') || lowercase.includes('refund request')) {
      category = 'REFUND_REQUEST';
      requestedAction = 'REFUND_ORDER';
      reasoning = 'Customer is requesting a refund for their order.';
      requiresHuman = false;
    } else if (lowercase.includes('damaged') || lowercase.includes('broken') || lowercase.includes('defective') || lowercase.includes('crack')) {
      category = 'DAMAGED_PRODUCT';
      requestedAction = 'REPLACE_OR_REFUND';
      reasoning = 'Customer claims the product was received damaged.';
      requiresHuman = false;
    }

    return {
      category,
      confidence,
      reasoning_summary: reasoning,
      requested_action: requestedAction,
      requires_human: requiresHuman
    };
  }

  getMockImageAnalysis() {
    return {
      damage_detected: true,
      damage_type: 'physical_damage',
      evidence_quality: 'good',
      confidence: 0.95
    };
  }
}

export const aiService = new AIService();
