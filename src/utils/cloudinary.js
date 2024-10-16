import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

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
    return response;
  } catch (err) {
    // console.log(err);
    return null;
  } finally {
    // remove the local file
    fs.unlinkSync(localFilePath);
  }
};

const deleteFromCloudinary = async (public_id) => {
  try {
    const res = await cloudinary.uploader.destroy(public_id);
    return res;
  } catch (error) {
    // console.log("error on deleting from cloudinary:", error);
    return null;
  }
};

export { deleteFromCloudinary, uploadOnCloudinary };
