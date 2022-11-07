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
        const ico: Contract = await ICO.deploy("Token", "TOKEN", 100);
        await ico.deployed();

        return { ico, owner, investor };
    }

    describe("Start", function () {
        it("Should run successfully", async function () {
            const { ico } = await loadFixture(deployICOFixture);

            expect(await ico.isIcoActive()).to.be.false;
            await ico.start(100, 100, 100, 1, 100);
            expect(await ico.isIcoActive()).to.be.true;
        });

        it("Should be reverted if the duration is not valid", async function () {
            const { ico } = await loadFixture(deployICOFixture);

            await expect(ico.start(0, 100, 100, 1, 100))
                .to.be.revertedWith("Duration should be > 0.");
        });

        it("Should be reverted if _availableToken is not valid", async function () {
            const { ico } = await loadFixture(deployICOFixture);

            await expect(ico.start(100, 100, 0, 1, 100))
                .to.be.revertedWith("_availableTokens is not valid.");
            await expect(ico.start(100, 100, 100000, 1, 100))
                .to.be.revertedWith("_availableTokens is not valid.");
        });

        it("Should be reverted if _minPurchase is not valid", async function () {
            const { ico } = await loadFixture(deployICOFixture);
            await expect(ico.start(100, 100, 100, 0, 100))
                .to.be.revertedWith("minPurchase is not valid.");
        });

        it("Should be reverted if _maxPurchase is not valid", async function () {
            const { ico } = await loadFixture(deployICOFixture);
            await expect(ico.start(100, 100, 100, 1, 0))
                .to.be.revertedWith("maxPurchase is not valid.");
            await expect(ico.start(100, 100, 100, 1, 101))
                .to.be.revertedWith("maxPurchase is not valid.");
        });
    });

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