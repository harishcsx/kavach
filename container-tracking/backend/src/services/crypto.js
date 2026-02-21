const crypto = require('crypto');

/**
 * Generates a random 32-byte secret key for a container and returns it as a hex string.
 */
const generateSecretKey = () => {
    return crypto.randomBytes(32).toString('hex');
};

/**
 * Verifies the HMAC-SHA256 signature of an IoT payload.
 * The IoT device should sign the JSON stringified payload using its secret key.
 * Expected signature format: hex
 */
const verifySignature = (payloadString, signature, secretKey) => {
    const hmac = crypto.createHmac('sha256', secretKey);
    hmac.update(payloadString);
    const calculatedSignature = hmac.digest('hex');

    return calculatedSignature === signature;
};

/**
 * Hashes an access token for storage in the DB.
 */
const hashToken = (token) => {
    return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Generates a random Delivery Permit Token that can be printed as QR or text.
 */
const generateDeliveryPermitToken = () => {
    return crypto.randomBytes(16).toString('hex');
};

module.exports = {
    generateSecretKey,
    verifySignature,
    hashToken,
    generateDeliveryPermitToken
};
