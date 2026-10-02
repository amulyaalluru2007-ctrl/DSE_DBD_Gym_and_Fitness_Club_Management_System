import express from "express";

import {
  loginUser,
  registerUser,
  requestTrainerPasswordReset,
  confirmTrainerPasswordReset,
  changePassword,
} from "../controllers/authController.js";

import {
  protect,
} from "../middleware/authMiddleware.js";

const router =
  express.Router();

/* =====================================================
   PUBLIC
===================================================== */

router.post(
  "/register",
  registerUser
);

router.post(
  "/login",
  loginUser
);

router.post(
  "/change-password",
  changePassword
);

router.post(
  "/trainer-reset-request",
  requestTrainerPasswordReset
);

router.post(
  "/trainer-reset-confirm",
  confirmTrainerPasswordReset
);

/* =====================================================
   PROTECTED
===================================================== */

router.get(
  "/me",
  protect,
  (req, res) => {
    res.status(200).json({
      success: true,
      user: req.user,
    });
  }
);

export default router;