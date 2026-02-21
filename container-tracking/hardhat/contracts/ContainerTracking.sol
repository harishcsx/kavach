// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ContainerTracking {
    address public owner;

    // Events mapped directly from requirements
    event MANUFACTURED(string containerId, string batchNumber, string manufacturerId, uint256 timestamp);
    event DISPATCHED(string containerId, uint256 timestamp);
    event TAMPER(string containerId, string reason, uint256 timestamp);
    event DELIVERED(string containerId, address receiver, uint256 timestamp);
    event REJECTED(string containerId, string reason, uint256 timestamp);
    event ACCESS_GRANTED(string containerId, address receiver, uint256 timestamp);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner (backend) can log events");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // Since the backend verifies IoT signatures, the contract acts as an immutable log
    // Only the backend (owner) can write to it to save on complex on-chain signature verification and gas

    function logManufactured(string memory containerId, string memory batchNumber, string memory manufacturerId) external onlyOwner {
        emit MANUFACTURED(containerId, batchNumber, manufacturerId, block.timestamp);
    }

    function logDispatched(string memory containerId) external onlyOwner {
        emit DISPATCHED(containerId, block.timestamp);
    }

    function logTamper(string memory containerId, string memory reason) external onlyOwner {
        emit TAMPER(containerId, reason, block.timestamp);
    }

    function logDelivered(string memory containerId, address receiver) external onlyOwner {
        emit DELIVERED(containerId, receiver, block.timestamp);
    }

    function logRejected(string memory containerId, string memory reason) external onlyOwner {
        emit REJECTED(containerId, reason, block.timestamp);
    }

    function logAccessGranted(string memory containerId, address receiver) external onlyOwner {
        emit ACCESS_GRANTED(containerId, receiver, block.timestamp);
    }
}
