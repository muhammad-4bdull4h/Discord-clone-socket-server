const db = require("../db");
module.exports.getProfile = async (userId) => {
  if (!userId) {
    return null;
  }
  const profile = await db.profile.findUnique({
    where: {
      userId,
    },
  });
  return profile;
};
