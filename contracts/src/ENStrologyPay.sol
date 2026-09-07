// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title ENStrologyPay
/// @notice Payment and visibility registry for ENStrology horoscope readings.
/// @dev Payments use a DEMO/TEST token on Sepolia with no monetary value.
///      This contract is the single source of truth for whether a reading is public;
///      the horoscope.public ENS text record is only a convenience mirror.
contract ENStrologyPay is Ownable {
    using SafeERC20 for IERC20;

    /// @notice DEMO/TEST currency (Sepolia mock USDC). Not real money.
    IERC20 public immutable demoToken;

    /// @notice Fixed price: 0.01 demo USDC (6 decimals).
    uint256 public constant PRICE = 10_000;

    /// @notice Wallet that receives demo payments.
    address public treasury;

    struct Reading {
        address buyer;
        bytes32 sourceNamehash;
        uint256 purchasedAt;
        bool published;
    }

    /// @notice readingNamehash => reading record
    mapping(bytes32 => Reading) public readings;

    /// @dev wallet => sourceNamehash => purchased
    mapping(address => mapping(bytes32 => bool)) private _purchased;

    event ReadingPurchased(
        address indexed buyer,
        bytes32 indexed sourceNamehash,
        bytes32 indexed readingNamehash,
        uint256 amount,
        uint256 timestamp
    );
    event ReadingVisibilityChanged(bytes32 indexed readingNamehash, bool isPublic, uint256 timestamp);
    event TreasuryChanged(address indexed previousTreasury, address indexed newTreasury);

    error AlreadyPurchased(bytes32 readingNamehash);
    error UnknownReading(bytes32 readingNamehash);
    error NotReadingOwner(address caller);
    error ZeroAddress();
    error ZeroNamehash();

    constructor(address demoToken_, address treasury_, address owner_) Ownable(owner_) {
        if (demoToken_ == address(0) || treasury_ == address(0)) revert ZeroAddress();
        demoToken = IERC20(demoToken_);
        treasury = treasury_;
    }

    /// @notice Pay 0.01 demo USDC to reserve one reading name.
    /// @dev The reading label is deterministic, so its namehash is computed
    ///      off-chain and passed in before the ENSv2 subname is registered.
    function purchaseReading(bytes32 sourceNamehash, bytes32 readingNamehash) external {
        if (sourceNamehash == bytes32(0) || readingNamehash == bytes32(0)) revert ZeroNamehash();
        // Replay protection: each reading name can only be purchased once.
        if (readings[readingNamehash].buyer != address(0)) revert AlreadyPurchased(readingNamehash);

        readings[readingNamehash] = Reading({
            buyer: msg.sender,
            sourceNamehash: sourceNamehash,
            purchasedAt: block.timestamp,
            published: false
        });
        _purchased[msg.sender][sourceNamehash] = true;

        demoToken.safeTransferFrom(msg.sender, treasury, PRICE);

        emit ReadingPurchased(msg.sender, sourceNamehash, readingNamehash, PRICE, block.timestamp);
    }

    /// @notice Has this wallet paid for a reading of this source ENS name?
    function hasPurchased(address wallet, bytes32 sourceNamehash) external view returns (bool) {
        return _purchased[wallet][sourceNamehash];
    }

    /// @notice Only the buyer may publish or unpublish their reading.
    function setReadingPublished(bytes32 readingNamehash, bool isPublic) external {
        Reading storage r = readings[readingNamehash];
        if (r.buyer == address(0)) revert UnknownReading(readingNamehash);
        if (r.buyer != msg.sender) revert NotReadingOwner(msg.sender);

        r.published = isPublic;
        emit ReadingVisibilityChanged(readingNamehash, isPublic, block.timestamp);
    }

    function isPublished(bytes32 readingNamehash) external view returns (bool) {
        return readings[readingNamehash].published;
    }

    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();
        emit TreasuryChanged(treasury, newTreasury);
        treasury = newTreasury;
    }
}
