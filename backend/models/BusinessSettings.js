const { pool } = require('../config/db');

const SETTINGS_COLS = `
  id,
  business_name AS businessName,
  business_email AS businessEmail,
  business_phone AS businessPhone,
  business_address AS businessAddress,
  business_website AS businessWebsite,
  business_logo AS businessLogo,
  created_at AS createdAt,
  updated_at AS updatedAt
`;

const BusinessSettings = {
  async get() {
    const [rows] = await pool.execute(
      `SELECT ${SETTINGS_COLS}
       FROM business_settings
       WHERE id = 1
       LIMIT 1`
    );

    return rows[0] || null;
  },

  async update(data) {
    const fields = [];
    const values = [];

    if (data.businessName !== undefined) {
      fields.push('business_name = ?');
      values.push(data.businessName.trim());
    }

    if (data.businessEmail !== undefined) {
      fields.push('business_email = ?');
      values.push(data.businessEmail ? data.businessEmail.trim() : null);
    }

    if (data.businessPhone !== undefined) {
      fields.push('business_phone = ?');
      values.push(data.businessPhone ? data.businessPhone.trim() : null);
    }

    if (data.businessAddress !== undefined) {
      fields.push('business_address = ?');
      values.push(data.businessAddress ? data.businessAddress.trim() : null);
    }

    if (data.businessWebsite !== undefined) {
      fields.push('business_website = ?');
      values.push(data.businessWebsite ? data.businessWebsite.trim() : null);
    }

    if (data.businessLogo !== undefined) {
      fields.push('business_logo = ?');
      values.push(data.businessLogo ? data.businessLogo.trim() : null);
    }

    if (fields.length === 0) {
      return BusinessSettings.get();
    }

    fields.push('updated_at = NOW()');

    await pool.execute(
      `UPDATE business_settings
       SET ${fields.join(', ')}
       WHERE id = 1`,
      values
    );

    return BusinessSettings.get();
  }
};

module.exports = BusinessSettings;