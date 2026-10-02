import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";

export const protect = async (req, res, next) => {
  try {
    const authorization = req.headers.authorization;

    if (!authorization || !authorization.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const token = authorization.split(" ")[1];
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "fitpulse_super_secret_jwt_key_2026"
    );

    const [rows] = await pool.query(
      `SELECT id, full_name AS name, email, phone, gender, goal, role, 
              membership_id AS membershipId, height_cm AS height, weight_kg AS weight, 
              emergency_contact AS emergencyContact, avatar_url AS avatar 
       FROM users WHERE id = ?`,
      [decoded.userId]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "User account no longer exists.",
      });
    }

    req.user = rows[0];
    next();
  } catch {
      return res.status(401).json({
        success: false,
        message:
          "Invalid or expired authentication token.",
      });
    }
  };

export const authorize =
  (...roles) => {
    return (req, res, next) => {
      if (
        !req.user ||
        !roles.includes(
          req.user.role
        )
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You do not have permission to access this resource.",
        });
      }

      next();
    };
  };