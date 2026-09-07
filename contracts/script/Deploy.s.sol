// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {ENStrologyPay} from "../src/ENStrologyPay.sol";

contract DeployENStrologyPay is Script {
    function run() public {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        address demoUSDC = 0x768F42455A2D082E23ceeF7d51e5787C82d67a39;
        address treasury = 0xfb93Bb10a68265925Aa4A193b466aA6920bF0D06;
        address owner = 0xfb93Bb10a68265925Aa4A193b466aA6920bF0D06;

        ENStrologyPay pay = new ENStrologyPay(demoUSDC, treasury, owner);

        vm.stopBroadcast();

        console.log("ENStrologyPay deployed at:", address(pay));
    }
}
