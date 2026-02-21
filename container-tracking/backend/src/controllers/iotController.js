const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const cryptoSvc = require('../services/crypto');
const blockchainSvc = require('../services/blockchain');
const { getIo } = require('../../socket');

const syncTelemetry = async (req, res) => {
    try {
        const signature = req.headers['x-device-signature'];
        const payloadBuffer = JSON.stringify(req.body);
        const { containerNumber, sealBroken, lightDetected, abnormalMotion } = req.body;

        if (!signature) return res.status(401).json({ error: "Missing signature" });

        const container = await prisma.container.findUnique({
            where: { containerNumber }
        });

        if (!container) return res.status(404).json({ error: "Container not found" });

        // Verify 
        const isValid = cryptoSvc.verifySignature(payloadBuffer, signature, container.secretKey);
        if (!isValid) return res.status(401).json({ error: "Invalid signature" });

        // Store telemetry
        await prisma.telemetry.create({
            data: {
                containerId: container.id,
                sealBroken,
                lightDetected,
                abnormalMotion
            }
        });

        // Check for anomalies indicating tamper
        if (sealBroken || lightDetected || abnormalMotion) {
            let reason = [];
            if (sealBroken) reason.push("Seal Broken");
            if (lightDetected) reason.push("Light Detected inside");
            if (abnormalMotion) reason.push("Abnormal Motion");

            const reasonStr = reason.join(", ");

            // Blockchain Log
            const txHash = await blockchainSvc.logTamper(container.id, reasonStr);

            await prisma.event.create({
                data: {
                    containerId: container.id,
                    eventType: 'TAMPER',
                    description: `Tamper detected: ${reasonStr}`,
                    txHash
                }
            });

            // Realtime alert over Socket
            const io = getIo();
            io.emit('tamperAlerts', {
                containerNumber,
                containerId: container.id,
                reason: reasonStr,
                timestamp: new Date()
            });
        }

        res.status(200).json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Sync failed" });
    }
};

module.exports = { syncTelemetry };
