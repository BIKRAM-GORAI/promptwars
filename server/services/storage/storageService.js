import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOADS_DIR = path.join(__dirname, '../../../uploads');

// Ensure local uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Configure Cloudinary if credentials exist and STORAGE_TYPE is 'cloudinary'
let useCloudinary = false;
if (
  env.storageType === 'cloudinary' &&
  env.cloudinary.cloudName &&
  env.cloudinary.apiKey &&
  env.cloudinary.apiSecret
) {
  try {
    cloudinary.config({
      cloud_name: env.cloudinary.cloudName,
      api_key: env.cloudinary.apiKey,
      api_secret: env.cloudinary.apiSecret
    });
    useCloudinary = true;
    console.log('[STORAGE] Cloudinary Storage configured and active');
  } catch (error) {
    console.error(`[STORAGE ERROR] Cloudinary config failed: ${error.message}. Falling back to local storage.`);
  }
} else {
  console.log('[STORAGE] Local Storage active (uploads/ directory)');
}

class StorageService {
  /**
   * Upload a file
   * @param {Buffer} fileBuffer File content buffer
   * @param {string} fileName Original file name
   * @param {string} mimeType File mime type
   * @returns {Promise<string>} Public URL or local file path
   */
  async uploadFile(fileBuffer, fileName, mimeType) {
    if (useCloudinary) {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'resolveai_disputes',
            resource_type: 'auto'
          },
          (error, result) => {
            if (error) {
              console.error(`[STORAGE ERROR] Cloudinary upload failed: ${error.message}`);
              reject(error);
            } else {
              console.log(`[STORAGE] Uploaded to Cloudinary: ${result.secure_url}`);
              resolve(result.secure_url);
            }
          }
        );
        uploadStream.end(fileBuffer);
      });
    } else {
      // Local storage fallback
      const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(fileName)}`;
      const filePath = path.join(UPLOADS_DIR, uniqueName);
      
      await fs.promises.writeFile(filePath, fileBuffer);
      console.log(`[STORAGE] Uploaded locally: /uploads/${uniqueName}`);
      return `/uploads/${uniqueName}`;
    }
  }
}

export const storageService = new StorageService();
export default storageService;
