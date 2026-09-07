// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ENStrologyPay} from "../src/ENStrologyPay.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @dev Stand-in for Sepolia mock USDC (6 decimals).
contract DemoUSDC is ERC20 {
    constructor() ERC20("Demo USDC", "dUSDC") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract ENStrologyPayTest is Test {
    ENStrologyPay pay;
    DemoUSDC usdc;

    address owner    = makeAddr("owner");
    address treasury = makeAddr("treasury");
    address pamela   = makeAddr("pamela");
    address stranger = makeAddr("stranger");

    bytes32 constant SOURCE  = keccak256("pamela.eth");
    bytes32 constant READING = keccak256("pamela-20260907.oracle.enscope.eth");

    event ReadingPurchased(
        address indexed buyer,
        bytes32 indexed sourceNamehash,
        bytes32 indexed readingNamehash,
        uint256 amount,
        uint256 timestamp
    );
    event ReadingVisibilityChanged(bytes32 indexed readingNamehash, bool isPublic, uint256 timestamp);

    function setUp() public {
        usdc = new DemoUSDC();
        pay  = new ENStrologyPay(address(usdc), treasury, owner);

        usdc.mint(pamela, 1_000_000);       // 1 demo USDC
        vm.prank(pamela);
        usdc.approve(address(pay), type(uint256).max);
    }

    // --- price ---

    function test_PriceIsPointZeroOneUSDC() public view {
        assertEq(pay.PRICE(), 10_000);      // 0.01 * 10^6
    }

    // --- purchase ---

    function test_PurchaseMovesExactlyPriceToTreasury() public {
        uint256 before = usdc.balanceOf(pamela);

        vm.prank(pamela);
        pay.purchaseReading(SOURCE, READING);

        assertEq(usdc.balanceOf(treasury), 10_000);
        assertEq(usdc.balanceOf(pamela), before - 10_000);
    }

    function test_PurchaseRecordsBuyerAndSource() public {
        vm.prank(pamela);
        pay.purchaseReading(SOURCE, READING);

        (address buyer, bytes32 src,, bool published) = pay.readings(READING);
        assertEq(buyer, pamela);
        assertEq(src, SOURCE);
        assertFalse(published);
        assertTrue(pay.hasPurchased(pamela, SOURCE));
        assertFalse(pay.hasPurchased(stranger, SOURCE));
    }

    function test_PurchaseEmitsEvent() public {
        vm.expectEmit(true, true, true, true);
        emit ReadingPurchased(pamela, SOURCE, READING, 10_000, block.timestamp);

        vm.prank(pamela);
        pay.purchaseReading(SOURCE, READING);
    }

    /// @dev Replay protection: the same reading name cannot be bought twice.
    function test_RevertWhen_SameReadingPurchasedTwice() public {
        vm.prank(pamela);
        pay.purchaseReading(SOURCE, READING);

        vm.expectRevert(abi.encodeWithSelector(ENStrologyPay.AlreadyPurchased.selector, READING));
        vm.prank(pamela);
        pay.purchaseReading(SOURCE, READING);
    }

    function test_RevertWhen_SomeoneElseReplaysTheReadingName() public {
        vm.prank(pamela);
        pay.purchaseReading(SOURCE, READING);

        usdc.mint(stranger, 1_000_000);
        vm.prank(stranger);
        usdc.approve(address(pay), type(uint256).max);

        vm.expectRevert(abi.encodeWithSelector(ENStrologyPay.AlreadyPurchased.selector, READING));
        vm.prank(stranger);
        pay.purchaseReading(SOURCE, READING);
    }

    function test_RevertWhen_NamehashIsZero() public {
        vm.expectRevert(ENStrologyPay.ZeroNamehash.selector);
        vm.prank(pamela);
        pay.purchaseReading(bytes32(0), READING);
    }

    function test_RevertWhen_BuyerHasNoTokens() public {
        vm.prank(stranger);
        usdc.approve(address(pay), type(uint256).max);

        vm.prank(stranger);
        vm.expectRevert();
        pay.purchaseReading(SOURCE, READING);
    }

    // --- visibility ---

    function test_OwnerCanPublishAndUnpublish() public {
        vm.startPrank(pamela);
        pay.purchaseReading(SOURCE, READING);

        assertFalse(pay.isPublished(READING));

        vm.expectEmit(true, false, false, true);
        emit ReadingVisibilityChanged(READING, true, block.timestamp);
        pay.setReadingPublished(READING, true);
        assertTrue(pay.isPublished(READING));

        pay.setReadingPublished(READING, false);
        assertFalse(pay.isPublished(READING));
        vm.stopPrank();
    }

    function test_RevertWhen_StrangerTriesToPublish() public {
        vm.prank(pamela);
        pay.purchaseReading(SOURCE, READING);

        vm.expectRevert(abi.encodeWithSelector(ENStrologyPay.NotReadingOwner.selector, stranger));
        vm.prank(stranger);
        pay.setReadingPublished(READING, true);
    }

    function test_RevertWhen_PublishingUnknownReading() public {
        bytes32 ghost = keccak256("never-bought.eth");
        vm.expectRevert(abi.encodeWithSelector(ENStrologyPay.UnknownReading.selector, ghost));
        vm.prank(pamela);
        pay.setReadingPublished(ghost, true);
    }

    // --- treasury ---

    function test_OwnerCanChangeTreasury() public {
        address newTreasury = makeAddr("newTreasury");
        vm.prank(owner);
        pay.setTreasury(newTreasury);
        assertEq(pay.treasury(), newTreasury);
    }

    function test_RevertWhen_NonOwnerChangesTreasury() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, pamela));
        vm.prank(pamela);
        pay.setTreasury(pamela);
    }
}
