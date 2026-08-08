import { genAI } from '../../config/ai.js';
import { env } from '../../config/env.js';

class GeminiService {
  async classifyDispute(text) {
    if (!genAI) {
      throw new Error('Gemini API client not initialized');
    }

    const modelName = env.geminiModel || 'gemini-2.0-flash-lite';
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: 'application/json' }
    });

    const prompt = `
      You are an expert customer dispute classification agent. 
      Analyze the customer dispute text and classify it into one of these categories:
      1. DAMAGED_PRODUCT (product received broken, defective, or physically damaged)
      2. PAYMENT_DISPUTE (payment made but order creation failed, incorrect amount charged, general payment issue)
      3. DOUBLE_CHARGE (customer was charged twice for the same order)
      4. REFUND_NOT_RECEIVED (customer returned an item or was promised a refund but has not received it)
      5. REFUND_REQUEST (customer wants a refund for an order they received, return within window)
      6. OTHER (any other query, question, or ambiguous request)

      Return STRICT JSON matching this schema exactly:
      {
        "category": "DAMAGED_PRODUCT" | "PAYMENT_DISPUTE" | "DOUBLE_CHARGE" | "REFUND_NOT_RECEIVED" | "REFUND_REQUEST" | "OTHER",
        "confidence": float (between 0.0 and 1.0),
        "reasoning_summary": "string explaining your classification reasoning",
        "requested_action": "string describing the action needed, e.g., REFUND_DUPLICATE, INVESTIGATE_PAYMENT, REFUND_ORDER, CHECK_REFUND_STATUS, HUMAN_REVIEW",
        "requires_human": boolean
      }

      Customer Dispute: "${text}"
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    console.log(`[AI GEMINI] Raw classification response: ${responseText}`);
    return JSON.parse(responseText);
  }

  async analyzeDamageImage(fileBuffer, mimeType, expectedProductName = null) {
    if (!genAI) {
      throw new Error('Gemini API client not initialized');
    }

    const modelName = env.geminiModel || 'gemini-2.0-flash-lite';
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: 'application/json' }
    });

    let productContext = "";
    if (expectedProductName) {
      productContext = `The customer is claiming damage for this specific product: "${expectedProductName}".
      IMPORTANT: You MUST verify if the product shown in the image matches the expected product: "${expectedProductName}".
      If the image shows a completely different type of product (e.g. they claimed damage on a mouse, but the photo clearly shows a keyboard, or vice versa), you MUST set "damage_detected" to false, "evidence_quality" to "poor", and explain this mismatch in "damage_type" as "product_mismatch".`;
    }

    const prompt = `
      Analyze this product image submitted by a customer claiming their product was delivered damaged.
      Determine if there is clear physical damage visible on the product.
      
      ${productContext}
      
      Return STRICT JSON matching this schema exactly:
      {
        "damage_detected": boolean,
        "damage_type": "physical_damage" | "cosmetic_damage" | "no_damage" | "product_mismatch" | "other",
        "evidence_quality": "good" | "poor" | "unclear",
        "confidence": float (between 0.0 and 1.0)
      }
    `;

    const imagePart = {
      inlineData: {
        data: fileBuffer.toString('base64'),
        mimeType: mimeType
      }
    };

    const result = await model.generateContent([prompt, imagePart]);
    const responseText = result.response.text();
    console.log(`[AI GEMINI] Raw image analysis response: ${responseText}`);
    return JSON.parse(responseText);
  }
}

export const geminiService = new GeminiService();
