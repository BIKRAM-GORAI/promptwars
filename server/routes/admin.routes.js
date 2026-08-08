import express from 'express';
import multer from 'multer';
import { 
  adminLogin, 
  getStats, 
  getAdminDisputes, 
  reviewDispute,
  createProduct,
  updateProduct,
  deleteProduct
} from '../controllers/admin.controller.js';
import { authenticateAdmin } from '../middleware/auth.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Public login endpoint
router.post('/login', adminLogin);

// Protected administrative management routes
router.get('/stats', authenticateAdmin, getStats);
router.get('/disputes', authenticateAdmin, getAdminDisputes);
router.post('/disputes/:id/review', authenticateAdmin, reviewDispute);

// Inventory CRUD
router.post('/products', authenticateAdmin, upload.single('image'), createProduct);
router.put('/products/:id', authenticateAdmin, upload.single('image'), updateProduct);
router.delete('/products/:id', authenticateAdmin, deleteProduct);

export default router;
