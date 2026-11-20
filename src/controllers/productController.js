const { getDbPool, sql } = require('../config/db');

// Helper: basic input sanitization
function sanitizeStr(val, maxLen = 500) {
  if (val === null || val === undefined) return null;
  return String(val).trim().substring(0, maxLen);
}

// جلب كل المنتجات
exports.getAllProducts = async (req, res) => {
  try {
    const pool = await getDbPool();
    const result = await pool.request().query('SELECT * FROM dbo.Products');
    res.json(result.recordset);
  } catch (err) {
    console.error('getAllProducts error:', err.message);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
};

// إضافة منتج جديد
exports.createProduct = async (req, res) => {
  try {
    const { nameAr, nameEn, price, oldPrice, stock, category, subCategory, brand, image, images, description, isDiscovery, isOffer } = req.body;
    
    // Input validation
    if (!nameAr || !nameEn || price === undefined || price === null) {
      return res.status(400).json({ error: 'nameAr, nameEn, and price are required' });
    }
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({ error: 'Invalid price value' });
    }
    
    const pool = await getDbPool();
    
    await pool.request()
      .input('NameAr', sql.NVarChar(255), sanitizeStr(nameAr, 255))
      .input('NameEn', sql.NVarChar(255), sanitizeStr(nameEn, 255))
      .input('Price', sql.Decimal(18,2), parsedPrice)
      .input('OldPrice', sql.Decimal(18,2), oldPrice ? parseFloat(oldPrice) : null)
      .input('Stock', sql.Int, Math.max(0, parseInt(stock) || 10))
      .input('Category', sql.NVarChar(100), sanitizeStr(category, 100))
      .input('SubCategory', sql.NVarChar(100), sanitizeStr(subCategory, 100))
      .input('Brand', sql.NVarChar(100), sanitizeStr(brand, 100))
      .input('Image', sql.NVarChar(1000), sanitizeStr(image, 1000))
      .input('Description', sql.NVarChar(sql.MAX), sanitizeStr(description?.AR || description || '', 4000))
      .input('IsDiscovery', sql.Bit, isDiscovery ? 1 : 0)
      .input('IsOffer', sql.Bit, isOffer ? 1 : 0)
      .query(`
        INSERT INTO dbo.Products (NameAr, NameEn, Price, OldPrice, Stock, Category, SubCategory, Brand, Image, Description, IsDiscovery, IsOffer)
        VALUES (@NameAr, @NameEn, @Price, @OldPrice, @Stock, @Category, @SubCategory, @Brand, @Image, @Description, @IsDiscovery, @IsOffer)
      `);

    res.json({ status: 'success', message: 'Product added successfully to SQL Server!' });
  } catch (err) {
    console.error('createProduct error:', err.message);
    res.status(500).json({ error: 'Failed to create product' });
  }
};

// حذف منتج
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const parsedId = parseInt(id);
    if (isNaN(parsedId) || parsedId <= 0) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }
    const pool = await getDbPool();
    await pool.request()
      .input('Id', sql.Int, parsedId)
      .query('DELETE FROM dbo.Products WHERE Id = @Id');

    res.json({ status: 'success', message: 'Product deleted successfully' });
  } catch (err) {
    console.error('deleteProduct error:', err.message);
    res.status(500).json({ error: 'Failed to delete product' });
  }
};