import express from 'express';
import { createOrder, getOrders, getOrderById } from '../controllers/order.controller.js';
import { authenticateUser } from '../middleware/auth.js';

const router = express.Router();

// All customer orders endpoints require authentication
router.use(authenticateUser);

router.post('/', createOrder);
router.get('/', getOrders);
router.get('/:id', getOrderById);

export default router;
