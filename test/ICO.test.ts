import { ethers } from "hardhat";
import { Contract, ContractFactory } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { FixedERC20, ICO } from "../typechain-types";

const sleep = async (durationInSec: number) => {
    await new Promise(resolve => setTimeout(resolve, durationInSec * 1000))
}

describe("ICO", function () {
    async function deployICOFixture() {
        const ICO: ContractFactory = await ethers.getContractFactory("ICO");
        const [owner, investor, nonInvestor]: SignerWithAddress[] = await ethers.getSigners();

        // Deploy the contract
        let icoContract: Contract = await ICO.deploy("Token", "TOKEN", 100);
        await icoContract.deployed();

        let ico: ICO = await ethers.getContractAt("ICO", icoContract.address);
        const token: FixedERC20 = await ethers.getContractAt("FixedERC20", await ico.token());

        return { ico, owner, investor, nonInvestor, token };
    }

    describe("Start", function () {
        it("Should run successfully", async function () {
            const { ico } = await loadFixture(deployICOFixture);

            expect(await ico.isIcoActive()).to.be.false;
            await ico.start(100, 100, 100, 1, 100);
            expect(await ico.isIcoActive()).to.be.true;
        });

        it("Should be reverted if not called by owner", async function () {
            const { ico, investor } = await loadFixture(deployICOFixture);

            await expect(ico.connect(investor).start(100, 100, 100, 1, 100))
                .to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Should be reverted if the duration is not valid", async function () {
            const { ico } = await loadFixture(deployICOFixture);

            await expect(ico.start(0, 100, 100, 1, 100))
                .to.be.revertedWith("Duration should be > 0");
        });

        it("Should be reverted if _availableToken is not valid", async function () {
            const { ico } = await loadFixture(deployICOFixture);

            await expect(ico.start(100, 100, 0, 1, 100))
                .to.be.revertedWith("_availableTokens is not valid");
            await expect(ico.start(100, 100, 100000, 1, 100))
                .to.be.revertedWith("_availableTokens is not valid");
        });

        it("Should be reverted if _minPurchase is not valid", async function () {
            const { ico } = await loadFixture(deployICOFixture);
            await expect(ico.start(100, 100, 100, 0, 100))
                .to.be.revertedWith("minPurchase is not valid");
        });

        it("Should be reverted if _maxPurchase is not valid", async function () {
            const { ico } = await loadFixture(deployICOFixture);
            await expect(ico.start(100, 100, 100, 1, 0))
                .to.be.revertedWith("maxPurchase is not valid");
            await expect(ico.start(100, 100, 100, 1, 101))
                .to.be.revertedWith("maxPurchase is not valid");
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

    describe("Buy", function () {
        const PRICE = 5;
        const AVAILABLE_TOKENS = 100;
        const MIN_PURCHASE = 5;
        const MAX_PURCHASE = 100;

        async function preBuyFixture() {
            const deployedUtils = await deployICOFixture();
            const { ico, investor } = deployedUtils;

            await ico.start(100, PRICE, AVAILABLE_TOKENS, MIN_PURCHASE, MAX_PURCHASE);
            await ico.whitelist(investor.address);

            return deployedUtils
        }

        it("Should run successfully", async function () {
            const { ico, investor } = await loadFixture(preBuyFixture);

            const quantity = MIN_PURCHASE;
            const value = quantity * PRICE;
            await ico.connect(investor).buy({ value });

            const sale = await ico.sales(0);
            expect(sale.investor).to.be.equal(investor.address);
            expect(sale.quantity).to.be.equal(quantity);
        });

        it("Should be reverted if not called by investors", async function () {
            const { ico, nonInvestor } = await loadFixture(preBuyFixture);
            await expect(ico.connect(nonInvestor).buy({ value: PRICE }))
                .to.be.revertedWith("Only investors can call this function");
        });

        it("Should be reverted if not paying the multiple of the price", async function () {
            const { ico, investor } = await loadFixture(preBuyFixture);
            await expect(ico.connect(investor).buy({ value: PRICE + 1 }))
                .to.be.revertedWith("Ethers sent should be a multiple of price");
        });

        it("Should be reverted if not buying between the minimum and maximum purchase", async function () {
            const { ico, investor } = await loadFixture(preBuyFixture);
            await expect(ico.connect(investor).buy({ value: (MIN_PURCHASE - 1) * PRICE }))
                .to.be.revertedWith("Number of tokens purchased should be between minPurchase and maxPurchase");
            await expect(ico.connect(investor).buy({ value: (MAX_PURCHASE + 1) * PRICE }))
                .to.be.revertedWith("Number of tokens purchased should be between minPurchase and maxPurchase");
        });

        it("Should be reverted if quantity is more that available tokens", async function () {
            const { ico, investor } = await loadFixture(preBuyFixture);

            // Purchase almost all the available tokens first
            await ico.connect(investor).buy({ value: (MAX_PURCHASE - 1) * PRICE });

            await expect(ico.connect(investor).buy({ value: MIN_PURCHASE * PRICE }))
                .to.be.revertedWith("Not enough tokens left for sale");
        });

        it("Should be reverted if ICO is not activated", async function () {
            const { ico, investor } = await loadFixture(deployICOFixture);
            await ico.whitelist(investor.address);

            await expect(ico.connect(investor).buy({ value: PRICE }))
                .to.be.revertedWith("ICO should be active");
        });
    });

    describe("Release", function () {
        const DURATION = 3;
        const PRICE = 5;
        const AVAILABLE_TOKENS = 100;
        const MIN_PURCHASE = 5;
        const MAX_PURCHASE = 100;

        async function startICOFixture() {
            const deployedUtils = await loadFixture(deployICOFixture);
            const { ico, investor } = deployedUtils;
            await ico.whitelist(investor.address);
            await ico.start(DURATION, PRICE, AVAILABLE_TOKENS, MIN_PURCHASE, MAX_PURCHASE);
            await ico.connect(investor).buy({ value: MIN_PURCHASE * PRICE });
            return deployedUtils;
        }

        async function startAndEndICOFixture() {
            const deployedUtils = await loadFixture(startICOFixture);
            await sleep(DURATION);
            return deployedUtils;
        }

        it("Should run successfully", async function () {
            const { ico, investor, token } = await loadFixture(startAndEndICOFixture);
            await ico.release();
            expect(await token.balanceOf(investor.address))
                .to.be.equal(MIN_PURCHASE);
        });

        it("Should be reverted if not called by the owner", async function () {
            const { ico, investor } = await loadFixture(startAndEndICOFixture);
            await expect(ico.connect(investor).release())
                .to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Should be reverted if token have been released", async function () {
            const { ico } = await loadFixture(startAndEndICOFixture);
            await ico.release()
            await expect(ico.release())
                .to.be.revertedWith("Token should not have been released");
        });

        it("Should be reverted if ICO haven't ended yet", async function () {
            const { ico } = await loadFixture(startICOFixture);
            await expect(ico.release())
                .to.be.revertedWith("ICO should have ended");
        });
    });
})