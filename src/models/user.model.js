import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      lowercase: true,
      trim: true,
      index: true, // enabling searching ,
    },

    description: {
      type: String,
      trim: true,
    },
    fullName: {
      type: String,
      required: [true, "FullName is required"],
      trim: true,
      index: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      validate: {
        validator(v) {
          return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v);
        },
        message: "Please provide a valid email address",
      },
      trim: true,
      lowercase: true,
    },

    avatar: {
      type: {
        url: {
          type: String,
          required: [true, "Avatar URL is required"],
        },
        public_id: {
          type: String,
          required: [true, "Avatar public ID is required"],
        },
        _id: false,
      },
      required: [true, "Avatar is required"],
    },

    coverImage: {
      type: {
        _id: false,
        url: {
          type: String,
          // required: [true, "Cover Image URL is required"],
        },
        public_id: {
          type: String,
          // required: [true, "Cover Image public ID is required"],
        },
      },
      // required: [true, "Cover Image is required"],
    },
    watchHistory: [
      {
        createdAt: {
          type: Date,
          default: new Date(),
        },
        videoId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Video",
        },
      },
    ],
    password: {
      type: String,
      /*
      select: false, // this will hide the password field when we retrieve data from database
      */
      required: [true, "Password is required"],
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationDigits: {
      type: String,
    },
    resetToken: {
      type: String,
    },
    refreshToken: {
      type: String,
    },
  },
  { timestamps: true }
);

// hash password before saving to database
userSchema.pre("save", async function (next) {
  // hash password using bcrypt
  /* 
  isModified("password"): This checks whether the "password" field of the document has been modified since it was last saved to the database. If the "password" field has not been modified, it returns false, indicating that there's no need to re-hash the password or perform any additional processing related to password modification.
  */
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// method to compare a plain text password with the encrypted one in the database
userSchema.methods.isPasswordCorrect = async function (password) {
  const isMatched = await bcrypt.compare(password, this.password);
  return isMatched;
};

// crate jwt token
userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      _id: this._id,
      email: this.email,
      fullName: this.fullName,
      username: this.username,
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
    }
  );
};
// create refresh token
userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    {
      _id: this._id,
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
    }
  );
};

const User = mongoose.model("User", userSchema);

export default User;
