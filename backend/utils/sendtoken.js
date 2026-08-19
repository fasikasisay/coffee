const Admin = require('../models/Admin');


const sendTokenResponse = (admin, statusCode, res) => {
  const token = Admin.getSignedJwtToken(admin);

  const isProd = process.env.NODE_ENV === 'production';
  const maxAgeMs = Number(process.env.JWT_COOKIE_EXPIRE) * 24 * 60 * 60 * 1000;

  res
    .status(statusCode)
    .cookie('token', token, {
      httpOnly:  true,          
      secure:    isProd,        
      sameSite:  isProd ? 'strict' : 'lax',  
      maxAge:    maxAgeMs,
      path:      '/',
    })
    .json({
      success: true,
      
      data: admin,  
    });
};

module.exports = sendTokenResponse;
