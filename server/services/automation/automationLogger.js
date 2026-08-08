import { AutomationLog } from '../../models/AutomationLog.js';

class AutomationLogger {
  /**
   * Log an automation event
   * @param {string} disputeId 
   * @param {string} action E.g., REQUEST_RECEIVED, AI_CLASSIFIED, POLICY_CHECKED, etc.
   * @param {string} status SUCCESS | FAILED | INFO
   * @param {string} message Description of the step
   * @param {Object} metadata Optional JSON metadata
   */
  async log(disputeId, action, status, message, metadata = null) {
    try {
      const logEntry = await AutomationLog.create({
        disputeId,
        action,
        status,
        message,
        metadata
      });
      console.log(`[AUTOMATION LOG] [${status}] ${action}: ${message}`);
      return logEntry;
    } catch (error) {
      console.error(`[AUTOMATION LOGGER ERROR] Failed to write automation log: ${error.message}`);
    }
  }
}

export const automationLogger = new AutomationLogger();
export default automationLogger;
