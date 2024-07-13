// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../../mixins/PermitAndCall.sol";
import "hardhat/console.sol"; // TODO: remove

contract PermitAndCallMock is PermitAndCall {
    using SafeERC20 for IERC20;

    event FooCalled();
    event FooTransferCalled();
    event MsgValue(uint256 value);
    event MsgValueTransfer(uint256 value);

    function foo() external {
        emit FooCalled();
    }

    function fooTransfer(address token, address to, uint256 amount, bool usePermit2) external {
        IERC20(token).safeTransferFromUniversal(msg.sender, to, amount, usePermit2);
        emit FooTransferCalled();
    }

    function payableFoo() external payable {
        emit MsgValue(msg.value);
    }

    function payableFooTransfer(address token, address to, uint256 amount, bool usePermit2) external payable {
        IERC20(token).safeTransferFromUniversal(msg.sender, to, amount, usePermit2);
        emit MsgValueTransfer(msg.value);
    }
}
