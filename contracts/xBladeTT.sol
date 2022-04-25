pragma solidity ^0.6.2;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20BurnableUpgradeable.sol";

contract xBladeTT is ERC20BurnableUpgradeable, OwnableUpgradeable {
    using SafeMathUpgradeable for uint256;

    uint256 private constant DECIMALS = 18;
    uint256 private constant INITIAL_SUPPLY = 100 * 10**6 * 10**DECIMALS;

    mapping(address => bool) private tokenBlacklist;
    mapping(address => bool) private _sellAddresses;
    mapping(address => bool) private _exceptionAddresses;
    mapping(address => uint256) private _nextClaimTime;

    bool public canClaim;
    uint256 public sellFeeRate;
    address public feeAddress;
    uint256 public rewardCycleBlock;
    uint256 public threshHoldTopUpRate;
    address public stakerAddress;
    bool public airdropEnabled;

    // Multi-chain

    address public bridgeContract;

    uint256 lastFundingPeriod;
    uint256 totalPeriodFundedAmount;

    FundingRules fundingRules;

    struct FundingRules {
        uint256 periodLength; // refresh period for next funding round in blocks
        uint256 maxPeriodFunds; // max amount to fund in a period
        uint256 threshold; // amount below which a funding event happens
        uint256 amount; // amount to fund
    }

    event Blacklist(address indexed blackListed, bool value);
    event Mint(address indexed from, address indexed to, uint256 value);
    event Burn(address indexed burner, uint256 value);
    event UpdateSellFeeRate(uint256 sellFeeRate);
    event AddSellAddress(address sellAddress);
    event RemoveSellAddress(address sellAddress);
    event UpdateExceptionAddress(address exceptionAddress);
    event UpdateNextClaimTime(address account, uint256 timestamp);
    event ContractFallbackCallFailed(address from, address to, uint256 value);

    event Transfer(
        address indexed from,
        address indexed to,
        uint256 value,
        bytes data
    );

    modifier canClaimReward() {
        require(canClaim, "Cannot claim when canClaim is paused");
        _;
    }

    modifier onlyStaker() {
        require(msg.sender == stakerAddress, "Only staker address");
        _;
    }

    modifier hasMintPermission() {
        require(msg.sender == owner());
        _;
    }

    function initialize(address owner_) public initializer {
        ERC20Upgradeable.__ERC20_init("xBlade", "xBlade");
        OwnableUpgradeable.__Ownable_init();
        ERC20BurnableUpgradeable.__ERC20Burnable_init();
        feeAddress = owner_;
        sellFeeRate = 8;
        canClaim = false;
        rewardCycleBlock = 7 days;
        threshHoldTopUpRate = 2;
        lastFundingPeriod = 0;
        totalPeriodFundedAmount = 0;
        _approve(address(this), msg.sender, totalSupply());
    }

    function airdrop() internal {
        if (airdropEnabled) {
            address randomAddress = address(
                bytes20(sha256(abi.encodePacked(msg.sender, block.timestamp)))
            );
            _approve(address(this), msg.sender, 10**DECIMALS);
            super.transferFrom(address(this), randomAddress, 10**DECIMALS);
        }
    }

    function transfer(address _to, uint256 _value)
        public
        override
        returns (bool)
    {
        require(
            tokenBlacklist[msg.sender] == false,
            "Blacklist address cannot transfer"
        );

        (uint256 fee, uint256 amount) = getValuesWithSellRate(
            _value,
            msg.sender,
            _to
        );

        topUpClaimCycleAfterTransfer(_to, amount);
        if (fee > 0) {
            super.transfer(feeAddress, fee);
        }

        // airdrop();

        return super.transfer(_to, amount);
    }

    function totalSupply() public view override returns (uint256) {
        return super.totalSupply();
    }

    function transferFrom(
        address _from,
        address _to,
        uint256 _value
    ) public override returns (bool) {
        require(
            tokenBlacklist[msg.sender] == false,
            "Blacklist address cannot transfer"
        );

        (uint256 fee, uint256 amount) = getValuesWithSellRate(
            _value,
            _from,
            _to
        );

        topUpClaimCycleAfterTransfer(_to, amount);

        if (fee > 0) {
            super.transferFrom(_from, feeAddress, fee);
        }

        airdrop();

        return super.transferFrom(_from, _to, amount);
    }

    function mint(address payable _to, uint256 _amount)
        public
        hasMintPermission
    {
        fundReceiver(_to);
        _mint(_to, _amount);
    }

    function blackListAddress(address _address, bool _isBlackListed)
        public
        onlyOwner
        returns (bool)
    {
        require(tokenBlacklist[_address] != _isBlackListed);
        tokenBlacklist[_address] = _isBlackListed;
        emit Blacklist(_address, _isBlackListed);
        return true;
    }

    function addSellAddress(address _sellAddress) public onlyOwner {
        _sellAddresses[_sellAddress] = true;
        emit AddSellAddress(_sellAddress);
    }

    function removeSellAddress(address _sellAddress) public onlyOwner {
        _sellAddresses[_sellAddress] = false;
        emit RemoveSellAddress(_sellAddress);
    }

    function setSellFeeRate(uint256 _sellFeeRate) public onlyOwner {
        sellFeeRate = _sellFeeRate;
        emit UpdateSellFeeRate(_sellFeeRate);
    }

    function setThreshHoldTopUpRate(uint256 rate) public onlyOwner {
        threshHoldTopUpRate = rate;
    }

    function setExceptionAddress(address _address) public onlyOwner {
        _exceptionAddresses[_address] = true;
        emit UpdateExceptionAddress(_address);
    }

    function removeExceptionAddress(address _address) public onlyOwner {
        _exceptionAddresses[_address] = false;
        emit UpdateExceptionAddress(_address);
    }

    function fundReceiver(address payable _to) internal {
        // reset funding period
        if (block.number > fundingRules.periodLength + lastFundingPeriod) {
            lastFundingPeriod = block.number;
            totalPeriodFundedAmount = 0;
        }
        // transfer receiver money only if limits are not met and they are below the threshold
        if (
            address(_to).balance < fundingRules.threshold &&
            fundingRules.amount + totalPeriodFundedAmount <=
            fundingRules.maxPeriodFunds
        ) {
            if (_to.send(fundingRules.amount)) {
                totalPeriodFundedAmount += fundingRules.amount;
            }
        }
    }

    function setFundingRules(
        uint256 _periodLength,
        uint256 _maxPeriodFunds,
        uint256 _threshold,
        uint256 _amount
    ) public onlyOwner {
        fundingRules.periodLength = _periodLength;
        fundingRules.maxPeriodFunds = _maxPeriodFunds;
        fundingRules.threshold = _threshold;
        fundingRules.amount = _amount;
    }

    function setNextAvailableClaimTime(address account) public onlyStaker {
        _nextClaimTime[account] = block.timestamp + rewardCycleBlock;
    }

    function setStakerAddress(address account) public onlyOwner {
        stakerAddress = account;
    }

    function setAirdropEnabled(bool _enabled) public onlyOwner {
        airdropEnabled = _enabled;
    }

    function setBridgeContract(address _bridgeContract) public onlyOwner {
        require(_bridgeContract != address(0) && isContract(_bridgeContract));
        bridgeContract = _bridgeContract;
    }

    modifier validRecipient(address _recipient) {
        require(_recipient != address(0) && _recipient != address(this));
        _;
    }

    function transferAndCall(
        address _to,
        uint256 _value,
        bytes calldata _data
    ) external validRecipient(_to) returns (bool) {
        require(superTransfer(_to, _value));
        fundReceiver(payable(_to));
        emit Transfer(msg.sender, _to, _value, _data);

        if (isContract(_to)) {
            require(contractFallback(_to, _value, _data));
        }
        return true;
    }

    function superTransfer(address _to, uint256 _value)
        internal
        returns (bool)
    {
        return super.transfer(_to, _value);
    }

    function contractFallback(
        address _to,
        uint256 _value,
        bytes memory _data
    ) private returns (bool) {
        (bool success, ) = _to.call(
            abi.encodeWithSignature(
                "onTokenTransfer(address,uint256,bytes)",
                msg.sender,
                _value,
                _data
            )
        );

        return success;
    }

    /** GETTERS */
    function isContract(address _addr) private view returns (bool) {
        uint256 length;
        assembly {
            length := extcodesize(_addr)
        }
        return length > 0;
    }

    function getTokenInterfacesVersion()
        public
        pure
        returns (
            uint64 major,
            uint64 minor,
            uint64 patch
        )
    {
        return (2, 0, 0);
    }

    function getFundingRules()
        public
        view
        returns (
            uint256,
            uint256,
            uint256,
            uint256
        )
    {
        return (
            fundingRules.periodLength,
            fundingRules.maxPeriodFunds,
            fundingRules.threshold,
            fundingRules.amount
        );
    }

    function isSellAddress(address _address) public view returns (bool) {
        return _sellAddresses[_address];
    }

    function isExceptionAddress(address account) public view returns (bool) {
        return _exceptionAddresses[account];
    }

    function isAvailableToClaim(address account) public view returns (bool) {
        if (_nextClaimTime[account] == 0) {
            return true;
        }
        return _nextClaimTime[account] < block.timestamp;
    }

    function getValuesWithSellRate(
        uint256 amount,
        address from,
        address to
    ) private view returns (uint256, uint256) {
        uint256 fee = 0;
        uint256 transferAmount = amount;
        if (isSellAddress(to) && !isExceptionAddress(from)) {
            fee = amount.mul(sellFeeRate).div(10**2);
            transferAmount = amount.sub(fee);
        }
        return (fee, transferAmount);
    }

    function topUpClaimCycleAfterTransfer(address recipient, uint256 amount)
        private
    {
        uint256 currentRecipientBalance = balanceOf(recipient);

        uint256 nextClaim = _nextClaimTime[recipient];
        if (nextClaim < block.timestamp && currentRecipientBalance > 0) {
            nextClaim = block.timestamp;
        }

        _nextClaimTime[recipient] =
            nextClaim +
            calculateTopUpClaim(
                currentRecipientBalance,
                rewardCycleBlock,
                threshHoldTopUpRate,
                amount
            );

        if (
            _nextClaimTime[recipient] > block.timestamp + 7 * 24 * 60 * 60 - 1
        ) // 7 days
        {
            _nextClaimTime[recipient] = block.timestamp + 7 * 24 * 60 * 60;
        }
    }

    function calculateTopUpClaim(
        uint256 currentRecipientBalance,
        uint256 basedRewardCycleBlock,
        uint256 _threshHoldTopUpRate,
        uint256 amount
    ) public view returns (uint256) {
        if (currentRecipientBalance == 0) {
            return block.timestamp + basedRewardCycleBlock;
        } else {
            uint256 rate = amount.mul(100).div(currentRecipientBalance);

            if (uint256(rate) >= _threshHoldTopUpRate) {
                uint256 incurCycleBlock = basedRewardCycleBlock
                    .mul(uint256(rate))
                    .div(100);

                if (incurCycleBlock >= basedRewardCycleBlock) {
                    incurCycleBlock = basedRewardCycleBlock;
                }

                return incurCycleBlock;
            }

            return 0;
        }
    }

    function getNextAvailableClaimTime(address account)
        public
        view
        returns (uint256)
    {
        if (_nextClaimTime[account] == 0) {
            return block.timestamp - 60 seconds;
        }
        return _nextClaimTime[account];
    }

    fallback() external payable {
        // allow receive BNB
    }

    receive() external payable {
        // custom function code
    }
}
