import { expect } from '../../src/expect';
import { defaultDeadlinePermit2, getPermit, getPermit2, permit2Contract, trim0x } from '../../src/permit';
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { PermitAndCallMock } from '../../typechain-types';

const value = 42n;

describe('Permitable', function () {
    let signer1: SignerWithAddress;
    let signer2: SignerWithAddress;

    before(async function () {
        [signer1, signer2] = await ethers.getSigners();
    });

    async function deployTokens() {
        const PermitAndCallMockFactory = await ethers.getContractFactory('PermitAndCallMock');
        const ERC20PermitMockFactory = await ethers.getContractFactory('ERC20PermitMock');
        const chainId = Number((await ethers.provider.getNetwork()).chainId);
        const permitAndCallMock = <PermitAndCallMock><unknown> await PermitAndCallMockFactory.deploy();
        const erc20PermitMock = await ERC20PermitMockFactory.deploy('USDC', 'USDC', signer1, 100n);
        return { permitAndCallMock, erc20PermitMock, chainId };
    }

    it('should work with valid permit', async function () {
        const { permitAndCallMock, erc20PermitMock, chainId } = await loadFixture(deployTokens);
        const permit = await getPermit(signer1, erc20PermitMock, '1', chainId, await permitAndCallMock.getAddress(), value.toString(), 0x8fffffff.toString(), true);
        const permitData = erc20PermitMock.target + trim0x(permit);
        const tx = await permitAndCallMock.permitAndCall(permitData, (await permitAndCallMock.fooTransfer.populateTransaction(erc20PermitMock.target, signer2, value, false)).data);
        
        await expect(tx).to.emit(permitAndCallMock, 'FooTransferCalled');
        expect(await erc20PermitMock.balanceOf(signer2.address)).to.eq(value);
    });

    it('should work with invalid permit', async function () {
        const { permitAndCallMock, erc20PermitMock, chainId } = await loadFixture(deployTokens);
        const badPermit = await getPermit(signer1, erc20PermitMock, '2', chainId, await permitAndCallMock.getAddress(), value.toString(), 0x8fffffff.toString(), true);
        const permitData = erc20PermitMock.target + trim0x(badPermit);
        const tx = permitAndCallMock.permitAndCall(permitData, (await permitAndCallMock.fooTransfer.populateTransaction(erc20PermitMock.target, signer2, value, false)).data);
        
        await expect(tx).revertedWithCustomError(permitAndCallMock, 'SafeTransferFromFailed()');
        expect(await erc20PermitMock.balanceOf(signer2.address)).to.eq(0);
    });

    it('should work with nested permit', async function () {
        const { permitAndCallMock, erc20PermitMock, chainId } = await loadFixture(deployTokens);
        const permit1 = await getPermit(signer1, erc20PermitMock, '1', chainId, await permitAndCallMock.getAddress(), value.toString(), 0x8fffffff.toString(), true);
        const permit2 = await getPermit(signer2, erc20PermitMock, '1', chainId, await permitAndCallMock.getAddress(), value.toString(), 0x8fffffff.toString(), false);
        const fooTransferCall = (await permitAndCallMock.fooTransfer.populateTransaction(erc20PermitMock.target, signer2, value, false)).data;
        const innerPermitCalldata = (await permitAndCallMock.permitAndCall.populateTransaction(erc20PermitMock.target + trim0x(permit2), fooTransferCall)).data;
        const tx = await permitAndCallMock.permitAndCall(erc20PermitMock.target + trim0x(permit1), innerPermitCalldata);
        
        await expect(tx).to.emit(permitAndCallMock, 'FooTransferCalled');
        expect(await erc20PermitMock.balanceOf(signer2.address)).to.eq(value);
        expect(await erc20PermitMock.allowance(signer2.address, permitAndCallMock.target)).to.equal(value);
    });

    it('should work with valid permit2', async function () {
        const { permitAndCallMock, erc20PermitMock, chainId } = await loadFixture(deployTokens);
        const permitContract = await permit2Contract();
        await erc20PermitMock.approve(permitContract.target, value);
        const permit2 = await getPermit2(signer1, await erc20PermitMock.getAddress(), chainId, await permitAndCallMock.getAddress(), value, false, defaultDeadlinePermit2, defaultDeadlinePermit2);
        const permit2Data = erc20PermitMock.target + trim0x(permit2);
        const tx = await permitAndCallMock.permitAndCall(permit2Data, (await permitAndCallMock.fooTransfer.populateTransaction(erc20PermitMock.target, signer2, value, true)).data);
        const allowance = await permitContract.allowance(signer1, erc20PermitMock, await permitAndCallMock.getAddress());

        await expect(tx).to.emit(permitAndCallMock, 'FooTransferCalled');
        expect(await erc20PermitMock.balanceOf(signer2.address)).to.eq(value);
        expect(allowance.nonce).to.equal(1);
    });

    it('should work with payable function', async function () {
        const { permitAndCallMock, erc20PermitMock, chainId } = await loadFixture(deployTokens);
        const permit = await getPermit(signer1, erc20PermitMock, '1', chainId, await permitAndCallMock.getAddress(), value.toString(), 0x8fffffff.toString(), true);
        const pData = erc20PermitMock.target + trim0x(permit);
        const tx = await permitAndCallMock.permitAndCall(pData, (await permitAndCallMock.payableFooTransfer.populateTransaction(erc20PermitMock.target, signer2, value, false)).data, { value: 1n });
       
        await expect(tx).to.emit(permitAndCallMock, 'MsgValueTransfer').withArgs(1n);
        expect(await erc20PermitMock.balanceOf(signer2.address)).to.eq(value);
        // expect(await erc20PermitMock.allowance(signer1.address, permitAndCallMock.target)).to.equal(value);
    });

    it('should work with payable function and nested permit', async function () {
        const { permitAndCallMock, erc20PermitMock, chainId } = await loadFixture(deployTokens);
        const permit1 = await getPermit(signer1, erc20PermitMock, '1', chainId, await permitAndCallMock.getAddress(), value.toString(), 0x8fffffff.toString(), true);
        const permit2 = await getPermit(signer2, erc20PermitMock, '1', chainId, await permitAndCallMock.getAddress(), value.toString(), 0x8fffffff.toString(), false);
        const fooTransferCall = (await permitAndCallMock.payableFooTransfer.populateTransaction(erc20PermitMock.target, signer2, value, false)).data;
        const innerPermitCalldata = (await permitAndCallMock.permitAndCall.populateTransaction(erc20PermitMock.target + trim0x(permit2), fooTransferCall)).data;
        const tx = await permitAndCallMock.permitAndCall(erc20PermitMock.target + trim0x(permit1), innerPermitCalldata, { value: 1n });
        
        await expect(tx).to.emit(permitAndCallMock, 'MsgValueTransfer').withArgs(1n);
        expect(await erc20PermitMock.balanceOf(signer2.address)).to.eq(value);
        expect(await erc20PermitMock.allowance(signer2.address, permitAndCallMock.target)).to.equal(value);
    });
});
