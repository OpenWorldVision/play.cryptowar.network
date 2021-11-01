pragma solidity ^0.6.0;

import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "abdk-libraries-solidity/ABDKMath64x64.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "./interfaces/IStakeFromGame.sol";
import "./interfaces/IRandoms.sol";
// import "./interfaces/IPancakeRouter02.sol";
import "./characters.sol";
import "./Promos.sol";
import "./weapons.sol";
import "./util.sol";
import "./pancakeUtils.sol";
import "./Blacksmith.sol";
import "./CWController.sol";

contract CryptoWars is
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable
{
    using ABDKMath64x64 for int128;
    using SafeMath for uint256;
    using SafeMath for uint64;
    using SafeERC20 for IERC20;

    bytes32 public constant GAME_ADMIN = keccak256("GAME_ADMIN");

    // Payment must be recent enough that the hash is available for the payment block.
    // Use 200 as a 'friendly' window of "You have 10 minutes."
    // uint256 public constant MINT_PAYMENT_TIMEOUT = 200;
    // uint256 public constant MINT_PAYMENT_RECLAIM_MINIMUM_WAIT_TIME = 3 hours;

    int128 public constant REWARDS_CLAIM_TAX_MAX = 2767011611056432742; // = ~0.15 = ~15%
    uint256 public constant REWARDS_CLAIM_TAX_DURATION = 15 days;

    Characters public characters;
    Weapons public weapons;
    IERC20 public xBlade;
    IRandoms public randoms;
    IPancakeRouter02 public pancakeRouter;
    uint256 public minimumFightTax;
    uint8 public supportFeeRate;

    function initialize(
        IERC20 _xBlade,
        Characters _characters,
        Weapons _weapons,
        IRandoms _randoms,
        IPancakeRouter02 _pancakeRouter,
        address _busdAddress,
        Blacksmith _blacksmith,
        Promos _promos
    ) public initializer {
        __AccessControl_init();
        __Pausable_init();

        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(GAME_ADMIN, msg.sender);

        xBlade = _xBlade;
        characters = _characters;
        weapons = _weapons;
        randoms = _randoms;
        blacksmith = _blacksmith;
        promos = _promos;

        pancakeRouter = _pancakeRouter;
        BUSDAddress = _busdAddress;

        staminaCostFight = 40;
        mintCharacterFee = 4200 ether; // 4200 xBlade;
        minimumFightTax = 5 * 10**14; // 0.0005 BNB
        supportFeeRate = 90; // 90%

        topupTimerBase = 120; // 2 minutes

        // migrateTo_1ee400a
        fightXpGain = 32;

        // migrateTo_aa9da90
        oneFrac = ABDKMath64x64.fromUInt(1);
        fightTraitBonus = ABDKMath64x64.divu(75, 1000);

        // migrateTo_7dd2a56
        // numbers given for the curves were $4.3-aligned so they need to be multiplied
        // additional accuracy may be in order for the setter functions for these
        // fightRewardGasOffset = ABDKMath64x64.divu(23177, 100000); // 0.0539 x 4.3
        fightRewardBaseline = ABDKMath64x64.divu(344, 1000); // 0.08 x 4.3

        // migrateTo_5e833b0
        durabilityCostFight = 1;

        // Burn weapon and reforge weapon fees
        burnWeaponFee = ABDKMath64x64.divu(2, 10); //0.2 usd;
        reforgeWeaponWithDustFee = ABDKMath64x64.divu(3, 10); //0.3 usd;

        reforgeWeaponFee = burnWeaponFee + reforgeWeaponWithDustFee; //0.5 usd;
    }

    function migrateTo_23b3a8b(IStakeFromGame _stakeFromGame) external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender));

        stakeFromGameImpl = _stakeFromGame;
    }

    // config vars
    uint8 staminaCostFight;

    uint256 public mintCharacterFee;
    //int128 public rerollTraitFee;
    //int128 public rerollCosmeticsFee;
    // int128 public refillStaminaFee;
    // lvl 1 player power could be anywhere between ~909 to 1666
    // cents per fight multiplied by monster power divided by 1000 (lv1 power)
    int128 public fightRewardBaseline;
    // int128 public fightRewardGasOffset;

    int128 public reforgeWeaponFee;

    mapping(address => uint256) lastBlockNumberCalled;

    uint256 public fightXpGain; // multiplied based on power differences

    mapping(address => uint256) tokenRewards; // user adress : xblade wei
    mapping(uint256 => uint256) xpRewards; // character id : xp

    int128 public oneFrac; // 1.0
    int128 public fightTraitBonus; // 7.5%

    mapping(address => uint256) public inGameOnlyFunds;
    uint256 public totalInGameOnlyFunds;

    Promos public promos;

    mapping(address => uint256) private _rewardsClaimTaxTimerStart;

    IStakeFromGame public stakeFromGameImpl;

    uint8 durabilityCostFight;

    int128 public burnWeaponFee;
    int128 public reforgeWeaponWithDustFee;

    Blacksmith public blacksmith;
    address public BUSDAddress;

    uint256 private topupTimerBase;
    CWController private cwController;

    event FightOutcome(
        address indexed owner,
        uint256 indexed character,
        uint256 weapon,
        uint32 target,
        uint24 playerRoll,
        uint24 enemyRoll,
        uint16 xpGain,
        uint256 xBladeGain
    );
    event InGameOnlyFundsGiven(address indexed to, uint256 xBladeAmount);
    event MintWeaponsSuccess(address indexed minter, uint32 count);
    event MintWeaponsFailure(address indexed minter, uint32 count);

    function recoverXBlade(uint256 amount) public {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Not adm");

        xBlade.safeTransfer(msg.sender, amount);
    }

    function getXBladeToSubtract(
        uint256 _inGameOnlyFunds,
        uint256 _tokenRewards,
        uint256 _xBladeNeeded
    )
        public
        pure
        returns (
            uint256 fromInGameOnlyFunds,
            uint256 fromTokenRewards,
            uint256 fromUserWallet
        )
    {
        if (_xBladeNeeded <= _inGameOnlyFunds) {
            return (_xBladeNeeded, 0, 0);
        }

        _xBladeNeeded -= _inGameOnlyFunds;

        if (_xBladeNeeded <= _tokenRewards) {
            return (_inGameOnlyFunds, _xBladeNeeded, 0);
        }

        _xBladeNeeded -= _tokenRewards;

        return (_inGameOnlyFunds, _tokenRewards, _xBladeNeeded);
    }

    function getXBladeNeededFromUserWallet(
        address playerAddress,
        uint256 xBladeNeeded
    ) public view returns (uint256 xBladeNeededFromUserWallet) {
        (, , xBladeNeededFromUserWallet) = getXBladeToSubtract(
            inGameOnlyFunds[playerAddress],
            tokenRewards[playerAddress],
            xBladeNeeded
        );
    }

    function getMyCharacters() public view returns (uint256[] memory) {
        uint256[] memory tokens = new uint256[](
            characters.balanceOf(msg.sender)
        );
        for (uint256 i = 0; i < tokens.length; i++) {
            tokens[i] = characters.tokenOfOwnerByIndex(msg.sender, i);
        }
        return tokens;
    }

    function getMyWeapons() public view returns (uint256[] memory) {
        uint256[] memory tokens = new uint256[](weapons.balanceOf(msg.sender));
        for (uint256 i = 0; i < tokens.length; i++) {
            tokens[i] = weapons.tokenOfOwnerByIndex(msg.sender, i);
        }
        return tokens;
    }

    function unpackFightData(uint96 playerData)
        public
        pure
        returns (
            uint8 charTrait,
            uint24 basePowerLevel,
            uint64 timestamp
        )
    {
        charTrait = uint8(playerData & 0xFF);
        basePowerLevel = uint24((playerData >> 8) & 0xFFFFFF);
        timestamp = uint64((playerData >> 32) & 0xFFFFFFFFFFFFFFFF);
    }

    function fight(
        uint256 char,
        uint256 wep,
        uint32 target,
        uint8 fightMultiplier
    ) external payable fightModifierChecks(char, wep) whenNotPaused {
        require(fightMultiplier >= 1 && fightMultiplier <= 5);

        (
            uint8 charTrait,
            uint24 basePowerLevel,
            uint64 timestamp
        ) = unpackFightData(
                characters.getFightDataAndDrainStamina(
                    char,
                    staminaCostFight * fightMultiplier
                )
            );

        (
            int128 weaponMultTarget,
            int128 weaponMultFight,
            uint24 weaponBonusPower,
            uint8 weaponTrait
        ) = weapons.getFightDataAndDrainDurability(
                wep,
                charTrait,
                durabilityCostFight * fightMultiplier
            );

        _verifyFight(
            basePowerLevel,
            weaponMultTarget,
            weaponBonusPower,
            timestamp,
            target
        );
        performFight(
            char,
            wep,
            getPlayerPower(basePowerLevel, weaponMultFight, weaponBonusPower),
            uint24(
                charTrait |
                    (uint24(weaponTrait) << 8) |
                    ((target & 0xFF000000) >> 8)
            ),
            uint24(target & 0xFFFFFF),
            fightMultiplier
        );
    }

    function _verifyFight(
        uint24 basePowerLevel,
        int128 weaponMultTarget,
        uint24 weaponBonusPower,
        uint64 timestamp,
        uint32 target
    ) internal view {
        verifyFight(
            basePowerLevel,
            weaponMultTarget,
            weaponBonusPower,
            timestamp,
            now.div(1 hours),
            target
        );
    }

    function verifyFight(
        uint24 playerBasePower,
        int128 wepMultiplier,
        uint24 wepBonusPower,
        uint64 staminaTimestamp,
        uint256 hour,
        uint32 target
    ) public pure {
        uint32[4] memory targets = getTargetsInternal(
            getPlayerPower(playerBasePower, wepMultiplier, wepBonusPower),
            staminaTimestamp,
            hour
        );
        bool foundMatch = false;
        for (uint256 i = 0; i < targets.length; i++) {
            if (targets[i] == target) {
                foundMatch = true;
                i = targets.length;
            }
        }
        require(foundMatch, "Invalid");
    }

    function isUnlikely(uint24 pp, uint24 ep) private pure returns (bool) {
        int128 playerMin = ABDKMath64x64
            .fromUInt(pp)
            .mul(ABDKMath64x64.fromUInt(90))
            .div(ABDKMath64x64.fromUInt(100));
        int128 playerMax = ABDKMath64x64
            .fromUInt(pp)
            .mul(ABDKMath64x64.fromUInt(110))
            .div(ABDKMath64x64.fromUInt(100));
        int128 playerRange = playerMax.sub(playerMin);
        int128 enemyMin = ABDKMath64x64
            .fromUInt(ep)
            .mul(ABDKMath64x64.fromUInt(90))
            .div(ABDKMath64x64.fromUInt(100));
        int128 enemyMax = ABDKMath64x64
            .fromUInt(ep)
            .mul(ABDKMath64x64.fromUInt(110))
            .div(ABDKMath64x64.fromUInt(100));
        int128 enemyRange = enemyMax.sub(enemyMin);
        int256 rollingTotal = 0;

        if (playerMin > enemyMax) return false;
        if (playerMax < enemyMin) return true;

        if (playerMin >= enemyMin) {
            int128 temp = playerMin.sub(enemyMin).div(enemyRange);
            temp = temp.add(
                ABDKMath64x64.fromUInt(1).sub(temp).mul(
                    playerMax.sub(enemyMax).div(playerRange)
                )
            );
            temp = temp.add(
                ABDKMath64x64.fromUInt(1).sub(temp).mul(
                    ABDKMath64x64.fromUInt(50).div(ABDKMath64x64.fromUInt(100))
                )
            );
            rollingTotal = ABDKMath64x64.toInt(
                temp.mul(ABDKMath64x64.fromUInt(1000))
            );
        } else {
            int128 temp = enemyMin.sub(playerMin).div(playerRange);
            temp = temp.add(
                ABDKMath64x64.fromUInt(1).sub(temp).mul(
                    enemyMax.sub(playerMax).div(enemyRange)
                )
            );
            temp = temp.add(
                ABDKMath64x64.fromUInt(1).sub(temp).mul(
                    ABDKMath64x64.fromUInt(50).div(ABDKMath64x64.fromUInt(100))
                )
            );
            temp = ABDKMath64x64.fromUInt(1).sub(temp);
            rollingTotal = ABDKMath64x64.toInt(
                temp.mul(ABDKMath64x64.fromUInt(1000))
            );
        }

        return rollingTotal <= 300 ? true : false;
    }

    function performFight(
        uint256 char,
        uint256 wep,
        uint24 playerFightPower,
        uint24 traitsCWE, // could fit into uint8 since each trait is only stored on 2 bits (TODO)
        uint24 targetPower,
        uint8 fightMultiplier
    ) private {

        uint256 seed = randoms.getRandomSeed(msg.sender);
        uint8 realLevel = characters.getExpectedLevel(characters.getLevel(char), uint256(characters.getXp(char)).add(xpRewards[char]));
        swapAndLiquify(char);
        uint24 playerRoll = getPlayerPowerRoll(
            playerFightPower,
            traitsCWE,
            seed,
            realLevel
        );
        uint24 monsterRoll = getMonsterPowerRoll(
            targetPower,
            RandomUtil.combineSeeds(seed, 1)
        );

        uint16 xp = getXpGainForFight(playerFightPower, targetPower) *
            fightMultiplier;
        uint256 tokens = PancakeUtil.usdToxBlade(
            address(pancakeRouter),
            BUSDAddress,
            address(xBlade),
            getTokenGainForFight(targetPower, fightMultiplier)
        );


        if (playerRoll < monsterRoll) {
            tokens = 0;
            xp = 0;
        }

        topupClaimTaxTimerStart(msg.sender, realLevel, tokens);

        // this may seem dumb but we want to avoid guessing the outcome based on gas estimates!
        tokenRewards[msg.sender] += tokens;
        xpRewards[char] += xp;

        // if (playerRoll > monsterRoll && isUnlikely(uint24(getPlayerTraitBonusAgainst(traitsCWE).mulu(playerFightPower)), targetPower)) {
        //     blacksmith.giveTicket(msg.sender, 1);
        // }

        emit FightOutcome(
            msg.sender,
            char,
            wep,
            (targetPower | ((uint32(traitsCWE) << 8) & 0xFF000000)),
            playerRoll,
            monsterRoll,
            xp,
            tokens
        );
    }

    function getMonsterPower(uint32 target) public pure returns (uint24) {
        return uint24(target & 0xFFFFFF);
    }

    function getTokenGainForFight(uint24 monsterPower, uint8 fightMultiplier)
        internal
        view
        returns (int128)
    {
        int128 supportFeeToken = int128(
            PancakeUtil.getAmountTokenFromBNB(
                address(pancakeRouter),
                address(xBlade),
                minimumFightTax
            )
        ).mul(supportFeeRate).div(100);

        return
            supportFeeToken.add(
                fightRewardBaseline
                    .mul(
                        ABDKMath64x64.sqrt(
                            // Performance optimization: 1000 = getPowerAtLevel(0)
                            ABDKMath64x64.divu(monsterPower, 1000)
                        )
                    )
                    .mul(ABDKMath64x64.fromUInt(fightMultiplier))
            );
    }

    function getXpGainForFight(uint24 playerPower, uint24 monsterPower)
        internal
        view
        returns (uint16)
    {
        return
            uint16(
                ABDKMath64x64.divu(monsterPower, playerPower).mulu(fightXpGain)
            );
    }

    function getPlayerPowerRoll(
        uint24 playerFightPower,
        uint24 traitsCWE,
        uint256 seed,
        uint8 level
    ) internal view returns (uint24) {
        return
            uint24(
                getPlayerTraitBonusAgainst(traitsCWE).mulu(
                    cwController.plusMinus10PercentSeededWithLv(playerFightPower, seed, level)
                )
            );
    }

    function getMonsterPowerRoll(uint24 monsterPower, uint256 seed)
        internal
        pure
        returns (uint24)
    {
        // roll for fights
        return uint24(RandomUtil.plusMinus10PercentSeeded(monsterPower, seed));
    }

    function getPlayerPower(
        uint24 basePower,
        int128 weaponMultiplier,
        uint24 bonusPower
    ) public pure returns (uint24) {
        return uint24(weaponMultiplier.mulu(basePower).add(bonusPower));
    }

    function getPlayerTraitBonusAgainst(uint24 traitsCWE)
        public
        view
        returns (int128)
    {
        int128 traitBonus = oneFrac;
        uint8 characterTrait = uint8(traitsCWE & 0xFF);
        if (
            characterTrait == (traitsCWE >> 8) & 0xFF /*wepTrait*/
        ) {
            traitBonus = traitBonus.add(fightTraitBonus);
        }
        if (
            isTraitEffectiveAgainst(
                characterTrait,
                uint8(traitsCWE >> 16) /*enemy*/
            )
        ) {
            traitBonus = traitBonus.add(fightTraitBonus);
        } else if (
            isTraitEffectiveAgainst(
                uint8(traitsCWE >> 16), /*enemy*/
                characterTrait
            )
        ) {
            traitBonus = traitBonus.sub(fightTraitBonus);
        }
        return traitBonus;
    }

    function getTargets(uint256 char, uint256 wep)
        public
        view
        returns (uint32[4] memory)
    {
        (int128 weaponMultTarget, , uint24 weaponBonusPower, ) = weapons
            .getFightData(wep, characters.getTrait(char));

        return
            getTargetsInternal(
                getPlayerPower(
                    characters.getPower(char),
                    weaponMultTarget,
                    weaponBonusPower
                ),
                characters.getStaminaTimestamp(char),
                now.div(1 hours)
            );
    }

    function getTargetsInternal(
        uint24 playerPower,
        uint64 staminaTimestamp,
        uint256 currentHour
    ) private pure returns (uint32[4] memory) {
        // 4 targets, roll powers based on character + weapon power
        // trait bonuses not accounted for
        // targets expire on the hour

        uint256 baseSeed = RandomUtil.combineSeeds(
            RandomUtil.combineSeeds(staminaTimestamp, currentHour),
            playerPower
        );

        uint32[4] memory targets;
        for (uint256 i = 0; i < targets.length; i++) {
            // we alter seed per-index or they would be all the same
            uint256 indexSeed = RandomUtil.combineSeeds(baseSeed, i);
            targets[i] = uint32(
                RandomUtil.plusMinus10PercentSeeded(playerPower, indexSeed) | // power
                    (uint32(indexSeed % 4) << 24) // trait
            );
        }

        return targets;
    }

    function isTraitEffectiveAgainst(uint8 attacker, uint8 defender)
        public
        pure
        returns (bool)
    {
        return (((attacker + 1) % 4) == defender); // Thanks to Tourist
    }

    function setTopupTimerBase(uint256 timerBase) public restricted {
        topupTimerBase = timerBase;
    }

    function topupClaimTaxTimerStart(address account, uint8 level, uint256 tokensAmount) private {
        if (tokenRewards[account] == 0 && tokensAmount > 0) {
            _rewardsClaimTaxTimerStart[account] = block.timestamp;
            return;
        }
        uint256 topupTime = uint256(level).add(1).mul(topupTimerBase);
        if (_rewardsClaimTaxTimerStart[account].add(topupTime) >= block.timestamp){
            _rewardsClaimTaxTimerStart[account] = block.timestamp;
            return;
        }
        _rewardsClaimTaxTimerStart[account] = _rewardsClaimTaxTimerStart[account].add(topupTime);
    }

    function mintCharacter(address ref) public onlyNonContract oncePerBlock(msg.sender) {
        uint256 fee = characters.getCurrentMintFee(mintCharacterFee);
        uint256 bonus = 0;
        if (ref != address(0) && ref != address(msg.sender)) {
            bonus = fee.mul(cwController.bonusRate()).div(100);
            fee = fee.sub(fee.mul(cwController.discountRate()).div(100));
        }
        if(bonus > 0){
            xBlade.transfer(ref, bonus);
        }
        (, , uint256 fromUserWallet) = getXBladeToSubtract(
            0,
            tokenRewards[msg.sender],
            fee //xblade amount
        );
        require(
            xBlade.balanceOf(msg.sender) >= fromUserWallet &&
                promos.getBit(msg.sender, 4) == false
        );

        _payContractTokenOnly(
            msg.sender,
            fee
        );

        uint256 seed = randoms.getRandomSeed(msg.sender);
        characters.mint(msg.sender, seed);

        // first weapon free with a character mint, max 1 star
        if (weapons.balanceOf(msg.sender) == 0) {
            weapons.performMintWeapon(
                msg.sender,
                weapons.getRandomProperties(
                    0,
                    RandomUtil.combineSeeds(seed, 100)
                ),
                weapons.getRandomStat(4, 200, seed, 101),
                0, // stat2
                0, // stat3
                RandomUtil.combineSeeds(seed, 102)
            );
        }
    }

    function burnWeapon(uint256 burnID)
        public
        isWeaponOwner(burnID)
        requestPayFromPlayer(burnWeaponFee)
    {
        _payContract(msg.sender, burnWeaponFee);
        weapons.burn(burnID);
    }

    function burnWeapons(uint256[] memory burnIDs)
        public
        isWeaponsOwner(burnIDs)
        requestPayFromPlayer(
            burnWeaponFee.mul(ABDKMath64x64.fromUInt(burnIDs.length))
        )
    {
        _payContract(
            msg.sender,
            burnWeaponFee.mul(ABDKMath64x64.fromUInt(burnIDs.length))
        );
        for (uint256 i = 0; i < burnIDs.length; i++) {
            weapons.burn(burnIDs[i]);
        }
    }

    function reforgeWeapon(uint256 reforgeID, uint256 burnID)
        public
        isWeaponOwner(reforgeID)
        isWeaponOwner(burnID)
        requestPayFromPlayer(reforgeWeaponFee)
    {
        _payContract(msg.sender, reforgeWeaponFee);
        weapons.reforge(reforgeID, burnID);
    }

    function reforgeWeaponWithDust(
        uint256 reforgeID,
        uint8 amountLB,
        uint8 amount4B,
        uint8 amount5B
    )
        public
        isWeaponOwner(reforgeID)
        requestPayFromPlayer(reforgeWeaponWithDustFee)
    {
        _payContract(msg.sender, reforgeWeaponWithDustFee);
        weapons.reforgeWithDust(reforgeID, amountLB, amount4B, amount5B);
    }

    // function migrateRandoms(IRandoms _newRandoms) external {
    //     require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Not adm");
    //     randoms = _newRandoms;
    // }

    function usdToxBlade(int128 usdAmount) public view returns (uint256) {
        return
            PancakeUtil.usdToxBlade(
                address(pancakeRouter),
                BUSDAddress,
                address(xBlade),
                usdAmount
            );
    }

    modifier fightModifierChecks(uint256 character, uint256 weapon) {
        _onlyNonContract();
        _isCharacterOwner(character);
        _isWeaponOwner(weapon);
        _;
    }

    modifier onlyNonContract() {
        _onlyNonContract();
        _;
    }

    function _onlyNonContract() internal view {
        require(tx.origin == msg.sender);
    }

    modifier restricted() {
        _restricted();
        _;
    }

    function _restricted() internal view {
        require(hasRole(GAME_ADMIN, msg.sender), "NGA");
    }

    modifier oncePerBlock(address user) {
        _oncePerBlock(user);
        _;
    }

    function _oncePerBlock(address user) internal {
        require(lastBlockNumberCalled[user] < block.number, "OCB");
        lastBlockNumberCalled[user] = block.number;
    }

    modifier isWeaponOwner(uint256 weapon) {
        _isWeaponOwner(weapon);
        _;
    }

    function _isWeaponOwner(uint256 weapon) internal view {
        require(weapons.ownerOf(weapon) == msg.sender, "Not WPO");
    }

    modifier isWeaponsOwner(uint256[] memory weaponArray) {
        _isWeaponsOwner(weaponArray);
        _;
    }

    function _isWeaponsOwner(uint256[] memory weaponArray) internal view {
        for (uint256 i = 0; i < weaponArray.length; i++) {
            require(weapons.ownerOf(weaponArray[i]) == msg.sender, "Not WPO");
        }
    }

    modifier isCharacterOwner(uint256 character) {
        _isCharacterOwner(character);
        _;
    }

    function _isCharacterOwner(uint256 character) internal view {
        require(characters.ownerOf(character) == msg.sender, "Not CHO");
    }

    modifier requestPayFromPlayer(int128 usdAmount) {
        _requestPayFromPlayer(usdAmount);
        _;
    }

    function _requestPayFromPlayer(int128 usdAmount) internal view {
        (, , uint256 fromUserWallet) = getXBladeToSubtract(
            inGameOnlyFunds[msg.sender],
            tokenRewards[msg.sender],
            PancakeUtil.usdToxBlade(
                address(pancakeRouter),
                BUSDAddress,
                address(xBlade),
                usdAmount
            ) // xblade amount
        );

        require(xBlade.balanceOf(msg.sender) >= fromUserWallet);
    }

    function payPlayerConverted(address playerAddress, uint256 convertedAmount)
        public
        restricted
    {
        _payPlayerConverted(playerAddress, convertedAmount);
    }

    function approveContractWeaponFor(uint256 weaponID, address playerAddress)
        public
        restricted
    {
        _approveContractWeaponFor(weaponID, playerAddress);
    }

    function payContractTokenOnly(
        address playerAddress,
        uint256 convertedAmount
    ) public restricted {
        _payContractTokenOnly(playerAddress, convertedAmount);
    }

    function _payContractTokenOnly(
        address playerAddress,
        uint256 convertedAmount
    ) internal {
        (
            ,
            uint256 fromTokenRewards,
            uint256 fromUserWallet
        ) = getXBladeToSubtract(
                0,
                tokenRewards[playerAddress],
                convertedAmount
            );

        tokenRewards[playerAddress] = tokenRewards[playerAddress].sub(
            fromTokenRewards
        );
        xBlade.transferFrom(playerAddress, address(this), fromUserWallet);
    }

    function _payContract(address playerAddress, int128 usdAmount)
        internal
        returns (
            uint256 _fromInGameOnlyFunds,
            uint256 _fromTokenRewards,
            uint256 _fromUserWallet
        )
    {
        return
            _payContractConverted(
                playerAddress,
                PancakeUtil.usdToxBlade(
                    address(pancakeRouter),
                    BUSDAddress,
                    address(xBlade),
                    usdAmount
                )
            );
    }

    function _payContractConverted(
        address playerAddress,
        uint256 convertedAmount
    )
        internal
        returns (
            uint256 _fromInGameOnlyFunds,
            uint256 _fromTokenRewards,
            uint256 _fromUserWallet
        )
    {
        (
            uint256 fromInGameOnlyFunds,
            uint256 fromTokenRewards,
            uint256 fromUserWallet
        ) = getXBladeToSubtract(
                inGameOnlyFunds[playerAddress],
                tokenRewards[playerAddress],
                convertedAmount
            );

        // must use requestPayFromPlayer modifier to approve on the initial function!
        totalInGameOnlyFunds = totalInGameOnlyFunds.sub(fromInGameOnlyFunds);
        inGameOnlyFunds[playerAddress] = inGameOnlyFunds[playerAddress].sub(
            fromInGameOnlyFunds
        );

        tokenRewards[playerAddress] = tokenRewards[playerAddress].sub(
            fromTokenRewards
        );
        xBlade.transferFrom(playerAddress, address(this), fromUserWallet);

        return (fromInGameOnlyFunds, fromTokenRewards, fromUserWallet);
    }

    function _payPlayer(address playerAddress, int128 baseAmount) internal {
        _payPlayerConverted(
            playerAddress,
            PancakeUtil.usdToxBlade(
                address(pancakeRouter),
                BUSDAddress,
                address(xBlade),
                baseAmount
            )
        );
    }

    function _payPlayerConverted(address playerAddress, uint256 convertedAmount)
        internal
    {
        xBlade.safeTransfer(playerAddress, convertedAmount);
    }

    function _approveContractCharacterFor(
        uint256 characterID,
        address playerAddress
    ) internal {
        characters.approve(playerAddress, characterID);
    }

    function _approveContractWeaponFor(uint256 weaponID, address playerAddress)
        internal
    {
        weapons.approve(playerAddress, weaponID);
    }

    function setCWController(CWController _controller) public restricted {
        cwController = _controller;
    }

    function setCharacterMintValue(uint256 baseFee) public restricted {
        mintCharacterFee = baseFee;
    }

    function setFightRewardBaselineValue(uint256 tenthcents) public restricted {
        fightRewardBaseline = ABDKMath64x64.divu(tenthcents, 1000); // !!! THIS TAKES TENTH OF CENTS !!!
    }

    function setBurnWeaponValue(uint256 cents) public restricted {
        burnWeaponFee = ABDKMath64x64.divu(cents, 100);
    }

    function setReforgeWeaponValue(uint256 cents) public restricted {
        int128 newReforgeWeaponFee = ABDKMath64x64.divu(cents, 100);
        require(newReforgeWeaponFee > burnWeaponFee, "Include burn fee");
        reforgeWeaponWithDustFee = newReforgeWeaponFee - burnWeaponFee;
        reforgeWeaponFee = newReforgeWeaponFee;
    }

    function setReforgeWeaponWithDustValue(uint256 cents) public restricted {
        reforgeWeaponWithDustFee = ABDKMath64x64.divu(cents, 100);
        reforgeWeaponFee = burnWeaponFee + reforgeWeaponWithDustFee;
    }

    function setStaminaCostFight(uint8 points) public restricted {
        staminaCostFight = points;
    }

    function setDurabilityCostFight(uint8 points) public restricted {
        durabilityCostFight = points;
    }

    function setFightXpGain(uint256 average) public restricted {
        fightXpGain = average;
    }

    function setCharacterLimit(uint256 max) public restricted {
        characters.setCharacterLimit(max);
    }

    function setMinimumFightTax(uint256 tax) public restricted {
        minimumFightTax = tax;
    }

    // function setSupportFeeRate(uint8 rate) public restricted {
    //     supportFeeRate = rate;
    // }

    // function setPancakeRouter(address _pancakeRouter) public restricted {
    //     pancakeRouter = IPancakeRouter02(_pancakeRouter);
    // }

    // function setBUSDAddress(address _busdAddress) public restricted {
    //     BUSDAddress = _busdAddress;
    // }

    // function setFightRewardGasOffsetValue(uint256 cents) public restricted {
    //     fightRewardGasOffset = ABDKMath64x64.divu(cents, 100);
    // }

    function giveInGameOnlyFunds(address to, uint256 xBladeAmount)
        external
        restricted
    {
        totalInGameOnlyFunds = totalInGameOnlyFunds.add(xBladeAmount);
        inGameOnlyFunds[to] = inGameOnlyFunds[to].add(xBladeAmount);

        xBlade.safeTransferFrom(msg.sender, address(this), xBladeAmount);

        emit InGameOnlyFundsGiven(to, xBladeAmount);
    }

    function _giveInGameOnlyFundsFromContractBalance(
        address to,
        uint256 xBladeAmount
    ) internal {
        totalInGameOnlyFunds = totalInGameOnlyFunds.add(xBladeAmount);
        inGameOnlyFunds[to] = inGameOnlyFunds[to].add(xBladeAmount);

        emit InGameOnlyFundsGiven(to, xBladeAmount);
    }

    function giveInGameOnlyFundsFromContractBalance(
        address to,
        uint256 xBladeAmount
    ) external restricted {
        _giveInGameOnlyFundsFromContractBalance(to, xBladeAmount);
    }

    function claimTokenRewards() public {
        // our characters go to the tavern
        // and the barkeep pays them for the bounties
        uint256 _tokenRewards = tokenRewards[msg.sender];
        tokenRewards[msg.sender] = 0;

        uint256 _tokenRewardsToPayOut = _tokenRewards.sub(
            _getRewardsClaimTax(msg.sender).mulu(_tokenRewards)
        );

        // Tax goes to game contract itself, which would mean
        // transferring from the game contract to ...itself.
        // So we don't need to do anything with the tax part of the rewards.
        if (promos.getBit(msg.sender, 4) == false)
            _payPlayerConverted(msg.sender, _tokenRewardsToPayOut);
    }

    function stakeUnclaimedRewards() external {
        uint256 _tokenRewards = tokenRewards[msg.sender];
        tokenRewards[msg.sender] = 0;

        if (promos.getBit(msg.sender, 4) == false) {
            xBlade.approve(address(stakeFromGameImpl), _tokenRewards);
            stakeFromGameImpl.stakeFromGame(msg.sender, _tokenRewards);
        }
    }

    function claimXpRewards() public whenNotPaused {
        // our characters go to the tavern to rest
        // they meditate on what they've learned
        for (uint256 i = 0; i < characters.balanceOf(msg.sender); i++) {
            uint256 char = characters.tokenOfOwnerByIndex(msg.sender, i);
            uint256 xpRewardsToClaim = xpRewards[char];
            xpRewards[char] = 0;
            if (xpRewardsToClaim > 65535) {
                xpRewardsToClaim = 65535;
            }
            characters.gainXp(char, uint16(xpRewardsToClaim));
        }
    }

    function getTokenRewards() public view returns (uint256) {
        return tokenRewards[msg.sender];
    }

    function getXpRewards(uint256 char) public view returns (uint256) {
        return xpRewards[char];
    }

    function getTokenRewardsFor(address wallet) public view returns (uint256) {
        return tokenRewards[wallet];
    }

    function getTotalXBladeOwnedBy(address wallet)
        public
        view
        returns (uint256)
    {
        return
            inGameOnlyFunds[wallet] +
            getTokenRewardsFor(wallet) +
            xBlade.balanceOf(wallet);
    }

    function getRewardsClaimTaxTimerStart(address playerAddress)
        public
        view
        returns (uint256)
    {
        return _rewardsClaimTaxTimerStart[playerAddress];
    }

    function _getRewardsClaimTax(address playerAddress)
        internal
        view
        returns (int128)
    {
        require(_rewardsClaimTaxTimerStart[playerAddress] <= block.timestamp,"_rewardsClaimTaxTimerStart[playerAddress] > block.timestamp");

        uint256 rewardsClaimTaxTimerEnd = _rewardsClaimTaxTimerStart[
            playerAddress
        ].add(REWARDS_CLAIM_TAX_DURATION);

        (, uint256 durationUntilNoTax) = rewardsClaimTaxTimerEnd.trySub(
            block.timestamp
        );

        assert(
            0 <= durationUntilNoTax &&
                durationUntilNoTax <= REWARDS_CLAIM_TAX_DURATION
        );

        int128 frac = ABDKMath64x64.divu(
            durationUntilNoTax,
            REWARDS_CLAIM_TAX_DURATION
        );

        return REWARDS_CLAIM_TAX_MAX.mul(frac);
    }

    function getOwnRewardsClaimTax() public view returns (int128) {
        return _getRewardsClaimTax(msg.sender);
    }

    fallback() external payable {
        // React to receiving ether, to avoid bug
    }

    receive() external payable {
        // custom function code
    }

    function swapAndLiquify(uint256 char) public payable {
        require(msg.value >= getTaxByHeroLevel(char), "Tax");

        if (address(this).balance > 5 * 10**17) {
            if (xBlade.allowance(address(this), address(pancakeRouter)) == 0) {
                xBlade.approve(address(pancakeRouter), ~uint256(0));
            }
            uint256 intialBalance = address(this).balance;
            uint256 swapBalance = intialBalance.div(2);
            // 0.2 BNB
            // generate the pancake pair path of token -> weth
            PancakeUtil.swapBNBForTokens(
                address(pancakeRouter),
                address(xBlade),
                swapBalance
            );
            uint256 deltaBalance = intialBalance.sub(swapBalance);
            PancakeUtil.addLiquidityForTokens(
                address(pancakeRouter),
                address(xBlade),
                address(this),
                deltaBalance
            );
        }
    }

    function getTaxByHeroLevel(uint256 char) public view returns (uint256) {
        uint256 level = getHeroExpectedLevel(char);
        if (level < 8) {
            return minimumFightTax;
        }
        return
            minimumFightTax.add(
                minimumFightTax.mul(uint256(level)).mul(5).div(100)
            );
    }

    function getHeroExpectedLevel(uint256 char) public view returns (uint256) {
        return
            characters.getExpectedLevel(
                characters.getLevel(char),
                uint256(characters.getXp(char)).add(xpRewards[char])
            );
    }
}
