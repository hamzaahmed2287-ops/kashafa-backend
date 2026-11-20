const { getDbPool, sql } = require('../config/db');

// جلب أسعار الشحن
exports.getShippingRates = async (req, res) => {
  try {
    const pool = await getDbPool();
    const result = await pool.request().query('SELECT * FROM dbo.ShippingRates');
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// حفظ أو تحديث أسعار الشحن (للأدمن)
exports.saveShippingRates = async (req, res) => {
  try {
    const { rates } = req.body; // مصفوفة الأسعار
    const pool = await getDbPool();

    for (const rate of rates) {
      await pool.request()
        .input('Id', sql.NVarChar, String(rate.id))
        .input('NameAr', sql.NVarChar, rate.nameAr || '')
        .input('NameEn', sql.NVarChar, rate.nameEn || '')
        .input('ShippingCost', sql.Decimal(18,2), rate.shippingCost || rate.price || 50)
        .input('DeliveryDaysAr', sql.NVarChar, rate.deliveryDaysAr || '2 - 4 أيام عمل')
        .input('DeliveryDaysEn', sql.NVarChar, rate.deliveryDaysEn || '2 - 4 Business Days')
        .query(`
          IF EXISTS (SELECT * FROM dbo.ShippingRates WHERE Id = @Id)
            UPDATE dbo.ShippingRates 
            SET NameAr = @NameAr, NameEn = @NameEn, ShippingCost = @ShippingCost, DeliveryDaysAr = @DeliveryDaysAr, DeliveryDaysEn = @DeliveryDaysEn
            WHERE Id = @Id
          ELSE
            INSERT INTO dbo.ShippingRates (Id, NameAr, NameEn, ShippingCost, DeliveryDaysAr, DeliveryDaysEn)
            VALUES (@Id, @NameAr, @NameEn, @ShippingCost, @DeliveryDaysAr, @DeliveryDaysEn)
        `);
    }

    res.json({ status: 'success', message: 'Shipping rates updated successfully!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// جلب أكواد الخصم
exports.getPromoCodes = async (req, res) => {
  try {
    const pool = await getDbPool();
    const result = await pool.request().query('SELECT * FROM dbo.PromoCodes');
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// إضافة برومو كود جديد
exports.createPromoCode = async (req, res) => {
  try {
    const { code, type, value, active } = req.body;
    const pool = await getDbPool();

    await pool.request()
      .input('Code', sql.NVarChar, code.toUpperCase())
      .input('Type', sql.NVarChar, type)
      .input('Value', sql.Decimal(18,2), value)
      .input('Active', sql.Bit, active !== false ? 1 : 0)
      .query(`
        INSERT INTO dbo.PromoCodes (Code, Type, Value, Active)
        VALUES (@Code, @Type, @Value, @Active)
      `);

    res.json({ status: 'success', message: 'Promo code added successfully!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// جلب إعدادات الدفع (فودافون وإنستا باي)
exports.getPaymentSettings = async (req, res) => {
  try {
    const pool = await getDbPool();
    const result = await pool.request().query('SELECT * FROM dbo.StoreSettings WHERE Id = 1');
    res.json(result.recordset[0] || { vodafoneCash1: '01012345678', vodafoneCash2: '01098765432', instapayHandle: 'kashafa@instapay' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// تحديث إعدادات الدفع
exports.updatePaymentSettings = async (req, res) => {
  try {
    const { vodafoneCash1, vodafoneCash2, instapayHandle } = req.body;
    const pool = await getDbPool();

    await pool.request()
      .input('VodafoneCash1', sql.NVarChar, vodafoneCash1)
      .input('VodafoneCash2', sql.NVarChar, vodafoneCash2)
      .input('InstapayHandle', sql.NVarChar, instapayHandle)
      .query(`
        IF EXISTS (SELECT * FROM dbo.StoreSettings WHERE Id = 1)
          UPDATE dbo.StoreSettings 
          SET VodafoneCash1 = @VodafoneCash1, VodafoneCash2 = @VodafoneCash2, InstapayHandle = @InstapayHandle
          WHERE Id = 1
        ELSE
          INSERT INTO dbo.StoreSettings (Id, VodafoneCash1, VodafoneCash2, InstapayHandle)
          VALUES (1, @VodafoneCash1, @VodafoneCash2, @InstapayHandle)
      `);

    res.json({ status: 'success', message: 'Payment settings updated successfully!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};