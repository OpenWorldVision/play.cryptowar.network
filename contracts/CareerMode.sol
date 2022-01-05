pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721ReceiverUpgradeable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "abdk-libraries-solidity/ABDKMath64x64.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "abdk-libraries-solidity/ABDKMath64x64.sol";
import "./interfaces/IStakeFromGame.sol";
import "./interfaces/IRandoms.sol";

import "./characters.sol";
import "./weapons.sol";

contract CareerMode is
    IERC721ReceiverUpgradeable,
    Initializable,
    AccessControlUpgradeable
{
    using ABDKMath64x64 for int128;
    using SafeMath for uint256;
    using SafeMath for uint64;

    bytes4 private constant _INTERFACE_ID_ERC721 = 0x80ac58cd;
    bytes32 public constant GAME_ADMIN = keccak256("GAME_ADMIN");

    Characters public characters;
    Weapons public weapons;
    IERC20 public xBlade;
    IRandoms public randoms;

    struct Room {
        uint256 id;
        address owner;
        uint256 matchReward;
        uint256 totalDeposit;
        uint256 weaponId;
        uint256 characterId;
        bool claimed;
    }

    struct RequestFight {
        uint256 id;
        address requester;
        uint256 char;
        uint256 wep;
        uint16 done; // 0 - not done, 1 - done, 2 - cancel
        bool win;
    }

    Room[] careerModeRooms;

    mapping(address => uint256) tokenRewards;
    uint256 rewardClaimTax;
    uint8 durabilityCostFight;
    uint8 staminaCostFight;

    mapping(uint256 => uint256) roomTimerStart;
    mapping(uint256 => RequestFight[]) requestFightList;
    mapping(address => mapping(uint256 => uint256[])) requestFightByAddress; // requester => (roomId => requestId)
    uint256 minimumRoundDuration;
    mapping(address => uint256[]) roomsByAddress;
    mapping(address => uint256[]) participatedRoomsByAddress;
    uint256 public feeRate;

    /** EVENTS */

    event CreateCareerRoom(
        address owner,
        uint256 matchReward,
        uint256 totalDeposit,
        uint256 weaponId,
        uint256 characterId
    );

    event FightOutCome(
        address opponent,
        address roomOwner,
        uint256 opponentRoll,
        uint256 ownerRoll,
        uint256 opponentIncome
    );

    event RequestFightOutcome(
        address requester,
        uint256 roomId,
        uint256 char,
        uint256 wep
    );

    event ClaimReward(uint256 reward);

    event EndCareerRoom(uint256 id, address owner, uint256 withdrawAmount);

    function initialize(
        IERC20 _xBlade,
        Characters _characters,
        Weapons _weapons,
        IRandoms _randoms
    ) public initializer {
        __AccessControl_init();

        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(GAME_ADMIN, msg.sender);

        xBlade = _xBlade;
        characters = _characters;
        weapons = _weapons;
        randoms = _randoms;

        rewardClaimTax = 10; // 10%
        staminaCostFight = 40;
        durabilityCostFight = 3;
        minimumRoundDuration = 2 days;
        feeRate = 5; //5%
    }

    /** MODIFIERS */

    modifier restricted() {
        _restricted();
        _;
    }

    function _restricted() internal view {
        require(hasRole(GAME_ADMIN, msg.sender), "NGA");
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

    /** MUTATIVES */

    function onERC721Received(
        address, /* operator */
        address, /* from */
        uint256,
        bytes calldata /* data */
    ) external override returns (bytes4) {
        return IERC721ReceiverUpgradeable.onERC721Received.selector;
    }

    function createRoom(
        uint256 _char,
        uint256 _wep,
        uint256 _matchReward,
        uint256 _totalDeposit
    ) public isWeaponOwner(_wep) isCharacterOwner(_char) {
        require(
            _totalDeposit > _matchReward.mul(210).div(100),
            "Total deposit must be larger than 210% match reward "
        );
        require(xBlade.balanceOf(msg.sender) > _totalDeposit);

        xBlade.transferFrom(msg.sender, address(this), _totalDeposit);
        // To prevent room owner sell NFT
        IERC721(address(characters)).safeTransferFrom(
            msg.sender,
            address(this),
            _char
        );
        IERC721(address(weapons)).safeTransferFrom(
            msg.sender,
            address(this),
            _wep
        );
        roomTimerStart[careerModeRooms.length] = block.timestamp;
        uint256 roomId = careerModeRooms.length;
        roomsByAddress[msg.sender].push(roomId);
        careerModeRooms.push(
            Room(
                roomId,
                msg.sender,
                _matchReward,
                _totalDeposit,
                _wep,
                _char,
                false
            )
        );
        emit CreateCareerRoom(
            msg.sender,
            _matchReward,
            _totalDeposit,
            _wep,
            _char
        );
    }

    function requestFight(
        uint256 _roomId,
        uint256 _wep,
        uint256 _char
    ) public isWeaponOwner(_wep) isCharacterOwner(_char) {
        Room memory r = careerModeRooms[_roomId];
        require(
            xBlade.balanceOf(msg.sender) > r.matchReward,
            "Not enough xBlade to fight"
        );
        require(msg.sender != r.owner, "Cannot fight yourself");
        require(r.totalDeposit >= r.matchReward, "This career room is ended");
        xBlade.transferFrom(msg.sender, address(this), r.matchReward);

        uint256 requestId = requestFightList[_roomId].length;
        requestFightList[_roomId].push(
            RequestFight(requestId, msg.sender, _char, _wep, 0, false)
        );
        participatedRoomsByAddress[msg.sender].push(_roomId);
        requestFightByAddress[msg.sender][_roomId].push(requestId);
        emit RequestFightOutcome(msg.sender, _roomId, _char, _wep);
    }

    function fight(uint256 _roomId, uint256 _requestId) public {
        require(canFight(_roomId, _requestId), "Cannot fight");
        RequestFight memory _requestFight = requestFightList[_roomId][
            _requestId
        ];
        Room memory r = careerModeRooms[_roomId];

        performFight(
            _roomId,
            _requestId,
            getPlayerPower(r.characterId, r.weaponId),
            getPlayerPower(_requestFight.char, _requestFight.wep)
        );
    }

    function performFight(
        uint256 _roomId,
        uint256 _requestId,
        uint24 _playerPower,
        uint24 _opponentPower
    ) internal {
        RequestFight storage _requestFight = requestFightList[_roomId][
            _requestId
        ];
        _requestFight.done = 1;
        uint256 seed = randoms.getRandomSeed(_requestFight.requester);

        uint24 playerRoll = getPlayerPowerRoll(_playerPower, seed); // owner roll
        uint24 opponentRoll = getPlayerPowerRoll(_opponentPower, seed); // requester roll
        Room storage r = careerModeRooms[_roomId];

        uint256 tokensWin = r.matchReward.sub(
            r.matchReward.mul(feeRate).div(100)
        );

        _requestFight.win = opponentRoll >= playerRoll;

        if (opponentRoll <= playerRoll) {
            // Owner win
            tokenRewards[r.owner] = tokenRewards[r.owner].add(tokensWin);
        } else {
            r.totalDeposit = r.totalDeposit.sub(r.matchReward);

            tokenRewards[_requestFight.requester] = tokenRewards[
                _requestFight.requester
            ].add(tokensWin);
        }

        emit FightOutCome(
            _requestFight.requester,
            r.owner,
            opponentRoll,
            playerRoll,
            tokensWin
        );
    }

    function cancelRequestFight(uint256 _roomId, uint256 _requestId) public {
        Room storage r = careerModeRooms[_roomId];
        RequestFight storage _requestFight = requestFightList[_roomId][
            _requestId
        ];

        require(
            r.owner == msg.sender || _requestFight.requester == msg.sender,
            "Not room owner nor requester"
        );
        // Mark as this request is done
        _requestFight.done = 2;
        // Get back match reward deposit by request
        xBlade.transfer(_requestFight.requester, r.matchReward);
    }

    function claimTokenRewards() public {
        require(tokenRewards[msg.sender] > 0, "No reward");

        uint256 _tokenRewards = tokenRewards[msg.sender];
        tokenRewards[msg.sender] = 0;

        xBlade.transfer(msg.sender, _tokenRewards);
        emit ClaimReward(_tokenRewards);
    }

    function endCareer(uint256 id) public {
        require(
            block.timestamp >= roomTimerStart[id].add(minimumRoundDuration),
            "Cannot end career"
        );
        Room storage r = careerModeRooms[id];

        require(msg.sender == r.owner, "Must be owner");

        r.claimed = true;
        uint256 fee = r.totalDeposit.mul(rewardClaimTax).div(100);
        uint256 reward = r.totalDeposit.sub(fee);

        if (reward > 0) {
            xBlade.transfer(r.owner, reward);
        }
        r.totalDeposit = 0;

        IERC721(address(characters)).safeTransferFrom(
            address(this),
            r.owner,
            r.characterId
        );
        IERC721(address(weapons)).safeTransferFrom(
            address(this),
            r.owner,
            r.weaponId
        );
        emit EndCareerRoom(id, r.owner, reward);
    }

    function setFeeRate(uint256 _rate) public restricted {
        feeRate = _rate;
    }

    function setMinimumRoundDuration(uint256 _minimumRoundDuration) public restricted{
        minimumRoundDuration = _minimumRoundDuration;
    }

    /** GETTERS */

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

    function getPlayerPower(uint256 char, uint256 wep) public returns (uint24) {
        (uint8 charTrait, uint24 basePower, ) = unpackFightData(
            characters.getFightDataAndDrainStamina(char, staminaCostFight)
        );

        (
            int128 weaponMultTarget,
            int128 weaponMultiplier,
            uint24 weaponBonusPower,
            uint8 weaponTrait
        ) = weapons.getFightDataAndDrainDurability(
                wep,
                charTrait,
                durabilityCostFight
            );
        return uint24(weaponMultiplier.mulu(basePower).add(weaponBonusPower));
    }

    function getPlayerPowerRoll(uint24 playerFightPower, uint256 seed)
        internal
        pure
        returns (uint24)
    {
        return uint24(plusMinus10PercentSeeded(playerFightPower, seed));
    }

    function getRoom(uint256 _id)
        public
        view
        returns (
            address owner,
            uint256 matchReward,
            uint256 totalDeposit,
            uint256 weaponId,
            uint256 characterId
        )
    {
        Room memory r = careerModeRooms[_id];
        return (
            r.owner,
            r.matchReward,
            r.totalDeposit,
            r.weaponId,
            r.characterId
        );
    }

    function randomSeededMinMax(
        uint256 min,
        uint256 max,
        uint256 seed
    ) internal pure returns (uint256) {
        // inclusive,inclusive (don't use absolute min and max values of uint256)
        // deterministic based on seed provided
        uint256 diff = max.sub(min).add(1);
        uint256 randomVar = uint256(keccak256(abi.encodePacked(seed))).mod(
            diff
        );
        randomVar = randomVar.add(min);
        return randomVar;
    }

    function plusMinus10PercentSeeded(uint256 num, uint256 seed)
        internal
        pure
        returns (uint256)
    {
        uint256 tenPercent = num.div(10);
        return
            num.sub(tenPercent).add(
                randomSeededMinMax(0, tenPercent.mul(2), seed)
            );
    }

    function getReward(address account) public view returns (uint256) {
        return tokenRewards[account];
    }

    function canFight(uint256 id, uint256 requestId)
        public
        view
        returns (bool)
    {
        Room memory r = careerModeRooms[id];
        RequestFight memory rf = requestFightList[id][requestId];

        if (r.owner != msg.sender) {
            return false;
        }
        return
            r.totalDeposit > 0 &&
            !r.claimed &&
            weapons.ownerOf(rf.wep) == rf.requester &&
            characters.ownerOf(rf.char) == rf.requester &&
            rf.done == 0;
    }

    function totalRooms() public view returns (uint256) {
        return careerModeRooms.length;
    }

    function getStartTime(uint256 id) public view returns (uint256) {
        return roomTimerStart[id];
    }

    function getRooms(uint256 cursor) public view returns (Room[] memory) {
        uint256 length = 20;
        if (length > totalRooms() - cursor) {
            length = totalRooms() - cursor;
        }

        Room[] memory values = new Room[](length);
        for (uint256 i = 0; i < length; i++) {
            values[i] = careerModeRooms[i + cursor];
        }
        return values;
    }

    function getRequests(uint256 cursor, uint256 roomId)
        public
        view
        returns (RequestFight[] memory)
    {
        uint256 length = 20;
        if (length > requestFightList[roomId].length - cursor) {
            length = requestFightList[roomId].length - cursor;
        }
        RequestFight[] memory values = new RequestFight[](length);
        for (uint256 i = 0; i < length; i++) {
            values[i] = requestFightList[roomId][i + cursor];
        }
        return values;
    }

    function getPartipatedRequests(address account)
        public
        view
        returns (uint256[] memory)
    {
        return participatedRoomsByAddress[account];
    }

    function getRoomsByAddress(address account)
        public
        view
        returns (uint256[] memory)
    {
        return roomsByAddress[account];
    }
}
