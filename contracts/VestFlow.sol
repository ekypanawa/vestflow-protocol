// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title VestFlow Protocol
/// @notice Native OPN vesting vault for transparent fund locking and contributor distribution.
contract VestFlow {
    struct Vault {
        address creator;
        address recipient;
        uint256 amount;
        uint256 claimed;
        uint64 start;
        uint64 cliff;
        uint64 duration;
        bool cancelled;
        string title;
    }

    uint256 public nextVaultId;
    mapping(uint256 => Vault) public vaults;
    mapping(address => uint256[]) private createdVaults;
    mapping(address => uint256[]) private recipientVaults;

    event VaultCreated(
        uint256 indexed vaultId,
        address indexed creator,
        address indexed recipient,
        uint256 amount,
        uint64 start,
        uint64 cliff,
        uint64 duration,
        string title
    );

    event Claimed(uint256 indexed vaultId, address indexed recipient, uint256 amount);
    event VaultCancelled(uint256 indexed vaultId, uint256 paidToRecipient, uint256 returnedToCreator);

    error InvalidRecipient();
    error InvalidAmount();
    error InvalidSchedule();
    error NotRecipient();
    error NotCreator();
    error NothingToClaim();
    error CancelledVault();
    error TransferFailed();

    function createVault(
        address recipient,
        uint64 cliffSeconds,
        uint64 durationSeconds,
        string calldata title
    ) external payable returns (uint256 vaultId) {
        if (recipient == address(0)) revert InvalidRecipient();
        if (msg.value == 0) revert InvalidAmount();
        if (durationSeconds == 0 || cliffSeconds > durationSeconds) revert InvalidSchedule();

        vaultId = nextVaultId++;
        uint64 start = uint64(block.timestamp);

        vaults[vaultId] = Vault({
            creator: msg.sender,
            recipient: recipient,
            amount: msg.value,
            claimed: 0,
            start: start,
            cliff: cliffSeconds,
            duration: durationSeconds,
            cancelled: false,
            title: title
        });

        createdVaults[msg.sender].push(vaultId);
        recipientVaults[recipient].push(vaultId);

        emit VaultCreated(vaultId, msg.sender, recipient, msg.value, start, cliffSeconds, durationSeconds, title);
    }

    function vestedAmount(uint256 vaultId) public view returns (uint256) {
        Vault memory vault = vaults[vaultId];

        if (vault.cancelled) return vault.claimed;
        if (block.timestamp < vault.start + vault.cliff) return 0;
        if (block.timestamp >= vault.start + vault.duration) return vault.amount;

        uint256 elapsed = block.timestamp - vault.start;
        return (vault.amount * elapsed) / vault.duration;
    }

    function claimableAmount(uint256 vaultId) public view returns (uint256) {
        Vault memory vault = vaults[vaultId];
        uint256 vested = vestedAmount(vaultId);
        if (vested <= vault.claimed) return 0;
        return vested - vault.claimed;
    }

    function claim(uint256 vaultId) external {
        Vault storage vault = vaults[vaultId];
        if (vault.cancelled) revert CancelledVault();
        if (msg.sender != vault.recipient) revert NotRecipient();

        uint256 claimable = claimableAmount(vaultId);
        if (claimable == 0) revert NothingToClaim();

        vault.claimed += claimable;
        (bool success, ) = vault.recipient.call{value: claimable}("");
        if (!success) revert TransferFailed();

        emit Claimed(vaultId, vault.recipient, claimable);
    }

    function cancelVault(uint256 vaultId) external {
        Vault storage vault = vaults[vaultId];
        if (msg.sender != vault.creator) revert NotCreator();
        if (vault.cancelled) revert CancelledVault();

        uint256 vested = vestedAmount(vaultId);
        uint256 owedToRecipient = vested > vault.claimed ? vested - vault.claimed : 0;
        uint256 returnedToCreator = vault.amount - vault.claimed - owedToRecipient;

        vault.cancelled = true;
        vault.claimed = vault.amount;

        if (owedToRecipient > 0) {
            (bool paid, ) = vault.recipient.call{value: owedToRecipient}("");
            if (!paid) revert TransferFailed();
        }

        if (returnedToCreator > 0) {
            (bool returned, ) = vault.creator.call{value: returnedToCreator}("");
            if (!returned) revert TransferFailed();
        }

        emit VaultCancelled(vaultId, owedToRecipient, returnedToCreator);
    }

    function getCreatedVaults(address creator) external view returns (uint256[] memory) {
        return createdVaults[creator];
    }

    function getRecipientVaults(address recipient) external view returns (uint256[] memory) {
        return recipientVaults[recipient];
    }
}
