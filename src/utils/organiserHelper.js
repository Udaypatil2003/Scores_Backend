const Organiser = require("../models/Organiser");

const isOrganiserOwner = async (userId, tournamentOrganiserId) => {
  const organiser = await Organiser.findOne({ user: userId }).lean();
  if (!organiser) return false;
  return organiser._id.toString() === tournamentOrganiserId.toString();
};

module.exports = { isOrganiserOwner };