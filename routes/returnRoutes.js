const express = require("express");

const {
    getReturns,
    getReturnById,
    createReturn,
    updateReturnStatus,
    inspectReturn,
    restockReturn,
} = require("../controllers/returnController");

const { verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(verifyToken);

router.get("/", getReturns);

router.get("/:id", getReturnById);

router.post("/", createReturn);

router.patch("/:id/status", updateReturnStatus);

router.post("/:id/inspect", inspectReturn);

router.post("/:id/restock", restockReturn);

module.exports = router;