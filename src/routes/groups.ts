import { Router } from "express";
import type { Response } from "express";
import { authenticateToken, type AuthRequest } from "../middleware/auth.js";

const router = Router();

// In-memory mock groups storage
interface MockMember {
  id: number;
  uniqueId: string;
  username: string;
  avatarUrl: string | null;
  role: 'owner' | 'member';
}

interface MockGroup {
  id: number;
  name: string;
  ownerId: number;
  createdAt: string;
  members: MockMember[];
}

const mockGroupsStorage: Map<number, MockGroup[]> = new Map();

function getUserGroups(userId: number): MockGroup[] {
  if (!mockGroupsStorage.has(userId)) {
    // Initialize with default groups
    mockGroupsStorage.set(userId, [
      {
        id: 1,
        name: "Family",
        ownerId: userId,
        createdAt: new Date().toISOString(),
        members: [
          { id: userId, uniqueId: '#' + String(userId).padStart(4, '0'), username: 'You', avatarUrl: null, role: 'owner' },
          { id: 101, uniqueId: '#0101', username: 'Alice', avatarUrl: 'https://ui-avatars.com/api/?name=Alice&background=2ECC71&color=fff', role: 'member' },
          { id: 102, uniqueId: '#0102', username: 'Bob', avatarUrl: 'https://ui-avatars.com/api/?name=Bob&background=3498DB&color=fff', role: 'member' },
        ],
      },
      {
        id: 2,
        name: "Work Team",
        ownerId: userId,
        createdAt: new Date().toISOString(),
        members: [
          { id: userId, uniqueId: '#' + String(userId).padStart(4, '0'), username: 'You', avatarUrl: null, role: 'owner' },
          { id: 103, uniqueId: '#0103', username: 'Charlie', avatarUrl: 'https://ui-avatars.com/api/?name=Charlie&background=E74C3C&color=fff', role: 'member' },
        ],
      },
    ]);
  }
  return mockGroupsStorage.get(userId)!;
}

let nextGroupId = 100;

/**
 * @swagger
 * tags:
 *   name: Groups
 *   description: Group management (create, list, members)
 */

/**
 * POST /groups - Create a group
 */
