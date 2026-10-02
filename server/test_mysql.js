import mysql from "mysql2/promise";

async function testConnection() {
  try {
    const connection = await mysql.createConnection({
      host: "localhost",
      user: "root",
      password: "Happy@2007",
      port: 3306,
    });
    console.log("Successfully connected to MySQL as root!");
    await connection.query("CREATE DATABASE IF NOT EXISTS fitpulse_gym;");
    console.log("Database fitpulse_gym created or already exists!");
    await connection.end();
  } catch (err) {
    console.error("MySQL connection error:", err.message);
  }
}

testConnection();
