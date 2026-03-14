const cron = require("node-cron");
const Match = require("../models/Match");
const Team = require("../models/Team");
const { sendNotificationToUser } = require("../utils/firebaseAdmin");

async function sendMatchReminders() {
  try {
    const now = new Date();

    // ✅ Find matches starting between 29-31 mins from now
    const from = new Date(now.getTime() + 29 * 60 * 1000);
    const to = new Date(now.getTime() + 31 * 60 * 1000);

    const upcomingMatches = await Match.find({
      status: "ACCEPTED",
      scheduledAt: { $gte: from, $lte: to },
    })
      .populate("homeTeam", "teamName admins")
      .populate("awayTeam", "teamName admins");

    if (upcomingMatches.length === 0) return;

    console.log(`⏰ Found ${upcomingMatches.length} match(es) starting in ~30 mins`);

    for (const match of upcomingMatches) {
      const matchInfo = `${match.homeTeam.teamName} vs ${match.awayTeam.teamName}`;

      // ✅ Notify home team admin
      try {
        await sendNotificationToUser(
          match.homeTeam.admins[0],
          "⏰ Match Starting Soon!",
          `Your match ${matchInfo} starts in 30 minutes!`,
          { type: "MATCH_REMINDER", matchId: match._id.toString() }
        );
      } catch (err) {
        console.error("Home team reminder error:", err.message);
      }

      // ✅ Notify away team admin
      try {
        await sendNotificationToUser(
          match.awayTeam.admins[0],
          "⏰ Match Starting Soon!",
          `Your match ${matchInfo} starts in 30 minutes!`,
          { type: "MATCH_REMINDER", matchId: match._id.toString() }
        );
      } catch (err) {
        console.error("Away team reminder error:", err.message);
      }

      console.log(`✅ Reminder sent for match: ${matchInfo}`);
    }
  } catch (err) {
    console.error("Match reminder job error:", err.message);
  }
}

// ✅ Runs every minute
function startMatchReminderJob() {
  cron.schedule("* * * * *", () => {
    sendMatchReminders();
  });
  console.log("⏰ Match reminder cron job started");
}

module.exports = { startMatchReminderJob };