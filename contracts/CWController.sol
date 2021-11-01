pragma solidity ^0.6.0;

import "abdk-libraries-solidity/ABDKMath64x64.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./characters.sol";
import "./weapons.sol";
import "./interfaces/IRandoms.sol";
import "./CryptoWars.sol";

contract CWController is Initializable, OwnableUpgradeable {
    using SafeMath for uint256;
    address public game;
    uint256 public reducePerMilestone;
    uint256 public maxReduce;
    uint256 public range;

    IERC20 public token;
    uint256 public discountRate;
    uint256 public bonusRate;

    function initialize() public initializer {
        OwnableUpgradeable.__Ownable_init();
        maxReduce = 4700; // 47%
        range = 700; // 7%
        reducePerMilestone = 70; // 0.07%
    }

    function setGame(address _game) public onlyOwner {
        game = _game;
    }

    function setReducePerLevel(uint256 _reduce) public onlyOwner {
        reducePerMilestone = _reduce;
    }

    function setRange(uint256 _range) public onlyOwner {
        range = _range;
    }

    function setMaxReduce(uint256 _maxReduce) public onlyOwner {
        maxReduce = _maxReduce;
    }

    function setToken(address _token) public onlyOwner {
        token = IERC20(_token);
    }

    function setDiscountRate(uint256 _rate) public onlyOwner {
        discountRate = _rate;
    }

    function setBonusRate(uint256 _rate) public onlyOwner {
        bonusRate = _rate;
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

    function combineSeeds(uint256 seed1, uint256 seed2)
        internal
        pure
        returns (uint256)
    {
        return uint256(keccak256(abi.encodePacked(seed1, seed2)));
    }

    function combineSeeds(uint256[] memory seeds)
        internal
        pure
        returns (uint256)
    {
        return uint256(keccak256(abi.encodePacked(seeds)));
    }

    function getMaxRollPerLevel(uint8 level) private view returns (uint256) {
        uint256 base = 10000; // 100%
        if (level < 8) {
            return base;
        }
        (bool success, uint256 reduce) = base.trySub(uint256(level).mul(reducePerMilestone));

        if (reduce < maxReduce || !success) {
            reduce = maxReduce;
        }
        return reduce;
    }

    function getMinRollPerLevel(uint8 level) private view returns (uint256) {
        return
            getMaxRollPerLevel(level).sub(
                getMaxRollPerLevel(level).mul(range).div(10000)
            );
    }

    function plusMinus10PercentSeeded(uint256 num, uint256 seed)
        public
        pure
        returns (uint256)
    {
        uint256 tenPercent = num.div(10);
        return
            num.sub(tenPercent).add(
                randomSeededMinMax(0, tenPercent.mul(2), seed)
            );
    }

    function plusMinus10PercentSeededWithLv(
        uint256 num,
        uint256 seed,
        uint8 level
    ) public view returns (uint256) {
        uint256 tenPercent = num.div(10);
        uint256 r = combineSeeds(seed, level);
        if (r.mod(100) < 10) {
            return
                num.sub(tenPercent).add(
                    randomSeededMinMax(0, tenPercent.mul(2), seed)
                );
        }
        uint256 min = getMinRollPerLevel(level);
        uint256 max = getMaxRollPerLevel(level);
        return
            num
                .sub(tenPercent)
                .add(randomSeededMinMax(0, tenPercent.mul(2), seed))
                .mul(randomSeededMinMax(min, max, combineSeeds(r, level)))
                .div(10000);
    }

    function uint2str(uint256 _i)
        internal
        pure
        returns (string memory _uintAsString)
    {
        if (_i == 0) {
            return "0";
        }
        uint256 j = _i;
        uint256 len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint256 k = len - 1;
        while (_i != 0) {
            bstr[k--] = bytes1(uint8(48 + (_i % 10)));
            _i /= 10;
        }
        return string(bstr);
    }
}
