const mongoose = require("mongoose");

const validateObjectId = (paramName = "id") => (req, res, next) => {
  const id = req.params[paramName];
  
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ 
      message: `Invalid ID format` 
    });
  }
  
  next();
};

module.exports = validateObjectId;