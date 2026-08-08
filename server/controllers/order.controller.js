import { Order } from '../models/Order.js';
import { Product } from '../models/Product.js';

export const createOrder = async (req, res, next) => {
  try {
    const { items } = req.body;
    
    if (!items || items.length === 0) {
      res.status(400);
      throw new Error('Order items cannot be empty');
    }

    let totalAmount = 0;
    const validatedItems = [];

    // Validate products and check stock
    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) {
        res.status(404);
        throw new Error(`Product not found: ${item.productId}`);
      }

      if (product.stock < item.quantity) {
        res.status(400);
        throw new Error(`Insufficient stock for product: ${product.name}`);
      }

      // Stock will be deducted on successful payment confirmation
      totalAmount += product.price * item.quantity;
      validatedItems.push({
        productId: product._id,
        name: product.name,
        quantity: item.quantity,
        price: product.price
      });
    }

    const order = await Order.create({
      userId: req.user._id,
      items: validatedItems,
      totalAmount,
      status: 'PENDING'
    });

    console.log(`[ORDER] Created Order ${order._id} for customer ${req.user.name}`);
    res.status(201).json(order);
  } catch (error) {
    next(error);
  }
};

export const getOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json(orders);
  } catch (error) {
    next(error);
  }
};

export const getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      res.status(404);
      throw new Error('Order not found');
    }

    // Verify ownership
    if (order.userId.toString() !== req.user._id.toString() && req.user.role !== 'ADMIN') {
      res.status(403);
      throw new Error('Access denied. Order belongs to another user.');
    }

    res.status(200).json(order);
  } catch (error) {
    next(error);
  }
};
