import multer from "multer";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // destination function to specify the folder where the file will be saved
    cb(null, "./public/temp");
  },

  // filename function to specify the name of the file
  filename: (req, file, cb) => {
    // console.log("file:", file);
    /* 
    {
  fieldname: 'avatar',
  originalname: 'ab-siddik.jpg',
  encoding: '7bit',
  mimetype: 'image/jpeg'
   }
    */
    // const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${file.originalname}-${Date.now()}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    // file filter function to check file format and size before uploading it to the server
    if (file.mimetype === "image/png" || file.mimetype === "image/jpeg") {
      cb(null, true); // accept file and upload it
    } else {
      cb(new Error("File format not supported")); // reject file
    }
  },
  limits: {
    // limits object to specify the file size
    fileSize: 1000000, // 1MB
  },
});

export default upload;