router.post("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!name) return res.status(400).json({ error: "Name is required" });

    const groups = getUserGroups(req.user.id);
    const newGroup: MockGroup = {
      id: ++nextGroupId,
      name,
      ownerId: req.user.id,
      createdAt: new Date().toISOString(),
      members: [
        { id: req.user.id, uniqueId: '#' + String(req.user.id).padStart(4, '0'), username: 'You', avatarUrl: null, role: 'owner' },
      ],
    };
    groups.push(newGroup);

    console.log("POST /groups created:", { id: newGroup.id, name });
    return res.json(newGroup);
  } catch (err) {
    console.error("POST /groups error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /groups - List groups for current user
 */
router.get("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    
    const groups = getUserGroups(req.user.id);
    console.log("GET /groups - returning groups:", groups.length);
    return res.json(groups);
  } catch (err) {
    console.error("GET /groups error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /groups/lookup - Find group by name
 */
router.get("/lookup", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const name = String(req.query.name || "").trim().toLowerCase();
    if (!name) return res.status(400).json({ error: "name is required" });

    const groups = getUserGroups(req.user.id);
    const group = groups.find(g => g.name.toLowerCase() === name);
    
    if (!group) return res.status(404).json({ error: "Group not found" });
    return res.json({ id: group.id, name: group.name });
  } catch (err) {
    console.error("GET /groups/lookup error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /groups/:groupId - Get group details
 */
router.get("/:groupId", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const groupId = Number(req.params.groupId);
    if (!Number.isFinite(groupId)) return res.status(400).json({ error: "Invalid groupId" });

    const groups = getUserGroups(req.user.id);
    const group = groups.find(g => g.id === groupId);
    
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    console.log("GET /groups/:groupId - returning group:", groupId);
    return res.json({
      group: { id: group.id, name: group.name },
      role: group.ownerId === req.user.id ? "owner" : "member",
      members: group.members,
    });
  } catch (err) {
    console.error("GET /groups/:groupId error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * PATCH /groups/:groupId - Rename group
 */
router.patch("/:groupId", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const groupId = Number(req.params.groupId);
    if (!Number.isFinite(groupId)) return res.status(400).json({ error: "Invalid groupId" });
    
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!name) return res.status(400).json({ error: "Name is required" });

    const groups = getUserGroups(req.user.id);
    const group = groups.find(g => g.id === groupId);
    
    if (!group) return res.status(404).json({ error: "Group not found" });
    
    group.name = name;
    console.log("PATCH /groups/:groupId renamed:", { id: groupId, name });
    return res.json(group);
  } catch (err) {
    console.error("PATCH /groups/:groupId error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * DELETE /groups/:groupId - Delete group
 */
router.delete("/:groupId", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const groupId = Number(req.params.groupId);
    if (!Number.isFinite(groupId)) return res.status(400).json({ error: "Invalid groupId" });

    const groups = getUserGroups(req.user.id);
    const index = groups.findIndex(g => g.id === groupId);
    
    if (index === -1) return res.status(404).json({ error: "Group not found" });
    
    groups.splice(index, 1);
    console.log("DELETE /groups/:groupId deleted:", { id: groupId });
    return res.json({ success: true });
  } catch (err) {
    console.error("DELETE /groups/:groupId error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /groups/:groupId/invite - Create invite token (mock)
 */
router.post("/:groupId/invite", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const groupId = Number(req.params.groupId);
    if (!Number.isFinite(groupId)) return res.status(400).json({ error: "Invalid groupId" });

    const groups = getUserGroups(req.user.id);
    const group = groups.find(g => g.id === groupId);
    
    if (!group) return res.status(404).json({ error: "Group not found" });

    // Mock invite
    const mockToken = `mock_invite_${groupId}_${Date.now()}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    
    console.log("POST /groups/:groupId/invite created:", { groupId });
    return res.json({
      token: mockToken,
      url: `http://localhost:3001/groups/join?token=${mockToken}`,
      expiresAt,
    });
  } catch (err) {
    console.error("POST /groups/:groupId/invite error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /groups/join - Join group via invite token (mock)
 */
router.post("/join", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
    if (!token) return res.status(400).json({ error: "token is required" });

    // Mock join - just return success
    console.log("POST /groups/join");
    return res.json({
      joined: true,
      friendship: "created",
      member: "created",
    });
  } catch (err) {
    console.error("POST /groups/join error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /groups/:groupId/members - Add member
 */
router.post("/:groupId/members", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const groupId = Number(req.params.groupId);
    if (!Number.isFinite(groupId)) return res.status(400).json({ error: "Invalid groupId" });

    const uniqueId = typeof req.body?.uniqueId === "string" ? req.body.uniqueId.trim() : "";
    if (!uniqueId) return res.status(400).json({ error: "uniqueId is required" });

    const groups = getUserGroups(req.user.id);
    const group = groups.find(g => g.id === groupId);
    
    if (!group) return res.status(404).json({ error: "Group not found" });

    // Check if already member
    if (group.members.some(m => m.uniqueId === uniqueId)) {
      return res.json({ success: true, alreadyMember: true });
    }

    // Add new member
    const newMemberId = 200 + Math.floor(Math.random() * 1000);
    const name = uniqueId.replace('#', 'User');
    group.members.push({
      id: newMemberId,
      uniqueId,
      username: name,
      avatarUrl: `https://ui-avatars.com/api/?name=${name}&background=random&color=fff`,
      role: 'member',
    });

    console.log("POST /groups/:groupId/members added:", { groupId, uniqueId });
    return res.json({ success: true });
  } catch (err) {
    console.error("POST /groups/:groupId/members error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * DELETE /groups/:groupId/members/:uniqueId - Remove member
 */
router.delete("/:groupId/members/:uniqueId", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const groupId = Number(req.params.groupId);
    if (!Number.isFinite(groupId)) return res.status(400).json({ error: "Invalid groupId" });
    
    const uniqueId = String(req.params.uniqueId || "").trim();
    if (!uniqueId) return res.status(400).json({ error: "Invalid uniqueId" });

    const groups = getUserGroups(req.user.id);
    const group = groups.find(g => g.id === groupId);
    
    if (!group) return res.status(404).json({ error: "Group not found" });

    const memberIndex = group.members.findIndex(m => m.uniqueId === uniqueId);
    if (memberIndex === -1) return res.json({ success: true, removed: false });

    // Don't allow removing owner
    const member = group.members[memberIndex];
    if (member && member.role === 'owner') {
      return res.status(400).json({ error: "Cannot remove the group owner" });
    }

    group.members.splice(memberIndex, 1);
    console.log("DELETE /groups/:groupId/members/:uniqueId removed:", { groupId, uniqueId });
    return res.json({ success: true, removed: true });
  } catch (err) {
    console.error("DELETE /groups/:groupId/members/:uniqueId error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /groups/:groupId/leave - Leave group
 */
router.post("/:groupId/leave", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const groupId = Number(req.params.groupId);
    if (!Number.isFinite(groupId)) return res.status(400).json({ error: "Invalid groupId" });

    const groups = getUserGroups(req.user.id);
    const group = groups.find(g => g.id === groupId);
    
    if (!group) return res.status(404).json({ error: "Group not found" });

    if (group.ownerId === req.user.id) {
      return res.status(400).json({ error: "Owner cannot leave; transfer ownership first" });
    }

    // Remove self from members
    const memberIndex = group.members.findIndex(m => m.id === req.user!.id);
    if (memberIndex !== -1) {
      group.members.splice(memberIndex, 1);
    }

    console.log("POST /groups/:groupId/leave:", { groupId, userId: req.user.id });
    return res.json({ success: true, message: "Left group" });
  } catch (err) {
    console.error("POST /groups/:groupId/leave error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * PATCH /groups/:groupId/members/:uniqueId/promote - Transfer ownership
 */
router.patch("/:groupId/members/:uniqueId/promote", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const groupId = Number(req.params.groupId);
    const uniqueId = String(req.params.uniqueId || "").trim();
    if (!Number.isFinite(groupId)) return res.status(400).json({ error: "Invalid groupId" });
    if (!uniqueId) return res.status(400).json({ error: "Invalid uniqueId" });

    const groups = getUserGroups(req.user.id);
    const group = groups.find(g => g.id === groupId);
    
    if (!group) return res.status(404).json({ error: "Group not found" });

    const member = group.members.find(m => m.uniqueId === uniqueId);
    if (!member) return res.status(404).json({ error: "User is not a group member" });

    // Transfer ownership
    const oldOwner = group.members.find(m => m.role === 'owner');
    if (oldOwner) oldOwner.role = 'member';
    member.role = 'owner';
    group.ownerId = member.id;

    console.log("PATCH /groups/:groupId/members/:uniqueId/promote:", { groupId, newOwner: uniqueId });
    return res.json({ success: true, transferred: true });
  } catch (err) {
    console.error("PATCH /groups/:groupId/members/:uniqueId/promote error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
