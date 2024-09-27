// get token from cookie and verify it then get user
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

const getLoggedInUser = async (req) => {
  const token = req.cookies?.token;
  if (!token) {
    return null;
  }
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(decoded.id).select("-password");
  return user;
};
export default getLoggedInUser;
