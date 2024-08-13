/**
 * @description 天空类
 */

import Rectangle from './Rectangle';

class Sky extends Rectangle {
  constructor(skyDom) {
    const skyStyle = getComputedStyle(skyDom);
    const skyWidth = parseFloat(skyStyle.width);
    const skyHeight = parseFloat(skyStyle.height);
    super(skyWidth, skyHeight, 0, 0, -100, 0, skyDom);
  }

  onMove() {
    if (this.left < -this.width / 2) {
      this.left = -80;
    }
  }
}

export default Sky;
