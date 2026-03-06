// backend/config/razorpay.js
const Razorpay = require('razorpay');

// ⚠️  Replace these with your actual keys from https://dashboard.razorpay.com
// KEY_ID  → starts with "rzp_test_" (test) or "rzp_live_" (production)
// KEY_SECRET → your secret key from Razorpay dashboard

const razorpay = new Razorpay({
  key_id    : process.env.RAZORPAY_KEY_ID     || 'rzp_test_XXXXXXXXXXXXXXXX',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'XXXXXXXXXXXXXXXXXXXXXXXX',
});

module.exports = razorpay;