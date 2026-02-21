const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const cryptoSvc = require('../services/crypto');
const blockchainSvc = require('../services/blockchain');

const createContainer = async (req, res) => {
    try {
        const { batchNumber, containerNumber } = req.body;

        // Generate a secure secret key for this container
        const secretKey = cryptoSvc.generateSecretKey();

        const container = await prisma.container.create({
            data: {
                batchNumber,
                containerNumber,
                secretKey,
                manufacturerId: req.user.id
            }
        });

        // Blockchain Log
        const txHash = await blockchainSvc.logManufactured(container.id, batchNumber, req.user.id);
        if (txHash) {
            await prisma.event.create({
                data: {
                    containerId: container.id,
                    eventType: 'MANUFACTURED',
                    description: `Container ${containerNumber} manufactured.`,
                    txHash
                }
            });
        }

        // Return the secretKey only ONCE during creation so the ESP32 can be programmed
        res.status(201).json({ container, secretKey, txHash });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to create container" });
    }
};

const dispatchContainer = async (req, res) => {
    try {
        const { containerId } = req.params;

        const container = await prisma.container.update({
            where: { id: containerId },
            data: { status: 'DISPATCHED' }
        });

        // Blockchain Log
        const txHash = await blockchainSvc.logDispatched(container.id);
        if (txHash) {
            await prisma.event.create({
                data: {
                    containerId: container.id,
                    eventType: 'DISPATCHED',
                    description: `Container ${container.containerNumber} dispatched.`,
                    txHash
                }
            });
        }

        res.json({ message: "Container dispatched", container, txHash });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to dispatch container" });
    }
};

const generateDeliveryPermit = async (req, res) => {
    try {
        const { containerId } = req.params;
        const { expiresInHours } = req.body;

        const token = cryptoSvc.generateDeliveryPermitToken();
        const tokenHash = cryptoSvc.hashToken(token);
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + (expiresInHours || 24));

        await prisma.accessGrant.create({
            data: {
                containerId,
                tokenHash,
                expiresAt
            }
        });

        // In a real scenario, this Token would be securely sent to the receiver (e.g., via SMS/Email)
        res.status(201).json({ message: "Permit generated", token, expiresAt });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to generate permit" });
    }
};

const getContainers = async (req, res) => {
    try {
        const containers = await prisma.container.findMany({
            include: {
                events: true,
            }
        });
        res.json(containers);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch containers" });
    }
};

const getContainerDetails = async (req, res) => {
    try {
        const { containerId } = req.params;
        const container = await prisma.container.findUnique({
            where: { id: containerId },
            include: {
                telemetry: { orderBy: { createdAt: 'desc' } },
                events: { orderBy: { createdAt: 'desc' } }
            }
        });

        if (!container) return res.status(404).json({ error: "Not found" });

        res.json(container);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch container details" });
    }
};

module.exports = { createContainer, dispatchContainer, generateDeliveryPermit, getContainers, getContainerDetails };
