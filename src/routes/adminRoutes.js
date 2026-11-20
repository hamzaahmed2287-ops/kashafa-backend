const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const orderController = require('../controllers/orderController');
const settingsController = require('../controllers/settingsController');

// المنتجات
router.get('/products', productController.getAllProducts);
router.post('/products', productController.createProduct);
router.delete('/products/:id', productController.deleteProduct);

// الطلبات
router.get('/orders', orderController.getAllOrders);
router.patch('/orders/:id/status', orderController.updateOrderStatus);

// الشحن والبرومو كود
router.get('/shipping-rates', settingsController.getShippingRates);
router.post('/shipping-rates', settingsController.saveShippingRates);
router.get('/promo-codes', settingsController.getPromoCodes);
router.post('/promo-codes', settingsController.createPromoCode);

// إعدادات الدفع
router.get('/payment-settings', settingsController.getPaymentSettings);
router.post('/payment-settings', settingsController.updatePaymentSettings);

module.exports = router;