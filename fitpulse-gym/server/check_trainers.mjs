import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });

async function checkTrainers() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Happy@2007',
    database: process.env.DB_NAME || 'fitpulse_gym',
    port: process.env.DB_PORT || 3306,
  });

  const [trainers] = await pool.query("SELECT id, full_name, email, specialty, avatar_url, face_enrolled FROM users WHERE role = 'Trainer'");
  console.log('Trainers:', trainers);

  const [members] = await pool.query("SELECT id, full_name, email, assigned_trainer_id FROM users WHERE role = 'Member'");
  console.log('Members and their assigned trainers:');
  members.forEach(m => console.log(`Member #${m.id} ${m.full_name} -> Trainer #${m.assigned_trainer_id}`));

  await pool.end();
}
checkTrainers().catch(console.error);
