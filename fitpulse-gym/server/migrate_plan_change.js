import { pool } from "./config/db.js";

async function run() {
  try {
    console.log("Adding member_change_plan to trainer_change_requests...");
    await pool.query(`
      ALTER TABLE trainer_change_requests 
      MODIFY COLUMN request_type ENUM('member_change_trainer','trainer_remove_member','member_change_plan') NOT NULL DEFAULT 'member_change_trainer'
    `);
    
    // Add columns if they don't exist
    const [cols] = await pool.query("DESCRIBE trainer_change_requests");
    const colNames = cols.map(c => c.Field);
    
    if (!colNames.includes("current_plan_duration")) {
      await pool.query("ALTER TABLE trainer_change_requests ADD COLUMN current_plan_duration VARCHAR(50) DEFAULT NULL");
    }
    if (!colNames.includes("requested_plan_duration")) {
      await pool.query("ALTER TABLE trainer_change_requests ADD COLUMN requested_plan_duration VARCHAR(50) DEFAULT NULL");
    }
    if (!colNames.includes("plan_adjustment_inr")) {
      await pool.query("ALTER TABLE trainer_change_requests ADD COLUMN plan_adjustment_inr DECIMAL(10,2) DEFAULT 0.00");
    }

    // Also check if bio exists in users table
    const [userCols] = await pool.query("DESCRIBE users");
    const userColNames = userCols.map(c => c.Field);
    if (!userColNames.includes("bio")) {
      await pool.query("ALTER TABLE users ADD COLUMN bio TEXT DEFAULT NULL");
      console.log("Added bio column to users table.");
    }

    console.log("Migration executed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Migration error:", err);
    process.exit(1);
  }
}

run();
