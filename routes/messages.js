const express = require("express");
const prisma = require("../db");
const { getProfile } = require("../lib/GetProfile");
const { MemberRole } = require("@prisma/client");
const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const userId = req.auth.userId;

    const { content, fileUrl } = req.body;
    const { serverId, channelId } = req.query;

    if (!content) {
      return res.status(404).send("Missing message");
    }

    if (!userId) {
      return res.status(404).send("UnAuthorized Request");
    }
    if (!serverId) {
      return res.status(404).send("ServerId missing");
    }
    if (!channelId) {
      return res.status(404).send("Channel Id missing");
    }

    const profile = await getProfile(userId);
    if (!profile) {
      return res.status(404).send("No user with Found");
    }

    const server = await prisma.server.findFirst({
      where: {
        id: serverId,
        members: {
          some: {
            profileId: profile.id,
          },
        },
      },
      include: {
        members: true,
      },
    });
    if (!server) {
      return res.status(404).send("No server exists!");
    }

    const channel = prisma.channel.findFirst({
      where: {
        id: channelId,
        serverId: serverId,
      },
    });

    if (!channel) {
      return res.status(404).send("No Channel exists!");
    }

    const member = server.members.find((mem) => mem.profileId === profile.id);

    if (!member) {
      return res.status(404).send("Member Not Found");
    }

    const message = await prisma.message.create({
      data: {
        content,
        fileUrl,
        channelId: channelId,
        memberId: member.id,
      },
      include: {
        member: {
          include: {
            profile: true,
          },
        },
      },
    });

    const channelKey = `chat:${channelId}:messages`;

    res?.app?.io?.emit(channelKey, message);
    res.status(200).json({ success: true, message });
  } catch (error) {
    console.log(error);
    res.status(500).send("error in sending message", error);
  }
});

router.patch("/:messageId", async (req, res) => {
  try {
    const { content } = req.body;
    const { channelId, serverId, action } = req.query;
    const { messageId } = req.params;
    const userId = req.auth.userId;
    if (!action === "delete" && !content) {
      return res.status(404).send("Missing message");
    }

    if (!userId) {
      return res.status(404).send("UnAuthorized Request");
    }
    if (!serverId) {
      return res.status(404).send("ServerId missing");
    }
    if (!channelId) {
      return res.status(404).send("Channel Id missing");
    }
    if (!messageId) {
      return res.status(404).send("messageId Id missing");
    }
    if (!action) {
      return res.status(404).send("Action Id missing");
    }

    const profile = await getProfile(userId);
    if (!profile) {
      return res.status(404).send("No user with Found");
    }

    const server = await prisma.server.findFirst({
      where: {
        id: serverId,
        members: {
          some: {
            profileId: profile.id,
          },
        },
      },
      include: {
        members: true,
      },
    });

    if (!server) {
      return res.status(404).send("No Server Found");
    }

    const channel = prisma.channel.findFirst({
      where: {
        id: channelId,
        serverId: serverId,
      },
    });

    if (!channel) {
      return res.status(404).send("No channel Found");
    }

    const member = server.members.find(
      (member) => member.profileId === profile.id
    );

    if (!member) {
      return res.status(404).send("No member Found");
    }

    let message = await prisma.message.findFirst({
      where: {
        id: messageId,
        channelId: channelId,
      },
      include: {
        member: {
          include: {
            profile: true,
          },
        },
      },
    });

    if (!message || message.deleted) {
      res.status(404).send("No message found");
    }

    const isMessageOwner = message.memberId === member.id;
    const isAdmin = member.role === MemberRole.ADMIN;
    const isModerator = member.role === MemberRole.MODERATOR;
    const canModify = isMessageOwner || isAdmin || isModerator;

    if (!canModify) {
      res.status(401).send("UnAuthorized request");
    }

    if (action === "delete") {
      message = await prisma.message.update({
        where: {
          id: messageId,
        },
        data: {
          fileUrl: null,
          content: "This message has been deleted",
          deleted: true,
        },
        include: {
          member: {
            include: {
              profile: true,
            },
          },
        },
      });
    }
    if (action === "edit") {
      if (!isMessageOwner) {
        res.status(401).send("UnAuthorized");
      }
      message = await prisma.message.update({
        where: {
          id: messageId,
        },
        data: {
          content,
        },
        include: {
          member: {
            include: {
              profile: true,
            },
          },
        },
      });
    }

    const updateKey = `chat:${channelId}:messages:update`;
    res?.app?.io?.emit(updateKey, message);
    return res.status(200).send({ success: true, message });
  } catch (error) {
    console.log(error);
  }
});

module.exports = router;
