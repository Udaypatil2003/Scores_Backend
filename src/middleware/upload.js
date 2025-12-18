const multer = require("multer");

const storage = multer.memoryStorage(); // no local storage

module.exports = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});
