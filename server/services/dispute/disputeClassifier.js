import { aiService } from '../ai/aiService.js';

class DisputeClassifier {
  /**
   * Classify dispute text using Gemini AI with backend JSON validation
   * @param {string} text Dispute description text
   * @returns {Promise<Object>} Cleaned and validated AI classification
   */
  async classify(text) {
    try {
      const classification = await aiService.classifyDispute(text);
      
      // Validate classification output structure
      const validCategories = [
        'DAMAGED_PRODUCT',
        'PAYMENT_DISPUTE',
        'DOUBLE_CHARGE',
        'REFUND_NOT_RECEIVED',
        'REFUND_REQUEST',
        'OTHER'
      ];

      const category = validCategories.includes(classification.category) 
        ? classification.category 
        : 'OTHER';
        
      const confidence = typeof classification.confidence === 'number' 
        ? classification.confidence 
        : 0.5;

      const requiresHuman = typeof classification.requires_human === 'boolean'
        ? classification.requires_human
        : (classification.requiresHuman !== undefined ? classification.requiresHuman : true);

      return {
        category,
        confidence,
        reasoningSummary: classification.reasoning_summary || classification.reasoningSummary || 'No reasoning summary provided by AI classifier.',
        requestedAction: classification.requested_action || classification.requestedAction || 'HUMAN_REVIEW',
        requiresHuman: requiresHuman || confidence < 0.7 // Escalate to human if AI confidence is low
      };
    } catch (error) {
      console.error(`[CLASSIFIER ERROR] AI Classification failed, using fallback: ${error.message}`);
      return {
        category: 'OTHER',
        confidence: 0.0,
        reasoningSummary: `AI classification failed with error: ${error.message}`,
        requestedAction: 'HUMAN_REVIEW',
        requiresHuman: true
      };
    }
  }
}

export const disputeClassifier = new DisputeClassifier();
export default disputeClassifier;
