const cloudinary = require("../config/cloudinary");
const streamifier = require("streamifier");

exports.uploadImage = (buffer, folder = "uploads") => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder }, (err, result) => {
      if (err) reject(err);
      else resolve(result.secure_url);
    });
    streamifier.createReadStream(buffer).pipe(stream);
  });
};
