const express = require("express");
const router = express.Router();

const prisma = require("../db");
const { getProfile } = require("../lib/GetProfile");
const { MemberRole } = require("@prisma/client");

router.post("/", async (req, res) => {
  try {
    const userId = req.auth.userId;

    const { content, fileUrl } = req.body;
    const { conversationId } = req.query;

    if (!content) {
      return res.status(404).send("Missing message");
    }

    if (!userId) {
      return res.status(404).send("UnAuthorized Request");
    }
    if (!conversationId) {
      return res.status(404).send("conversationId missing");
    }

    const profile = await getProfile(userId);
    if (!profile) {
      return res.status(404).send("No user with Found");
    }

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        OR: [
          {
            memberOne: {
              profileId: profile.id,
            },
          },
          {
            memberTwo: {
              profileId: profile.id,
            },
          },
        ],
      },
      include: {
        memberOne: {
          include: {
            profile: true,
          },
        },
        memberTwo: {
          include: {
            profile: true,
          },
        },
      },
    });

    if (!conversation) {
      return res.status(404).send("No conversation Found");
    }

    const member =
      conversation.memberOne?.profileId === profile.id
        ? conversation.memberOne
        : conversation.memberTwo;

    if (!member) {
      return res.status(404).send("Member Not Found");
    }

    const message = await prisma.directMessage.create({
      data: {
        content,
        fileUrl,
        conversationId: conversationId,
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

    const channelKey = `chat:${conversationId}:messages`;

    res?.app?.io?.emit(channelKey, message);
    res.status(200).json({ success: true, message });
  } catch (error) {
    console.log(error);
    res.status(500).send("error in sending message", error);
  }
});

router.patch("/:directMessageId", async (req, res) => {
  try {
    const { content } = req.body;
    const { conversationId, action } = req.query;
    const { directMessageId } = req.params;
    const userId = req.auth.userId;
    if (!action === "delete" && !content) {
      return res.status(404).send("Missing message");
    }

    if (!userId) {
      return res.status(404).send("UnAuthorized Request");
    }
    if (!conversationId) {
      return res.status(404).send("ServerId missing");
    }
    if (!directMessageId) {
      return res.status(404).send("messageId Id missing");
    }
    if (!action) {
      return res.status(404).send("Action Id missing");
    }

    const profile = await getProfile(userId);
    if (!profile) {
      return res.status(404).send("No user with Found");
    }

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        OR: [
          {
            memberOne: {
              profileId: profile.id,
            },
          },
          {
            memberTwo: {
              profileId: profile.id,
            },
          },
        ],
      },
      include: {
        memberOne: {
          include: {
            profile: true,
          },
        },
        memberTwo: {
          include: {
            profile: true,
          },
        },
      },
    });

    if (!conversation) {
      return res.status(404).send("No conversation Found");
    }

    const member =
      conversation.memberOne?.profileId === profile.id
        ? conversation.memberOne
        : conversation.memberTwo;

    if (!member) {
      return res.status(404).send("No member Found");
    }

    let directMessage = await prisma.directMessage.findFirst({
      where: {
        id: directMessageId,
        conversationId: conversationId,
      },
      include: {
        member: {
          include: {
            profile: true,
          },
        },
      },
    });

    if (!directMessage || directMessage.deleted) {
      res.status(404).send("No message found");
    }

    const isMessageOwner = directMessage.memberId === member.id;
    const isAdmin = member.role === MemberRole.ADMIN;
    const isModerator = member.role === MemberRole.MODERATOR;
    const canModify = isMessageOwner || isAdmin || isModerator;

    if (!canModify) {
      res.status(401).send("UnAuthorized request");
    }

    if (action === "delete") {
      directMessage = await prisma.directMessage.update({
        where: {
          id: directMessageId,
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
      directMessage = await prisma.directMessage.update({
        where: {
          id: directMessageId,
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

    const updateKey = `chat:${conversationId}:messages:update`;
    res?.app?.io?.emit(updateKey, directMessage);
    return res.status(200).send({ success: true, directMessage });
  } catch (error) {
    console.log(error);
  }
});

module.exports = router;
