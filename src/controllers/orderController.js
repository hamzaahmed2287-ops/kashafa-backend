const { getDbPool, sql } = require('../config/db');

// Helper: basic input sanitization
function sanitizeStr(val, maxLen = 500) {
  if (val === null || val === undefined) return '';
  return String(val).trim().substring(0, maxLen);
}

// إنشاء طلب جديد (Checkout)
exports.createOrder = async (req, res) => {
  try {
    const { 
      id, customerName, phone, altPhone, governorate, address, 
      productName, items, quantity, subtotal, shipping, discountAmount, 
      promoCode, deliveryDays, totalAmount, date, status, receiptImage, targetWallet, userEmail 
    } = req.body;

    // Basic validation
    if (!id || !customerName || !phone || !governorate || !address) {
      return res.status(400).json({ error: 'Missing required order fields' });
    }
    
    // Sanitize ID to prevent injection
    const cleanId = sanitizeStr(id, 50);
    if (!/^KSH-\d+$/.test(cleanId)) {
      return res.status(400).json({ error: 'Invalid order ID format' });
    }

    const pool = await getDbPool();

    // 1. حفظ الطلب الرئيسي في جدول Orders
    await pool.request()
      .input('Id', sql.NVarChar(50), cleanId)
      .input('CustomerName', sql.NVarChar(255), sanitizeStr(customerName, 255))
      .input('Phone', sql.NVarChar(20), sanitizeStr(phone, 20))
      .input('AltPhone', sql.NVarChar(20), sanitizeStr(altPhone, 20))
      .input('Governorate', sql.NVarChar(100), sanitizeStr(governorate, 100))
      .input('Address', sql.NVarChar(500), sanitizeStr(address, 500))
      .input('ProductName', sql.NVarChar(255), sanitizeStr(productName, 255))
      .input('Quantity', sql.Int, Math.max(1, parseInt(quantity) || 1))
      .input('Subtotal', sql.Decimal(18,2), parseFloat(subtotal) || 0)
      .input('Shipping', sql.Decimal(18,2), parseFloat(shipping) || 0)
      .input('DiscountAmount', sql.Decimal(18,2), parseFloat(discountAmount) || 0)
      .input('PromoCode', sql.NVarChar(50), sanitizeStr(promoCode, 50) || null)
      .input('DeliveryDays', sql.NVarChar(100), sanitizeStr(deliveryDays, 100))
      .input('TotalAmount', sql.Decimal(18,2), parseFloat(totalAmount) || 0)
      .input('Date', sql.Date, date ? new Date(date) : new Date())
      .input('Status', sql.NVarChar(50), sanitizeStr(status, 50) || 'pending')
      .input('ReceiptImage', sql.NVarChar(sql.MAX), sanitizeStr(receiptImage, 10000))
      .input('TargetWallet', sql.NVarChar(50), sanitizeStr(targetWallet, 50))
      .input('UserEmail', sql.NVarChar(255), sanitizeStr(userEmail, 255) || null)
      .query(`
        INSERT INTO dbo.Orders (Id, CustomerName, Phone, AltPhone, Governorate, Address, ProductName, Quantity, Subtotal, Shipping, DiscountAmount, PromoCode, DeliveryDays, TotalAmount, Date, Status, ReceiptImage, TargetWallet, UserEmail)
        VALUES (@Id, @CustomerName, @Phone, @AltPhone, @Governorate, @Address, @ProductName, @Quantity, @Subtotal, @Shipping, @DiscountAmount, @PromoCode, @DeliveryDays, @TotalAmount, @Date, @Status, @ReceiptImage, @TargetWallet, @UserEmail)
      `);

    // 2. حفظ تفاصيل المنتجات في OrderItems وخصم المخزون من جدول Products
    if (items && Array.isArray(items)) {
      for (const item of items) {
        const itemPrice = parseFloat(String(item.price).replace(/[^0-9.]/g, '')) || 0;
        const itemQty = Math.max(1, parseInt(item.quantity) || 1);
        
        await pool.request()
          .input('OrderId', sql.NVarChar(50), cleanId)
          .input('ProductId', sql.NVarChar(50), sanitizeStr(String(item.id || ''), 50))
          .input('Title', sql.NVarChar(255), sanitizeStr(item.title?.AR || item.title || '', 255))
          .input('Price', sql.Decimal(18,2), itemPrice)
          .input('Quantity', sql.Int, itemQty)
          .input('SelectedSize', sql.NVarChar(50), sanitizeStr(item.selectedSize, 50))
          .input('SelectedColor', sql.NVarChar(50), sanitizeStr(item.selectedColor, 50))
          .input('Image', sql.NVarChar(1000), sanitizeStr(item.image, 1000))
          .query(`
            INSERT INTO dbo.OrderItems (OrderId, ProductId, Title, Price, Quantity, SelectedSize, SelectedColor, Image)
            VALUES (@OrderId, @ProductId, @Title, @Price, @Quantity, @SelectedSize, @SelectedColor, @Image)
          `);

        // خصم الكمية المباعة من مخزون المنتج في جدول Products
        await pool.request()
          .input('ProductId', sql.NVarChar(50), sanitizeStr(String(item.id || ''), 50))
          .input('BoughtQty', sql.Int, itemQty)
          .query(`
            UPDATE dbo.Products 
            SET Stock = CASE WHEN Stock - @BoughtQty < 0 THEN 0 ELSE Stock - @BoughtQty END 
            WHERE Id = @ProductId OR NameAr = @ProductId
          `);
      }
    }

    res.json({ status: 'success', message: 'Order placed successfully and stock updated!', orderId: cleanId });
  } catch (err) {
    console.error('createOrder error:', err.message);
    res.status(500).json({ error: 'Failed to place order' });
  }
};

// جلب كل الطلبات (للأدمن)
exports.getAllOrders = async (req, res) => {
  try {
    const pool = await getDbPool();
    const result = await pool.request().query('SELECT * FROM dbo.Orders ORDER BY Date DESC');
    res.json(result.recordset);
  } catch (err) {
    console.error('getAllOrders error:', err.message);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
};

// تحديث حالة الطلب
exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const allowedStatuses = ['pending', 'packed', 'shipped', 'delivered', 'cancelled', 'Pending', 'Packed', 'Shipped', 'Delivered', 'Cancelled'];
    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid order status' });
    }
    
    const pool = await getDbPool();
    
    await pool.request()
      .input('Id', sql.NVarChar(50), sanitizeStr(id, 50))
      .input('Status', sql.NVarChar(50), status)
      .query('UPDATE dbo.Orders SET Status = @Status WHERE Id = @Id');

    res.json({ status: 'success', message: 'Order status updated successfully' });
  } catch (err) {
    console.error('updateOrderStatus error:', err.message);
    res.status(500).json({ error: 'Failed to update order status' });
  }
};