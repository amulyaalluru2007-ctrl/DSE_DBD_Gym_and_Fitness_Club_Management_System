import mongoose from "mongoose";

const userSchema =
  new mongoose.Schema(
    {
      name: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 100,
      },

      email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
      },

      phone: {
        type: String,
        required: true,
        trim: true,
      },

      password: {
        type: String,
        required: true,
        minlength: 6,
      },

      goal: {
        type: String,
        enum: [
          "muscle",
          "fat-loss",
          "strength",
          "performance",
        ],
        required: true,
      },

      role: {
        type: String,
        enum: [
          "member",
          "trainer",
          "admin",
        ],
        default: "member",
      },

      membership: {
        plan: {
          type: String,
          default: "none",
        },

        status: {
          type: String,
          enum: [
            "inactive",
            "active",
            "expired",
          ],
          default: "inactive",
        },

        startDate: {
          type: Date,
          default: null,
        },

        endDate: {
          type: Date,
          default: null,
        },
      },

      profile: {
        avatar: {
          type: String,
          default: "",
        },

        height: {
          type: Number,
          default: null,
        },

        weight: {
          type: Number,
          default: null,
        },

        dateOfBirth: {
          type: Date,
          default: null,
        },
      },

      stats: {
        attendance: {
          type: Number,
          default: 0,
        },

        workoutsCompleted: {
          type: Number,
          default: 0,
        },

        performanceScore: {
          type: Number,
          default: 0,
        },

        streak: {
          type: Number,
          default: 0,
        },
      },
    },
    {
      timestamps: true,
    }
  );

const User =
  mongoose.model(
    "User",
    userSchema
  );

export default User;