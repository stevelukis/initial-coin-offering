import { Contract, ContractFactory } from "ethers";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { FixedERC20, ICO } from "../typechain-types";
import { time } from "@nomicfoundation/hardhat-network-helpers";

const DURATION = 100;
const PRICE = 5;
const AVAILABLE_TOKENS = 100;
const MIN_PURCHASE = 5;
const MAX_PURCHASE = 100;
const value = MIN_PURCHASE * PRICE;

export const params = {
    PRICE,
    MIN_PURCHASE,
    MAX_PURCHASE,
    value
}

export async function deployICOFixture() {
    const ICO: ContractFactory = await ethers.getContractFactory("ICO");
    const [owner, investor, nonInvestor]: SignerWithAddress[] = await ethers.getSigners();

    // Deploy the contract
    let icoContract: Contract = await ICO.deploy("Token", "TOKEN", 100);
    await icoContract.deployed();

    let ico: ICO = await ethers.getContractAt("ICO", icoContract.address);
    const token: FixedERC20 = await ethers.getContractAt("FixedERC20", await ico.token());

    return { ico, owner, investor, nonInvestor, token };
}

export async function startICOFixture() {
    const deployedUtils = await deployICOFixture();
    const { ico, investor } = deployedUtils;

    await ico.start(DURATION, PRICE, AVAILABLE_TOKENS, MIN_PURCHASE, MAX_PURCHASE);
    await ico.whitelist(investor.address);

    return deployedUtils;
}

export async function afterBuyFixture() {
    const deployedUtils = await startICOFixture();
    const { ico, investor } = deployedUtils;
    await ico.connect(investor).buy({ value: value });
    return deployedUtils;
}

export async function endICOFixture() {
    const deployedUtils = await afterBuyFixture();
    await time.increase(DURATION);
    return deployedUtils;
}

export const tokenReleasedFixture = async () => {
    const deployedUtils = await endICOFixture();
    const { ico } = deployedUtils;
    await ico.release();
    return deployedUtils;
}