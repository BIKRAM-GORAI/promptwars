import express from 'express';
import multer from 'multer';
import { createDispute, getDisputes, getDisputeById, resolveDispute } from '../controllers/dispute.controller.js';
import { authenticateUser } from '../middleware/auth.js';

const router = express.Router();

// Configure Multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB max file size
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images are permitted for evidence uploads.'), false);
    }
  }
});

// Protect user dispute endpoints
router.use(authenticateUser);

// POST dispute handles optional evidence image uploads
router.post('/', upload.single('evidence'), createDispute);
router.get('/', getDisputes);
router.get('/:id', getDisputeById);
router.post('/:id/resolve', resolveDispute);

export default router;
