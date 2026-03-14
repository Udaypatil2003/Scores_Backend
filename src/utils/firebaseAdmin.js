const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

// Initialize only once
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const messaging = admin.messaging();

// ✅ Send notification to a single user by userId
async function sendNotificationToUser(userId, title, body, data = {}) {
  try {
    console.log("🔍 Looking for token for userId:", userId);
    const DeviceToken = require("../models/DeviceToken");
    const tokenDoc = await DeviceToken.findOne({ userId });

    if (!tokenDoc) {
      console.log(`No token found for user ${userId}`);
      return;
    }

    console.log("📱 Token found, sending notification...");

    await messaging.send({
      token: tokenDoc.fcmToken,
      notification: { title, body },
      data,
      android: {
        priority: "high",
        notification: {
          channelId: "football_app", // 👈 must match Notifee channel id
          priority: "max",
        },
      },
      apns: { payload: { aps: { sound: "default" } } },
    });

    console.log(`✅ Notification sent to user ${userId}: ${title}`);
  } catch (err) {
    console.error("Send notification error:", err.message);
  }
}

// ✅ Send notification to multiple users at once
async function sendNotificationToMany(userIds, title, body, data = {}) {
  try {
    const DeviceToken = require("../models/DeviceToken");
    const tokens = await DeviceToken.find({ userId: { $in: userIds } });

    if (!tokens.length) return;

    const messages = tokens.map((t) => ({
      token: t.fcmToken,
      notification: { title, body },
      data,
      android: { priority: "high" },
      apns: { payload: { aps: { sound: "default" } } },
    }));

    await messaging.sendEach(messages);
    console.log(`✅ Notification sent to ${tokens.length} users: ${title}`);
  } catch (err) {
    console.error("Send bulk notification error:", err.message);
  }
}

module.exports = { sendNotificationToUser, sendNotificationToMany };
