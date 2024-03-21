import { v2 as cloudinary } from "cloudinary";
import fs from "fs/promises";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;
    // upload file on cloudinary
    const response = await cloudinary.uploader.upload(localFilePath, {
      folder: "youtube-clone",
      resource_type: "auto", // jpeg, png etc
    });
    // file uploaded on cloudinary successfully, we can remove the local file
    if (response?.secure_url) {
      await fs.unlink(localFilePath);
    }
    return response;
  } catch (err) {
    // remove the local file if something went wrong
    await fs.unlink(localFilePath);
    console.log(err);
    return null;
  }
};

export default uploadOnCloudinary;
