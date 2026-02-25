require("dotenv").config();
const mongoose = require("mongoose");
const Organiser = require("./src/models/Organiser");
const Tournament = require("./src/models/Tournament");

const migrate = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    console.log("✅ Connected to DB");

    const organisers = await Organiser.find({});
    console.log(`Found ${organisers.length} organisers`);

    let updated = 0;

    for (const organiser of organisers) {
      // Find tournaments where organiser field = User _id (wrong)
      const result = await Tournament.updateMany(
        { organiser: organiser.user },  // wrong — has User _id
        { $set: { organiser: organiser._id } }  // fix — set Organiser _id
      );

      if (result.modifiedCount > 0) {
        console.log(
          `✅ Fixed ${result.modifiedCount} tournament(s) for organiser ${organiser._id}`
        );
        updated += result.modifiedCount;
      }
    }

    console.log(`\n🎉 Migration complete. ${updated} tournament(s) updated.`);
    process.exit(0);

  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  }
};

migrate();