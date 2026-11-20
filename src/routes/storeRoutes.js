const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const orderController = require('../controllers/orderController');
const settingsController = require('../controllers/settingsController');

// جلب المنتجات للمتجر
router.get('/products', productController.getAllProducts);

// استقبال الأوردر (Checkout)
router.post('/orders', orderController.createOrder);

// جلب إعدادات الدفع والشحن العامة للعملاء
router.get('/payment-settings', settingsController.getPaymentSettings);
router.get('/shipping-rates', settingsController.getShippingRates);

module.exports = router;