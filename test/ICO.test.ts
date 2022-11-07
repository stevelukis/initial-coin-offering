import { ethers } from "hardhat";
import { Contract, ContractFactory } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";

describe("ICO", function () {
    async function deployICOFixture() {
        const ICO: ContractFactory = await ethers.getContractFactory("ICO");
        const [owner, investor]: SignerWithAddress[] = await ethers.getSigners();

        // Deploy the contract
        const ico: Contract = await ICO.deploy("Token", "TOKEN");
        await ico.deployed();

        return { ico, owner, investor };
    }

    describe("Whitelist", function () {
        it("Should whitelist successfully", async function () {
            const { ico, investor } = await loadFixture(deployICOFixture);
            await ico.whitelist(investor.address);
            expect(await ico.investors(investor.address)).to.be.true;
        });

        it("Should return false for account that is not whitelisted", async function () {
            const { ico, investor } = await loadFixture(deployICOFixture);
            expect(await ico.investors(investor.address)).to.be.false;
        });

        it("Should be reverted if not called by owner", async function () {
            const { ico, investor } = await loadFixture(deployICOFixture);
            await expect(ico.connect(investor).whitelist(investor.address))
                .to.revertedWith("Ownable: caller is not the owner");
        });
    });

})