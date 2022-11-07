// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ICO is Ownable {
    struct Sale {
        address investor;
        uint256 quantity;
    }

    Sale[] public sales;
    mapping(address => bool) public investors;
    address public token;
    address public admin;
    uint256 public end;
    uint256 public price;
    uint256 public availableTokens;
    uint256 public minPurchase;
    uint256 public maxPurchase;
    bool public isReleased = false;

    constructor(string memory _name, string memory _symbol) {
        token = address(new ERC20(_name, _symbol));
    }

    function start(
        uint256 duration,
        uint256 _price,
        uint256 _availableTokens,
        uint256 _minPurchase,
        uint256 _maxPurchase)
    external onlyOwner icoNotActive {
        require(duration > 0, "Duration should be > 0.");

        uint256 totalSupply = ERC20(token).totalSupply();
        require(_availableTokens > 0 && _availableTokens <= totalSupply, "_availableTokens is not valid.");

        require(_minPurchase > 0, "minPurchase is not valid.");
        require(_maxPurchase > 0 && _maxPurchase <= _availableTokens, "maxPurchase is not valid.");

        end = duration + block.timestamp;
        price = _price;
        availableTokens = _availableTokens;
        minPurchase = _minPurchase;
        maxPurchase = _maxPurchase;
    }

    function whitelist(address investor) external onlyOwner {
        investors[investor] = true;
    }

    function buy() payable external onlyInvestors icoActive {
        require(msg.value % price == 0, "Ethers sent should be a multiple of price");
        require(msg.value >= minPurchase && msg.value <= maxPurchase,
            "Ethers should be between minPurchase and maxPurchase");

        uint quantity = price * msg.value;
        require(quantity <= availableTokens, "Not enough tokens left for sale");

        sales.push(Sale(msg.sender, quantity));
    }

    function release() external onlyOwner icoEnded tokenNotReleased {
        ERC20 tokenInstance = ERC20(token);
        for (uint256 i = 0; i < sales.length; i++) {
            Sale storage sale = sales[i];
            tokenInstance.transfer(sale.investor, sale.quantity);
        }
        isReleased = true;
    }

    function withdraw(address payable to, uint256 amount) external onlyOwner icoEnded tokenReleased {
        to.transfer(amount);
    }

    modifier icoActive() {
        require(end > 0 && block.timestamp < end && availableTokens > 0, "ICO should be active.");
        _;
    }

    modifier icoNotActive() {
        require(end == 0, "ICO shouldn't be active.");
        _;
    }

    modifier icoEnded() {
        require(end > 0 && (block.timestamp >= end || availableTokens == 0), "ICO should have ended");
        _;
    }

    modifier tokenReleased() {
        require(isReleased == true, "Token should have been released");
        _;
    }

    modifier tokenNotReleased() {
        require(isReleased == false, "Token should not have been released");
        _;
    }

    modifier onlyInvestors() {
        require(investors[msg.sender], "Only investors can call this function.");
        _;
    }
}