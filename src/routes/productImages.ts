import { Router } from "express";
import { getProductImages } from "../controllers/productImages.controller.js";
import { authenticateToken } from "../middleware/auth.js";

const router = Router();

/**
 * @swagger
 * /product-images:
 *   post:
 *     summary: Fetch cached product image thumbnails for receipt items
 *     tags: [ProductImages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productNames]
 *             properties:
 *               productNames:
 *                 type: array
 *                 items: { type: string }
 *                 example: ["Coca Cola", "Bread", "Apples"]
 *     responses:
 *       200:
 *         description: Product names with image URLs, or null when no image is available
 */
router.post("/", authenticateToken, getProductImages);

export default router;
