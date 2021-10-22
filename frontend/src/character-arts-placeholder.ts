import heroAir01 from './assets/hero/hero-air-01.png';
import heroAir02 from './assets/hero/hero-air-02.png';
import heroAir03 from './assets/hero/hero-air-03.png';
import heroAir04 from './assets/hero/hero-air-04.png';
import heroEarth01 from './assets/hero/hero-earth-01.png';
import heroEarth02 from './assets/hero/hero-earth-02.png';
import heroEarth03 from './assets/hero/hero-earth-03.png';
import heroEarth04 from './assets/hero/hero-earth-04.png';
import heroFire01 from './assets/hero/hero-fire-01.png';
import heroFire02 from './assets/hero/hero-fire-02.png';
import heroFire03 from './assets/hero/hero-fire-03.png';
import heroFire04 from './assets/hero/hero-fire-04.png';
import heroWater01 from './assets/hero/hero-water-01.png';
import heroWater02 from './assets/hero/hero-water-02.png';
import heroWater03 from './assets/hero/hero-water-03.png';
import heroWater04 from './assets/hero/hero-water-04.png';


import { ICharacter } from './interfaces';

const art = {
  Lightning: [heroAir01,heroAir02,heroAir03,heroAir04],
  Water:[heroWater01, heroWater02, heroWater03, heroWater04],
  Earth: [heroEarth01,heroEarth02,heroEarth03,heroEarth04],
  Fire: [heroFire01,heroFire02,heroFire03,heroFire04]
};

export function getCharacterArt(character: ICharacter) {
  if (!character) {
    return null;
  }

  const { traitName } = character;

  if (!['Lightning', 'Water', 'Earth', 'Fire'].includes(traitName)){
    return null;
  }
  // @ts-ignore
  return art[traitName][Number(character.id) % 4];
}
