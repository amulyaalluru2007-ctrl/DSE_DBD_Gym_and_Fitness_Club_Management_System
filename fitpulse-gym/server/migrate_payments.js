import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function runMigration() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Happy@2007',
    database: process.env.DB_NAME || 'fitpulse_gym',
    port: Number(process.env.DB_PORT) || 3306,
  });

  console.log('Connecting to MySQL database...');

  const alterQueries = [
    'ALTER TABLE users ADD COLUMN gym_membership_active TINYINT(1) DEFAULT 0;',
    'ALTER TABLE users ADD COLUMN gym_membership_plan VARCHAR(100) DEFAULT NULL;',
    'ALTER TABLE users ADD COLUMN gym_membership_duration VARCHAR(50) DEFAULT NULL;',
    'ALTER TABLE users ADD COLUMN gym_membership_expires_at DATETIME DEFAULT NULL;',
    'ALTER TABLE users ADD COLUMN gym_membership_paid_at DATETIME DEFAULT NULL;',
    'ALTER TABLE users ADD COLUMN trainer_id INT DEFAULT NULL;',
    'ALTER TABLE users ADD COLUMN trainer_fee_paid TINYINT(1) DEFAULT 0;',
    'ALTER TABLE users ADD COLUMN trainer_fee_expires_at DATETIME DEFAULT NULL;',
  ];

  for (const q of alterQueries) {
    try {
      await pool.query(q);
      console.log('Applied:', q);
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('Column already exists.');
      } else {
        console.error('Error on query:', q, err.message);
      }
    }
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id VARCHAR(100) UNIQUE NOT NULL,
      cf_order_id VARCHAR(100),
      cf_payment_id VARCHAR(100),
      user_id INT NOT NULL,
      user_name VARCHAR(150),
      user_email VARCHAR(150),
      payment_type ENUM('gym_membership', 'trainer_fee') NOT NULL,
      plan_duration VARCHAR(50),
      plan_name VARCHAR(150),
      trainer_id INT DEFAULT NULL,
      trainer_name VARCHAR(150) DEFAULT NULL,
      amount DECIMAL(10,2) NOT NULL,
      currency VARCHAR(10) DEFAULT 'INR',
      payment_status VARCHAR(50) DEFAULT 'PENDING',
      payment_method VARCHAR(100) DEFAULT 'Cashfree PG',
      payment_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      raw_response LONGTEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('payments table created/verified.');

  // Set default active gym membership for user 1 (Nihal) for 30 days
  const expires = new Date();
  expires.setDate(expires.getDate() + 30);
  await pool.query(
    `UPDATE users 
     SET gym_membership_active = 1, 
         gym_membership_plan = '1 Month Gym Membership', 
         gym_membership_duration = '1_month', 
         gym_membership_expires_at = ?, 
         gym_membership_paid_at = NOW(), 
         trainer_id = 6, 
         trainer_fee_paid = 1 
     WHERE id = 1`,
    [expires]
  );
  console.log('Nihal (User 1) initialized with active 1-month gym membership expiring:', expires.toISOString());

  // Also insert an initial verified Cashfree payment for Nihal in the payments table so Admin sees past history
  const [existingOrder] = await pool.query("SELECT id FROM payments WHERE order_id = 'order_FP_INIT_001'");
  if (existingOrder.length === 0) {
    await pool.query(`
      INSERT INTO payments (
        order_id, cf_order_id, cf_payment_id, user_id, user_name, user_email,
        payment_type, plan_duration, plan_name, amount, currency,
        payment_status, payment_method, payment_time, expires_at
      ) VALUES (
        'order_FP_INIT_001', 'cf_ord_init_1001', 'cf_pay_init_9001', 1, 'Nihal Metuku', 'nihal@fitpulse.com',
        'gym_membership', '1_month', '1 Month Gym Membership', 1499.00, 'INR',
        'PAID', 'Cashfree PG • UPI (Instant)', NOW(), ?
      )
    `, [expires]);
    console.log('Inserted initial payment record for user 1.');
  }

  // Also insert a trainer payment for Coach Sai Sathwik from Nihal so Trainer dashboard and Admin see trainer fees
  const [existingTrOrder] = await pool.query("SELECT id FROM payments WHERE order_id = 'order_FP_TRN_INIT_001'");
  if (existingTrOrder.length === 0) {
    await pool.query(`
      INSERT INTO payments (
        order_id, cf_order_id, cf_payment_id, user_id, user_name, user_email,
        payment_type, plan_duration, plan_name, trainer_id, trainer_name, amount, currency,
        payment_status, payment_method, payment_time, expires_at
      ) VALUES (
        'order_FP_TRN_INIT_001', 'cf_ord_trn_1002', 'cf_pay_trn_9002', 1, 'Nihal Metuku', 'nihal@fitpulse.com',
        'trainer_fee', '1_month', 'Monthly Coaching Retainer', 6, 'Sai Sathwik', 2999.00, 'INR',
        'PAID', 'Cashfree PG • NetBanking', NOW(), ?
      )
    `, [expires]);
    console.log('Inserted initial trainer fee payment record.');
  }

  await pool.end();
  console.log('Migration completed successfully.');
}

runMigration().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
