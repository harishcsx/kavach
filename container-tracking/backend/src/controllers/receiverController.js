const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const cryptoSvc = require('../services/crypto');
const blockchainSvc = require('../services/blockchain');
const jwt = require('jsonwebtoken');

const activatePermit = async (req, res) => {
    try {
        const { permitToken } = req.body;

        // Hash the cleartext token
        const tokenHash = cryptoSvc.hashToken(permitToken);

        // Find valid permit
        const grant = await prisma.accessGrant.findFirst({
            where: {
                tokenHash,
                isUsed: false,
                expiresAt: { gt: new Date() }
            },
            include: { container: true }
        });

        if (!grant) return res.status(403).json({ error: "Invalid or expired permit token" });

        // Normally this creates a temporary session. For demo, we just return a special receiver token
        const payload = {
            id: req.user.id,
            role: req.user.role,
            authorizedContainerId: grant.containerId
        };

        const sessionToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '2h' });

        res.json({ message: "Permit verified. Ready for RFID scan.", sessionToken, containerId: grant.containerId });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Permit activation failed" });
    }
};

const scanRfid = async (req, res) => {
    try {
        const { containerId, rfidUid } = req.body;

        // The user session must be authorized for this specific container
        if (req.user.authorizedContainerId !== containerId) {
            return res.status(403).json({ error: "Unauthorized receiver for this container" });
        }

        const container = await prisma.container.findUnique({
            where: { id: containerId },
            include: { telemetry: true }
        });

        if (!container) return res.status(404).json({ error: "Container not found" });

        // Check conditions:
        // 1. RFID matches
        // 2. Not tampered (In our demo, if multiple events of TAMPER exist, it's tampered)
        const isTampered = container.telemetry.some(t => t.sealBroken || t.lightDetected || t.abnormalMotion);

        let eventType;
        let description;
        let txHash;

        if (isTampered || container.rfidUid !== rfidUid) { // For demo, assume rfidUid matches DB or DB rfidUid is null on initialize and patched
            eventType = 'REJECTED';
            description = `Delivery rejected. Reason: ${isTampered ? 'Tampered' : 'RFID Mismatch'}`;
            txHash = await blockchainSvc.logRejected(container.id, description);
            res.status(403).json({ error: description, txHash });
        } else {
            eventType = 'DELIVERED';
            description = `Container successfully delivered.`;

            // Mark grant as used
            await prisma.accessGrant.updateMany({
                where: { containerId: container.id, isUsed: false },
                data: { isUsed: true }
            });

            // Update container state
            await prisma.container.update({
                where: { id: container.id },
                data: { status: 'DELIVERED' }
            });

            txHash = await blockchainSvc.logDelivered(container.id, req.user.id);
            res.status(200).json({ message: description, txHash });
        }

        await prisma.event.create({
            data: {
                containerId: container.id,
                eventType,
                description,
                txHash
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Scan processing failed" });
    }
};

module.exports = { activatePermit, scanRfid };
